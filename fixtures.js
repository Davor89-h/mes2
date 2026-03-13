/**
 * DEER MES — Digital Twin Route
 * Real-time factory simulation based on live DB data.
 * No external APIs — fully offline.
 */

'use strict'

const router = require('express').Router()
const db     = require('../db')
const { auth } = require('../middleware/auth')

// ─── Helper: compute health score 0-100 ────────────────────────────────────
function healthScore(oee, downtime, openMaint) {
  let s = oee ?? 70
  s -= Math.min(30, (downtime / 480) * 30) // penalize downtime
  s -= Math.min(20, openMaint * 5)          // penalize open maintenance
  return Math.max(0, Math.round(s))
}

// ─── Helper: utilization color ─────────────────────────────────────────────
function utilizationStatus(pct) {
  if (pct >= 85) return 'optimal'
  if (pct >= 60) return 'normal'
  if (pct >= 30) return 'underutilized'
  return 'idle'
}

// ─── GET /api/digital-twin ─────────────────────────────────────────────────
// Returns live factory snapshot for the twin dashboard
router.get('/', auth, (req, res) => {
  try {
    const machines = db.all(`
      SELECT m.*, l.full_label as location_label,
        (SELECT COUNT(*) FROM maintenance_orders WHERE machine_id=m.id AND status NOT IN ('completed','closed')) as open_maint,
        (SELECT MAX(recorded_at) FROM machine_telemetry WHERE machine_id=m.id) as last_telemetry
      FROM machines m
      LEFT JOIN locations l ON m.location_id=l.id
      ORDER BY m.id
    `)

    // OEE last 7 days per machine
    const oeeData = db.all(`
      SELECT machine_id,
        ROUND(AVG(oee)*100)/100           as avg_oee,
        ROUND(AVG(availability)*100)/100  as avg_avail,
        ROUND(AVG(performance)*100)/100   as avg_perf,
        ROUND(AVG(quality)*100)/100       as avg_qual,
        SUM(downtime_min)                 as total_downtime,
        SUM(parts_produced)               as total_parts,
        SUM(parts_scrap)                  as total_scrap,
        COUNT(*)                          as records
      FROM oee_records
      WHERE record_date >= date('now','-7 days')
      GROUP BY machine_id
    `)
    const oeeMap = {}
    oeeData.forEach(o => { oeeMap[o.machine_id] = o })

    // Latest telemetry per machine
    const telemetry = db.all(`
      SELECT t1.*
      FROM machine_telemetry t1
      INNER JOIN (
        SELECT machine_id, MAX(recorded_at) as max_ts
        FROM machine_telemetry
        GROUP BY machine_id
      ) t2 ON t1.machine_id=t2.machine_id AND t1.recorded_at=t2.max_ts
    `)
    const telMap = {}
    telemetry.forEach(t => { telMap[t.machine_id] = t })

    // Active work orders per machine
    const activeWO = db.all(`
      SELECT machine_id, COUNT(*) as cnt,
        SUM(CASE WHEN priority='urgent' THEN 1 ELSE 0 END) as urgent_cnt,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress_cnt
      FROM work_orders
      WHERE status NOT IN ('completed','closed','cancelled')
      GROUP BY machine_id
    `)
    const woMap = {}
    activeWO.forEach(w => { woMap[w.machine_id] = w })

    // Build machine twin objects
    const twinMachines = machines.map(m => {
      const oee = oeeMap[m.id]
      const tel = telMap[m.id]
      const wo  = woMap[m.id]

      const oeeVal       = oee?.avg_oee    ?? null
      const availVal     = oee?.avg_avail  ?? null
      const perfVal      = oee?.avg_perf   ?? null
      const qualVal      = oee?.avg_qual   ?? null
      const downtime     = oee?.total_downtime ?? 0
      const openMaint    = m.open_maint ?? 0
      const health       = healthScore(oeeVal, downtime, openMaint)
      const utilPct      = availVal ? Math.round(availVal * 100) : (m.status === 'running' ? 75 : m.status === 'idle' ? 20 : 0)

      return {
        id:               m.id,
        machine_id:       m.machine_id,
        name:             m.name,
        type:             m.type,
        manufacturer:     m.manufacturer,
        location:         m.location_label,
        status:           m.status || 'idle',
        health_score:     health,
        utilization_pct:  utilPct,
        utilization_status: utilizationStatus(utilPct),
        open_maintenance: openMaint,
        last_telemetry:   m.last_telemetry,
        oee: oeeVal !== null ? {
          oee:          oeeVal,
          availability: availVal,
          performance:  perfVal,
          quality:      qualVal,
          downtime_min: downtime,
          parts_produced: oee.total_parts,
          parts_scrap:    oee.total_scrap,
          records:        oee.records,
        } : null,
        telemetry: tel ? {
          temperature:  tel.temperature,
          spindle_speed: tel.spindle_speed,
          feed_rate:    tel.feed_rate,
          vibration:    tel.vibration,
          power_kw:     tel.power_kw,
          recorded_at:  tel.recorded_at,
        } : null,
        work_orders: {
          total:       wo?.cnt ?? 0,
          urgent:      wo?.urgent_cnt ?? 0,
          in_progress: wo?.in_progress_cnt ?? 0,
        },
      }
    })

    // Factory-level KPIs
    const running  = twinMachines.filter(m => m.status === 'running').length
    const fault    = twinMachines.filter(m => m.status === 'fault').length
    const idle     = twinMachines.filter(m => m.status === 'idle').length
    const avgOEE   = oeeData.length
      ? Math.round(oeeData.reduce((s, o) => s + (o.avg_oee || 0), 0) / oeeData.length * 10) / 10
      : null
    const avgHealth = Math.round(twinMachines.reduce((s, m) => s + m.health_score, 0) / Math.max(1, twinMachines.length))

    // Open work orders total
    const woStats = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN priority='urgent' AND status NOT IN ('completed','closed','cancelled') THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN planned_end < date('now') AND status NOT IN ('completed','closed','cancelled') THEN 1 ELSE 0 END) as overdue
      FROM work_orders
    `)

    // Tool status
    const toolStats = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN current_quantity=0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN current_quantity>0 AND current_quantity<=min_quantity THEN 1 ELSE 0 END) as low_stock
      FROM tools
    `)

    // Maintenance summary
    const maintStats = db.get(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN priority='urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open
      FROM maintenance_orders
      WHERE status NOT IN ('completed','closed')
    `)

    // Alerts
    const alerts = db.all(`
      SELECT * FROM alerts WHERE is_read=0 ORDER BY created_at DESC LIMIT 10
    `)

    // OEE trend (last 14 days, all machines combined)
    const oeeTrend = db.all(`
      SELECT record_date as date,
        ROUND(AVG(oee)*100)/100 as oee,
        ROUND(AVG(availability)*100)/100 as availability,
        ROUND(AVG(performance)*100)/100 as performance,
        ROUND(AVG(quality)*100)/100 as quality
      FROM oee_records
      WHERE record_date >= date('now','-14 days')
      GROUP BY record_date
      ORDER BY record_date ASC
    `)

    res.json({
      snapshot_at: new Date().toISOString(),
      factory: {
        machines_total:  twinMachines.length,
        machines_running: running,
        machines_fault:   fault,
        machines_idle:    idle,
        avg_oee:          avgOEE,
        avg_health:       avgHealth,
        work_orders:      woStats,
        tools:            toolStats,
        maintenance:      maintStats,
        alerts_unread:    alerts.length,
      },
      machines: twinMachines,
      oee_trend: oeeTrend,
      alerts,
    })
  } catch (e) {
    console.error('[digital-twin GET /]', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /api/digital-twin/machine/:id ─────────────────────────────────────
// Deep dive for one machine — telemetry history + work order list
router.get('/machine/:id', auth, (req, res) => {
  try {
    const { id } = req.params

    const machine = db.get('SELECT * FROM machines WHERE id=?', [id])
    if (!machine) return res.status(404).json({ error: 'Machine not found' })

    // Telemetry last 20 readings
    const telHistory = db.all(`
      SELECT * FROM machine_telemetry
      WHERE machine_id=?
      ORDER BY recorded_at DESC LIMIT 20
    `, [id])

    // OEE last 30 days
    const oeeHistory = db.all(`
      SELECT * FROM oee_records
      WHERE machine_id=?
      ORDER BY record_date DESC LIMIT 30
    `, [id])

    // Active + recent work orders
    const workOrders = db.all(`
      SELECT w.*, u.first_name||' '||u.last_name as operator_name
      FROM work_orders w
      LEFT JOIN users u ON w.operator_id=u.id
      WHERE w.machine_id=?
      ORDER BY CASE w.status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,
               w.planned_end ASC
      LIMIT 10
    `, [id])

    // Open maintenance
    const maintenance = db.all(`
      SELECT * FROM maintenance_orders
      WHERE machine_id=? AND status NOT IN ('completed','closed')
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END
    `, [id])

    // Tool life for this machine
    const toolLife = db.all(`
      SELECT tl.*, t.name as tool_name
      FROM tool_life tl
      LEFT JOIN tools t ON tl.tool_id=t.id
      WHERE tl.machine_id=?
      ORDER BY tl.updated_at DESC LIMIT 10
    `, [id])

    res.json({
      machine,
      telemetry_history: telHistory.reverse(),
      oee_history: oeeHistory.reverse(),
      work_orders: workOrders,
      maintenance,
      tool_life: toolLife,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /api/digital-twin/simulate ───────────────────────────────────────
// Run a "what if" capacity simulation
router.post('/simulate', auth, (req, res) => {
  try {
    const { working_hours_per_day = 8, shifts = 1, name } = req.body

    const machines    = db.all(`SELECT * FROM machines WHERE status != 'fault'`)
    const workOrders  = db.all(`
      SELECT * FROM work_orders
      WHERE status NOT IN ('completed','closed','cancelled')
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, planned_end
    `)
    const oeeData     = db.all(`
      SELECT machine_id, ROUND(AVG(oee)*100)/100 as avg_oee,
        ROUND(AVG(availability)*100)/100 as avg_avail
      FROM oee_records
      WHERE record_date >= date('now','-30 days')
      GROUP BY machine_id
    `)
    const oeeMap = {}
    oeeData.forEach(o => { oeeMap[o.machine_id] = o })

    const availableMinutes = working_hours_per_day * 60 * shifts

    // Simulate machine load
    const machineLoad = {}
    machines.forEach(m => {
      const oee = oeeMap[m.id]
      machineLoad[m.id] = {
        machine_id:   m.id,
        machine_name: m.name,
        capacity_min: availableMinutes,
        effective_capacity: Math.round(availableMinutes * (oee?.avg_avail ?? 0.75)),
        load_min:     0,
        jobs:         [],
        status:       'idle',
        utilization_pct: 0,
        bottleneck:   false,
      }
    })

    // Assign work orders to machines
    const unassigned = []
    workOrders.forEach(wo => {
      const estMin = wo.estimated_time_min || 60
      const remaining = wo.quantity > 0
        ? Math.round(estMin * (1 - (wo.quantity_done || 0) / wo.quantity))
        : estMin

      if (wo.machine_id && machineLoad[wo.machine_id]) {
        machineLoad[wo.machine_id].load_min += remaining
        machineLoad[wo.machine_id].jobs.push({
          id: wo.work_order_id,
          part: wo.part_name,
          remaining_min: remaining,
          priority: wo.priority,
          deadline: wo.planned_end,
        })
      } else {
        unassigned.push(wo)
      }
    })

    // Calculate utilization and detect bottlenecks
    const bottlenecks = []
    const machineStates = Object.values(machineLoad).map(ml => {
      const cap = ml.effective_capacity || availableMinutes
      ml.utilization_pct = Math.min(150, Math.round((ml.load_min / cap) * 100))
      if (ml.utilization_pct >= 100) {
        ml.status      = 'overloaded'
        ml.bottleneck  = true
        const overload = ml.load_min - cap
        bottlenecks.push({
          location:       ml.machine_name,
          utilization_pct: ml.utilization_pct,
          overload_min:   overload,
          impact: `Preopterećenje ${Math.round(overload / 60 * 10) / 10}h · ${ml.jobs.length} naloga čeka`,
          recommendation: `Premjesti ${Math.ceil(overload / (ml.load_min / ml.jobs.length))} naloga na drugi stroj ili dodaj smjenu`,
        })
      } else if (ml.utilization_pct >= 70) {
        ml.status = 'optimal'
      } else if (ml.utilization_pct >= 30) {
        ml.status = 'normal'
      } else {
        ml.status = 'underutilized'
      }
      return ml
    })

    const avgUtil = machineStates.length
      ? Math.round(machineStates.reduce((s, m) => s + m.utilization_pct, 0) / machineStates.length)
      : 0

    const riskLevel = bottlenecks.length >= 3 ? 'critical'
      : bottlenecks.length >= 2 ? 'high'
      : bottlenecks.length >= 1 ? 'medium'
      : avgUtil < 40 ? 'low' : 'low'

    // Optimizations
    const optimizations = []
    const underutil = machineStates.filter(m => m.utilization_pct < 40 && m.capacity_min > 0)
    if (underutil.length > 0 && bottlenecks.length > 0) {
      optimizations.push({
        category: 'load_balancing',
        proposed_change: `${underutil.map(m => m.machine_name).join(', ')} ima slobodnih kapaciteta — premjesti naloge s preopterećenih strojeva`,
        estimated_improvement_pct: Math.min(30, bottlenecks.length * 8),
      })
    }
    if (shifts < 2 && avgUtil > 70) {
      const gainPct = shifts === 1 ? 90 : 40
      optimizations.push({
        category: 'shift_extension',
        proposed_change: `Dodavanje ${shifts === 1 ? 'druge smjene' : 'treće smjene'} povećava kapacitet za ${gainPct}%`,
        estimated_improvement_pct: gainPct,
      })
    }
    if (unassigned.length > 0) {
      optimizations.push({
        category: 'unassigned_orders',
        proposed_change: `${unassigned.length} naloga nema dodijeljeni stroj — dodijelite stroj u radnim nalozima`,
        estimated_improvement_pct: 0,
      })
    }

    // AI assessment (rule-based)
    let assessment = ''
    if (bottlenecks.length === 0 && avgUtil >= 60) {
      assessment = `Fabrika radi optimalno. Prosječna iskorištenost ${avgUtil}% uz ${workOrders.length} aktivnih naloga na ${machines.length} strojeva. Nema identificiranih uskih grla.`
    } else if (bottlenecks.length > 0) {
      assessment = `Identificirano ${bottlenecks.length} uskih grla: ${bottlenecks.map(b => b.location).join(', ')}. Prosječna iskorištenost ${avgUtil}%. Preporučujem preraspodjelu naloga ili proširenje kapaciteta.`
    } else {
      assessment = `Kapaciteti su dostupni (iskorištenost ${avgUtil}%), ali nema dovoljno naloga. Razmislite o prihvaćanju novih narudžbi ili planiranom održavanju.`
    }

    // Save scenario to DB (simple log in alerts table as a record)
    // Note: no dedicated table, keep in memory/response

    res.json({
      scenario_name:    name || `Simulacija ${new Date().toLocaleDateString('hr-HR')}`,
      parameters:       { working_hours_per_day, shifts, available_minutes: availableMinutes },
      simulation_summary: {
        total_jobs:            workOrders.length,
        assigned_jobs:         workOrders.length - unassigned.length,
        unassigned_jobs:       unassigned.length,
        overall_utilization_pct: avgUtil,
        bottleneck_count:      bottlenecks.length,
        risk_level:            riskLevel,
      },
      machine_states:   machineStates,
      bottlenecks,
      optimizations,
      ai_assessment:    assessment,
      simulated_at:     new Date().toISOString(),
    })
  } catch (e) {
    console.error('[digital-twin POST /simulate]', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /api/digital-twin/bottlenecks ────────────────────────────────────
// Quick bottleneck analysis from real data
router.post('/bottlenecks', auth, (req, res) => {
  try {
    const bottlenecks = []
    const quickWins   = []

    // Machines with high open maintenance
    const maintLoad = db.all(`
      SELECT m.name as machine_name, COUNT(*) as cnt,
        SUM(CASE WHEN mo.priority='urgent' THEN 1 ELSE 0 END) as urgent
      FROM maintenance_orders mo
      JOIN machines m ON mo.machine_id=m.id
      WHERE mo.status NOT IN ('completed','closed')
      GROUP BY mo.machine_id
      HAVING cnt >= 1
      ORDER BY urgent DESC, cnt DESC
    `)
    maintLoad.forEach(ml => {
      const sev = ml.urgent > 0 ? 'critical' : ml.cnt >= 3 ? 'high' : 'medium'
      bottlenecks.push({
        resource:  ml.machine_name,
        type:      'maintenance',
        severity:  sev,
        detail:    `${ml.cnt} otvorenih naloga za održavanje${ml.urgent > 0 ? ` (${ml.urgent} hitnih)` : ''}`,
        impact_on_throughput_pct: ml.urgent > 0 ? 30 : 15,
        recommendation: `Zatvorite ${ml.urgent > 0 ? 'hitne' : 'sve'} naloge za održavanje ${ml.machine_name} — direktno utječe na dostupnost`,
      })
    })

    // Machines in fault
    const faultMachines = db.all(`SELECT name FROM machines WHERE status='fault'`)
    faultMachines.forEach(m => {
      bottlenecks.push({
        resource:  m.name,
        type:      'fault',
        severity:  'critical',
        detail:    'Stroj u kvaru — nema produkcijskog kapaciteta',
        impact_on_throughput_pct: 100,
        recommendation: `Hitno servisiranje ${m.name} — stroj je izvan produkcije`,
      })
    })

    // Overdue work orders
    const overdueWO = db.all(`
      SELECT m.name as machine_name, COUNT(*) as cnt
      FROM work_orders wo
      JOIN machines m ON wo.machine_id=m.id
      WHERE wo.planned_end < date('now') AND wo.status NOT IN ('completed','closed','cancelled')
      GROUP BY wo.machine_id
      ORDER BY cnt DESC
    `)
    overdueWO.forEach(ow => {
      bottlenecks.push({
        resource:  ow.machine_name,
        type:      'overdue',
        severity:  'high',
        detail:    `${ow.cnt} kasnih radnih naloga`,
        impact_on_throughput_pct: 20,
        recommendation: `Prioritizirajte kasne naloge na ${ow.machine_name} ili prerasporedite na slobodni stroj`,
      })
    })

    // Low tool stock
    const toolIssues = db.all(`
      SELECT name FROM tools WHERE current_quantity=0 LIMIT 5
    `)
    toolIssues.forEach(t => {
      bottlenecks.push({
        resource:  t.name,
        type:      'tooling',
        severity:  'high',
        detail:    'Nulta zaliha — produkcija može stati',
        impact_on_throughput_pct: 25,
        recommendation: `Hitno naručite ${t.name} — bez ovog alata neki procesi su blokirani`,
      })
    })

    // OEE-based bottlenecks (last 7 days)
    const lowOEE = db.all(`
      SELECT m.name as machine_name, ROUND(AVG(o.oee)*100)/100 as avg_oee,
        ROUND(AVG(o.availability)*100)/100 as avail
      FROM oee_records o
      JOIN machines m ON o.machine_id=m.id
      WHERE o.record_date >= date('now','-7 days')
      GROUP BY o.machine_id
      HAVING avg_oee < 0.60
      ORDER BY avg_oee ASC
    `)
    lowOEE.forEach(lo => {
      bottlenecks.push({
        resource:  lo.machine_name,
        type:      'oee',
        severity:  lo.avg_oee < 0.40 ? 'critical' : 'medium',
        detail:    `OEE ${Math.round(lo.avg_oee * 100)}% (ispod 60% praga) — dostupnost ${Math.round(lo.avail * 100)}%`,
        impact_on_throughput_pct: Math.round((0.85 - lo.avg_oee) * 100),
        recommendation: 'Analizirajte uzroke zastoja — planirana preventiva može smanjiti neplanirana stajanja',
      })
    })

    // Quick wins
    const idleMachines = db.all(`SELECT name FROM machines WHERE status='idle' LIMIT 3`)
    if (idleMachines.length > 0) {
      quickWins.push(`Slobodni strojevi: ${idleMachines.map(m => m.name).join(', ')} — mogu primiti hitne naloge odmah`)
    }

    const pendingMaint = db.all(`
      SELECT m.name as machine_name, mo.title
      FROM maintenance_orders mo
      JOIN machines m ON mo.machine_id=m.id
      WHERE mo.status='open' AND mo.priority NOT IN ('urgent','high')
      LIMIT 3
    `)
    if (pendingMaint.length > 0) {
      quickWins.push(`${pendingMaint.length} rutinskih naloga za održavanje može se riješiti za < 1 dan — poboljšava OEE`)
    }

    const lowStockTools = db.all(`
      SELECT name FROM tools WHERE current_quantity>0 AND current_quantity<=min_quantity LIMIT 3
    `)
    if (lowStockTools.length > 0) {
      quickWins.push(`Naručite alate na niskim zalihama (${lowStockTools.map(t => t.name).join(', ')}) preventivno`)
    }

    // Sort by severity
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    bottlenecks.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))

    const critCount = bottlenecks.filter(b => b.severity === 'critical').length
    const highCount = bottlenecks.filter(b => b.severity === 'high').length

    const summary = bottlenecks.length === 0
      ? 'Nema identificiranih uskih grla. Fabrika radi bez kritičnih ograničenja.'
      : `Identificirano ${bottlenecks.length} uskih grla (${critCount} kritičnih, ${highCount} visokih). ${critCount > 0 ? 'Hitna intervencija potrebna.' : 'Preporučuje se planirana akcija.'}`

    res.json({ summary, bottlenecks, quick_wins: quickWins, analyzed_at: new Date().toISOString() })
  } catch (e) {
    console.error('[digital-twin POST /bottlenecks]', e)
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /api/digital-twin/telemetry ──────────────────────────────────────
// Inject a fresh telemetry reading (simulate live sensor push)
router.post('/telemetry', auth, (req, res) => {
  try {
    const machines = db.all('SELECT id, status FROM machines')
    const _telBase = [
      { temp:42, spindle:8500, feed:1200, vibr:0.8, power:12.5 },
      { temp:28, spindle:0,    feed:0,    vibr:0.1, power:1.2  },
      { temp:55, spindle:6000, feed:800,  vibr:1.2, power:18.0 },
    ]
    const j = (v, p) => Math.round((v * (1 + (Math.random()-0.5)*p)) * 10) / 10
    const ts = new Date().toISOString()

    machines.forEach((m, idx) => {
      const base = _telBase[idx] || _telBase[0]
      const isRunning = m.status === 'running'
      db.run('INSERT INTO machine_telemetry (machine_id,temperature,spindle_speed,feed_rate,vibration,power_kw,status,recorded_at) VALUES (?,?,?,?,?,?,?,?)',
        [m.id,
         j(isRunning?base.temp:24, 0.06),
         isRunning?j(base.spindle,0.05):0,
         isRunning?j(base.feed,0.1):0,
         j(isRunning?base.vibr:0.05, 0.2),
         j(isRunning?base.power:0.8, 0.06),
         m.status, ts])
    })

    res.json({ success:true, machines_updated:machines.length, recorded_at:ts })
  } catch(e) {
    res.status(500).json({ error:e.message })
  }
})


module.exports = router
