const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)

// ─── Employees ────────────────────────────────────────────────────────────────
router.get('/employees', (req, res) => {
  try { res.json(db.all('SELECT * FROM employees WHERE active=1 ORDER BY last_name,first_name')) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/employees', (req, res) => {
  try {
    const { first_name, last_name, department, position, employment_type, start_date } = req.body
    const code = 'EMP-' + String(Date.now()).slice(-5)
    const r = db.prepare('INSERT INTO employees (employee_code,first_name,last_name,department,position,employment_type,start_date) VALUES (?,?,?,?,?,?,?)').run(code,first_name,last_name,department,position,employment_type||'full_time',start_date)
    res.json(db.prepare('SELECT * FROM employees WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/employees/:id', (req, res) => {
  try {
    const { first_name, last_name, department, position, employment_type } = req.body
    db.prepare('UPDATE employees SET first_name=?,last_name=?,department=?,position=?,employment_type=? WHERE id=?').run(first_name,last_name,department,position,employment_type,req.params.id)
    res.json(db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/employees/:id', (req, res) => {
  try {
    db.prepare('UPDATE employees SET active=0 WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ─── Attendance ───────────────────────────────────────────────────────────────
// /attendance/today  - must be before /attendance/:date
router.get('/attendance/today', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    res.json(db.all("SELECT a.*, e.first_name||' '||e.last_name as employee_name FROM attendance a JOIN employees e ON a.employee_id=e.id WHERE a.date=? ORDER BY e.last_name", [today]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/attendance', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]
    res.json(db.all("SELECT a.*, e.first_name||' '||e.last_name as employee_name FROM attendance a JOIN employees e ON a.employee_id=e.id WHERE a.date=? ORDER BY e.last_name", [date]))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/attendance', (req, res) => {
  try {
    const { employee_id, date, check_in, check_out, status } = req.body
    db.prepare('INSERT OR REPLACE INTO attendance (employee_id,date,check_in,check_out,status) VALUES (?,?,?,?,?)').run(employee_id,date||new Date().toISOString().split('T')[0],check_in,check_out,status||'present')
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/attendance/checkin', (req, res) => {
  try {
    const { employee_id } = req.body
    const today = new Date().toISOString().split('T')[0]
    const now   = new Date().toTimeString().slice(0,5)
    db.prepare('INSERT OR REPLACE INTO attendance (employee_id,date,check_in,status) VALUES (?,?,?,?)').run(employee_id,today,now,'present')
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/attendance/checkout', (req, res) => {
  try {
    const { employee_id } = req.body
    const today = new Date().toISOString().split('T')[0]
    const now   = new Date().toTimeString().slice(0,5)
    db.prepare("UPDATE attendance SET check_out=? WHERE employee_id=? AND date=?").run(now,employee_id,today)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ─── Leaves ───────────────────────────────────────────────────────────────────
router.get('/leaves/all', (req, res) => {
  try {
    res.json(db.all("SELECT l.*, e.first_name||' '||e.last_name as employee_name FROM leave_requests l JOIN employees e ON l.employee_id=e.id ORDER BY l.created_at DESC"))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/leaves', (req, res) => {
  try {
    res.json(db.all("SELECT l.*, e.first_name||' '||e.last_name as employee_name FROM leave_requests l JOIN employees e ON l.employee_id=e.id ORDER BY l.created_at DESC"))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/leaves', (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, notes } = req.body
    const r = db.prepare('INSERT INTO leave_requests (employee_id,leave_type,start_date,end_date,notes) VALUES (?,?,?,?,?)').run(employee_id,leave_type||'annual',start_date,end_date,notes)
    res.json(db.prepare('SELECT * FROM leave_requests WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.patch('/leaves/:id', (req, res) => {
  try {
    db.prepare('UPDATE leave_requests SET status=? WHERE id=?').run(req.body.status, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ─── Trainings (stub table - safe fallback) ───────────────────────────────────
router.get('/trainings/all', (req, res) => {
  try {
    // Try trainings table; if not exists return empty array
    const rows = db.all('SELECT * FROM trainings ORDER BY created_at DESC')
    res.json(rows)
  } catch(e) { res.json([]) }
})

router.post('/trainings', (req, res) => {
  try {
    const { employee_id, title, date, status, notes } = req.body
    const r = db.prepare('INSERT INTO trainings (employee_id,title,date,status,notes) VALUES (?,?,?,?,?)').run(employee_id,title,date,status||'scheduled',notes)
    res.json(db.prepare('SELECT * FROM trainings WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const total         = db.get('SELECT COUNT(*) as cnt FROM employees WHERE active=1').cnt || 0
    const present       = db.get("SELECT COUNT(*) as cnt FROM attendance WHERE date=? AND status='present'", [today]).cnt || 0
    const pending_leaves= db.get("SELECT COUNT(*) as cnt FROM leave_requests WHERE status='pending'").cnt || 0
    const on_leave      = db.get("SELECT COUNT(*) as cnt FROM leave_requests WHERE status='approved' AND start_date<=? AND end_date>=?", [today,today]).cnt || 0
    res.json({ total_employees: total, present_today: present, pending_leaves, on_leave })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
