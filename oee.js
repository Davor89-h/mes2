const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`SELECT u.*, f.name as fixture_name, f.internal_id as fixture_internal_id,
    m.name as machine_name, op.first_name||' '||op.last_name as operator_name
    FROM fixture_usage u
    LEFT JOIN fixtures f ON u.fixture_id=f.id
    LEFT JOIN machines m ON u.machine_id=m.id
    LEFT JOIN users op ON u.operator_id=op.id
    ORDER BY u.checked_out_at DESC LIMIT 200`).all()
  res.json(rows)
})

router.post('/checkout', auth, (req, res) => {
  const { fixture_id, machine_id, work_order, notes } = req.body
  if (!fixture_id) return res.status(400).json({ error: 'fixture_id required' })
  db.prepare('UPDATE fixtures SET status="in_production" WHERE id=?').run(fixture_id)
  const r = db.prepare('INSERT INTO fixture_usage (fixture_id,machine_id,operator_id,work_order,notes) VALUES (?,?,?,?,?)').run(fixture_id,machine_id,req.user.id,work_order,notes)
  res.json(db.prepare('SELECT * FROM fixture_usage WHERE id=?').get(r.lastInsertRowid))
})

router.patch('/:id/return', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM fixture_usage WHERE id=?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Not found' })
  db.prepare('UPDATE fixture_usage SET status="returned", returned_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id)
  db.prepare('UPDATE fixtures SET status="active" WHERE id=?').run(u.fixture_id)
  res.json({ ok: true })
})

module.exports = router
