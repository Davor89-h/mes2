const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)


// ── Tools CRUD ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { search, category, low_stock } = req.query
    let sql = 'SELECT * FROM tools WHERE 1=1'
    const p = []
    if (search) { sql += ' AND (name LIKE ? OR code LIKE ?)'; p.push(`%${search}%`,`%${search}%`) }
    if (category) { sql += ' AND category=?'; p.push(category) }
    if (low_stock === '1') sql += ' AND current_quantity <= min_quantity'
    sql += ' ORDER BY name'
    res.json(db.all(sql, p))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/stats', (req, res) => {
  try {
    const s = db.get(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN current_quantity<=min_quantity THEN 1 ELSE 0 END) as low_stock,
      SUM(CASE WHEN status='dostupan' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status='u_upotrebi' THEN 1 ELSE 0 END) as in_use
      FROM tools`)
    res.json(s)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/orders', (req, res) => {
  try { res.json(db.all('SELECT o.*, t.name as tool_name_ref FROM tool_orders o LEFT JOIN tools t ON o.tool_id=t.id ORDER BY o.created_at DESC')) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/orders', (req, res) => {
  try {
    const { tool_id, tool_name, quantity, supplier, notes } = req.body
    const r = db.prepare('INSERT INTO tool_orders (tool_id,tool_name,quantity,supplier,notes,created_by) VALUES (?,?,?,?,?,?)').run(
      tool_id||null, tool_name||null, parseInt(quantity)||1, supplier||null, notes||null, req.user.id)
    res.json(db.get('SELECT * FROM tool_orders WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.patch('/orders/:id', (req, res) => {
  try { db.prepare('UPDATE tool_orders SET status=? WHERE id=?').run(req.body.status, req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/calibration-due', (req, res) => {
  try {
    const soon = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10)
    const rows = db.all(`
      SELECT t.*, c.next_date as calibration_due
      FROM tools t
      JOIN tool_calibrations c ON c.tool_id = t.id
      WHERE c.next_date <= ? AND c.next_date = (SELECT MAX(c2.next_date) FROM tool_calibrations c2 WHERE c2.tool_id=t.id)
      ORDER BY c.next_date
    `, [soon])
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/alert-critical', (req, res) => {
  try {
    const critical = db.all('SELECT * FROM tools WHERE current_quantity <= min_quantity ORDER BY name')
    res.json({ ok: true, count: critical.length, tools: critical })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/', (req, res) => {
  try {
    const { name, code, category, description, unit, current_quantity, min_quantity, location, supplier, unit_price } = req.body
    if (!name) return res.status(400).json({ error: 'Naziv je obavezan' })
    const r = db.prepare('INSERT INTO tools (name,code,category,description,unit,current_quantity,min_quantity,location,supplier,unit_price) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      name, code||null, category||null, description||null, unit||'kom',
      parseFloat(current_quantity)||0, parseFloat(min_quantity)||0, location||null, supplier||null, parseFloat(unit_price)||0)
    res.json(db.get('SELECT * FROM tools WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', (req, res) => {
  try {
    const t = db.get('SELECT * FROM tools WHERE id=?', [req.params.id])
    if (!t) return res.status(404).json({ error: 'Not found' })
    res.json(t)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', (req, res) => {
  try {
    const { name, code, category, description, unit, current_quantity, min_quantity, location, supplier, unit_price, status } = req.body
    db.prepare('UPDATE tools SET name=?,code=?,category=?,description=?,unit=?,current_quantity=?,min_quantity=?,location=?,supplier=?,unit_price=?,status=? WHERE id=?').run(
      name, code, category, description, unit||'kom',
      parseFloat(current_quantity)||0, parseFloat(min_quantity)||0,
      location, supplier, parseFloat(unit_price)||0, status||'dostupan', req.params.id)
    res.json(db.get('SELECT * FROM tools WHERE id=?', [req.params.id]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/qty', (req, res) => {
  try {
    const tool = db.get('SELECT * FROM tools WHERE id=?', [req.params.id])
    if (!tool) return res.status(404).json({ error: 'Not found' })
    const newQty = Math.max(0, (tool.current_quantity||0) + (parseFloat(req.body.change)||0))
    db.prepare('UPDATE tools SET current_quantity=? WHERE id=?').run(newQty, req.params.id)
    if (req.body.change) db.prepare('INSERT INTO tool_history (tool_id,action,quantity_change,notes,user_id) VALUES (?,?,?,?,?)').run(
      req.params.id, parseFloat(req.body.change)>0?'stock_in':'stock_out', parseFloat(req.body.change), req.body.note||null, req.user.id)
    res.json(db.get('SELECT * FROM tools WHERE id=?', [req.params.id]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id/quantity', (req, res) => {
  try {
    const tool = db.get('SELECT * FROM tools WHERE id=?', [req.params.id])
    if (!tool) return res.status(404).json({ error: 'Not found' })
    const newQty = Math.max(0, (tool.current_quantity||0) + (parseFloat(req.body.change)||0))
    db.prepare('UPDATE tools SET current_quantity=? WHERE id=?').run(newQty, req.params.id)
    if (req.body.change) db.prepare('INSERT INTO tool_history (tool_id,action,quantity_change,notes,user_id) VALUES (?,?,?,?,?)').run(
      req.params.id, parseFloat(req.body.change)>0?'stock_in':'stock_out', parseFloat(req.body.change), req.body.note||null, req.user.id)
    res.json(db.get('SELECT * FROM tools WHERE id=?', [req.params.id]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id/history', (req, res) => {
  try { res.json(db.all('SELECT h.*, u.first_name||" "||u.last_name as user_name FROM tool_history h LEFT JOIN users u ON h.user_id=u.id WHERE h.tool_id=? ORDER BY h.recorded_at DESC', [req.params.id])) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id/calibration', (req, res) => {
  try { res.json(db.all('SELECT * FROM tool_calibrations WHERE tool_id=? ORDER BY calibration_date DESC', [req.params.id])) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/calibration', (req, res) => {
  try {
    const { calibration_date, next_date, performed_by, result, notes } = req.body
    const r = db.prepare('INSERT INTO tool_calibrations (tool_id,calibration_date,next_date,performed_by,result,notes) VALUES (?,?,?,?,?,?)').run(
      req.params.id, calibration_date, next_date||null, performed_by||null, result||'ok', notes||null)
    res.json(db.get('SELECT * FROM tool_calibrations WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id/usage', (req, res) => {
  try { res.json(db.all('SELECT u.*, usr.first_name||" "||usr.last_name as user_name FROM tool_usage_log u LEFT JOIN users usr ON u.used_by=usr.id WHERE u.tool_id=? ORDER BY u.used_at DESC', [req.params.id])) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/:id/usage', (req, res) => {
  try {
    const { order_id, quantity_used, operation, notes } = req.body
    const r = db.prepare('INSERT INTO tool_usage_log (tool_id,order_id,quantity_used,operation,notes,used_by) VALUES (?,?,?,?,?,?)').run(
      req.params.id, order_id||null, parseFloat(quantity_used)||1, operation||null, notes||null, req.user.id)
    res.json(db.get('SELECT * FROM tool_usage_log WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', (req, res) => {
  try { db.prepare('DELETE FROM tools WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
