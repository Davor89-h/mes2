const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT m.*, l.full_label as location_label FROM machines m LEFT JOIN locations l ON m.location_id=l.id ORDER BY m.name').all())
})

router.post('/', auth, (req, res) => {
  const { machine_id, name, manufacturer, type, table_size, max_load, location_id, notes } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const mid = machine_id || 'STR-' + Date.now()
  const r = db.prepare('INSERT INTO machines (machine_id,name,manufacturer,type,table_size,max_load,location_id,notes) VALUES (?,?,?,?,?,?,?,?)').run(mid,name,manufacturer,type,table_size,max_load,location_id,notes)
  res.json(db.prepare('SELECT * FROM machines WHERE id=?').get(r.lastInsertRowid))
})

router.put('/:id', auth, (req, res) => {
  const { name, manufacturer, type, table_size, max_load, location_id, status, notes } = req.body
  db.prepare('UPDATE machines SET name=?,manufacturer=?,type=?,table_size=?,max_load=?,location_id=?,status=?,notes=? WHERE id=?').run(name,manufacturer,type,table_size,max_load,location_id,status||'idle',notes,req.params.id)
  res.json(db.prepare('SELECT * FROM machines WHERE id=?').get(req.params.id))
})

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM machines WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// Telemetry
router.get('/:id/telemetry', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM machine_telemetry WHERE machine_id=? ORDER BY recorded_at DESC LIMIT 100').all(req.params.id)
  res.json(rows)
})

router.post('/:id/telemetry', auth, (req, res) => {
  const { temperature, spindle_speed, feed_rate, vibration, power_kw, status } = req.body
  const r = db.prepare('INSERT INTO machine_telemetry (machine_id,temperature,spindle_speed,feed_rate,vibration,power_kw,status) VALUES (?,?,?,?,?,?,?)').run(req.params.id,temperature,spindle_speed,feed_rate,vibration,power_kw,status||'running')
  res.json({ id: r.lastInsertRowid })
})

module.exports = router
