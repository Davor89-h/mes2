const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)


// ── Materials ──────────────────────────────────────────────────────────────
router.get('/materials', (req, res) => {
  try {
    const rows = db.all(`
      SELECT m.*, COALESCE(SUM(s.quantity),0) as total_stock
      FROM wh_materials m
      LEFT JOIN wh_stocks s ON s.material_id = m.id AND s.status != 'iskorišten'
      GROUP BY m.id ORDER BY m.name
    `)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.get('/materials/low-stock', (req, res) => {
  try {
    const rows = db.all(`
      SELECT m.*, COALESCE(SUM(s.quantity),0) as total_stock
      FROM wh_materials m
      LEFT JOIN wh_stocks s ON s.material_id = m.id AND s.status != 'iskorišten'
      GROUP BY m.id HAVING total_stock <= m.min_stock ORDER BY m.name
    `)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/materials', (req, res) => {
  try {
    const { name, type, unit, internal_id, min_stock, storage_location, supplier } = req.body
    if (!name) return res.status(400).json({ error: 'Naziv je obavezan' })
    const r = db.prepare('INSERT INTO wh_materials (name,type,unit,internal_id,min_stock,storage_location,supplier) VALUES (?,?,?,?,?,?,?)').run(
      name, type||'raw', unit||'kom', internal_id||null, parseFloat(min_stock)||0, storage_location||null, supplier||null)
    res.json(db.get('SELECT * FROM wh_materials WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.put('/materials/:id', (req, res) => {
  try {
    const { name, type, unit, min_stock, storage_location, supplier } = req.body
    db.prepare('UPDATE wh_materials SET name=?,type=?,unit=?,min_stock=?,storage_location=?,supplier=? WHERE id=?').run(
      name, type, unit, parseFloat(min_stock)||0, storage_location, supplier, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.delete('/materials/:id', (req, res) => {
  try { db.prepare('DELETE FROM wh_materials WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Stocks ─────────────────────────────────────────────────────────────────
router.get('/stocks', (req, res) => {
  try {
    const rows = db.all(`
      SELECT s.*, m.name as material_name, m.unit, w.name as warehouse_name, p.name as supplier_name
      FROM wh_stocks s
      LEFT JOIN wh_materials m ON s.material_id = m.id
      LEFT JOIN wh_warehouses w ON s.warehouse_id = w.id
      LEFT JOIN sales_partners p ON s.supplier_id = p.id
      ORDER BY s.received_at DESC
    `)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/stocks/receive', (req, res) => {
  try {
    const { material_id, warehouse_id, supplier_id, quantity, mass_kg, external_batch } = req.body
    if (!material_id || !quantity) return res.status(400).json({ error: 'Material i količina su obavezni' })
    const batch = 'B-' + Date.now().toString(36).toUpperCase()
    const r = db.prepare('INSERT INTO wh_stocks (material_id,warehouse_id,supplier_id,quantity,mass_kg,internal_batch,external_batch,status) VALUES (?,?,?,?,?,?,?,?)').run(
      material_id, warehouse_id||null, supplier_id||null, parseFloat(quantity), parseFloat(mass_kg)||null, batch, external_batch||null, 'slobodan')
    res.json(db.get('SELECT * FROM wh_stocks WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.patch('/stocks/:id/status', (req, res) => {
  try {
    db.prepare('UPDATE wh_stocks SET status=? WHERE id=?').run(req.body.status, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Warehouses ─────────────────────────────────────────────────────────────
router.get('/warehouses', (req, res) => {
  try {
    const rows = db.all(`
      SELECT w.*, COUNT(s.id) as stock_count
      FROM wh_warehouses w LEFT JOIN wh_stocks s ON s.warehouse_id = w.id
      GROUP BY w.id ORDER BY w.name
    `)
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.post('/warehouses', (req, res) => {
  try {
    const { name, type, location } = req.body
    if (!name) return res.status(400).json({ error: 'Naziv je obavezan' })
    const r = db.prepare('INSERT INTO wh_warehouses (name,type,location) VALUES (?,?,?)').run(name, type||'main', location||null)
    res.json(db.get('SELECT * FROM wh_warehouses WHERE id=?', [r.lastInsertRowid]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.put('/warehouses/:id', (req, res) => {
  try {
    const { name, type, location } = req.body
    db.prepare('UPDATE wh_warehouses SET name=?,type=?,location=? WHERE id=?').run(name, type, location, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})
router.delete('/warehouses/:id', (req, res) => {
  try { db.prepare('DELETE FROM wh_warehouses WHERE id=?').run(req.params.id); res.json({ ok:true }) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
