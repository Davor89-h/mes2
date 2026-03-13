const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/stats', auth, (req, res) => {
  const stats = db.prepare(`SELECT COUNT(*) as total,
    SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status='in_production' THEN 1 ELSE 0 END) as in_production,
    SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) as maintenance,
    SUM(CASE WHEN next_maintenance IS NOT NULL AND next_maintenance < date('now') THEN 1 ELSE 0 END) as overdue_maintenance
    FROM fixtures`).get()
  res.json(stats)
})

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`SELECT f.*, l.full_label as location_label FROM fixtures f LEFT JOIN locations l ON f.location_id=l.id ORDER BY f.created_at DESC`).all()
  res.json(rows)
})

router.post('/', auth, (req, res) => {
  const { internal_id, name, description, type, status, material, weight, dimensions, clamping_points, max_force, estimated_value, location_id, last_maintenance, next_maintenance, notes } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const iid = internal_id || 'NP-' + Date.now()
  try {
    const r = db.prepare('INSERT INTO fixtures (internal_id,name,description,type,status,material,weight,dimensions,clamping_points,max_force,estimated_value,location_id,last_maintenance,next_maintenance,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(iid,name,description,type||'manual',status||'active',material,weight,dimensions,clamping_points,max_force,estimated_value,location_id,last_maintenance,next_maintenance,notes)
    db.prepare('INSERT INTO activity_log (user_name,action,entity_type,entity_name) VALUES (?,?,?,?)').run(req.user.username,'create','fixture',name)
    res.json(db.prepare('SELECT * FROM fixtures WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', auth, (req, res) => {
  const { name, description, type, status, material, weight, dimensions, clamping_points, max_force, estimated_value, location_id, last_maintenance, next_maintenance, notes } = req.body
  db.prepare('UPDATE fixtures SET name=?,description=?,type=?,status=?,material=?,weight=?,dimensions=?,clamping_points=?,max_force=?,estimated_value=?,location_id=?,last_maintenance=?,next_maintenance=?,notes=? WHERE id=?').run(name,description,type,status,material,weight,dimensions,clamping_points,max_force,estimated_value,location_id,last_maintenance,next_maintenance,notes,req.params.id)
  res.json(db.prepare('SELECT * FROM fixtures WHERE id=?').get(req.params.id))
})

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM fixtures WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
