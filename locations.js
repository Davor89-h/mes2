const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// GET OEE overview — latest for each machine
router.get('/overview', (req, res) => {
  try {
    const machines = db.all('SELECT * FROM machines ORDER BY name')
    const result = machines.map(m => {
      const today = new Date().toISOString().split('T')[0]
      const latest = db.get('SELECT * FROM oee_records WHERE machine_id=? ORDER BY record_date DESC LIMIT 1', [m.id])
      const avg7 = db.get(`
        SELECT AVG(availability) as avg_avail, AVG(performance) as avg_perf,
               AVG(quality) as avg_qual, AVG(oee) as avg_oee,
               SUM(parts_produced) as total_parts, SUM(parts_scrap) as total_scrap
        FROM oee_records WHERE machine_id=? AND record_date >= date('now','-7 days')`, [m.id])
      const wo_active = db.get(`SELECT COUNT(*) as c FROM work_orders WHERE machine_id=? AND status='in_progress'`, [m.id])
      return {
        machine_id: m.id, machine_name: m.name, machine_code: m.machine_id, status: m.status,
        today: latest,
        avg_7days: {
          availability: Math.round((avg7?.avg_avail||0) * 100) / 100,
          performance:  Math.round((avg7?.avg_perf||0)  * 100) / 100,
          quality:      Math.round((avg7?.avg_qual||0)  * 100) / 100,
          oee:          Math.round((avg7?.avg_oee||0)   * 100) / 100,
          total_parts:  avg7?.total_parts || 0,
          total_scrap:  avg7?.total_scrap || 0,
        },
        active_work_orders: wo_active?.c || 0
      }
    })
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET OEE history for machine
router.get('/machine/:machine_id', (req, res) => {
  try {
    const { days = 30 } = req.query
    const rows = db.all(`
      SELECT * FROM oee_records WHERE machine_id=? AND record_date >= date('now','-${parseInt(days)||30} days')
      ORDER BY record_date ASC`, [req.params.machine_id])
    const machine = db.get('SELECT * FROM machines WHERE id=?', [req.params.machine_id])
    res.json({ machine, records: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET daily fleet OEE (all machines aggregated)
router.get('/fleet', (req, res) => {
  try {
    const { days = 14 } = req.query
    const rows = db.all(`
      SELECT record_date,
        ROUND(AVG(availability)*100,1) as avg_availability,
        ROUND(AVG(performance)*100,1)  as avg_performance,
        ROUND(AVG(quality)*100,1)      as avg_quality,
        ROUND(AVG(oee)*100,1)          as avg_oee,
        SUM(parts_produced)            as total_parts,
        SUM(parts_scrap)               as total_scrap,
        COUNT(DISTINCT machine_id)     as machines_count
      FROM oee_records
      WHERE record_date >= date('now','-${parseInt(days)||14} days')
      GROUP BY record_date ORDER BY record_date ASC`)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST manual OEE entry
router.post('/', (req, res) => {
  try {
    const { machine_id, record_date, shift, planned_time_min, downtime_min, downtime_reason,
            parts_produced, parts_target, parts_good, parts_scrap } = req.body
    if (!machine_id || !record_date) return res.status(400).json({ error: 'machine_id and record_date required' })

    const planned = parseInt(planned_time_min) || 480
    const downtime = parseInt(downtime_min) || 0
    const prod = parseInt(parts_produced) || 0
    const target = parseInt(parts_target) || prod || 1
    const good = parseInt(parts_good) || prod
    const scrap = parseInt(parts_scrap) || 0

    const avail = Math.min(1, Math.max(0, (planned - downtime) / planned))
    const perf  = Math.min(1, Math.max(0, prod / target))
    const qual  = prod > 0 ? Math.min(1, Math.max(0, good / prod)) : 1
    const oee   = Math.round(avail * perf * qual * 100) / 100

    // Upsert
    const existing = db.get('SELECT id FROM oee_records WHERE machine_id=? AND record_date=? AND shift=?', [machine_id, record_date, shift||'A'])
    if (existing) {
      db.prepare(`UPDATE oee_records SET planned_time_min=?,downtime_min=?,downtime_reason=?,parts_produced=?,parts_target=?,parts_good=?,parts_scrap=?,availability=?,performance=?,quality=?,oee=? WHERE id=?`)
        .run(planned, downtime, downtime_reason||'', prod, target, good, scrap, avail, perf, qual, oee, existing.id)
      return res.json(db.get('SELECT * FROM oee_records WHERE id=?', [existing.id]))
    }
    const r = db.prepare(`INSERT INTO oee_records (machine_id,record_date,shift,planned_time_min,downtime_min,downtime_reason,parts_produced,parts_target,parts_good,parts_scrap,availability,performance,quality,oee) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(machine_id, record_date, shift||'A', planned, downtime, downtime_reason||'', prod, target, good, scrap, avail, perf, qual, oee)
    res.json(db.get('SELECT * FROM oee_records WHERE id=?', [r.lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET production costs overview
router.get('/costs/overview', (req, res) => {
  try {
    const { days = 30 } = req.query
    const rows = db.all(`
      SELECT pc.cost_type, SUM(pc.total_cost) as total, COUNT(DISTINCT pc.work_order_id) as work_orders
      FROM production_costs pc
      JOIN work_orders w ON pc.work_order_id=w.id
      WHERE w.created_at >= date('now','-${parseInt(days)||30} days')
      GROUP BY pc.cost_type`)
    const byWo = db.all(`
      SELECT w.work_order_id, w.part_name, SUM(pc.total_cost) as total_cost
      FROM production_costs pc
      JOIN work_orders w ON pc.work_order_id=w.id
      WHERE w.created_at >= date('now','-${parseInt(days)||30} days')
      GROUP BY pc.work_order_id ORDER BY total_cost DESC LIMIT 10`)
    res.json({ by_type: rows, top_by_wo: byWo })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST calculate and store production costs for WO
router.post('/costs/:work_order_id', (req, res) => {
  try {
    const wo = db.get('SELECT * FROM work_orders WHERE id=?', [req.params.work_order_id])
    if (!wo) return res.status(404).json({ error: 'Work order not found' })

    const machineRatePerHour = 85  // €/h machine rate
    const operatorRatePerHour = 28 // €/h operator rate
    const materialCostPerKg = 8    // €/kg default

    db.prepare('DELETE FROM production_costs WHERE work_order_id=?').run(wo.id)
    const costs = []

    // Machine time cost
    if (wo.actual_time_min > 0) {
      const machCost = (wo.actual_time_min / 60) * machineRatePerHour
      db.prepare(`INSERT INTO production_costs (work_order_id,cost_type,description,quantity,unit_cost,total_cost) VALUES (?,?,?,?,?,?)`)
        .run(wo.id, 'machine', `Stroj — ${wo.actual_time_min} min`, wo.actual_time_min/60, machineRatePerHour, Math.round(machCost*100)/100)
      costs.push({ type: 'machine', total: machCost })
    }
    // Setup time cost
    if (wo.setup_time_min > 0) {
      const setupCost = (wo.setup_time_min / 60) * operatorRatePerHour
      db.prepare(`INSERT INTO production_costs (work_order_id,cost_type,description,quantity,unit_cost,total_cost) VALUES (?,?,?,?,?,?)`)
        .run(wo.id, 'setup', `Priprema — ${wo.setup_time_min} min`, wo.setup_time_min/60, operatorRatePerHour, Math.round(setupCost*100)/100)
      costs.push({ type: 'setup', total: setupCost })
    }
    // Tool wear cost (based on tool life consumed)
    const toolLife = db.all(`SELECT tl.* FROM tool_life tl JOIN work_order_tools wot ON tl.tool_id=wot.tool_id WHERE wot.work_order_id=?`, [wo.id])
    if (toolLife.length > 0) {
      const toolCost = toolLife.length * 12 // simplified: €12 per tool used
      db.prepare(`INSERT INTO production_costs (work_order_id,cost_type,description,quantity,unit_cost,total_cost) VALUES (?,?,?,?,?,?)`)
        .run(wo.id, 'tools', `Habanje alata — ${toolLife.length} alata`, toolLife.length, 12, toolCost)
      costs.push({ type: 'tools', total: toolCost })
    }

    const totalCost = costs.reduce((s, c) => s + c.total, 0)
    const costPerPiece = wo.quantity_done > 0 ? totalCost / wo.quantity_done : 0

    res.json({ work_order_id: wo.id, costs, total_cost: Math.round(totalCost*100)/100, cost_per_piece: Math.round(costPerPiece*100)/100 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
