const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// GET all tool life records with tool info
router.get('/', (req, res) => {
  try {
    const rows = db.all(`
      SELECT tl.*, t.name as tool_name, t.category, t.internal_id,
        t.current_quantity,
        CASE
          WHEN tl.life_limit_strokes > 0 THEN ROUND(tl.strokes_used * 100.0 / tl.life_limit_strokes, 1)
          WHEN tl.life_limit_minutes > 0 THEN ROUND(tl.minutes_used * 100.0 / tl.life_limit_minutes, 1)
          ELSE 0
        END as life_pct
      FROM tool_life tl
      JOIN tools t ON tl.tool_id = t.id
      ORDER BY life_pct DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET tool life for specific tool
router.get('/tool/:tool_id', (req, res) => {
  try {
    const life = db.get('SELECT * FROM tool_life WHERE tool_id=?', [req.params.tool_id])
    const tool = db.get('SELECT * FROM tools WHERE id=?', [req.params.tool_id])
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    const history = db.all(`
      SELECT tl.*, w.work_order_id, w.part_name, m.name as machine_name
      FROM tool_life tl
      LEFT JOIN work_orders w ON tl.work_order_id=w.id
      LEFT JOIN machines m ON tl.machine_id=m.id
      WHERE tl.tool_id=? ORDER BY tl.created_at DESC LIMIT 30`, [req.params.tool_id])
    res.json({ tool, life, history })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST create/update tool life record
router.post('/', (req, res) => {
  try {
    const { tool_id, life_limit_strokes, life_limit_minutes, notes } = req.body
    if (!tool_id) return res.status(400).json({ error: 'tool_id required' })
    const existing = db.get('SELECT * FROM tool_life WHERE tool_id=? AND work_order_id IS NULL', [tool_id])
    if (existing) {
      db.prepare(`UPDATE tool_life SET life_limit_strokes=?,life_limit_minutes=?,notes=?,updated_at=datetime('now') WHERE id=?`)
        .run(parseInt(life_limit_strokes)||0, parseFloat(life_limit_minutes)||0, notes||'', existing.id)
      res.json(db.get('SELECT * FROM tool_life WHERE id=?', [existing.id]))
    } else {
      const r = db.prepare(`INSERT INTO tool_life (tool_id,life_limit_strokes,life_limit_minutes,status,notes) VALUES (?,?,?,'ok',?)`)
        .run(tool_id, parseInt(life_limit_strokes)||0, parseFloat(life_limit_minutes)||0, notes||'')
      res.json(db.get('SELECT * FROM tool_life WHERE id=?', [r.lastInsertRowid]))
    }
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH — record tool usage (add strokes/minutes)
router.patch('/:id/use', (req, res) => {
  try {
    const { strokes, minutes, work_order_id, machine_id } = req.body
    const tl = db.get('SELECT * FROM tool_life WHERE id=?', [req.params.id])
    if (!tl) return res.status(404).json({ error: 'Not found' })
    const newStrokes = tl.strokes_used + (parseInt(strokes)||0)
    const newMins = tl.minutes_used + (parseFloat(minutes)||0)
    // Auto-calculate status
    let status = 'ok'
    if (tl.life_limit_strokes > 0) {
      const pct = newStrokes / tl.life_limit_strokes
      if (pct >= 1) status = 'replace'
      else if (pct >= 0.85) status = 'warning'
    } else if (tl.life_limit_minutes > 0) {
      const pct = newMins / tl.life_limit_minutes
      if (pct >= 1) status = 'replace'
      else if (pct >= 0.85) status = 'warning'
    }
    db.prepare(`UPDATE tool_life SET strokes_used=?,minutes_used=?,status=?,updated_at=datetime('now') WHERE id=?`)
      .run(newStrokes, newMins, status, req.params.id)
    // Auto alert if status changed
    if (status !== tl.status) {
      const tool = db.get('SELECT name FROM tools WHERE id=?', [tl.tool_id])
      const msg = status === 'replace'
        ? `Alat ${tool?.name} — ZAMJENA: dostignut životni vijek!`
        : `Alat ${tool?.name} — UPOZORENJE: 85% životnog vijeka`
      db.prepare(`INSERT INTO alerts (type,message) VALUES (?,?)`).run(status === 'replace' ? 'critical' : 'warning', msg)
    }
    res.json(db.get('SELECT * FROM tool_life WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH — sharpen/reset tool
router.patch('/:id/reset', (req, res) => {
  try {
    const { notes } = req.body
    db.prepare(`UPDATE tool_life SET strokes_used=0,minutes_used=0,status='ok',last_sharpened=datetime('now'),updated_at=datetime('now') WHERE id=?`).run(req.params.id)
    res.json(db.get('SELECT * FROM tool_life WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET tools that need attention
router.get('/alerts/pending', (req, res) => {
  try {
    const rows = db.all(`
      SELECT tl.*, t.name as tool_name, t.category,
        CASE
          WHEN tl.life_limit_strokes > 0 THEN ROUND(tl.strokes_used * 100.0 / tl.life_limit_strokes, 1)
          WHEN tl.life_limit_minutes > 0 THEN ROUND(tl.minutes_used * 100.0 / tl.life_limit_minutes, 1)
          ELSE 0
        END as life_pct
      FROM tool_life tl
      JOIN tools t ON tl.tool_id=t.id
      WHERE tl.status IN ('warning','replace')
      ORDER BY life_pct DESC`)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
