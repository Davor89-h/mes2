const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)

router.get('/stats', (req, res) => {
  try {
    const total    = db.get('SELECT COUNT(*) as cnt FROM clamping_devices').cnt || 0
    const low      = db.get("SELECT COUNT(*) as cnt FROM clamping_devices WHERE status='Niske zalihe'").cnt || 0
    const critical = db.get("SELECT COUNT(*) as cnt FROM clamping_devices WHERE status='Kritično'").cnt || 0
    const ok       = db.get("SELECT COUNT(*) as cnt FROM clamping_devices WHERE status='Dostupan'").cnt || 0
    res.json({ total, low, critical, ok })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/', (req, res) => {
  try { res.json(db.all('SELECT * FROM clamping_devices ORDER BY name')) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/', (req, res) => {
  try {
    const { internal_id, name, type, current_quantity, min_quantity, location, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const qty = parseInt(current_quantity)||0, minQty = parseInt(min_quantity)||0
    const status = qty===0?'Kritično':qty<=minQty?'Niske zalihe':'Dostupan'
    const r = db.prepare('INSERT INTO clamping_devices (internal_id,name,type,current_quantity,min_quantity,location,status,notes) VALUES (?,?,?,?,?,?,?,?)').run(internal_id,name,type,qty,minQty,location,status,notes)
    res.json(db.prepare('SELECT * FROM clamping_devices WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', (req, res) => {
  try {
    const { name, type, current_quantity, min_quantity, location, notes } = req.body
    const qty = parseInt(current_quantity)||0, minQty = parseInt(min_quantity)||0
    const status = qty===0?'Kritično':qty<=minQty?'Niske zalihe':'Dostupan'
    db.prepare('UPDATE clamping_devices SET name=?,type=?,current_quantity=?,min_quantity=?,location=?,status=?,notes=? WHERE id=?').run(name,type,qty,minQty,location,status,notes,req.params.id)
    res.json(db.prepare('SELECT * FROM clamping_devices WHERE id=?').get(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM clamping_devices WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
