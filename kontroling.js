const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// ── Helper: auto-generate OEE snapshot when WO closes ──
function updateOEE(machine_id, date) {
  if (!machine_id) return
  const rec = db.get('SELECT * FROM oee_records WHERE machine_id=? AND record_date=? AND shift="A"', [machine_id, date])
  const wos = db.all(`SELECT * FROM work_orders WHERE machine_id=? AND DATE(actual_end)=? AND status IN ('completed','closed')`, [machine_id, date])
  if (!wos.length) return
  const parts_good = wos.reduce((s,w) => s + (w.quantity_done||0), 0)
  const parts_scrap = wos.reduce((s,w) => s + (w.quantity_scrap||0), 0)
  const parts_produced = parts_good + parts_scrap
  const actual_min = wos.reduce((s,w) => s + (w.actual_time_min||0), 0)
  const avail = Math.min(1, actual_min / 480)
  const target = wos.reduce((s,w) => s + (w.quantity||0), 0) || 1
  const perf = Math.min(1, parts_produced / target)
  const qual = parts_produced > 0 ? Math.min(1, parts_good / parts_produced) : 1
  const oee = Math.round(avail * perf * qual * 100) / 100
  if (rec) {
    db.prepare(`UPDATE oee_records SET parts_produced=?,parts_good=?,parts_scrap=?,availability=?,performance=?,quality=?,oee=? WHERE id=?`)
      .run(parts_produced, parts_good, parts_scrap, Math.round(avail*100)/100, Math.round(perf*100)/100, Math.round(qual*100)/100, oee, rec.id)
  } else {
    db.prepare(`INSERT INTO oee_records (machine_id,record_date,shift,planned_time_min,parts_produced,parts_target,parts_good,parts_scrap,availability,performance,quality,oee) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(machine_id, date, 'A', 480, parts_produced, target, parts_good, parts_scrap, Math.round(avail*100)/100, Math.round(perf*100)/100, Math.round(qual*100)/100, oee)
  }
}

// GET all work orders with joins
router.get('/', (req, res) => {
  try {
    const rows = db.all(`
      SELECT w.*,
        m.name as machine_name, m.machine_id as machine_code,
        u.first_name||' '||u.last_name as operator_name,
        cb.first_name||' '||cb.last_name as created_by_name
      FROM work_orders w
      LEFT JOIN machines m ON w.machine_id = m.id
      LEFT JOIN users u ON w.operator_id = u.id
      LEFT JOIN users cb ON w.created_by = cb.id
      ORDER BY
        CASE w.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        w.planned_start ASC, w.created_at DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET stats overview  ← MUST be before /:id
router.get('/stats/overview', (req, res) => {
  try {
    const byStatus = db.all('SELECT status, COUNT(*) as cnt FROM work_orders GROUP BY status')
    const stats = {}; byStatus.forEach(r => { stats[r.status] = r.cnt })
    const today = new Date().toISOString().split('T')[0]
    const overdue = db.get(`SELECT COUNT(*) as c FROM work_orders WHERE planned_end < ? AND status NOT IN ('completed','closed','cancelled')`, [today])
    const inProgress = db.all(`SELECT w.*, m.name as machine_name FROM work_orders w LEFT JOIN machines m ON w.machine_id=m.id WHERE w.status='in_progress'`)
    const completedToday = db.get(`SELECT COUNT(*) as c FROM work_orders WHERE DATE(actual_end)=? AND status='completed'`, [today])
    res.json({ ...stats, overdue: overdue.c, in_progress_list: inProgress, completed_today: completedToday.c })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET single WO with tools
router.get('/:id', (req, res) => {
  try {
    const wo = db.get(`
      SELECT w.*, m.name as machine_name, u.first_name||' '||u.last_name as operator_name
      FROM work_orders w
      LEFT JOIN machines m ON w.machine_id=m.id
      LEFT JOIN users u ON w.operator_id=u.id
      WHERE w.id=?`, [req.params.id])
    if (!wo) return res.status(404).json({ error: 'Not found' })
    const tools = db.all(`
      SELECT wt.*, t.name as tool_name, t.category, t.current_quantity, t.status as tool_status
      FROM work_order_tools wt
      JOIN tools t ON wt.tool_id=t.id
      WHERE wt.work_order_id=?`, [req.params.id])
    const logs = db.all(`
      SELECT pl.*, u.first_name||' '||u.last_name as operator_name
      FROM production_logs pl
      LEFT JOIN users u ON pl.operator_id=u.id
      WHERE pl.work_order_id=? ORDER BY pl.event_time DESC LIMIT 20`, [req.params.id])
    const costs = db.all('SELECT * FROM production_costs WHERE work_order_id=?', [req.params.id])
    res.json({ ...wo, tools, logs, costs })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST create new WO
router.post('/', (req, res) => {
  try {
    const { part_name, drawing_number, quantity, machine_id, operator_id, sales_order_id,
            kalkulacija_id, priority, material, estimated_time_min, cycle_time_sec,
            planned_start, planned_end, notes, tool_ids } = req.body
    if (!part_name) return res.status(400).json({ error: 'part_name required' })

    const wo_id = 'WO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4)
    const r = db.prepare(`
      INSERT INTO work_orders (work_order_id,part_name,drawing_number,quantity,machine_id,operator_id,
        sales_order_id,kalkulacija_id,priority,material,estimated_time_min,cycle_time_sec,
        planned_start,planned_end,notes,status,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,datetime('now'),datetime('now'))
    `).run(wo_id, part_name, drawing_number||'', parseInt(quantity)||1, machine_id||null,
           operator_id||null, sales_order_id||null, kalkulacija_id||null, priority||'normal',
           material||'', parseInt(estimated_time_min)||0, parseFloat(cycle_time_sec)||0,
           planned_start||null, planned_end||null, notes||'', req.user.id)

    const woId = r.lastInsertRowid
    // Assign tools
    if (Array.isArray(tool_ids)) {
      tool_ids.forEach((tid, i) => {
        if (tid) db.prepare('INSERT INTO work_order_tools (work_order_id,tool_id,tool_position) VALUES (?,?,?)').run(woId, tid, i+1)
      })
    }
    res.json(db.get('SELECT * FROM work_orders WHERE id=?', [woId]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT update WO
router.put('/:id', (req, res) => {
  try {
    const { part_name, drawing_number, quantity, machine_id, operator_id, priority, material,
            estimated_time_min, cycle_time_sec, planned_start, planned_end, notes,
            quantity_done, quantity_scrap } = req.body
    db.prepare(`
      UPDATE work_orders SET part_name=?,drawing_number=?,quantity=?,machine_id=?,operator_id=?,
        priority=?,material=?,estimated_time_min=?,cycle_time_sec=?,planned_start=?,planned_end=?,
        notes=?,quantity_done=COALESCE(?,quantity_done),quantity_scrap=COALESCE(?,quantity_scrap),
        updated_at=datetime('now') WHERE id=?
    `).run(part_name, drawing_number||'', parseInt(quantity)||1, machine_id||null, operator_id||null,
           priority||'normal', material||'', parseInt(estimated_time_min)||0,
           parseFloat(cycle_time_sec)||0, planned_start||null, planned_end||null, notes||'',
           quantity_done!=null ? parseInt(quantity_done) : null,
           quantity_scrap!=null ? parseInt(quantity_scrap) : null,
           req.params.id)
    res.json(db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH status transitions
router.patch('/:id/status', (req, res) => {
  try {
    const { status, notes } = req.body
    const wo = db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id])
    if (!wo) return res.status(404).json({ error: 'Not found' })

    const now = new Date().toISOString()
    let extra = {}

    if (status === 'in_progress' && !wo.actual_start) {
      extra.actual_start = now
      // Log start event
      db.prepare(`INSERT INTO production_logs (work_order_id,machine_id,operator_id,event_type,event_time,notes) VALUES (?,?,?,?,?,?)`)
        .run(wo.id, wo.machine_id, req.user.id, 'start', now, notes||'')
    }
    if ((status === 'completed' || status === 'paused') && !wo.actual_end) {
      if (status === 'completed') extra.actual_end = now
      // Calculate actual time if started
      if (wo.actual_start) {
        const diffMin = Math.round((Date.now() - new Date(wo.actual_start)) / 60000)
        extra.actual_time_min = diffMin
        db.prepare(`INSERT INTO production_logs (work_order_id,machine_id,operator_id,event_type,event_time,duration_min,notes) VALUES (?,?,?,?,?,?,?)`)
          .run(wo.id, wo.machine_id, req.user.id, status, now, diffMin, notes||'')
        if (status === 'completed') updateOEE(wo.machine_id, now.split('T')[0])
      }
    }

    db.prepare(`UPDATE work_orders SET status=?,${Object.keys(extra).map(k=>k+'=?').join(',')},updated_at=datetime('now') WHERE id=?`)
      .run(status, ...Object.values(extra), req.params.id)

    res.json(db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST log production quantity update
router.post('/:id/log', (req, res) => {
  try {
    const { quantity_produced, quantity_scrap, notes } = req.body
    const wo = db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id])
    if (!wo) return res.status(404).json({ error: 'Not found' })
    const good = parseInt(quantity_produced)||0
    const scrap = parseInt(quantity_scrap)||0
    db.prepare(`UPDATE work_orders SET quantity_done=quantity_done+?,quantity_scrap=quantity_scrap+?,updated_at=datetime('now') WHERE id=?`)
      .run(good, scrap, req.params.id)
    db.prepare(`INSERT INTO production_logs (work_order_id,machine_id,operator_id,event_type,event_time,quantity_produced,quantity_scrap,notes) VALUES (?,?,?,?,datetime('now'),?,?,?)`)
      .run(wo.id, wo.machine_id, req.user.id, 'production', good, scrap, notes||'')
    res.json(db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE WO
router.delete('/:id', (req, res) => {
  try {
    const wo = db.get('SELECT * FROM work_orders WHERE id=?', [req.params.id])
    if (!wo) return res.status(404).json({ error: 'Not found' })
    if (['in_progress'].includes(wo.status)) return res.status(400).json({ error: 'Cannot delete active WO' })
    db.prepare('DELETE FROM work_order_tools WHERE work_order_id=?').run(req.params.id)
    db.prepare('DELETE FROM production_logs WHERE work_order_id=?').run(req.params.id)
    db.prepare('DELETE FROM work_orders WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})


module.exports = router
