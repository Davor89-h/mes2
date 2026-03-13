import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { C, useToast } from '../components/UI'
import { BarChart2, Cpu, TrendingUp, TrendingDown, Plus, RefreshCw, Calendar, X, Save, ChevronDown } from 'lucide-react'

// Recharts-free simple chart using SVG
function SparkLine({ data, color=C.teal, height=40 }) {
  if (!data || data.length < 2) return null
  const vals = data.map(d => parseFloat(d) || 0)
  const min = Math.min(...vals) * 0.95
  const max = Math.max(...vals) * 1.05 || 1
  const w = 200, h = height
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length-1)) * w
    const y = h - ((v - min) / (max - min) || 0) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`${color}22`} stroke="none"/>
    </svg>
  )
}

function GaugeArc({ pct, color, size=80 }) {
  const r = (size-12)/2, cx = size/2, cy = size/2
  const circumference = Math.PI * r  // half circle
  const strokeDash = circumference * Math.min(1, pct/100)
  const rotate = -180
  return (
    <svg width={size} height={size/2+8} style={{ overflow:'visible' }}>
      <path d={`M ${12/2} ${cy} A ${r} ${r} 0 0 1 ${size-12/2} ${cy}`} fill="none" stroke={C.surface3} strokeWidth={8} strokeLinecap="round"/>
      <path d={`M ${12/2} ${cy} A ${r} ${r} 0 0 1 ${size-12/2} ${cy}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${strokeDash} ${circumference}`} style={{ transition:'stroke-dasharray .6s ease' }}/>
    </svg>
  )
}

function OEEGauge({ label, value, color }) {
  const pct = Math.round((value||0)*100)
  const c = pct>=90?C.green:pct>=70?C.teal:pct>=50?C.orange:C.red
  return (
    <div style={{ textAlign:'center', padding:'0 8px' }}>
      <div style={{ position:'relative', display:'inline-block' }}>
        <GaugeArc pct={pct} color={c} size={90}/>
        <div style={{ position:'absolute', bottom:-4, left:0, right:0, textAlign:'center', fontSize:18, fontWeight:700, color:c, fontFamily:"'Chakra Petch',sans-serif" }}>{pct}<span style={{ fontSize:11 }}>%</span></div>
      </div>
      <div style={{ fontSize:10, color:C.muted, letterSpacing:1.2, marginTop:6, textTransform:'uppercase' }}>{label}</div>
    </div>
  )
}

const S = {
  card:  { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },
  input: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  btn: (col=C.accent) => ({ background: col, border:'none', borderRadius: 8, padding:'8px 16px', color: col===C.accent?'#1a2a28':C.gray, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }),
  ghost: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
}

function EntryModal({ open, onClose, onSave, machines }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ machine_id:'', record_date:today, shift:'A', planned_time_min:480, downtime_min:0, downtime_reason:'', parts_produced:0, parts_target:0, parts_good:0, parts_scrap:0, notes:'' })
  const F = (k,v) => setForm(f=>({...f,[k]:v}))
  if (!open) return null
  // Auto-calc quality from parts
  const good = parseInt(form.parts_good)||0
  const prod = parseInt(form.parts_produced)||0
  const avail = form.planned_time_min>0 ? Math.round(Math.max(0,form.planned_time_min-form.downtime_min)/form.planned_time_min*100) : 0
  const perf  = form.parts_target>0 ? Math.round(Math.min(100,prod/form.parts_target*100)) : 0
  const qual  = prod>0 ? Math.round(good/prod*100) : 100
  const oee   = Math.round(avail*perf*qual/10000)
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:560,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:24 }}>
          <span style={{ fontSize:16,fontWeight:700,color:C.accent,letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif" }}>NOVA OEE EVIDENCIJA</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={S.label}>Stroj *</label>
            <select style={S.input} value={form.machine_id} onChange={e=>F('machine_id',e.target.value)}>
              <option value="">— odaberi —</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Datum</label><input type="date" style={S.input} value={form.record_date} onChange={e=>F('record_date',e.target.value)}/></div>
          <div><label style={S.label}>Smjena</label>
            <select style={S.input} value={form.shift} onChange={e=>F('shift',e.target.value)}>
              {['A','B','C'].map(s=><option key={s} value={s}>Smjena {s}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Planirano vrij. (min)</label><input type="number" style={S.input} value={form.planned_time_min} onChange={e=>F('planned_time_min',parseInt(e.target.value)||0)}/></div>
          <div><label style={S.label}>Downtime (min)</label><input type="number" style={S.input} value={form.downtime_min} onChange={e=>F('downtime_min',parseInt(e.target.value)||0)}/></div>
          <div style={{ gridColumn:'1/-1' }}><label style={S.label}>Razlog zastoja</label><input style={S.input} value={form.downtime_reason} onChange={e=>F('downtime_reason',e.target.value)} placeholder="npr. Alat lom, setup, ..."/></div>
          <div><label style={S.label}>Произведено komada</label><input type="number" style={S.input} value={form.parts_produced} onChange={e=>F('parts_produced',parseInt(e.target.value)||0)}/></div>
          <div><label style={S.label}>Target komada</label><input type="number" style={S.input} value={form.parts_target} onChange={e=>F('parts_target',parseInt(e.target.value)||0)}/></div>
          <div><label style={S.label}>Dobri komadi</label><input type="number" style={S.input} value={form.parts_good} onChange={e=>F('parts_good',parseInt(e.target.value)||0)}/></div>
          <div><label style={S.label}>Škart</label><input type="number" style={S.input} value={form.parts_scrap} onChange={e=>F('parts_scrap',parseInt(e.target.value)||0)}/></div>
        </div>
        {/* Live preview */}
        <div style={{ marginTop:16,background:C.surface2,borderRadius:10,padding:'14px 18px',display:'flex',justifyContent:'space-around' }}>
          {[['Dostupnost',avail,C.teal],['Performanse',perf,C.blue],['Kvaliteta',qual,C.green],['OEE',oee,oee>=85?C.green:oee>=60?C.orange:C.red]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:22,fontWeight:700,color:c,fontFamily:"'Chakra Petch',sans-serif" }}>{v}<span style={{ fontSize:12 }}>%</span></div>
              <div style={{ fontSize:10,color:C.muted,letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:20 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn()} onClick={()=>onSave(form)}><Save size={14}/> Spremi</button>
        </div>
      </div>
    </div>
  )
}

export default function OEEMonitoringPage() {
  const [overview, setOverview] = useState([])
  const [fleet, setFleet] = useState([])
  const [machines, setMachines] = useState([])
  const [selMachine, setSelMachine] = useState(null)
  const [machineHistory, setMachineHistory] = useState([])
  const [days, setDays] = useState(14)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, showToast] = useToast()

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ovR, fleetR, machR] = await Promise.all([
        api.get('/oee/overview'),
        api.get(`/oee/fleet?days=${days}`),
        api.get('/machines'),
      ])
      setOverview(ovR.data || [])
      setFleet(fleetR.data || [])
      setMachines(machR.data || [])
    } catch { showToast('Greška pri učitavanju', 'error') }
    setLoading(false)
  }, [days])

  useEffect(() => { loadAll() }, [loadAll])

  const loadMachineHistory = async (machine_id) => {
    const r = await api.get(`/oee/machine/${machine_id}?days=30`).catch(()=>null)
    setMachineHistory(r?.data?.records || [])
    setSelMachine(machine_id)
  }

  const save = async (form) => {
    try {
      await api.post('/oee', form)
      showToast('OEE evidencija spremljena')
      setModal(false); loadAll()
    } catch { showToast('Greška', 'error') }
  }

  // Fleet-level averages
  const fleetAvg = fleet.length > 0 ? {
    avail: Math.round(fleet.reduce((s,d)=>s+parseFloat(d.avg_availability||0),0)/fleet.length),
    perf:  Math.round(fleet.reduce((s,d)=>s+parseFloat(d.avg_performance||0),0)/fleet.length),
    qual:  Math.round(fleet.reduce((s,d)=>s+parseFloat(d.avg_quality||0),0)/fleet.length),
    oee:   Math.round(fleet.reduce((s,d)=>s+parseFloat(d.avg_oee||0),0)/fleet.length),
    parts: fleet.reduce((s,d)=>s+(parseInt(d.total_parts)||0),0),
    scrap: fleet.reduce((s,d)=>s+(parseInt(d.total_scrap)||0),0),
  } : { avail:0, perf:0, qual:0, oee:0, parts:0, scrap:0 }

  const oeeColor = v => v >= 85 ? C.green : v >= 60 ? C.orange : C.red

  return (
    <div style={{ padding:24, maxWidth:1400, margin:'0 auto' }}>
      {toast.visible && <div style={{ position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',borderRadius:10,padding:'12px 22px',fontWeight:600,zIndex:9999 }}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
            <BarChart2 size={24} color={C.accent}/>
            <h1 style={{ color:C.accent,fontSize:22,fontWeight:700,margin:0,fontFamily:"'Chakra Petch',sans-serif",letterSpacing:1 }}>OEE MONITORING</h1>
          </div>
          <div style={{ color:C.muted,fontSize:13 }}>Overall Equipment Effectiveness — Ukupna učinkovitost opreme</div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <select value={days} onChange={e=>setDays(parseInt(e.target.value))} style={{ ...S.ghost, padding:'7px 12px', background:C.surface }}>
            {[7,14,30,90].map(d=><option key={d} value={d}>Zadnjih {d} dana</option>)}
          </select>
          <button style={S.ghost} onClick={loadAll}><RefreshCw size={14}/></button>
          <button style={S.btn()} onClick={()=>setModal(true)}><Plus size={14}/> Nova evidencija</button>
        </div>
      </div>

      {/* Fleet KPI */}
      <div style={{ ...S.card, marginBottom:20, background:`linear-gradient(145deg,${C.surface},${C.surface2})` }}>
        <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:16,display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ width:3,height:14,background:C.accent,borderRadius:2 }}/>
          FLOTA — PROSJEK ZADNJIH {days} DANA
        </div>
        <div style={{ display:'flex',justifyContent:'space-around',flexWrap:'wrap',gap:12 }}>
          <OEEGauge label="Dostupnost" value={fleetAvg.avail/100}/>
          <OEEGauge label="Performanse" value={fleetAvg.perf/100}/>
          <OEEGauge label="Kvaliteta" value={fleetAvg.qual/100}/>
          <div style={{ textAlign:'center', padding:'0 8px' }}>
            <div style={{ fontSize:48, fontWeight:700, color:oeeColor(fleetAvg.oee), fontFamily:"'Chakra Petch',sans-serif", lineHeight:1 }}>
              {fleetAvg.oee}<span style={{ fontSize:20 }}>%</span>
            </div>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginTop:6 }}>OEE UKUPNO</div>
            <div style={{ fontSize:11,color:fleetAvg.oee>=85?C.green:fleetAvg.oee>=60?C.orange:C.red,marginTop:4 }}>
              {fleetAvg.oee>=85?'✓ World class':fleetAvg.oee>=60?'△ Prosječno':'✕ Ispod prosjeka'}
            </div>
          </div>
          <div style={{ textAlign:'center', padding:'0 8px' }}>
            <div style={{ fontSize:36,fontWeight:700,color:C.teal,fontFamily:"'Chakra Petch',sans-serif" }}>{fleetAvg.parts.toLocaleString()}</div>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1 }}>KOMADA UKUPNO</div>
            <div style={{ fontSize:11,color:C.orange,marginTop:6 }}>{fleetAvg.scrap} škart</div>
          </div>
        </div>
      </div>

      {/* Fleet trend chart */}
      {fleet.length > 1 && (
        <div style={{ ...S.card, marginBottom:20 }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:16,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:3,height:14,background:C.teal,borderRadius:2 }}/>
            OEE TREND — FLOTA
          </div>
          <div style={{ display:'flex',gap:20,overflowX:'auto',paddingBottom:4 }}>
            {[['avg_oee','OEE',C.accent],['avg_availability','Dostupnost',C.teal],['avg_performance','Performanse',C.blue],['avg_quality','Kvaliteta',C.green]].map(([key,label,color])=>(
              <div key={key} style={{ minWidth:200 }}>
                <div style={{ fontSize:10,color,letterSpacing:1,marginBottom:6 }}>{label}</div>
                <SparkLine data={fleet.map(d=>d[key])} color={color}/>
                <div style={{ display:'flex',justifyContent:'space-between',marginTop:4 }}>
                  <span style={{ fontSize:10,color:C.muted }}>{fleet[0]?.record_date?.slice(5)}</span>
                  <span style={{ fontSize:11,fontWeight:700,color }}>{Math.round(parseFloat(fleet[fleet.length-1]?.[key])||0)}%</span>
                  <span style={{ fontSize:10,color:C.muted }}>{fleet[fleet.length-1]?.record_date?.slice(5)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-machine cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16,marginBottom:20 }}>
        {loading ? (
          <div style={{ gridColumn:'1/-1',textAlign:'center',padding:40,color:C.muted }}>Učitavanje...</div>
        ) : overview.map(m => {
          const oeeVal = Math.round((m.avg_7days?.oee||0)*100)
          const oc = oeeColor(oeeVal)
          const isSelected = selMachine === m.machine_id
          return (
            <div key={m.machine_id} onClick={()=>isSelected?setSelMachine(null):loadMachineHistory(m.machine_id)}
              style={{ ...S.card, cursor:'pointer', borderTop:`3px solid ${oc}`, transition:'all .2s',
                       boxShadow: isSelected?`0 0 0 2px ${oc}44`:'none' }}
              onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseOut={e=>e.currentTarget.style.transform='none'}>

              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:C.gray }}>{m.machine_name}</div>
                  <div style={{ fontSize:11,color:C.muted }}>{m.machine_code}</div>
                </div>
                <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                  {m.active_work_orders>0 && <span style={{ fontSize:10,background:`${C.teal}22`,color:C.teal,borderRadius:5,padding:'2px 7px' }}>⚙ {m.active_work_orders} aktivno</span>}
                  <span style={{ fontSize:11,padding:'3px 10px',borderRadius:6,background:`${oc}22`,color:oc,fontWeight:700 }}>
                    {m.status==='running'?'▶ Radi':m.status==='idle'?'◼ Stoj':'⚠ Greška'}
                  </span>
                </div>
              </div>

              {/* OEE gauges row */}
              <div style={{ display:'flex',justifyContent:'space-around',marginBottom:14 }}>
                <OEEGauge label="Dostup." value={m.avg_7days?.availability}/>
                <OEEGauge label="Perf."   value={m.avg_7days?.performance}/>
                <OEEGauge label="Kval."   value={m.avg_7days?.quality}/>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:30,fontWeight:700,color:oc,fontFamily:"'Chakra Petch',sans-serif",lineHeight:1 }}>{oeeVal}%</div>
                  <div style={{ fontSize:9,color:C.muted,letterSpacing:1,marginTop:4 }}>OEE Ø7d</div>
                </div>
              </div>

              <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:C.muted,borderTop:`1px solid ${C.border}22`,paddingTop:10 }}>
                <span>Komada: <strong style={{ color:C.gray }}>{m.avg_7days?.total_parts||0}</strong></span>
                <span>Škart: <strong style={{ color:m.avg_7days?.total_scrap>0?C.orange:C.green }}>{m.avg_7days?.total_scrap||0}</strong></span>
                <span style={{ color:C.teal,fontSize:11 }}>Detalji →</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Machine detail history */}
      {selMachine && machineHistory.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:16,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:3,height:14,background:C.blue,borderRadius:2 }}/>
            HISTORIJA — {overview.find(m=>m.machine_id===selMachine)?.machine_name} (zadnjih 30 dana)
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Datum','Smjena','Planirano','Downtime','Dostupnost','Performanse','Kvaliteta','OEE','Komadi','Škart'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px',fontSize:10,color:C.muted,letterSpacing:1.2,textTransform:'uppercase',textAlign:'left',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[...machineHistory].reverse().map((r,i) => {
                  const oc = oeeColor(Math.round((r.oee||0)*100))
                  return (
                    <tr key={r.id} style={{ background:i%2===0?'transparent':C.surface2+'44' }}>
                      <td style={{ padding:'8px 10px',fontSize:12,color:C.gray }}>{r.record_date}</td>
                      <td style={{ padding:'8px 10px',fontSize:12,color:C.muted }}>{r.shift}</td>
                      <td style={{ padding:'8px 10px',fontSize:12,color:C.muted }}>{r.planned_time_min}m</td>
                      <td style={{ padding:'8px 10px',fontSize:12,color:r.downtime_min>60?C.orange:C.muted }}>{r.downtime_min}m</td>
                      {[r.availability,r.performance,r.quality].map((v,j)=>{
                        const val = Math.round((v||0)*100)
                        const vc = val>=85?C.green:val>=60?C.orange:C.red
                        return <td key={j} style={{ padding:'8px 10px' }}>
                          <span style={{ background:`${vc}22`,color:vc,borderRadius:5,padding:'2px 8px',fontSize:11,fontWeight:700 }}>{val}%</span>
                        </td>
                      })}
                      <td style={{ padding:'8px 10px' }}>
                        <span style={{ background:`${oc}22`,color:oc,borderRadius:6,padding:'3px 10px',fontSize:12,fontWeight:700 }}>{Math.round((r.oee||0)*100)}%</span>
                      </td>
                      <td style={{ padding:'8px 10px',fontSize:12,color:C.gray }}>{r.parts_produced}</td>
                      <td style={{ padding:'8px 10px',fontSize:12,color:r.parts_scrap>0?C.orange:C.green }}>{r.parts_scrap}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EntryModal open={modal} onClose={()=>setModal(false)} onSave={save} machines={machines}/>
    </div>
  )
}
