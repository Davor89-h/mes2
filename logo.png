const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)

// ─── GET all forms (with filters) ────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, type } = req.query
    let sql = `
      SELECT f.*,
        u1.first_name || ' ' || u1.last_name AS submitter_name,
        u2.first_name || ' ' || u2.last_name AS assigned_name
      FROM form_requests f
      LEFT JOIN users u1 ON f.requested_by = u1.id
      LEFT JOIN users u2 ON f.assigned_to  = u2.id
      WHERE 1=1
    `
    const params = []
    if (status) { sql += ' AND f.status = ?'; params.push(status) }
    if (type)   { sql += ' AND f.form_type = ?'; params.push(type) }
    sql += ' ORDER BY f.created_at DESC'

    const forms = db.all(sql, params)
    res.json({ forms })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── GET stats ────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const stats = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('submitted','draft') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as reviewing,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
      FROM form_requests
    `)
    res.json(stats)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── GET single form ──────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const form = db.get(`
      SELECT f.*,
        u1.first_name || ' ' || u1.last_name AS submitter_name,
        u2.first_name || ' ' || u2.last_name AS assigned_name
      FROM form_requests f
      LEFT JOIN users u1 ON f.requested_by = u1.id
      LEFT JOIN users u2 ON f.assigned_to  = u2.id
      WHERE f.id = ?
    `, [req.params.id])
    if (!form) return res.status(404).json({ error: 'Not found' })
    res.json(form)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── POST create form ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { type, title, description, priority } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Naslov je obavezan' })

    const result = db.prepare(`
      INSERT INTO form_requests (form_type, title, description, status, priority, requested_by, submitted_at)
      VALUES (?, ?, ?, 'submitted', ?, ?, datetime('now'))
    `).run(type || 'custom', title.trim(), description || '', priority || 'normal', req.user.id)

    const form = db.get(`
      SELECT f.*, u.first_name || ' ' || u.last_name AS submitter_name
      FROM form_requests f LEFT JOIN users u ON f.requested_by = u.id
      WHERE f.id = ?
    `, [result.lastInsertRowid])
    res.json(form)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── PATCH update status (approve / reject / review) ─────────────────────────
router.patch('/:id/status', (req, res) => {
  try {
    const { status, review_notes } = req.body
    const valid = ['draft','submitted','under_review','approved','rejected','completed']
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const resolved_at = ['completed','rejected'].includes(status) ? "datetime('now')" : 'NULL'
    db.run(
      `UPDATE form_requests SET status=?, review_notes=COALESCE(?,review_notes), resolved_at=${resolved_at} WHERE id=?`,
      [status, review_notes || null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── PUT update form (edit) ───────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { title, description, priority, assigned_to } = req.body
    db.prepare(`
      UPDATE form_requests SET title=?, description=?, priority=?, assigned_to=? WHERE id=?
    `).run(title, description || '', priority || 'normal', assigned_to || null, req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM form_requests WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
