const express = require('express')
const router = express.Router()
const { auth, checkPermission } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// ── Helper: get full task with assignee info ──────────────────────────────
const getTask = (id) => {
  const task = db.get(`
    SELECT t.*,
      u1.first_name || ' ' || u1.last_name as assigned_to_name,
      u2.first_name || ' ' || u2.last_name as assigned_by_name
    FROM tasks t
    LEFT JOIN users u1 ON t.assigned_to = u1.id
    LEFT JOIN users u2 ON t.assigned_by = u2.id
    WHERE t.id = ?
  `, [id])
  if (!task) return null
  task.checklist = db.all('SELECT * FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order', [id])
  task.comments = db.all(`
    SELECT tc.*, u.first_name || ' ' || u.last_name as user_name
    FROM task_comments tc LEFT JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ? ORDER BY tc.created_at
  `, [id])
  return task
}

// ── GET all tasks (with filters) ──────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, priority, module, assigned_to, search } = req.query
    let sql = `
      SELECT t.*,
        u1.first_name || ' ' || u1.last_name as assigned_to_name,
        u2.first_name || ' ' || u2.last_name as assigned_by_name,
        (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id) as checklist_total,
        (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id AND completed=1) as checklist_done
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE 1=1
    `
    const params = []
    if (status)      { sql += ' AND t.status = ?';      params.push(status) }
    if (priority)    { sql += ' AND t.priority = ?';    params.push(priority) }
    if (module)      { sql += ' AND t.module = ?';      params.push(module) }
    if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to) }
    if (search)      { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
    sql += ' ORDER BY CASE t.priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "normal" THEN 3 ELSE 4 END, t.due_date ASC, t.created_at DESC'
    res.json(db.all(sql, params))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET my tasks ───────────────────────────────────────────────────────────
router.get('/my', (req, res) => {
  try {
    const tasks = db.all(`
      SELECT t.*,
        u2.first_name || ' ' || u2.last_name as assigned_by_name,
        (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id) as checklist_total,
        (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id AND completed=1) as checklist_done
      FROM tasks t
      LEFT JOIN users u2 ON t.assigned_by = u2.id
      WHERE t.assigned_to = ? AND t.status NOT IN ('completed','cancelled')
      ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, t.due_date ASC
    `, [req.user.id])
    res.json(tasks)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET stats ──────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const stats = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN priority='urgent' AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN due_date < date('now') AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as overdue
      FROM tasks
    `)
    const myStats = db.get(`
      SELECT COUNT(*) as my_open
      FROM tasks WHERE assigned_to=? AND status NOT IN ('completed','cancelled')
    `, [req.user.id])
    res.json({ ...stats, ...myStats })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET single task ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const task = getTask(req.params.id)
    if (!task) return res.status(404).json({ error: 'Not found' })
    res.json(task)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST create task ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { title, description, assigned_to, priority, module, due_date, checklist } = req.body
    const result = db.prepare(`
      INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, status, module, due_date)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(title, description || '', assigned_to || null, req.user.id, priority || 'normal', module || null, due_date || null)

    const taskId = result.lastInsertRowid

    // Insert checklist items
    if (checklist && Array.isArray(checklist)) {
      checklist.forEach((label, i) => {
        if (label?.trim()) db.prepare('INSERT INTO task_checklist_items (task_id,label,sort_order) VALUES (?,?,?)').run(taskId, label.trim(), i)
      })
    }

    res.json(getTask(taskId))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PUT update task ────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { title, description, assigned_to, priority, status, module, due_date } = req.body
    const completed_at = status === 'completed' ? new Date().toISOString() : null
    db.prepare(`
      UPDATE tasks SET title=?, description=?, assigned_to=?, priority=?, status=?, module=?, due_date=?,
        completed_at=COALESCE(?, completed_at), updated_at=datetime('now')
      WHERE id=?
    `).run(title, description || '', assigned_to || null, priority || 'normal', status || 'open', module || null, due_date || null, completed_at, req.params.id)
    res.json(getTask(req.params.id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PATCH assign task ──────────────────────────────────────────────────────
router.patch('/:id/assign', (req, res) => {
  try {
    const { assigned_to } = req.body
    db.prepare("UPDATE tasks SET assigned_to=?, status='open', updated_at=datetime('now') WHERE id=?").run(assigned_to, req.params.id)
    res.json(getTask(req.params.id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PATCH complete task ────────────────────────────────────────────────────
router.patch('/:id/complete', (req, res) => {
  try {
    db.prepare("UPDATE tasks SET status='completed', completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(req.params.id)
    res.json(getTask(req.params.id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── PATCH status ───────────────────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body
    if (status === 'completed') {
      db.prepare("UPDATE tasks SET status=?, completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(status, req.params.id)
    } else {
      db.prepare("UPDATE tasks SET status=?, completed_at=NULL, updated_at=datetime('now') WHERE id=?").run(status, req.params.id)
    }
    res.json(getTask(req.params.id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── DELETE task ────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.run('DELETE FROM task_checklist_items WHERE task_id=?', [req.params.id])
    db.run('DELETE FROM task_comments WHERE task_id=?', [req.params.id])
    db.run('DELETE FROM tasks WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CHECKLIST: toggle item ─────────────────────────────────────────────────
router.patch('/:id/checklist/:itemId', (req, res) => {
  try {
    const { completed } = req.body
    db.prepare(`
      UPDATE task_checklist_items SET completed=?, completed_at=?, completed_by=? WHERE id=? AND task_id=?
    `).run(completed ? 1 : 0, completed ? new Date().toISOString() : null, completed ? req.user.id : null, req.params.itemId, req.params.id)
    res.json({ ok: true, checklist: db.all('SELECT * FROM task_checklist_items WHERE task_id=? ORDER BY sort_order', [req.params.id]) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CHECKLIST: add item ────────────────────────────────────────────────────
router.post('/:id/checklist', (req, res) => {
  try {
    const { label } = req.body
    const maxOrder = db.get('SELECT MAX(sort_order) as m FROM task_checklist_items WHERE task_id=?', [req.params.id])?.m || 0
    db.prepare('INSERT INTO task_checklist_items (task_id,label,sort_order) VALUES (?,?,?)').run(req.params.id, label, maxOrder + 1)
    res.json(db.all('SELECT * FROM task_checklist_items WHERE task_id=? ORDER BY sort_order', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── CHECKLIST: delete item ─────────────────────────────────────────────────
router.delete('/:id/checklist/:itemId', (req, res) => {
  try {
    db.run('DELETE FROM task_checklist_items WHERE id=? AND task_id=?', [req.params.itemId, req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── COMMENTS ──────────────────────────────────────────────────────────────
router.post('/:id/comments', (req, res) => {
  try {
    const { comment } = req.body
    db.prepare('INSERT INTO task_comments (task_id,user_id,comment) VALUES (?,?,?)').run(req.params.id, req.user.id, comment)
    res.json(getTask(req.params.id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
