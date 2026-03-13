const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

// ─── INIT EXTRA TABLES ───────────────────────────────────────────────────────
function initSalesTables() {
  db.prepare(`CREATE TABLE IF NOT EXISTS sales_rfq_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfq_id INTEGER NOT NULL,
    position_no INTEGER DEFAULT 1,
    part_name TEXT,
    drawing_number TEXT,
    material TEXT,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'kom',
    unit_price REAL,
    total_price REAL,
    delivery_weeks INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run()
  db.prepare(`CREATE TABLE IF NOT EXISTS sales_order_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    position_no INTEGER DEFAULT 1,
    part_name TEXT,
    drawing_number TEXT,
    material TEXT,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'kom',
    unit_price REAL,
    total_price REAL,
    delivery_weeks INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run()
  db.prepare(`CREATE TABLE IF NOT EXISTS sales_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT,
    entity_id INTEGER,
    action TEXT,
    description TEXT,
    user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run()
}
try { initSalesTables() } catch(e) { console.error('Sales tables init:', e.message) }

function logActivity(entity_type, entity_id, action, description, user_id) {
  try { db.prepare('INSERT INTO sales_activities (entity_type,entity_id,action,description,user_id) VALUES (?,?,?,?,?)').run(entity_type, entity_id, action, description, user_id) } catch(e) {}
}

// ─── STATS & DASHBOARD ───────────────────────────────────────────────────────
router.get('/rfqs/stats', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) as cnt FROM sales_rfqs GROUP BY status').all()
  const stats = {}; rows.forEach(r => { stats[r.status] = r.cnt })
  res.json(stats)
})
router.get('/orders/stats', auth, (req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) as cnt FROM sales_orders GROUP BY status').all()
  const stats = {}; rows.forEach(r => { stats[r.status] = r.cnt })
  const overdue = db.prepare("SELECT COUNT(*) as cnt FROM sales_orders WHERE delivery_date < date('now') AND status NOT IN ('isporučena','otkazana')").get()
  stats.kasni = overdue.cnt
  res.json(stats)
})
router.get('/invoice/stats', auth, (req, res) => {
  try {
    const total = db.prepare('SELECT COALESCE(SUM(total_amount),0) as val FROM sales_invoices').get()
    const paid = db.prepare("SELECT COALESCE(SUM(total_amount),0) as val FROM sales_invoices WHERE status='plaćena'").get()
    const overdue = db.prepare("SELECT COALESCE(SUM(total_amount),0) as val, COUNT(*) as cnt FROM sales_invoices WHERE due_date < date('now') AND status != 'plaćena'").get()
    const pending = db.prepare("SELECT COALESCE(SUM(total_amount),0) as val, COUNT(*) as cnt FROM sales_invoices WHERE status != 'plaćena'").get()
    res.json({ total: total.val, paid: paid.val, overdue_amount: overdue.val, overdue_count: overdue.cnt, pending_amount: pending.val, pending_count: pending.cnt })
  } catch(e) { res.json({ total:0, paid:0, overdue_amount:0, overdue_count:0, pending_amount:0, pending_count:0 }) }
})
router.get('/revenue/monthly', auth, (req, res) => {
  try {
    const rows = db.prepare("SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as count FROM sales_invoices WHERE created_at >= date('now', '-12 months') GROUP BY month ORDER BY month").all()
    res.json(rows)
  } catch(e) { res.json([]) }
})
router.get('/activities', auth, (req, res) => {
  try { res.json(db.prepare("SELECT a.*, u.username FROM sales_activities a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.created_at DESC LIMIT 50").all()) } catch(e) { res.json([]) }
})

// ─── PARTNERS ────────────────────────────────────────────────────────────────
router.get('/partners', auth, (req, res) => {
  const { search, type } = req.query
  let q = 'SELECT p.*, (SELECT COUNT(*) FROM sales_orders WHERE partner_id=p.id) as order_count, (SELECT COALESCE(SUM(i.total_amount),0) FROM sales_invoices i WHERE i.partner_id=p.id) as total_revenue FROM sales_partners p'
  const params = []; const where = []
  if (search) { where.push('(p.name LIKE ? OR p.oib LIKE ? OR p.contact_email LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`) }
  if (type) { where.push('p.type=?'); params.push(type) }
  if (where.length) q += ' WHERE ' + where.join(' AND ')
  res.json(db.prepare(q + ' ORDER BY p.name').all(...params))
})
router.post('/partners', auth, (req, res) => {
  const { name, type, oib, country, address, payment_terms, contact_name, contact_email, contact_phone } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const r = db.prepare('INSERT INTO sales_partners (name,type,oib,country,address,payment_terms,contact_name,contact_email,contact_phone) VALUES (?,?,?,?,?,?,?,?,?)').run(name, type||'customer', oib, country||'Hrvatska', address, payment_terms||30, contact_name, contact_email, contact_phone)
  logActivity('partner', r.lastInsertRowid, 'create', `Partner "${name}" kreiran`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_partners WHERE id=?').get(r.lastInsertRowid))
})
router.put('/partners/:id', auth, (req, res) => {
  const { name, type, oib, country, address, payment_terms, contact_name, contact_email, contact_phone } = req.body
  db.prepare('UPDATE sales_partners SET name=COALESCE(?,name),type=COALESCE(?,type),oib=COALESCE(?,oib),country=COALESCE(?,country),address=COALESCE(?,address),payment_terms=COALESCE(?,payment_terms),contact_name=COALESCE(?,contact_name),contact_email=COALESCE(?,contact_email),contact_phone=COALESCE(?,contact_phone) WHERE id=?').run(name,type,oib,country,address,payment_terms,contact_name,contact_email,contact_phone,req.params.id)
  res.json(db.prepare('SELECT * FROM sales_partners WHERE id=?').get(req.params.id))
})
router.delete('/partners/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sales_partners WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ─── RFQs ────────────────────────────────────────────────────────────────────
router.get('/rfqs', auth, (req, res) => {
  const { search, status, partner_id } = req.query
  let q = `SELECT r.*, p.name as partner_name,
    (SELECT COUNT(*) FROM sales_rfq_positions WHERE rfq_id=r.id) as position_count,
    (SELECT COALESCE(SUM(total_price),0) FROM sales_rfq_positions WHERE rfq_id=r.id) as total_value
    FROM sales_rfqs r LEFT JOIN sales_partners p ON r.partner_id=p.id`
  const params = []; const where = []
  if (search) { where.push('(r.internal_id LIKE ? OR p.name LIKE ? OR r.customer_rfq_id LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`) }
  if (status) { where.push('r.status=?'); params.push(status) }
  if (partner_id) { where.push('r.partner_id=?'); params.push(partner_id) }
  if (where.length) q += ' WHERE ' + where.join(' AND ')
  res.json(db.prepare(q + ' ORDER BY r.created_at DESC').all(...params))
})
router.get('/rfqs/:id', auth, (req, res) => {
  const rfq = db.prepare('SELECT r.*, p.name as partner_name FROM sales_rfqs r LEFT JOIN sales_partners p ON r.partner_id=p.id WHERE r.id=?').get(req.params.id)
  if (!rfq) return res.status(404).json({ error: 'Not found' })
  rfq.positions = db.prepare('SELECT * FROM sales_rfq_positions WHERE rfq_id=? ORDER BY position_no').all(req.params.id)
  res.json(rfq)
})
router.post('/rfqs', auth, (req, res) => {
  const { partner_id, customer_rfq_id, deadline, notes, positions } = req.body
  const iid = 'RFQ-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5)
  const r = db.prepare('INSERT INTO sales_rfqs (internal_id,partner_id,customer_rfq_id,deadline,notes,created_by) VALUES (?,?,?,?,?,?)').run(iid, partner_id, customer_rfq_id, deadline, notes, req.user.id)
  const rfqId = r.lastInsertRowid
  if (positions && positions.length) {
    const ins = db.prepare('INSERT INTO sales_rfq_positions (rfq_id,position_no,part_name,drawing_number,material,quantity,unit,unit_price,total_price,delivery_weeks,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    positions.forEach((p, i) => ins.run(rfqId, i+1, p.part_name, p.drawing_number, p.material, p.quantity||1, p.unit||'kom', p.unit_price||0, (parseFloat(p.quantity)||1)*(parseFloat(p.unit_price)||0), p.delivery_weeks, p.notes))
  }
  logActivity('rfq', rfqId, 'create', `RFQ "${iid}" kreiran`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(rfqId))
})
router.put('/rfqs/:id', auth, (req, res) => {
  const { status, deadline, notes } = req.body
  const old = db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(req.params.id)
  db.prepare('UPDATE sales_rfqs SET status=COALESCE(?,status), deadline=COALESCE(?,deadline), notes=COALESCE(?,notes) WHERE id=?').run(status, deadline, notes, req.params.id)
  if (status && status !== old?.status) logActivity('rfq', req.params.id, 'status', `Status: ${old?.status} → ${status}`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(req.params.id))
})
router.delete('/rfqs/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sales_rfq_positions WHERE rfq_id=?').run(req.params.id)
  db.prepare('DELETE FROM sales_rfqs WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})
router.post('/rfqs/:id/positions', auth, (req, res) => {
  const { part_name, drawing_number, material, quantity, unit, unit_price, delivery_weeks, notes } = req.body
  const count = db.prepare('SELECT COUNT(*) as cnt FROM sales_rfq_positions WHERE rfq_id=?').get(req.params.id)
  const total = (parseFloat(quantity)||1) * (parseFloat(unit_price)||0)
  const r = db.prepare('INSERT INTO sales_rfq_positions (rfq_id,position_no,part_name,drawing_number,material,quantity,unit,unit_price,total_price,delivery_weeks,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(req.params.id, count.cnt+1, part_name, drawing_number, material, quantity||1, unit||'kom', unit_price||0, total, delivery_weeks, notes)
  res.json(db.prepare('SELECT * FROM sales_rfq_positions WHERE id=?').get(r.lastInsertRowid))
})
router.put('/rfqs/:id/positions/:pid', auth, (req, res) => {
  const { part_name, drawing_number, material, quantity, unit, unit_price, delivery_weeks, notes } = req.body
  const total = (parseFloat(quantity)||1) * (parseFloat(unit_price)||0)
  db.prepare('UPDATE sales_rfq_positions SET part_name=COALESCE(?,part_name),drawing_number=COALESCE(?,drawing_number),material=COALESCE(?,material),quantity=COALESCE(?,quantity),unit=COALESCE(?,unit),unit_price=COALESCE(?,unit_price),total_price=?,delivery_weeks=COALESCE(?,delivery_weeks),notes=COALESCE(?,notes) WHERE id=?').run(part_name,drawing_number,material,quantity,unit,unit_price,total,delivery_weeks,notes,req.params.pid)
  res.json(db.prepare('SELECT * FROM sales_rfq_positions WHERE id=?').get(req.params.pid))
})
router.delete('/rfqs/:id/positions/:pid', auth, (req, res) => {
  db.prepare('DELETE FROM sales_rfq_positions WHERE id=?').run(req.params.pid)
  res.json({ ok: true })
})
router.post('/rfqs/:id/convert', auth, (req, res) => {
  const { customer_order_id, delivery_date, notes: extraNotes } = req.body
  const rfq = db.prepare('SELECT * FROM sales_rfqs WHERE id=?').get(req.params.id)
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' })
  const positions = db.prepare('SELECT * FROM sales_rfq_positions WHERE rfq_id=?').all(req.params.id)
  const totalValue = positions.reduce((s, p) => s + (p.total_price || 0), 0)
  const iid = 'NO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5)
  const r = db.prepare('INSERT INTO sales_orders (internal_id,partner_id,rfq_id,customer_order_id,delivery_date,total_value,notes,created_by) VALUES (?,?,?,?,?,?,?,?)').run(iid, rfq.partner_id, rfq.id, customer_order_id, delivery_date || rfq.deadline, totalValue, extraNotes || rfq.notes, req.user.id)
  const orderId = r.lastInsertRowid
  const insPos = db.prepare('INSERT INTO sales_order_positions (order_id,position_no,part_name,drawing_number,material,quantity,unit,unit_price,total_price,delivery_weeks,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  positions.forEach(p => insPos.run(orderId, p.position_no, p.part_name, p.drawing_number, p.material, p.quantity, p.unit, p.unit_price, p.total_price, p.delivery_weeks, p.notes))
  db.prepare("UPDATE sales_rfqs SET status='narudžba' WHERE id=?").run(rfq.id)
  logActivity('rfq', rfq.id, 'convert', `Konvertiran u narudžbu ${iid}`, req.user.id)
  logActivity('order', orderId, 'create', `Kreiran iz RFQ ${rfq.internal_id}`, req.user.id)
  res.json({ order: db.prepare('SELECT * FROM sales_orders WHERE id=?').get(orderId) })
})

// ─── ORDERS ──────────────────────────────────────────────────────────────────
router.get('/orders', auth, (req, res) => {
  const { search, status, partner_id } = req.query
  let q = `SELECT o.*, p.name as partner_name,
    (SELECT COUNT(*) FROM sales_order_positions WHERE order_id=o.id) as position_count
    FROM sales_orders o LEFT JOIN sales_partners p ON o.partner_id=p.id`
  const params = []; const where = []
  if (search) { where.push('(o.internal_id LIKE ? OR p.name LIKE ? OR o.customer_order_id LIKE ?)'); params.push(`%${search}%`,`%${search}%`,`%${search}%`) }
  if (status) { where.push('o.status=?'); params.push(status) }
  if (partner_id) { where.push('o.partner_id=?'); params.push(partner_id) }
  if (where.length) q += ' WHERE ' + where.join(' AND ')
  res.json(db.prepare(q + ' ORDER BY o.created_at DESC').all(...params))
})
router.get('/orders/:id', auth, (req, res) => {
  const order = db.prepare('SELECT o.*, p.name as partner_name, p.contact_email, p.contact_phone, p.payment_terms FROM sales_orders o LEFT JOIN sales_partners p ON o.partner_id=p.id WHERE o.id=?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  order.positions = db.prepare('SELECT * FROM sales_order_positions WHERE order_id=? ORDER BY position_no').all(req.params.id)
  order.invoices = db.prepare('SELECT * FROM sales_invoices WHERE order_id=?').all(req.params.id)
  res.json(order)
})
router.post('/orders', auth, (req, res) => {
  const { partner_id, customer_order_id, delivery_date, notes, positions } = req.body
  const iid = 'NO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5)
  let totalValue = 0
  if (positions) totalValue = positions.reduce((s, p) => s + ((parseFloat(p.quantity)||1)*(parseFloat(p.unit_price)||0)), 0)
  const r = db.prepare('INSERT INTO sales_orders (internal_id,partner_id,customer_order_id,delivery_date,total_value,notes,created_by) VALUES (?,?,?,?,?,?,?)').run(iid, partner_id, customer_order_id, delivery_date, totalValue, notes, req.user.id)
  const orderId = r.lastInsertRowid
  if (positions && positions.length) {
    const ins = db.prepare('INSERT INTO sales_order_positions (order_id,position_no,part_name,drawing_number,material,quantity,unit,unit_price,total_price,delivery_weeks,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    positions.forEach((p, i) => ins.run(orderId, i+1, p.part_name, p.drawing_number, p.material, p.quantity||1, p.unit||'kom', p.unit_price||0, (parseFloat(p.quantity)||1)*(parseFloat(p.unit_price)||0), p.delivery_weeks, p.notes))
  }
  logActivity('order', orderId, 'create', `Narudžba "${iid}" kreirana`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_orders WHERE id=?').get(orderId))
})
router.put('/orders/:id', auth, (req, res) => {
  const { status, delivery_date, notes, total_value } = req.body
  const old = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id)
  db.prepare('UPDATE sales_orders SET status=COALESCE(?,status), delivery_date=COALESCE(?,delivery_date), notes=COALESCE(?,notes), total_value=COALESCE(?,total_value) WHERE id=?').run(status, delivery_date, notes, total_value, req.params.id)
  if (status && status !== old?.status) logActivity('order', req.params.id, 'status', `Status: ${old?.status} → ${status}`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id))
})
router.delete('/orders/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sales_order_positions WHERE order_id=?').run(req.params.id)
  db.prepare('DELETE FROM sales_orders WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ─── INVOICES ────────────────────────────────────────────────────────────────
router.get('/invoices', auth, (req, res) => {
  const { search, status, partner_id } = req.query
  let q = `SELECT i.*, p.name as partner_name, o.internal_id as order_ref FROM sales_invoices i LEFT JOIN sales_partners p ON i.partner_id=p.id LEFT JOIN sales_orders o ON i.order_id=o.id`
  const params = []; const where = []
  if (search) { where.push('(i.invoice_number LIKE ? OR p.name LIKE ?)'); params.push(`%${search}%`,`%${search}%`) }
  if (status) { where.push('i.status=?'); params.push(status) }
  if (partner_id) { where.push('i.partner_id=?'); params.push(partner_id) }
  if (where.length) q += ' WHERE ' + where.join(' AND ')
  res.json(db.prepare(q + ' ORDER BY i.created_at DESC').all(...params))
})
router.post('/invoices', auth, (req, res) => {
  const { order_id, partner_id: pid, amount, vat_rate, due_date, notes } = req.body
  const order = order_id ? db.prepare('SELECT * FROM sales_orders WHERE id=?').get(order_id) : null
  const partner_id = pid || order?.partner_id
  const vat = parseFloat(vat_rate) || 25
  const total = parseFloat(amount || 0) * (1 + vat / 100)
  const year = new Date().getFullYear()
  const count = db.prepare('SELECT COUNT(*) as cnt FROM sales_invoices WHERE invoice_number LIKE ?').get(`RAC-${year}-%`)
  const num = `RAC-${year}-${String((count?.cnt || 0) + 1).padStart(4, '0')}`
  const r = db.prepare('INSERT INTO sales_invoices (invoice_number,order_id,partner_id,amount,vat_rate,total_amount,due_date,notes) VALUES (?,?,?,?,?,?,?,?)').run(num, order_id, partner_id, amount, vat, total.toFixed(2), due_date, notes)
  logActivity('invoice', r.lastInsertRowid, 'create', `Faktura "${num}" kreirana`, req.user.id)
  res.json(db.prepare('SELECT * FROM sales_invoices WHERE id=?').get(r.lastInsertRowid))
})
router.put('/invoices/:id', auth, (req, res) => {
  const { status, due_date, notes } = req.body
  db.prepare('UPDATE sales_invoices SET status=COALESCE(?,status), due_date=COALESCE(?,due_date), notes=COALESCE(?,notes) WHERE id=?').run(status, due_date, notes, req.params.id)
  res.json(db.prepare('SELECT * FROM sales_invoices WHERE id=?').get(req.params.id))
})
router.put('/invoices/:id/paid', auth, (req, res) => {
  db.prepare("UPDATE sales_invoices SET status='plaćena', paid_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id)
  const inv = db.prepare('SELECT * FROM sales_invoices WHERE id=?').get(req.params.id)
  logActivity('invoice', req.params.id, 'paid', `Faktura ${inv?.invoice_number} plaćena`, req.user.id)
  res.json({ ok: true })
})
router.delete('/invoices/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sales_invoices WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
