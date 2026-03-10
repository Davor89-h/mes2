'use strict'
const router = require('express').Router()
const db     = require('../db')
const { auth } = require('../middleware/auth')
router.use(auth)

// ── STATS ────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const ago30 = new Date(Date.now() - 30*864e5).toISOString()
    const ago7  = new Date(Date.now() -  7*864e5).toISOString()
    const soon  = new Date(Date.now() + 30*864e5).toISOString().slice(0,10)
    const s = db.get(`SELECT
      SUM(CASE WHEN result='odobreno'   AND created_at>? THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN result='odbijeno'   AND created_at>? THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN result='uvjetno'    AND created_at>? THEN 1 ELSE 0 END) as conditional,
      SUM(CASE WHEN result='na_čekanju'                  THEN 1 ELSE 0 END) as pending
      FROM quality_inspections`, [ago30, ago30, ago30])
    const nok7  = db.get(`SELECT COUNT(*) as cnt FROM quality_measure_results WHERE status='nok' AND created_at>?`, [ago7])
    const cal   = db.get(`SELECT COUNT(*) as cnt FROM quality_instruments WHERE next_calibration<=? AND status!='u_kvaru'`, [soon])
    const total = (s.approved||0)+(s.rejected||0)+(s.conditional||0)
    res.json({
      approved:         s.approved   ||0,
      rejected:         s.rejected   ||0,
      conditional:      s.conditional||0,
      pending:          s.pending    ||0,
      reject_rate_pct:  total>0 ? Math.round((s.rejected||0)/total*1000)/10 : 0,
      nok_week:         nok7.cnt ||0,
      calibrations_due: cal.cnt  ||0,
    })
  } catch(e){ res.status(500).json({error:e.message}) }
})

// ── TREND ────────────────────────────────────────────────────────────────────
router.get('/trend', (req, res) => {
  try {
    const rows = db.all(`SELECT DATE(created_at) as date,
      SUM(CASE WHEN result='odobreno' THEN 1 ELSE 0 END) as ok,
      SUM(CASE WHEN result='odbijeno' THEN 1 ELSE 0 END) as nok,
      COUNT(*) as total
      FROM quality_inspections
      WHERE created_at >= date('now','-14 days')
      GROUP BY DATE(created_at) ORDER BY date ASC`)
    res.json(rows)
  } catch(e){ res.status(500).json({error:e.message}) }
})

// ── INSPECTIONS ──────────────────────────────────────────────────────────────
router.get('/inspections', (req, res) => {
  try {
    const rows = db.all(`SELECT i.*,
      u.first_name||' '||u.last_name as inspector_name,
      p.name as protocol_name,
      (SELECT COUNT(*) FROM quality_measure_results r WHERE r.inspection_id=i.id) as measure_count,
      (SELECT COUNT(*) FROM quality_measure_results r WHERE r.inspection_id=i.id AND r.status='nok') as nok_count
      FROM quality_inspections i
      LEFT JOIN users u ON i.inspector_id=u.id
      LEFT JOIN quality_protocols p ON i.protocol_id=p.id
      ORDER BY i.created_at DESC LIMIT 200`)
    res.json(rows)
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.get('/inspections/:id', (req, res) => {
  try {
    const insp = db.get(`SELECT i.*,
      u.first_name||' '||u.last_name as inspector_name,
      p.name as protocol_name
      FROM quality_inspections i
      LEFT JOIN users u ON i.inspector_id=u.id
      LEFT JOIN quality_protocols p ON i.protocol_id=p.id
      WHERE i.id=?`, [req.params.id])
    if (!insp) return res.status(404).json({error:'Not found'})
    const results = db.all(`SELECT * FROM quality_measure_results WHERE inspection_id=? ORDER BY sample_number,id`, [req.params.id])
    res.json({...insp, results})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.post('/inspections', (req, res) => {
  try {
    const {work_order_ref, part_name, drawing_number, quantity, type, protocol_id, machine_id, notes} = req.body
    const r = db.prepare(`INSERT INTO quality_inspections
      (work_order_ref,part_name,drawing_number,quantity,type,protocol_id,inspector_id,machine_id,result,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(work_order_ref||null, part_name||null, drawing_number||null,
      parseInt(quantity)||1, type||'završna', protocol_id||null,
      req.user.id, machine_id||null, 'na_čekanju', notes||null)
    res.json(db.get('SELECT * FROM quality_inspections WHERE id=?',[r.lastInsertRowid]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.put('/inspections/:id/result', (req, res) => {
  try {
    const {result, verdict_notes} = req.body
    const completed = result!=='na_čekanju' ? new Date().toISOString() : null
    db.prepare(`UPDATE quality_inspections SET result=?,verdict_notes=?,completed_at=? WHERE id=?`)
      .run(result, verdict_notes||null, completed, req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.delete('/inspections/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM quality_measure_results WHERE inspection_id=?').run(req.params.id)
    db.prepare('DELETE FROM quality_nok_log WHERE inspection_id=?').run(req.params.id)
    db.prepare('DELETE FROM quality_inspections WHERE id=?').run(req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

// Save measurement results for an inspection
router.post('/inspections/:id/results', (req, res) => {
  try {
    const {results} = req.body
    if (!Array.isArray(results)) return res.status(400).json({error:'results must be array'})
    const id = parseInt(req.params.id)
    const insp = db.get('SELECT * FROM quality_inspections WHERE id=?',[id])
    if (!insp) return res.status(404).json({error:'Inspection not found'})

    let hasNok = false
    for (const r of results) {
      const val  = parseFloat(r.measured_value)
      const nom  = parseFloat(r.nominal)||0
      const tmin = r.tolerance_min!=null ? parseFloat(r.tolerance_min) : null
      const tmax = r.tolerance_max!=null ? parseFloat(r.tolerance_max) : null
      const dev  = Math.round((val-nom)*10000)/10000
      let status = 'ok'
      if (tmin!=null && tmax!=null) {
        if (val < nom+tmin || val > nom+tmax) { status='nok'; hasNok=true }
      }
      db.prepare(`INSERT INTO quality_measure_results
        (inspection_id,measure_id,measure_name,nominal,tolerance_min,tolerance_max,unit,measured_value,deviation,status,sample_number,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, r.measure_id||null, r.measure_name, nom, tmin, tmax,
            r.unit||'mm', val, dev, status, parseInt(r.sample_number)||1, r.notes||null)
      if (status==='nok') {
        db.prepare(`INSERT INTO quality_nok_log (inspection_id,work_order_ref,part_name,measure_name,nominal,measured_value,deviation,nok_type) VALUES (?,?,?,?,?,?,?,?)`)
          .run(id, insp.work_order_ref, insp.part_name, r.measure_name, nom, val, dev, 'over_tolerance')
      }
    }
    const mx = db.get('SELECT MAX(sample_number) as mx FROM quality_measure_results WHERE inspection_id=?',[id])
    db.prepare('UPDATE quality_inspections SET quantity_measured=? WHERE id=?').run(mx.mx||0, id)
    res.json({ok:true, nok_found:hasNok})
  } catch(e){ res.status(500).json({error:e.message}) }
})

// ── PROTOCOLS ────────────────────────────────────────────────────────────────
router.get('/protocols', (req, res) => {
  try {
    res.json(db.all(`SELECT p.*,
      (SELECT COUNT(*) FROM quality_measures WHERE protocol_id=p.id) as measure_count
      FROM quality_protocols p ORDER BY p.name`))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.get('/protocols/:id', (req, res) => {
  try {
    const p = db.get('SELECT * FROM quality_protocols WHERE id=?',[req.params.id])
    if (!p) return res.status(404).json({error:'Not found'})
    const measures = db.all('SELECT * FROM quality_measures WHERE protocol_id=? ORDER BY sort_order,id',[req.params.id])
    res.json({...p, measures})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.post('/protocols', (req, res) => {
  try {
    const {name, version, project_name, drawing_number, material, description} = req.body
    if (!name) return res.status(400).json({error:'Naziv je obavezan'})
    const r = db.prepare(`INSERT INTO quality_protocols (name,version,project_name,drawing_number,material,description,created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(name, version||'1.0', project_name||null, drawing_number||null, material||null, description||null, req.user.id)
    res.json(db.get('SELECT * FROM quality_protocols WHERE id=?',[r.lastInsertRowid]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.put('/protocols/:id', (req, res) => {
  try {
    const {name, version, project_name, drawing_number, material, status, description} = req.body
    db.prepare(`UPDATE quality_protocols SET name=?,version=?,project_name=?,drawing_number=?,material=?,status=?,description=?,updated_at=datetime('now') WHERE id=?`)
      .run(name, version, project_name||null, drawing_number||null, material||null, status||'aktivan', description||null, req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.delete('/protocols/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM quality_measures WHERE protocol_id=?').run(req.params.id)
    db.prepare('DELETE FROM quality_protocols WHERE id=?').run(req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.post('/protocols/:id/measures', (req, res) => {
  try {
    const {name, nominal, tolerance_min, tolerance_max, unit, measurement_method, sort_order} = req.body
    if (!name) return res.status(400).json({error:'Naziv mjere je obavezan'})
    const r = db.prepare(`INSERT INTO quality_measures (protocol_id,name,nominal,tolerance_min,tolerance_max,unit,measurement_method,sort_order) VALUES (?,?,?,?,?,?,?,?)`)
      .run(req.params.id, name, parseFloat(nominal)||0, parseFloat(tolerance_min)||null, parseFloat(tolerance_max)||null, unit||'mm', measurement_method||null, parseInt(sort_order)||0)
    res.json(db.get('SELECT * FROM quality_measures WHERE id=?',[r.lastInsertRowid]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.put('/measures/:id', (req, res) => {
  try {
    const {name, nominal, tolerance_min, tolerance_max, unit, measurement_method} = req.body
    db.prepare(`UPDATE quality_measures SET name=?,nominal=?,tolerance_min=?,tolerance_max=?,unit=?,measurement_method=? WHERE id=?`)
      .run(name, parseFloat(nominal)||0, parseFloat(tolerance_min)||null, parseFloat(tolerance_max)||null, unit||'mm', measurement_method||null, req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.delete('/measures/:id', (req, res) => {
  try { db.prepare('DELETE FROM quality_measures WHERE id=?').run(req.params.id); res.json({ok:true}) }
  catch(e){ res.status(500).json({error:e.message}) }
})

// ── INSTRUMENTS ──────────────────────────────────────────────────────────────
router.get('/instruments', (req, res) => {
  try {
    const soon = new Date(Date.now()+30*864e5).toISOString().slice(0,10)
    res.json(db.all(`SELECT *,
      (next_calibration IS NOT NULL AND next_calibration<=?) as calibration_due_soon,
      (next_calibration IS NOT NULL AND next_calibration<date('now')) as calibration_overdue
      FROM quality_instruments ORDER BY name`, [soon]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.post('/instruments', (req, res) => {
  try {
    const {name, type, serial_number, manufacturer, storage_location, last_calibration, next_calibration, accuracy, range_min, range_max, unit, notes} = req.body
    if (!name) return res.status(400).json({error:'Naziv je obavezan'})
    const r = db.prepare(`INSERT INTO quality_instruments (name,type,serial_number,manufacturer,storage_location,last_calibration,next_calibration,accuracy,range_min,range_max,unit,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(name, type||null, serial_number||null, manufacturer||null, storage_location||null,
           last_calibration||null, next_calibration||null, accuracy||null,
           range_min||null, range_max||null, unit||'mm', notes||null)
    res.json(db.get('SELECT * FROM quality_instruments WHERE id=?',[r.lastInsertRowid]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.put('/instruments/:id', (req, res) => {
  try {
    const {name, type, serial_number, manufacturer, storage_location, last_calibration, next_calibration, status, accuracy, notes} = req.body
    db.prepare(`UPDATE quality_instruments SET name=?,type=?,serial_number=?,manufacturer=?,storage_location=?,last_calibration=?,next_calibration=?,status=?,accuracy=?,notes=? WHERE id=?`)
      .run(name, type||null, serial_number||null, manufacturer||null, storage_location||null,
           last_calibration||null, next_calibration||null, status||'aktivan', accuracy||null, notes||null, req.params.id)
    res.json({ok:true})
  } catch(e){ res.status(500).json({error:e.message}) }
})

router.delete('/instruments/:id', (req, res) => {
  try { db.prepare('DELETE FROM quality_instruments WHERE id=?').run(req.params.id); res.json({ok:true}) }
  catch(e){ res.status(500).json({error:e.message}) }
})

// ── NOK ANALYSIS ─────────────────────────────────────────────────────────────
router.get('/nok-analysis', (req, res) => {
  try {
    const ago = new Date(Date.now()-30*864e5).toISOString()
    res.json(db.all(`SELECT measure_name,
      COUNT(*) as nok_count,
      AVG(nominal) as nominal,
      MIN(measured_value) as min_value,
      MAX(measured_value) as max_value,
      AVG(measured_value) as avg_value,
      MIN(tolerance_min) as tolerance_min,
      MAX(tolerance_max) as tolerance_max,
      unit
      FROM quality_measure_results
      WHERE status='nok' AND created_at>?
      GROUP BY measure_name ORDER BY nok_count DESC LIMIT 20`, [ago]))
  } catch(e){ res.status(500).json({error:e.message}) }
})

// SPC data for one measure
router.get('/spc/:measure', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.measure)
    const rows = db.all(`SELECT r.*, i.work_order_ref, i.part_name
      FROM quality_measure_results r
      LEFT JOIN quality_inspections i ON r.inspection_id=i.id
      WHERE r.measure_name=? ORDER BY r.created_at ASC LIMIT 60`, [name])
    if (!rows.length) return res.json({measure_name:name, data:[], stats:null})
    const vals = rows.map(r=>parseFloat(r.measured_value)).filter(v=>!isNaN(v))
    const n=vals.length, mean=vals.reduce((a,b)=>a+b,0)/n
    const std=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,n-1))
    const nom=parseFloat(rows[0].nominal)||mean
    const tmin=parseFloat(rows[0].tolerance_min), tmax=parseFloat(rows[0].tolerance_max)
    let cp=null, cpk=null
    if (!isNaN(tmin)&&!isNaN(tmax)&&std>0) {
      const lsl=nom+tmin, usl=nom+tmax
      cp=Math.round((usl-lsl)/(6*std)*100)/100
      cpk=Math.round(Math.min((usl-mean)/(3*std),(mean-lsl)/(3*std))*100)/100
    }
    res.json({measure_name:name, data:rows,
      stats:{n, mean:Math.round(mean*10000)/10000, std:Math.round(std*10000)/10000,
        min:Math.min(...vals), max:Math.max(...vals), cp, cpk,
        nok_count:rows.filter(r=>r.status==='nok').length}})
  } catch(e){ res.status(500).json({error:e.message}) }
})

module.exports = router
