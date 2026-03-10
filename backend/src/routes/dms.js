const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.use(auth)

router.get('/stats', (req, res) => {
  try {
    const total    = db.get('SELECT COUNT(*) as cnt FROM documents').cnt || 0
    const active   = db.get("SELECT COUNT(*) as cnt FROM documents WHERE status='active'").cnt || 0
    const draft    = db.get("SELECT COUNT(*) as cnt FROM documents WHERE status='draft'").cnt || 0
    const expiring = db.get("SELECT COUNT(*) as cnt FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days') AND expiry_date >= date('now')").cnt || 0
    res.json({ total, active, draft, expiring })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/folders', (req, res) => {
  try {
    const rows = db.all("SELECT COALESCE(category,'Ostalo') as name, COUNT(*) as count FROM documents GROUP BY category ORDER BY count DESC")
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/expiring', (req, res) => {
  try {
    const rows = db.all("SELECT d.*, u.first_name||' '||u.last_name as uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by=u.id WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= date('now','+30 days') ORDER BY d.expiry_date")
    res.json(rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/', (req, res) => {
  try {
    const { category, status, search } = req.query
    let sql = "SELECT d.*, u.first_name||' '||u.last_name as uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by=u.id WHERE 1=1"
    const p = []
    if (category) { sql += ' AND d.category=?'; p.push(category) }
    if (status)   { sql += ' AND d.status=?';   p.push(status) }
    if (search)   { sql += ' AND (d.title LIKE ? OR d.tags LIKE ?)'; p.push(`%${search}%`,`%${search}%`) }
    sql += ' ORDER BY d.created_at DESC'
    res.json(db.all(sql, p))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.post('/', (req, res) => {
  try {
    const { title, category, version, status, description, tags, expiry_date } = req.body
    if (!title) return res.status(400).json({ error: 'Title required' })
    const r = db.prepare('INSERT INTO documents (title,category,version,status,description,tags,expiry_date,uploaded_by) VALUES (?,?,?,?,?,?,?,?)').run(title,category,version||'1.0',status||'draft',description,tags,expiry_date||null,req.user.id)
    res.json(db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', (req, res) => {
  try {
    const { title, category, version, status, description, tags, expiry_date } = req.body
    db.prepare('UPDATE documents SET title=?,category=?,version=?,status=?,description=?,tags=?,expiry_date=? WHERE id=?').run(title,category,version,status,description,tags,expiry_date||null,req.params.id)
    res.json(db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
