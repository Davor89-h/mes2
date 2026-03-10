const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)

router.get('/stats', (req, res) => {
  try {
    const total    = db.get('SELECT COUNT(*) as cnt FROM materials').cnt || 0
    const low      = db.get("SELECT COUNT(*) as cnt FROM materials WHERE status='Niske zalihe'").cnt || 0
    const critical = db.get("SELECT COUNT(*) as cnt FROM materials WHERE status='Kritično'").cnt || 0
    const ok       = db.get("SELECT COUNT(*) as cnt FROM materials WHERE status='Dostupan'").cnt || 0
    res.json({ total, low, critical, ok })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/', (req, res) => {
  try {
    const { status, category, search } = req.query
    let sql = 'SELECT * FROM materials WHERE 1=1'
    const p = []
    if (status)   { sql += ' AND status=?';   p.push(status) }
    if (category) { sql += ' AND category=?'; p.push(category) }
    if (search)   { sql += ' AND (name LIKE ? OR code LIKE ?)'; p.push(`%${search}%`,`%${search}%`) }
    sql += ' ORDER BY name'
    res.json(db.all(sql, p))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/', (req, res) => {
  try {
    const { code, name, category, current_quantity, min_quantity, unit, location, supplier, price, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const qty = parseFloat(current_quantity)||0, minQty = parseFloat(min_quantity)||0
    const status = qty===0?'Kritično':qty<=minQty?'Niske zalihe':'Dostupan'
    const r = db.prepare('INSERT INTO materials (code,name,category,current_quantity,min_quantity,unit,location,supplier,price,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(code,name,category,qty,minQty,unit||'kg',location,supplier,price,status,notes)
    res.json(db.prepare('SELECT * FROM materials WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', (req, res) => {
  try {
    const { name, category, current_quantity, min_quantity, unit, location, supplier, price, notes } = req.body
    const qty = parseFloat(current_quantity)||0, minQty = parseFloat(min_quantity)||0
    const status = qty===0?'Kritično':qty<=minQty?'Niske zalihe':'Dostupan'
    db.prepare('UPDATE materials SET name=?,category=?,current_quantity=?,min_quantity=?,unit=?,location=?,supplier=?,price=?,status=?,notes=? WHERE id=?').run(name,category,qty,minQty,unit,location,supplier,price,status,notes,req.params.id)
    res.json(db.prepare('SELECT * FROM materials WHERE id=?').get(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
