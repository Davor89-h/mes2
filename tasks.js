const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT m.*, mc.name as machine_name, u.first_name||" "||u.last_name as assigned_name FROM maintenance_orders m LEFT JOIN machines mc ON m.machine_id=mc.id LEFT JOIN users u ON m.assigned_to=u.id ORDER BY m.created_at DESC').all()
  res.json(rows)
})
router.post('/', auth, (req, res) => {
  const { machine_id, type, priority, title, description, scheduled_date } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })
  const r = db.prepare('INSERT INTO maintenance_orders (machine_id,type,priority,title,description,scheduled_date) VALUES (?,?,?,?,?,?)').run(machine_id,type||'preventive',priority||'normal',title,description,scheduled_date)
  res.json(db.prepare('SELECT * FROM maintenance_orders WHERE id=?').get(r.lastInsertRowid))
})
router.put('/:id', auth, (req, res) => {
  const { status, priority, assigned_to, notes, downtime_minutes } = req.body
  const completed = status==='completed' ? new Date().toISOString() : null
  db.prepare('UPDATE maintenance_orders SET status=?,priority=?,assigned_to=?,notes=?,downtime_minutes=?,completed_at=COALESCE(?,completed_at) WHERE id=?').run(status,priority,assigned_to,notes,downtime_minutes,completed,req.params.id)
  res.json(db.prepare('SELECT * FROM maintenance_orders WHERE id=?').get(req.params.id))
})
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM maintenance_orders WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
