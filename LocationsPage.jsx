import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { C, useToast } from '../components/UI'
import { Calendar, Cpu, Clock, AlertTriangle, Plus, RefreshCw, Zap, X, Save, ChevronRight } from 'lucide-react'

const PRIORITY_COLORS = { urgent:C.red, high:C.orange, normal:C.blue, low:C.muted }
const STATUS_COLORS = { planned:C.blue, in_progress:C.teal, completed:C.green, cancelled:C.muted }
const WO_PRIORITY_COLORS = { urgent:C.red, high:C.orange, normal:C.blue, low:C.muted }

const S = {
  card:  { background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
  input: { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.gray, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  label: { fontSize:11, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4, display:'block' },
  btn: (col=C.accent) => ({ background:col, border:'none', borderRadius:8, padding:'8px 16px', color:col===C.accent?'#1a2a28':C.gray, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }),
  ghost: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  th:    { padding:'9px 12px', fontSize:10, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:    { padding:'10px 12px', fontSize:13, color:C.gray, borderBottom:`1px solid ${C.border}22`, verticalAlign:'middle' },
}

// Load bar for machine utilization
function LoadBar({ pct, label }) {
  const c = pct>=90?C.red:pct>=70?C.orange:C.green
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
        <span style={{ fontSize:12,color:C.gray }}>{label}</span>
        <span style={{ fontSize:12,fontWeight:700,color:c }}>{pct}%</span>
      </div>
      <div style={{ height:8,background:C.surface3,borderRadius:4,overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100,pct)}%`,height:'100%',background:`linear-gradient(90deg,${c},${c}88)`,borderRadius:4,transition:'width .5s ease' }}/>
      </div>
    </div>
  )
}

function ScheduleModal({ open, onClose, onSave, workOrders, machines }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ work_order_id:'', machine_id:'', scheduled_start:'', scheduled_end:'', notes:'' })
  const F = (k,v) => setForm(f=>({...f,[k]:v}))
  // auto-set end from WO estimated time
  useEffect(() => {
    if (form.work_order_id && form.scheduled_start) {
      const wo = workOrders.find(w => w.id === parseInt(form.work_order_id))
      if (wo?.estimated_time_min && form.scheduled_start) {
        const end = new Date(form.scheduled_start + 'T08:00')
        end.setMinutes(end.getMinutes() + parseInt(wo.estimated_time_min))
        setForm(f=>({...f, scheduled_end: end.toISOString().slice(0,16), machine_id: f.machine_id || (wo.machine_id||'')}))
      }
    }
  }, [form.work_order_id, form.scheduled_start])
  if (!open) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:540,maxWidth:'100%' }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:24 }}>
          <span style={{ fontSize:16,fontWeight:700,color:C.accent,letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif" }}>RASPORED NALOGA</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div>
            <label style={S.label}>Radni nalog *</label>
            <select style={S.input} value={form.work_order_id} onChange={e=>F('work_order_id',e.target.value)}>
              <option value="">— odaberi nalog —</option>
              {workOrders.map(w=><option key={w.id} value={w.id}>{w.work_order_id} — {w.part_name} (×{w.quantity})</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Stroj *</label>
            <select style={S.input} value={form.machine_id} onChange={e=>F('machine_id',e.target.value)}>
              <option value="">— odaberi stroj —</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div>
              <label style={S.label}>Planirani početak</label>
              <input type="datetime-local" style={S.input} value={form.scheduled_start} onChange={e=>F('scheduled_start',e.target.value)}/>
            </div>
            <div>
              <label style={S.label}>Planirani kraj</label>
              <input type="datetime-local" style={S.input} value={form.scheduled_end} onChange={e=>F('scheduled_end',e.target.value)}/>
            </div>
          </div>
          <div>
            <label style={S.label}>Napomena</label>
            <input style={S.input} value={form.notes} onChange={e=>F('notes',e.target.value)}/>
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:24 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn()} onClick={()=>onSave(form)}><Save size={14}/> Rasporedi</button>
        </div>
      </div>
    </div>
  )
}

// Simple Gantt-like timeline for a week
function GanttTimeline({ schedule, machines }) {
  const days = 7
  const today = new Date()
  today.setHours(0,0,0,0)
  const cols = Array.from({length:days},(_, i) => {
    const d = new Date(today); d.setDate(d.getDate()+i)
    return { date: d, label: d.toLocaleDateString('hr-HR',{weekday:'short',day:'numeric'}) }
  })
  const getBar = (entry) => {
    const start = new Date(entry.scheduled_start)
    const end   = new Date(entry.scheduled_end)
    const startDay = Math.max(0, (start-today)/(86400000))
    const endDay   = Math.min(days, (end-today)/(86400000))
    if (endDay < 0 || startDay > days) return null
    const left = (startDay/days)*100
    const width = Math.max(1, ((endDay-startDay)/days)*100)
    const c = STATUS_COLORS[entry.status] || C.blue
    return { left:`${left}%`, width:`${width}%`, color:c }
  }
  return (
    <div style={{ overflowX:'auto' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:`140px repeat(${days},1fr)`, gap:0, marginBottom:4 }}>
        <div style={{ fontSize:10,color:C.muted,padding:'4px 8px' }}>STROJ</div>
        {cols.map((c,i)=>(
          <div key={i} style={{ fontSize:10,color:c.date.toDateString()===new Date().toDateString()?C.accent:C.muted, padding:'4px 4px',textAlign:'center',
            background:c.date.toDateString()===new Date().toDateString()?`${C.accent}11`:'transparent',borderRadius:4 }}>
            {c.label}
          </div>
        ))}
      </div>
      {/* Machine rows */}
      {machines.map(m => {
        const machEntries = schedule.filter(s=>s.machine_id===m.id)
        return (
          <div key={m.id} style={{ display:'grid',gridTemplateColumns:`140px 1fr`,gap:0,borderBottom:`1px solid ${C.border}22`,minHeight:36 }}>
            <div style={{ fontSize:11,color:C.gray,padding:'8px 8px',display:'flex',alignItems:'center' }}>
              <Cpu size={10} style={{ marginRight:5,color:C.teal,flexShrink:0 }}/>{m.name}
            </div>
            <div style={{ position:'relative' }}>
              {/* Day separators */}
              {cols.map((_,i)=>(
                <div key={i} style={{ position:'absolute',left:`${(i/days)*100}%`,top:0,bottom:0,width:1,background:`${C.border}33` }}/>
              ))}
              {/* Bars */}
              {machEntries.map(e=>{
                const bar = getBar(e)
                if (!bar) return null
                const c = STATUS_COLORS[e.status] || C.blue
                return (
                  <div key={e.id} title={`${e.work_order_id} — ${e.part_name}`}
                    style={{ position:'absolute',left:bar.left,width:bar.width,top:5,height:26,
                             background:`${c}33`,border:`1px solid ${c}88`,borderRadius:4,
                             display:'flex',alignItems:'center',paddingLeft:6,overflow:'hidden',
                             fontSize:10,color:c,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' }}>
                    {e.work_order_id} — {e.part_name}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProductionPlanningPage() {
  const [schedule, setSchedule] = useState([])
  const [queue, setQueue] = useState([])
  const [machineLoad, setMachineLoad] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('gantt') // gantt | list | queue
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date().toISOString().split('T')[0]
      const to   = new Date(Date.now()+14*86400000).toISOString().split('T')[0]
      const [schedR, queueR, loadR, machR] = await Promise.all([
        api.get(`/production/schedule?from=${from}&to=${to}`),
        api.get('/production/queue'),
        api.get(`/production/machine-load?from=${from}&to=${to}`),
        api.get('/machines'),
      ])
      setSchedule(schedR.data || [])
      setQueue(queueR.data || [])
      setMachineLoad(loadR.data || [])
      setMachines(machR.data || [])
    } catch { showToast('Greška pri učitavanju','error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (form) => {
    try {
      const r = await api.post('/production/schedule', form)
      if (r.data.conflicts?.length > 0) showToast(`Raspoređeno — ${r.data.conflicts.length} konflikta!`, 'warn')
      else showToast('Raspoređeno uspješno')
      setModal(false); load()
    } catch { showToast('Greška','error') }
  }

  const autoSchedule = async () => {
    setAutoLoading(true)
    try {
      const r = await api.post('/production/auto-schedule')
      showToast(`Auto-raspored: ${r.data.scheduled_count} naloga raspoređeno`)
      load()
    } catch { showToast('Greška','error') }
    setAutoLoading(false)
  }

  const removeSchedule = async (id) => {
    try {
      await api.delete(`/production/schedule/${id}`)
      showToast('Uklonjeno iz rasporeda')
      load()
    } catch { showToast('Greška','error') }
  }

  const totalLoad = machineLoad.reduce((s,m)=>s+m.load_pct,0) / Math.max(1, machineLoad.length)

  return (
    <div style={{ padding:24, maxWidth:1500, margin:'0 auto' }}>
      {toast.visible && <div style={{ position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',borderRadius:10,padding:'12px 22px',fontWeight:600,zIndex:9999 }}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
            <Calendar size={24} color={C.accent}/>
            <h1 style={{ color:C.accent,fontSize:22,fontWeight:700,margin:0,fontFamily:"'Chakra Petch',sans-serif",letterSpacing:1 }}>PLANIRANJE PRODUKCIJE</h1>
          </div>
          <div style={{ color:C.muted,fontSize:13 }}>Raspored strojeva · Prioriteti · Kontrola kapaciteta</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button style={S.ghost} onClick={load}><RefreshCw size={14}/></button>
          <button style={{ ...S.btn(C.teal), opacity:autoLoading?.6:1 }} onClick={autoSchedule} disabled={autoLoading}>
            <Zap size={14}/> {autoLoading?'Raspoređujem...':'Auto-raspored'}
          </button>
          <button style={S.btn()} onClick={()=>setModal(true)}><Plus size={14}/> Dodaj</button>
        </div>
      </div>

      {/* Machine Load Overview */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 2fr',gap:16,marginBottom:20 }}>
        <div style={S.card}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:14,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:3,height:14,background:C.accent,borderRadius:2 }}/>
            OPTEREĆENJE STROJEVA (14 dana)
          </div>
          {machineLoad.length === 0 ? (
            <div style={{ color:C.muted,fontSize:12,textAlign:'center',padding:20 }}>Nema podataka</div>
          ) : machineLoad.map(ml => (
            <LoadBar key={ml.machine.id} label={ml.machine.name} pct={ml.load_pct}/>
          ))}
          <div style={{ borderTop:`1px solid ${C.border}22`,paddingTop:12,marginTop:4 }}>
            <LoadBar label="PROSJEK FLOTE" pct={Math.round(totalLoad)}/>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:14,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:3,height:14,background:C.blue,borderRadius:2 }}/>
            STATISTIKA
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
            {[
              { l:'U redu čekanja',   v:queue.length,                              c:C.accent },
              { l:'Raspoređeno',      v:schedule.length,                           c:C.blue   },
              { l:'Bez stroja',       v:queue.filter(q=>!q.machine_id).length,     c:C.orange },
              { l:'Hitni nalozi',     v:[...queue,...schedule].filter(x=>x.priority==='urgent').length, c:C.red },
              { l:'Avg. opterećenje', v:`${Math.round(totalLoad)}%`,               c:C.teal   },
              { l:'Strojevi',         v:machines.length,                           c:C.green  },
            ].map(s=>(
              <div key={s.l} style={{ background:C.surface2,borderRadius:8,padding:'10px 14px' }}>
                <div style={{ fontSize:10,color:C.muted,letterSpacing:1,marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Chakra Petch',sans-serif" }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',gap:4,marginBottom:16 }}>
        {[['gantt','📅 Gantt'],['list','📋 Raspored'],['queue','⏳ Red čekanja']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{ background:activeTab===k?C.accent:'transparent',border:`1px solid ${activeTab===k?C.accent:C.border}`,
                     color:activeTab===k?'#1a2a28':C.muted,borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* GANTT */}
      {activeTab==='gantt' && (
        <div style={S.card}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:16,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:3,height:14,background:C.accent,borderRadius:2 }}/>
            RASPORED — SLJEDEĆIH 7 DANA
          </div>
          {loading ? <div style={{ textAlign:'center',padding:40,color:C.muted }}>Učitavanje...</div>
           : machines.length === 0 ? <div style={{ textAlign:'center',padding:40,color:C.muted }}>Nema strojeva</div>
           : <GanttTimeline schedule={schedule} machines={machines}/>}
        </div>
      )}

      {/* SCHEDULE LIST */}
      {activeTab==='list' && (
        <div style={{ ...S.card, overflowX:'auto' }}>
          {schedule.length === 0 ? (
            <div style={{ textAlign:'center',padding:60,color:C.muted }}>
              <Calendar size={40} style={{ opacity:.3,marginBottom:12 }}/>
              <div>Nema raspoređenih naloga</div>
            </div>
          ) : (
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Nalog','Dio','Stroj','Početak','Kraj','Status','Prioritet','Akcije'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {schedule.map(e => {
                  const c = STATUS_COLORS[e.status] || C.blue
                  const pc = WO_PRIORITY_COLORS[e.priority] || C.blue
                  const isConflict = false
                  return (
                    <tr key={e.id} onMouseOver={x=>x.currentTarget.style.background=C.surface2+'88'} onMouseOut={x=>x.currentTarget.style.background='transparent'}>
                      <td style={{ ...S.td,color:C.accent,fontWeight:700 }}>{e.work_order_id}</td>
                      <td style={S.td}>{e.part_name}</td>
                      <td style={{ ...S.td,color:C.teal }}><Cpu size={11} style={{ display:'inline',marginRight:4 }}/>{e.machine_name}</td>
                      <td style={{ ...S.td,fontSize:12,color:C.muted }}>{e.scheduled_start?.replace('T',' ').slice(0,16)}</td>
                      <td style={{ ...S.td,fontSize:12,color:C.muted }}>{e.scheduled_end?.replace('T',' ').slice(0,16)}</td>
                      <td style={S.td}><span style={{ background:`${c}22`,color:c,borderRadius:5,padding:'2px 8px',fontSize:11,fontWeight:600 }}>{e.status}</span></td>
                      <td style={S.td}><span style={{ color:pc,fontSize:11,fontWeight:700 }}>{e.priority}</span></td>
                      <td style={S.td}><button style={{ ...S.ghost,padding:'4px 8px',color:C.red,fontSize:11 }} onClick={()=>removeSchedule(e.id)}><X size={11}/></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* QUEUE */}
      {activeTab==='queue' && (
        <div style={{ ...S.card, overflowX:'auto' }}>
          <div style={{ fontSize:11,color:C.muted,marginBottom:12 }}>Nalozi koji čekaju na raspored ({queue.length})</div>
          {queue.length === 0 ? (
            <div style={{ textAlign:'center',padding:40,color:C.green }}>✓ Svi nalozi su raspoređeni</div>
          ) : (
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Nalog','Naziv dijela','Stroj','Prioritet','Planiran rok','Procjena','Raspoređeno','Akcija'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {queue.map(wo => {
                  const pc = WO_PRIORITY_COLORS[wo.priority] || C.blue
                  const isOverdue = wo.planned_end && wo.planned_end < new Date().toISOString().split('T')[0]
                  return (
                    <tr key={wo.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ ...S.td,color:C.accent,fontWeight:700 }}>{wo.work_order_id}</td>
                      <td style={S.td}>{wo.part_name}</td>
                      <td style={{ ...S.td,color:wo.machine_name?C.teal:C.red,fontSize:12 }}>
                        {wo.machine_name || <span><AlertTriangle size={10} style={{ display:'inline',marginRight:3 }}/>Nedodjeljeno</span>}
                      </td>
                      <td style={S.td}><span style={{ color:pc,fontWeight:700,fontSize:11 }}>{wo.priority}</span></td>
                      <td style={{ ...S.td,color:isOverdue?C.red:C.muted,fontSize:12 }}>{wo.planned_end||'—'}</td>
                      <td style={{ ...S.td,color:C.muted,fontSize:12 }}>{wo.estimated_time_min?`${Math.round(wo.estimated_time_min/60*10)/10}h`:'—'}</td>
                      <td style={S.td}>
                        <span style={{ fontSize:11,color:wo.scheduled>0?C.green:C.muted }}>
                          {wo.scheduled>0?'✓ Da':'—'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button style={{ ...S.ghost,padding:'4px 10px',fontSize:11,color:C.blue }} onClick={()=>setModal(true)}>
                          Rasporedi <ChevronRight size={11}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ScheduleModal open={modal} onClose={()=>setModal(false)} onSave={save} workOrders={queue} machines={machines}/>
    </div>
  )
}
