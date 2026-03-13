const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/stats', auth, (req, res) => {
  try {
    const tools = db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status="Dostupan" THEN 1 ELSE 0 END) as available, SUM(CASE WHEN current_quantity<=min_quantity AND current_quantity>0 THEN 1 ELSE 0 END) as low, SUM(CASE WHEN current_quantity=0 THEN 1 ELSE 0 END) as critical FROM tools')
    const orders = { active: 0, late: 0 }
    const alerts = db.all('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20')
    const activity = db.all('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10')

    // Task stats
    const taskStats = db.get(`
      SELECT
        SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as open_tasks,
        SUM(CASE WHEN assigned_to=? AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as my_tasks,
        SUM(CASE WHEN priority='urgent' AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as urgent_tasks,
        SUM(CASE WHEN due_date < date('now') AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
    `, [req.user.id]) || {}

    // Machine status summary
    const machines = db.get("SELECT COUNT(*) as total, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running, SUM(CASE WHEN status='idle' THEN 1 ELSE 0 END) as idle, SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) as maintenance FROM machines") || {}

    // Work order summary
    const workOrders = db.get("SELECT COUNT(*) as total, SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress, SUM(CASE WHEN status='planned' THEN 1 ELSE 0 END) as planned FROM work_orders") || {}

    res.json({ tools, orders, clamping: { total: 0, critical: 0 }, alerts, activity, taskStats, machines, workOrders })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/alerts/:id/read', auth, (req, res) => {
  db.prepare('UPDATE alerts SET is_read=1 WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/alerts/read-all', auth, (req, res) => {
  db.prepare('UPDATE alerts SET is_read=1').run()
  res.json({ ok: true })
})

module.exports = router
