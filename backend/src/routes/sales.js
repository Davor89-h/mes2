const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

// Stats
router.get('/rfqs/stats', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) as cnt FROM sales_rfqs GROUP BY status').all()
  const stats = {}
  rows.forEach(r => { stats[r.status] = r.cnt })
  res.json(stats)
})

router.get('/orders/stats', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) as cnt FROM sales_orders GROUP BY status').all()
  const stats = {}
  rows.forEach(r => { stats[r.status] = r.cnt })
  const overdue = db.prepare("SELECT COUNT(*) as cnt FROM sales_orders WHERE delivery_date < date('now') AND status NOT IN ('isporučena','otkazana')").get()
  stats.kasni = overdue.cnt
  res.json(stats)
})

// Partners
router.get('/partners', auth, (req, res) => {
  const partners = db.prepare('SELECT p.*, (SELECT COUNT(*) FROM sales_orders WHERE partner_id=p.id) as order_count FROM sales_partners p ORDER BY name').all()
  res.json(partners)
})
router.post('/partners', auth, (req, res) => {
  const { name, type, oib, country, address, payment_terms, contact_name, contact_email, contact_phone } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const r = db.prepare('INSERT INTO sales_partners (name,type,oib,country,address,payment_terms,contact_name,contact_email,contact_phone) VALUES (?,?,?,?,?,?,?,?,?)').run(name,type||'customer',oib,country||'Hrvatska',address,payment_terms||30,contact_name,contact_email,contact_phone)
  res.json(db.prepare('SELECT * FROM sales_partners WHERE id=?').get(r.lastInsertRowid))
})
router.put('/partners/:id', auth, (req, res) => {
  const { name, type, oib, country, address, payment_terms } = req.body
  db.prepare('UPDATE sales_partners SET name=?,type=?,oib=?,country=?,address=?,payment_terms=? WHERE id=?').run(name,type,oib,country,address,payment_terms,req.params.id)
  res.json(db.prepare('SELECT * FROM sales_partners WHERE id=?').get(req.params.id))
})
router.delete('/partners/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sales_partners WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// RFQs
router.get('/rfqs', auth, (req, res) => {
  const rows = db.prepare('SELECT r.*, p.name as partner_name FROM sales_rfqs r LEFT JOIN sales_partners p ON r.partner_id=p.id ORDER BY r.created_at DESC').all()
  res.json(rows)
})
router.post('/rfqs', auth, (req, res) => {
  const { partner_id, customer_rfq_id, deadline, notes } = req.body
  const iid = 'RFQ-' + Date.now()
  const r = db.prepare('INSERT INTO sales_rfqs (internal_id,partner_id,customer_rfq_id,deadline,notes,created_by) VALUES (?,?,?,?,?,?)').run(iid,partner_id,customer_rfq_id,deadline,notes,req.user.id)
  res.json(db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(r.lastInsertRowid))
})
router.put('/rfqs/:id', auth, (req, res) => {
  const { status, deadline, notes } = req.body
  db.prepare('UPDATE sales_rfqs SET status=COALESCE(?,status), deadline=COALESCE(?,deadline), notes=COALESCE(?,notes) WHERE id=?').run(status,deadline,notes,req.params.id)
  res.json(db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(req.params.id))
})

// Orders
router.get('/orders', auth, (req, res) => {
  const rows = db.prepare('SELECT o.*, p.name as partner_name FROM sales_orders o LEFT JOIN sales_partners p ON o.partner_id=p.id ORDER BY o.created_at DESC').all()
  res.json(rows)
})
router.post('/orders', auth, (req, res) => {
  const { partner_id, customer_order_id, delivery_date, notes } = req.body
  const iid = 'NO-' + Date.now()
  const r = db.prepare('INSERT INTO sales_orders (internal_id,partner_id,customer_order_id,delivery_date,notes,created_by) VALUES (?,?,?,?,?,?)').run(iid,partner_id,customer_order_id,delivery_date,notes,req.user.id)
  res.json(db.prepare('SELECT * FROM sales_orders WHERE id=?').get(r.lastInsertRowid))
})
router.put('/orders/:id', auth, (req, res) => {
  const { status, delivery_date, notes } = req.body
  db.prepare('UPDATE sales_orders SET status=COALESCE(?,status), delivery_date=COALESCE(?,delivery_date), notes=COALESCE(?,notes) WHERE id=?').run(status,delivery_date,notes,req.params.id)
  res.json(db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id))
})

// Invoices
router.get('/invoices', auth, (req, res) => {
  const rows = db.prepare('SELECT i.*, p.name as partner_name FROM sales_invoices i LEFT JOIN sales_partners p ON i.partner_id=p.id ORDER BY i.created_at DESC').all()
  res.json(rows)
})
router.post('/invoices', auth, (req, res) => {
  const { order_id, amount, vat_rate, due_date } = req.body
  const order = order_id ? db.prepare('SELECT * FROM sales_orders WHERE id=?').get(order_id) : null
  const partner_id = order?.partner_id
  const vat = parseFloat(vat_rate)||25
  const total = parseFloat(amount||0) * (1 + vat/100)
  const num = 'RAC-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4)
  const r = db.prepare('INSERT INTO sales_invoices (invoice_number,order_id,partner_id,amount,vat_rate,total_amount,due_date) VALUES (?,?,?,?,?,?,?)').run(num,order_id,partner_id,amount,vat,total.toFixed(2),due_date)
  res.json(db.prepare('SELECT * FROM sales_invoices WHERE id=?').get(r.lastInsertRowid))
})
router.put('/invoices/:id/paid', auth, (req, res) => {
  db.prepare("UPDATE sales_invoices SET status='plaćena', paid_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
