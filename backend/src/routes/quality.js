const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)


// ── Inspections ────────────────────────────────────────────────────────────
router.get('/inspections', (req, res) => {
  try {
    const rows = db.all(`
      SELECT i.*, u.first_name||' '||u.last_name as inspector_name, p.name as protocol_name
      FROM quality_inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN quality_protocols p ON i.protocol_id = p.id
      ORDER BY i.created_at DESC
    `)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/inspections', (req, res) => {
  try {
    const { work_order_ref, project_name, type, protocol_id, notes } = req.body
    const r = db.prepare(`INSERT INTO quality_inspections (work_order_ref,project_name,type,inspector_id,protocol_id,result,notes) VALUES (?,?,?,?,?,?,?)`
    ).run(work_order_ref||null, project_name||null, type||'završna', req.user.id, protocol_id||null, 'na_čekanju', notes||null)
    res.json(db.get('SELECT * FROM quality_inspections WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.put('/inspections/:id/result', (req, res) => {
  try {
    const { result } = req.body
    db.prepare('UPDATE quality_inspections SET result=? WHERE id=?').run(result, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.delete('/inspections/:id', (req, res) => {
  try { db.prepare('DELETE FROM quality_inspections WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Protocols ──────────────────────────────────────────────────────────────
router.get('/protocols', (req, res) => {
  try { res.json(db.all('SELECT * FROM quality_protocols ORDER BY name')) }
  catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/protocols', (req, res) => {
  try {
    const { name, version, project_name } = req.body
    if (!name) return res.status(400).json({ error: 'Naziv je obavezan' })
    const r = db.prepare('INSERT INTO quality_protocols (name,version,project_name,created_by) VALUES (?,?,?,?)').run(name, version||'1.0', project_name||null, req.user.id)
    res.json(db.get('SELECT * FROM quality_protocols WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.put('/protocols/:id', (req, res) => {
  try {
    const { name, version, status } = req.body
    db.prepare('UPDATE quality_protocols SET name=?,version=?,status=? WHERE id=?').run(name, version, status, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.delete('/protocols/:id', (req, res) => {
  try { db.prepare('DELETE FROM quality_protocols WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Instruments ────────────────────────────────────────────────────────────
router.get('/instruments', (req, res) => {
  try {
    const now = new Date().toISOString().slice(0,10)
    const soon = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10)
    const rows = db.all('SELECT *, (next_calibration IS NOT NULL AND next_calibration <= ?) as calibration_due_soon FROM quality_instruments ORDER BY name', [soon])
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/instruments', (req, res) => {
  try {
    const { name, type, serial_number, manufacturer, storage_location, last_calibration, next_calibration } = req.body
    if (!name) return res.status(400).json({ error: 'Naziv je obavezan' })
    const r = db.prepare(`INSERT INTO quality_instruments (name,type,serial_number,manufacturer,storage_location,last_calibration,next_calibration) VALUES (?,?,?,?,?,?,?)`
    ).run(name, type||null, serial_number||null, manufacturer||null, storage_location||null, last_calibration||null, next_calibration||null)
    res.json(db.get('SELECT * FROM quality_instruments WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.put('/instruments/:id', (req, res) => {
  try {
    const { name, type, serial_number, storage_location, last_calibration, next_calibration, status } = req.body
    db.prepare('UPDATE quality_instruments SET name=?,type=?,serial_number=?,storage_location=?,last_calibration=?,next_calibration=?,status=? WHERE id=?'
    ).run(name, type, serial_number, storage_location, last_calibration, next_calibration, status||'aktivan', req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.delete('/instruments/:id', (req, res) => {
  try { db.prepare('DELETE FROM quality_instruments WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const ago30 = new Date(Date.now()-30*24*60*60*1000).toISOString()
    const soon  = new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10)
    const s = db.get(`SELECT
      SUM(CASE WHEN result='odobreno' AND created_at>? THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN result='odbijeno' AND created_at>? THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN result='na_čekanju' THEN 1 ELSE 0 END) as pending
      FROM quality_inspections`, [ago30, ago30])
    const cal = db.get('SELECT COUNT(*) as calibrations_due FROM quality_instruments WHERE next_calibration IS NOT NULL AND next_calibration <= ?', [soon])
    res.json({ ...s, calibrations_due: cal.calibrations_due, nok_week: 0 })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── NOK analysis ───────────────────────────────────────────────────────────
router.get('/nok-analysis', (req, res) => {
  try { res.json([]) } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
