const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// GET full schedule board
router.get('/schedule', (req, res) => {
  try {
    const { from, to } = req.query
    const dateFrom = from || new Date().toISOString().split('T')[0]
    const dateTo   = to   || new Date(Date.now()+14*86400000).toISOString().split('T')[0]
    const rows = db.all(`
      SELECT ps.*,
        w.work_order_id, w.part_name, w.quantity, w.quantity_done, w.status as wo_status,
        w.priority, w.material, w.cycle_time_sec,
        m.name as machine_name, m.machine_id as machine_code, m.status as machine_status,
        u.first_name||' '||u.last_name as operator_name
      FROM production_schedule ps
      JOIN work_orders w ON ps.work_order_id=w.id
      JOIN machines m ON ps.machine_id=m.id
      LEFT JOIN users u ON w.operator_id=u.id
      WHERE ps.scheduled_start >= ? AND ps.scheduled_start <= ?
      ORDER BY ps.scheduled_start ASC, ps.priority DESC`, [dateFrom, dateTo])
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET machine load for a date range
router.get('/machine-load', (req, res) => {
  try {
    const { from, to } = req.query
    const dateFrom = from || new Date().toISOString().split('T')[0]
    const dateTo   = to   || new Date(Date.now()+14*86400000).toISOString().split('T')[0]
    const machines = db.all("SELECT * FROM machines WHERE status != 'fault'")
    const result = machines.map(m => {
      const scheduled = db.all(`
        SELECT ps.*, w.work_order_id, w.part_name, w.quantity, w.status as wo_status, w.priority
        FROM production_schedule ps
        JOIN work_orders w ON ps.work_order_id=w.id
        WHERE ps.machine_id=? AND ps.scheduled_start >= ? AND ps.scheduled_start <= ?
        ORDER BY ps.scheduled_start`, [m.id, dateFrom, dateTo])
      const totalMin = scheduled.reduce((s, r) => {
        const start = new Date(r.scheduled_start)
        const end = new Date(r.scheduled_end)
        return s + (end - start) / 60000
      }, 0)
      const daysInRange = Math.max(1, (new Date(dateTo) - new Date(dateFrom)) / 86400000)
      const availableMin = daysInRange * 480 // 8h per day
      return {
        machine: m, scheduled_jobs: scheduled,
        total_scheduled_min: Math.round(totalMin),
        available_min: Math.round(availableMin),
        load_pct: Math.min(100, Math.round(totalMin / availableMin * 100))
      }
    })
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET unscheduled work orders (queue)
router.get('/queue', (req, res) => {
  try {
    const rows = db.all(`
      SELECT w.*, m.name as machine_name,
        (SELECT COUNT(*) FROM production_schedule WHERE work_order_id=w.id) as scheduled
      FROM work_orders w
      LEFT JOIN machines m ON w.machine_id=m.id
      WHERE w.status IN ('draft','planned')
      ORDER BY CASE w.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
               w.planned_start ASC`)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST add/update schedule entry
router.post('/schedule', (req, res) => {
  try {
    const { work_order_id, machine_id, scheduled_start, scheduled_end, priority, notes } = req.body
    if (!work_order_id || !machine_id || !scheduled_start || !scheduled_end)
      return res.status(400).json({ error: 'work_order_id, machine_id, scheduled_start, scheduled_end required' })

    // Conflict detection
    const conflicts = db.all(`
      SELECT ps.*, w.work_order_id as wo_code, w.part_name
      FROM production_schedule ps
      JOIN work_orders w ON ps.work_order_id=w.id
      WHERE ps.machine_id=? AND ps.status != 'cancelled'
        AND ps.work_order_id != ?
        AND ps.scheduled_start < ? AND ps.scheduled_end > ?`,
      [machine_id, work_order_id, scheduled_end, scheduled_start])

    const r = db.prepare(`INSERT OR REPLACE INTO production_schedule (work_order_id,machine_id,scheduled_start,scheduled_end,status,priority,notes) VALUES (?,?,?,?,'planned',?,?)`)
      .run(work_order_id, machine_id, scheduled_start, scheduled_end, priority||50, notes||'')

    // Update WO status to planned
    db.prepare("UPDATE work_orders SET status='planned', updated_at=datetime('now') WHERE id=? AND status='draft'")
      .run(work_order_id)

    res.json({
      schedule: db.get('SELECT * FROM production_schedule WHERE id=?', [r.lastInsertRowid]),
      conflicts: conflicts
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH update schedule entry status
router.patch('/schedule/:id', (req, res) => {
  try {
    const { status, notes } = req.body
    db.prepare('UPDATE production_schedule SET status=?,notes=COALESCE(?,notes) WHERE id=?')
      .run(status, notes||null, req.params.id)
    res.json(db.get('SELECT * FROM production_schedule WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE schedule entry
router.delete('/schedule/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM production_schedule WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST auto-schedule: assign pending WOs to available machines
router.post('/auto-schedule', (req, res) => {
  try {
    const pendingWOs = db.all(`
      SELECT * FROM work_orders WHERE status IN ('draft','planned') AND machine_id IS NOT NULL
      ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
               planned_start ASC LIMIT 20`)
    const machines = db.all("SELECT * FROM machines WHERE status NOT IN ('fault','maintenance')")
    const scheduled = []
    const today = new Date()

    pendingWOs.forEach((wo, i) => {
      const machine = machines.find(m => m.id === wo.machine_id) || machines[i % machines.length]
      if (!machine) return
      const startDate = wo.planned_start || new Date(today.getTime() + i*86400000).toISOString().split('T')[0]
      const estHours = (wo.estimated_time_min || 120) / 60
      const startDt = new Date(startDate + 'T08:00:00')
      const endDt   = new Date(startDt.getTime() + estHours * 3600000)

      const existing = db.get('SELECT id FROM production_schedule WHERE work_order_id=?', [wo.id])
      if (!existing) {
        db.prepare(`INSERT INTO production_schedule (work_order_id,machine_id,scheduled_start,scheduled_end,status,priority) VALUES (?,?,?,?,'planned',?)`)
          .run(wo.id, machine.id, startDt.toISOString(), endDt.toISOString(), 50-i)
        db.prepare("UPDATE work_orders SET status='planned',updated_at=datetime('now') WHERE id=? AND status='draft'").run(wo.id)
        scheduled.push({ wo: wo.work_order_id, machine: machine.name })
      }
    })
    res.json({ scheduled_count: scheduled.length, items: scheduled })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
