import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { C, useToast } from '../components/UI'
import {
  ClipboardList, Plus, Play, Pause, CheckCircle, Clock, AlertTriangle,
  ChevronRight, X, Save, Search, Filter, RefreshCw, Settings,
  Wrench, Cpu, User, Calendar, BarChart2, Package, Eye, Trash2
} from 'lucide-react'

// ── Status config ──────────────────────────────────────
const STATUS = {
  draft:       { label: 'Nacrt',       color: C.muted,   bg: C.muted+'22'   },
  planned:     { label: 'Planirano',   color: C.blue,    bg: C.blue+'22'    },
  in_progress: { label: 'U tijeku',    color: C.teal,    bg: C.teal+'22'    },
  paused:      { label: 'Pauzirano',   color: C.orange,  bg: C.orange+'22'  },
  completed:   { label: 'Završeno',    color: C.green,   bg: C.green+'22'   },
  cancelled:   { label: 'Otkazano',    color: C.red,     bg: C.red+'22'     },
}
const PRIORITY = {
  urgent: { label: 'Hitno',    color: C.red    },
  high:   { label: 'Visoko',   color: C.orange },
  normal: { label: 'Normalno', color: C.blue   },
  low:    { label: 'Nisko',    color: C.muted  },
}

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft
  return <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
}
const PriorityBadge = ({ priority }) => {
  const p = PRIORITY[priority] || PRIORITY.normal
  return <span style={{ color: p.color, fontSize: 11, fontWeight: 700 }}>{p.label}</span>
}

const fmt = n => typeof n === 'number' ? n.toFixed(0) : '—'
const fmtTime = min => { if (!min) return '—'; const h = Math.floor(min/60); const m = min%60; return h > 0 ? `${h}h ${m}m` : `${m}m` }

const S = {
  card:  { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },
  input: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  btn: (col=C.accent) => ({ background: col, border: 'none', borderRadius: 8, padding: '8px 16px', color: col===C.accent?'#1a2a28':C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }),
  ghost: { background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  th: { padding: '9px 12px', fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', fontSize: 13, color: C.gray, borderBottom: `1px solid ${C.border}22`, verticalAlign: 'middle' },
}

// ── Progress Bar ────────────────────────────────────────
function ProgressBar({ done, total, color=C.teal }) {
  const pct = total > 0 ? Math.min(100, Math.round(done/total*100)) : 0
  return (
    <div style={{ width: '100%' }}>
      <div style={{ height: 6, background: C.surface3, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{done}/{total} kom ({pct}%)</div>
    </div>
  )
}

// ── WO Card for Kanban view ─────────────────────────────
function WOCard({ wo, onOpen, onStatusChange }) {
  const st = STATUS[wo.status] || STATUS.draft
  return (
    <div onClick={() => onOpen(wo)} style={{ background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${C.border}`, borderLeft: `3px solid ${st.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', marginBottom: 10, transition: 'all .2s' }}
      onMouseOver={e => e.currentTarget.style.transform='translateY(-2px)'}
      onMouseOut={e => e.currentTarget.style.transform='none'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{wo.work_order_id}</span>
        <PriorityBadge priority={wo.priority} />
      </div>
      <div style={{ fontSize: 13, color: C.gray, fontWeight: 600, marginBottom: 6 }}>{wo.part_name}</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{wo.material || '—'}</div>
      <ProgressBar done={wo.quantity_done||0} total={wo.quantity} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {wo.machine_name && <span style={{ fontSize: 10, background: `${C.teal}15`, color: C.teal, borderRadius: 5, padding: '2px 7px' }}><Cpu size={9} style={{ display:'inline',marginRight:3 }}/>{wo.machine_name}</span>}
        {wo.operator_name && <span style={{ fontSize: 10, background: `${C.blue}15`, color: C.blue, borderRadius: 5, padding: '2px 7px' }}><User size={9} style={{ display:'inline',marginRight:3 }}/>{wo.operator_name}</span>}
      </div>
    </div>
  )
}

// ── Form Modal ─────────────────────────────────────────
function WOModal({ open, onClose, onSave, initial, machines, operators }) {
  const [form, setForm] = useState({
    part_name:'', drawing_number:'', quantity:1, machine_id:'', operator_id:'',
    priority:'normal', material:'', estimated_time_min:120, cycle_time_sec:0,
    planned_start:'', planned_end:'', notes:''
  })
  useEffect(() => {
    if (initial) setForm({ ...form, ...initial, machine_id: initial.machine_id||'', operator_id: initial.operator_id||'' })
    else setForm({ part_name:'', drawing_number:'', quantity:1, machine_id:'', operator_id:'', priority:'normal', material:'', estimated_time_min:120, cycle_time_sec:0, planned_start:'', planned_end:'', notes:'' })
  }, [open, initial])
  if (!open) return null
  const F = (key, val) => setForm(f => ({...f, [key]: val}))
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:640,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
          <span style={{ fontSize:17,fontWeight:700,color:C.accent,letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif" }}>{initial?.id ? 'UREDI RADNI NALOG' : 'NOVI RADNI NALOG'}</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={S.label}>Naziv dijela *</label>
            <input style={S.input} value={form.part_name} onChange={e=>F('part_name',e.target.value)} placeholder="npr. Nosač osi X" />
          </div>
          <div>
            <label style={S.label}>Broj nacrta</label>
            <input style={S.input} value={form.drawing_number} onChange={e=>F('drawing_number',e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Količina</label>
            <input style={S.input} type="number" min="1" value={form.quantity} onChange={e=>F('quantity',e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Materijal</label>
            <input style={S.input} value={form.material} onChange={e=>F('material',e.target.value)} placeholder="npr. Čelik 42CrMo4" />
          </div>
          <div>
            <label style={S.label}>Prioritet</label>
            <select style={S.input} value={form.priority} onChange={e=>F('priority',e.target.value)}>
              {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Stroj</label>
            <select style={S.input} value={form.machine_id} onChange={e=>F('machine_id',e.target.value)}>
              <option value="">— odaberi —</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Operater</label>
            <select style={S.input} value={form.operator_id} onChange={e=>F('operator_id',e.target.value)}>
              <option value="">— odaberi —</option>
              {operators.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Procijenjeno vrijeme (min)</label>
            <input style={S.input} type="number" min="0" value={form.estimated_time_min} onChange={e=>F('estimated_time_min',e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Ciklus (sek/kom)</label>
            <input style={S.input} type="number" min="0" step="0.1" value={form.cycle_time_sec} onChange={e=>F('cycle_time_sec',e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Planirani početak</label>
            <input style={S.input} type="date" value={form.planned_start} onChange={e=>F('planned_start',e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Planirani kraj</label>
            <input style={S.input} type="date" value={form.planned_end} onChange={e=>F('planned_end',e.target.value)} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={S.label}>Napomena</label>
            <textarea style={{ ...S.input, resize:'vertical', minHeight:70 }} value={form.notes} onChange={e=>F('notes',e.target.value)} />
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:24 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn()} onClick={() => onSave(form)}>
            <Save size={14}/> Spremi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Log Production Modal ────────────────────────────────
function LogModal({ open, onClose, onLog, wo }) {
  const [good, setGood] = useState(0)
  const [scrap, setScrap] = useState(0)
  const [notes, setNotes] = useState('')
  if (!open || !wo) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:420 }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:20 }}>
          <span style={{ fontSize:15,fontWeight:700,color:C.accent,letterSpacing:1 }}>EVIDENCIJA KOMADA</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:16 }}>{wo.work_order_id} — {wo.part_name}</div>
        <div style={{ marginBottom:12 }}>
          <label style={S.label}>Dobri komadi</label>
          <input style={S.input} type="number" min="0" value={good} onChange={e=>setGood(parseInt(e.target.value)||0)} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={S.label}>Škart</label>
          <input style={S.input} type="number" min="0" value={scrap} onChange={e=>setScrap(parseInt(e.target.value)||0)} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={S.label}>Napomena</label>
          <input style={S.input} value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn(C.green)} onClick={() => { onLog(good, scrap, notes); onClose() }}>
            <CheckCircle size={14}/> Evidentiraj
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────
export default function WorkOrdersPage() {
  const [list, setList] = useState([])
  const [stats, setStats] = useState({})
  const [machines, setMachines] = useState([])
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState('table') // table | kanban
  const [modal, setModal] = useState(false)
  const [editWO, setEditWO] = useState(null)
  const [detailWO, setDetailWO] = useState(null)
  const [logModal, setLogModal] = useState(false)
  const [logWO, setLogWO] = useState(null)
  const [toast, showToast] = useToast()

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [listR, statsR, machR, usersR] = await Promise.all([
        api.get('/work-orders'),
        api.get('/work-orders/stats/overview'),
        api.get('/machines'),
        api.get('/users'),
      ])
      setList(listR.data || [])
      setStats(statsR.data || {})
      setMachines(machR.data || [])
      setOperators((usersR.data || []).filter(u => u.active))
    } catch(e) { showToast('Greška pri učitavanju', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const save = async (form) => {
    try {
      if (editWO?.id) {
        await api.put(`/work-orders/${editWO.id}`, form)
        showToast('Radni nalog ažuriran')
      } else {
        await api.post('/work-orders', form)
        showToast('Radni nalog kreiran')
      }
      setModal(false); setEditWO(null); loadAll()
    } catch { showToast('Greška pri spremanju', 'error') }
  }

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/work-orders/${id}/status`, { status })
      showToast(`Status: ${STATUS[status]?.label || status}`)
      loadAll()
    } catch { showToast('Greška', 'error') }
  }

  const logProduction = async (wo_id, good, scrap, notes) => {
    try {
      await api.post(`/work-orders/${wo_id}/log`, { quantity_produced: good, quantity_scrap: scrap, notes })
      showToast(`Evidentirano: ${good} dobra, ${scrap} škart`)
      loadAll()
    } catch { showToast('Greška', 'error') }
  }

  const deleteWO = async (id) => {
    if (!confirm('Obrisati radni nalog?')) return
    try { await api.delete(`/work-orders/${id}`); showToast('Obrisano','error'); loadAll() }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const openNew = () => { setEditWO(null); setModal(true) }
  const openEdit = (wo) => { setEditWO(wo); setModal(true) }

  const filtered = list.filter(w => {
    const matchSearch = !search || w.work_order_id?.toLowerCase().includes(search.toLowerCase()) ||
      w.part_name?.toLowerCase().includes(search.toLowerCase()) ||
      w.machine_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || w.status === filterStatus
    return matchSearch && matchStatus
  })

  const kanbanCols = ['draft','planned','in_progress','completed']

  return (
    <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
      {toast.visible && (
        <div style={{ position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',borderRadius:10,padding:'12px 22px',fontWeight:600,zIndex:9999,fontSize:14 }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
            <ClipboardList size={24} color={C.accent} />
            <h1 style={{ color:C.accent,fontSize:22,fontWeight:700,margin:0,fontFamily:"'Chakra Petch',sans-serif",letterSpacing:1 }}>RADNI NALOZI</h1>
          </div>
          <div style={{ color:C.muted,fontSize:13 }}>Praćenje i upravljanje nalozima za CNC obradu</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button style={S.ghost} onClick={() => setViewMode(v => v==='table'?'kanban':'table')}>
            {viewMode==='table' ? <BarChart2 size={14}/> : <Filter size={14}/>} {viewMode==='table'?'Kanban':'Tablica'}
          </button>
          <button style={S.ghost} onClick={loadAll}><RefreshCw size={14}/></button>
          <button style={S.btn()} onClick={openNew}><Plus size={14}/> Novi nalog</button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:20 }}>
        {[
          { label:'Ukupno',     val: list.length,             color: C.accent },
          { label:'Nacrt',      val: stats.draft||0,          color: C.muted  },
          { label:'Planirano',  val: stats.planned||0,        color: C.blue   },
          { label:'U tijeku',   val: stats.in_progress||0,    color: C.teal   },
          { label:'Završeno',   val: stats.completed||0,      color: C.green  },
          { label:'Kasni',      val: stats.overdue||0,        color: C.red    },
        ].map(s => (
          <div key={s.label} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 16px',borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:28,fontWeight:700,color:s.color,fontFamily:"'Chakra Petch',sans-serif" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Active WOs at top */}
      {stats.in_progress_list?.length > 0 && (
        <div style={{ ...S.card, marginBottom:16, borderTop:`3px solid ${C.teal}` }}>
          <div style={{ fontSize:11,color:C.teal,letterSpacing:1.5,marginBottom:12,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:C.teal,animation:'pulse 1.5s infinite' }}/>
            U TIJEKU SADA
          </div>
          <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
            {stats.in_progress_list.map(wo => (
              <div key={wo.id} style={{ background:C.surface2,border:`1px solid ${C.teal}33`,borderRadius:8,padding:'10px 14px',cursor:'pointer' }} onClick={() => openEdit(wo)}>
                <div style={{ fontSize:11,color:C.accent,fontWeight:700 }}>{wo.work_order_id}</div>
                <div style={{ fontSize:12,color:C.gray }}>{wo.part_name}</div>
                <div style={{ fontSize:10,color:C.teal,marginTop:4 }}>⚙ {wo.machine_name||'—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...S.card, marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative',flex:1,minWidth:200 }}>
          <Search size={13} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.muted }} />
          <input placeholder="Pretraži naloge..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, paddingLeft:32 }} />
        </div>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {['all',...Object.keys(STATUS)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ background: filterStatus===s ? (STATUS[s]?.bg||C.accent+'22') : 'transparent',
                       border: `1px solid ${filterStatus===s ? (STATUS[s]?.color||C.accent) : C.border}`,
                       color: filterStatus===s ? (STATUS[s]?.color||C.accent) : C.muted,
                       borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              {s==='all' ? 'Sve' : STATUS[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div style={{ ...S.card, overflowX:'auto' }}>
          {loading ? (
            <div style={{ textAlign:'center',padding:40,color:C.muted }}>Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center',padding:60,color:C.muted }}>
              <ClipboardList size={40} style={{ opacity:.3,marginBottom:12 }} />
              <div>Nema radnih naloga. Kreirajte novi!</div>
            </div>
          ) : (
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr>{['ID naloga','Naziv dijela','Nacrт','Stroj','Operater','Količina','Status','Prioritet','Planirani rok','Akcije'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(wo => (
                  <tr key={wo.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...S.td, color:C.accent, fontWeight:700, cursor:'pointer' }} onClick={()=>openEdit(wo)}>{wo.work_order_id}</td>
                    <td style={{ ...S.td, fontWeight:600 }}>{wo.part_name}</td>
                    <td style={{ ...S.td, color:C.muted }}>{wo.drawing_number||'—'}</td>
                    <td style={S.td}>{wo.machine_name ? <span style={{ color:C.teal }}><Cpu size={11} style={{ display:'inline',marginRight:4 }}/>{wo.machine_name}</span> : '—'}</td>
                    <td style={{ ...S.td, color:C.muted }}>{wo.operator_name||'—'}</td>
                    <td style={S.td}><ProgressBar done={wo.quantity_done||0} total={wo.quantity} /></td>
                    <td style={S.td}><StatusBadge status={wo.status}/></td>
                    <td style={S.td}><PriorityBadge priority={wo.priority}/></td>
                    <td style={{ ...S.td, color:wo.planned_end&&wo.planned_end<new Date().toISOString().split('T')[0]&&!['completed','cancelled'].includes(wo.status)?C.red:C.muted, fontSize:12 }}>
                      {wo.planned_end||'—'}
                    </td>
                    <td style={S.td}>
                      <div style={{ display:'flex',gap:4 }}>
                        {wo.status==='draft'     && <button style={{ ...S.ghost,padding:'4px 8px',color:C.blue }}  title="Planiraj"  onClick={()=>changeStatus(wo.id,'planned')}><Calendar size={12}/></button>}
                        {wo.status==='planned'   && <button style={{ ...S.ghost,padding:'4px 8px',color:C.teal }}  title="Pokreni"   onClick={()=>changeStatus(wo.id,'in_progress')}><Play size={12}/></button>}
                        {wo.status==='in_progress'&&<button style={{ ...S.ghost,padding:'4px 8px',color:C.orange }} title="Pauziraj"  onClick={()=>changeStatus(wo.id,'paused')}><Pause size={12}/></button>}
                        {wo.status==='in_progress'&&<button style={{ ...S.ghost,padding:'4px 8px',color:C.green }}  title="Evidentitraj kom." onClick={()=>{setLogWO(wo);setLogModal(true)}}><Package size={12}/></button>}
                        {wo.status==='in_progress'&&<button style={{ ...S.ghost,padding:'4px 8px',color:C.green }}  title="Završi" onClick={()=>changeStatus(wo.id,'completed')}><CheckCircle size={12}/></button>}
                        {wo.status==='paused'    && <button style={{ ...S.ghost,padding:'4px 8px',color:C.teal }}  title="Nastavi" onClick={()=>changeStatus(wo.id,'in_progress')}><Play size={12}/></button>}
                        <button style={{ ...S.ghost,padding:'4px 8px' }} title="Uredi" onClick={()=>openEdit(wo)}><Settings size={12}/></button>
                        {!['in_progress'].includes(wo.status) && <button style={{ ...S.ghost,padding:'4px 8px',color:C.red }} title="Obriši" onClick={()=>deleteWO(wo.id)}><Trash2 size={12}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16 }}>
          {kanbanCols.map(col => {
            const colWOs = filtered.filter(w => w.status === col)
            const st = STATUS[col]
            return (
              <div key={col}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,padding:'8px 12px',background:st.bg,borderRadius:8,border:`1px solid ${st.color}44` }}>
                  <span style={{ fontSize:11,fontWeight:700,color:st.color,letterSpacing:1 }}>{st.label.toUpperCase()}</span>
                  <span style={{ fontSize:11,color:st.color,background:`${st.color}22`,borderRadius:10,padding:'2px 8px',fontWeight:700 }}>{colWOs.length}</span>
                </div>
                {colWOs.map(wo => <WOCard key={wo.id} wo={wo} onOpen={openEdit} onStatusChange={changeStatus}/>)}
                {colWOs.length===0 && <div style={{ textAlign:'center',padding:'30px 0',color:C.muted,fontSize:12,border:`1px dashed ${C.border}`,borderRadius:10 }}>Nema naloga</div>}
              </div>
            )
          })}
        </div>
      )}

      <WOModal open={modal} onClose={()=>{setModal(false);setEditWO(null)}} onSave={save} initial={editWO} machines={machines} operators={operators}/>
      <LogModal open={logModal} onClose={()=>{setLogModal(false);setLogWO(null)}} onLog={(g,s,n)=>logProduction(logWO.id,g,s,n)} wo={logWO}/>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
