import { useState, useEffect, useCallback } from 'react'
import { C, useToast } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  CheckSquare, Plus, X, Save, Edit2, Trash2, User, Calendar,
  AlertTriangle, Clock, CheckCircle, Flag, FileText, MessageSquare,
  Search, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS = {
  open:        { label:'Otvoreno',   color:C.blue,   bg:C.blue+'22'   },
  in_progress: { label:'U tijeku',   color:C.teal,   bg:C.teal+'22'   },
  waiting:     { label:'Čekanje',    color:C.orange, bg:C.orange+'22' },
  completed:   { label:'Završeno',   color:C.green,  bg:C.green+'22'  },
  cancelled:   { label:'Otkazano',   color:C.muted,  bg:C.muted+'22'  },
}
const PRIORITY = {
  urgent: { label:'Hitno',    color:C.red    },
  high:   { label:'Visoko',   color:C.orange },
  normal: { label:'Normalno', color:C.blue   },
  low:    { label:'Nisko',    color:C.muted  },
}
const MODULES = ['machines','production','work_orders','warehouse','tools','maintenance','quality','sales','other']

const S = {
  card:  { background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:14, padding:20, boxShadow:'0 4px 16px rgba(0,0,0,.2)' },
  input: { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.gray, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  label: { fontSize:11, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4, display:'block' },
  btn:   (col=C.accent)=>({ background:col, border:'none', borderRadius:8, padding:'8px 16px', color:col===C.accent?'#1a2a28':C.gray, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }),
  ghost: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  th:    { padding:'9px 12px', fontSize:10, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:    { padding:'10px 12px', fontSize:13, color:C.gray, borderBottom:`1px solid ${C.border}22`, verticalAlign:'middle' },
}

const StatusBadge = ({status}) => {
  const s=STATUS[status]||STATUS.open
  return <span style={{ background:s.bg, color:s.color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:600 }}>{s.label}</span>
}
const PriorityBadge = ({priority}) => {
  const p=PRIORITY[priority]||PRIORITY.normal
  return <span style={{ color:p.color, fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}><Flag size={9}/>{p.label}</span>
}
const isOverdue = (due,status) => due && !['completed','cancelled'].includes(status) && new Date(due)<new Date()
const fmtDate  = d => d ? new Date(d).toLocaleDateString('hr-HR') : '—'

// ─── Tile (DEER style) ────────────────────────────────────────────────────────
function Tile({ label, value, color=C.accent, warn }) {
  return (
    <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${warn?color:C.border}`, borderRadius:14, padding:'16px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},${color}88)` }}/>
      <div style={{ fontSize:10, color:C.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:32, fontWeight:700, color, lineHeight:1, fontFamily:"'Chakra Petch',sans-serif" }}>{value??0}</div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ color=C.teal, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
      <div style={{ width:3, height:14, background:`linear-gradient(${color},${color}44)`, borderRadius:2 }}/>
      <div style={{ fontSize:10, color, letterSpacing:2 }}>{label}</div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgBar({ done, total, color=C.teal }) {
  const pct = total>0 ? Math.min(100,Math.round(done/total*100)) : 0
  return (
    <div style={{ width:'100%' }}>
      <div style={{ height:5, background:C.surface3, borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${color},${color}99)`, borderRadius:3, transition:'width .4s ease' }}/>
      </div>
      <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{done}/{total} ({pct}%)</div>
    </div>
  )
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onClick, color=C.green }) {
  return (
    <div onClick={onClick} style={{
      width:20, height:20, borderRadius:5, border:`2px solid ${checked?color:C.border}`,
      background:checked?color:'transparent', cursor:'pointer', flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s'
    }}>
      {checked && <CheckCircle size={12} color="#1a2a28"/>}
    </div>
  )
}

// ─── Checklist section ────────────────────────────────────────────────────────
function ChecklistSection({ task, onUpdate }) {
  const [newItem, setNewItem] = useState('')
  const done  = task.checklist?.filter(i=>i.completed).length||0
  const total = task.checklist?.length||0

  const toggle = async item => {
    await api.patch(`/tasks/${task.id}/checklist/${item.id}`, { completed:!item.completed })
    onUpdate()
  }
  const add = async () => {
    if(!newItem.trim()) return
    await api.post(`/tasks/${task.id}/checklist`, { label:newItem.trim() })
    setNewItem(''); onUpdate()
  }
  const del = async id => { await api.delete(`/tasks/${task.id}/checklist/${id}`); onUpdate() }

  return (
    <div>
      <SectionHead color={C.accent} label={`CHECKLISTA — ${done}/${total}`}/>
      <ProgBar done={done} total={total}/>
      <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:2 }}>
        {task.checklist?.map(item=>(
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background:item.completed?C.surface3+'44':'transparent' }}>
            <Checkbox checked={!!item.completed} onClick={()=>toggle(item)}/>
            <span style={{ flex:1, fontSize:13, color:item.completed?C.muted:C.gray, textDecoration:item.completed?'line-through':'none' }}>{item.label}</span>
            <button onClick={()=>del(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:2, opacity:.5 }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=.5}><X size={11}/></button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="Dodaj stavku checkliste..."
          onKeyDown={e=>e.key==='Enter'&&add()}
          style={{ ...S.input, flex:1, padding:'6px 10px', fontSize:12 }}/>
        <button onClick={add} style={{ ...S.btn(), padding:'6px 12px' }}><Plus size={13}/></button>
      </div>
    </div>
  )
}

// ─── Task detail modal ────────────────────────────────────────────────────────
function TaskModal({ task, users, onClose, onSaved }) {
  const isNew = !task?.id
  const [form, setForm] = useState({
    title:       task?.title||'',
    description: task?.description||'',
    assigned_to: task?.assigned_to||'',
    priority:    task?.priority||'normal',
    status:      task?.status||'open',
    module:      task?.module||'',
    due_date:    task?.due_date||'',
  })
  const [detail, setDetail] = useState(task)
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('info')
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const reload = async () => {
    if(!task?.id) return
    const r = await api.get(`/tasks/${task.id}`)
    setDetail(r.data)
  }
  const save = async () => {
    setSaving(true)
    try {
      if(isNew) await api.post('/tasks', form)
      else await api.put(`/tasks/${task.id}`, form)
      onSaved(); onClose()
    } catch(e) { alert(e.response?.data?.error||e.message) }
    setSaving(false)
  }
  const addComment = async () => {
    if(!newComment.trim()) return
    await api.post(`/tasks/${task.id}/comments`, { comment:newComment })
    setNewComment(''); reload()
  }

  const TABS = isNew
    ? [{id:'info',label:'INFO'}]
    : [{id:'info',label:'INFO'},{id:'checklist',label:'CHECKLISTA'},{id:'comments',label:'KOMENTARI'}]

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,20,18,.88)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:18, width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.5)' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:`1px solid ${C.border}44` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <CheckSquare size={18} color={C.accent}/>
            <span style={{ fontWeight:700, color:C.accent, letterSpacing:1.5, fontFamily:"'Chakra Petch',sans-serif", fontSize:14 }}>
              {isNew?'NOVI ZADATAK':'UREDI ZADATAK'}
            </span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={18}/></button>
        </div>

        {/* Sub tabs */}
        <div style={{ display:'flex', gap:2, padding:'10px 22px 0', borderBottom:`1px solid ${C.border}33` }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:'none', border:'none', cursor:'pointer', padding:'7px 14px', marginBottom:-1,
              color:tab===t.id?C.accent:C.muted, fontSize:11, fontWeight:700, letterSpacing:0.8,
              borderBottom:`2px solid ${tab===t.id?C.accent:'transparent'}`,
              fontFamily:"'Chakra Petch',sans-serif"
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', padding:'20px 22px', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
          {tab==='info' && (
            <>
              <div>
                <label style={S.label}>Naziv zadatka *</label>
                <input value={form.title} onChange={e=>F('title',e.target.value)} placeholder="Unesite naziv zadatka..." style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Opis</label>
                <textarea value={form.description} onChange={e=>F('description',e.target.value)} rows={3}
                  style={{ ...S.input, resize:'vertical', fontFamily:'inherit' }} placeholder="Detaljan opis..."/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div>
                  <label style={S.label}>Prioritet</label>
                  <select value={form.priority} onChange={e=>F('priority',e.target.value)} style={S.input}>
                    {Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select value={form.status} onChange={e=>F('status',e.target.value)} style={S.input}>
                    {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Modul</label>
                  <select value={form.module} onChange={e=>F('module',e.target.value)} style={S.input}>
                    <option value="">— svi —</option>
                    {MODULES.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={S.label}>Dodijeli korisniku</label>
                  <select value={form.assigned_to} onChange={e=>F('assigned_to',e.target.value)} style={S.input}>
                    <option value="">— nedodijeljeno —</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Rok (due date)</label>
                  <input type="date" value={form.due_date} onChange={e=>F('due_date',e.target.value)} style={S.input}/>
                </div>
              </div>
              {/* Quick verify section */}
              {!isNew && detail && (
                <div style={{ background:C.surface3+'66', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:10, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>BRZA VERIFIKACIJA</div>
                    <div style={{ fontSize:12, color:C.gray }}>Označi zadatak kao završen</div>
                  </div>
                  <button onClick={async()=>{ await api.patch(`/tasks/${task.id}/complete`); onSaved(); onClose() }}
                    style={{ ...S.btn(C.green), padding:'7px 14px', fontSize:12 }}>
                    <CheckCircle size={14}/> Verificiraj / Završi
                  </button>
                </div>
              )}
            </>
          )}

          {tab==='checklist' && detail && (
            <ChecklistSection task={detail} onUpdate={reload}/>
          )}

          {tab==='comments' && detail && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <SectionHead color={C.blue} label="KOMENTARI"/>
              {detail.comments?.length===0 && <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:20 }}>Nema komentara</div>}
              {detail.comments?.map(c=>(
                <div key={c.id} style={{ background:C.surface3+'55', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, color:C.accent, fontWeight:700 }}>{c.user_name}</span>
                    <span style={{ fontSize:10, color:C.muted }}>{new Date(c.created_at).toLocaleString('hr-HR')}</span>
                  </div>
                  <div style={{ fontSize:13, color:C.gray }}>{c.comment}</div>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Dodaj komentar..."
                  onKeyDown={e=>e.key==='Enter'&&addComment()}
                  style={{ ...S.input, flex:1, padding:'7px 10px', fontSize:12 }}/>
                <button onClick={addComment} style={{ ...S.btn(), padding:'7px 12px' }}><MessageSquare size={13}/></button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:10, padding:'14px 22px', borderTop:`1px solid ${C.border}44` }}>
          <button onClick={save} disabled={saving||!form.title.trim()} style={{ ...S.btn(), flex:1, justifyContent:'center', opacity:saving?.6:1 }}>
            <Save size={14}/>{saving?'Sprema...':'Spremi zadatak'}
          </button>
          <button onClick={onClose} style={S.ghost}><X size={14}/> Zatvori</button>
        </div>
      </div>
    </div>
  )
}

// ─── Assignment modal ─────────────────────────────────────────────────────────
function AssignModal({ task, users, onClose, onSaved }) {
  const [assignTo, setAssignTo] = useState(task.assigned_to||'')
  const save = async () => {
    await api.patch(`/tasks/${task.id}/assign`, { assigned_to:+assignTo })
    onSaved(); onClose()
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,20,18,.88)', backdropFilter:'blur(6px)', zIndex:210, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:18, width:'100%', maxWidth:380, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontWeight:700, color:C.accent, letterSpacing:1.5, fontFamily:"'Chakra Petch',sans-serif" }}>DODIJELI ZADATAK</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={18}/></button>
        </div>
        <div style={{ marginBottom:6, fontSize:11, color:C.muted, fontWeight:700, letterSpacing:1 }}>ZADATAK</div>
        <div style={{ fontSize:13, color:C.gray, marginBottom:16, padding:'8px 12px', background:C.surface3, borderRadius:8 }}>{task.title}</div>
        <label style={S.label}>Dodijeli korisniku</label>
        <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} style={{ ...S.input, marginBottom:16 }}>
          <option value="">— nedodijeljeno —</option>
          {users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
        </select>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={save} style={{ ...S.btn(), flex:1, justifyContent:'center' }}><User size={14}/> Dodijeli</button>
          <button onClick={onClose} style={S.ghost}><X size={13}/></button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuth()
  const [tasks,   setTasks]   = useState([])
  const [stats,   setStats]   = useState({})
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)   // null | {type:'edit',task} | {type:'new'} | {type:'assign',task}
  const [tab,     setTab]     = useState('all')
  const [filters, setFilters] = useState({ search:'', status:'', priority:'', module:'' })
  const [toast,   showToast]  = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t,s,u] = await Promise.all([api.get('/tasks'), api.get('/tasks/stats'), api.get('/users')])
      setTasks(t.data); setStats(s.data); setUsers(u.data)
    } catch(e) { showToast('Greška učitavanja','error') }
    setLoading(false)
  },[])
  useEffect(()=>{ load() },[load])

  const del = async id => { if(!confirm('Obrisati zadatak?')) return; await api.delete(`/tasks/${id}`); load() }
  const quickStatus = async (task, status) => { await api.patch(`/tasks/${task.id}/status`, { status }); load() }

  const filtered = tasks.filter(t => {
    if(tab==='my'      && t.assigned_to !== user?.id) return false
    if(tab==='urgent'  && t.priority !== 'urgent')    return false
    if(tab==='overdue' && !isOverdue(t.due_date,t.status)) return false
    if(tab==='open'    && !['open','in_progress','waiting'].includes(t.status)) return false
    if(filters.status   && t.status   !== filters.status)   return false
    if(filters.priority && t.priority !== filters.priority) return false
    if(filters.module   && t.module   !== filters.module)   return false
    if(filters.search   && !t.title?.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  const TABS = [
    { id:'all',     label:'SVI',        count:stats.total },
    { id:'open',    label:'OTVORENI',   count:(stats.open||0)+(stats.in_progress||0) },
    { id:'my',      label:'MOJI',       count:stats.my_open },
    { id:'urgent',  label:'HITNI',      count:stats.urgent_tasks },
    { id:'overdue', label:'KASNE',      count:stats.overdue_tasks },
  ]

  return (
    <div style={{ fontFamily:"'Chakra Petch',sans-serif", color:C.gray }}>
      {toast.visible && <div style={{ position:'fixed', top:20, right:20, background:toast.type==='error'?C.red:C.green, color:'#fff', padding:'12px 20px', borderRadius:10, zIndex:9999, fontWeight:700 }}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:4 }}>DEER MES v6</div>
          <h1 style={{ margin:0, fontSize:22, color:C.accent, letterSpacing:2 }}>✅ UPRAVLJANJE ZADACIMA</h1>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Kreiranje · Dodjela · Checkliste · Verifikacija</div>
        </div>
        <button onClick={()=>setModal({type:'new'})} style={S.btn()}>
          <Plus size={15}/> Novi zadatak
        </button>
      </div>

      {/* KPI tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <Tile label="Ukupno otvoreno" value={(stats.open||0)+(stats.in_progress||0)+(stats.waiting||0)} color={C.blue}/>
        <Tile label="Moji zadaci"     value={stats.my_open}       color={C.teal}/>
        <Tile label="Hitni"           value={stats.urgent_tasks}  color={C.red}   warn={stats.urgent_tasks>0}/>
        <Tile label="Kasni"           value={stats.overdue_tasks} color={C.orange} warn={stats.overdue_tasks>0}/>
      </div>

      {/* Filters bar */}
      <div style={{ ...S.card, padding:'14px 18px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        {/* Tabs */}
        <div style={{ display:'flex', background:C.surface3, borderRadius:8, padding:3, gap:2 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?`linear-gradient(145deg,${C.surface3},${C.surface})`:'transparent',
              border:tab===t.id?`1px solid ${C.border}`:'1px solid transparent',
              borderRadius:6, padding:'5px 11px', cursor:'pointer',
              color:tab===t.id?C.accent:C.muted, fontSize:10, fontWeight:700, letterSpacing:.8,
              display:'flex', alignItems:'center', gap:5, transition:'all .15s'
            }}>
              {t.label}
              {t.count>0&&<span style={{ background:tab===t.id?C.accent:C.surface, color:tab===t.id?'#1a2a28':C.muted, borderRadius:8, padding:'1px 5px', fontSize:9, fontWeight:700 }}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        {/* Search */}
        <div style={{ position:'relative' }}>
          <Search size={12} color={C.muted} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }}/>
          <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}
            placeholder="Pretraži..." style={{ ...S.input, width:170, paddingLeft:28, padding:'6px 10px 6px 28px', fontSize:12 }}/>
        </div>
        <select value={filters.status}   onChange={e=>setFilters(f=>({...f,status:e.target.value}))}   style={{ ...S.input, width:'auto', padding:'6px 10px', fontSize:12 }}>
          <option value="">Svi statusi</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.priority} onChange={e=>setFilters(f=>({...f,priority:e.target.value}))} style={{ ...S.input, width:'auto', padding:'6px 10px', fontSize:12 }}>
          <option value="">Svi prioriteti</option>
          {Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.module}   onChange={e=>setFilters(f=>({...f,module:e.target.value}))}   style={{ ...S.input, width:'auto', padding:'6px 10px', fontSize:12 }}>
          <option value="">Svi moduli</option>
          {MODULES.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ background:C.surface2 }}>
              <tr>
                {['','Zadatak','Prioritet','Status','Dodijeljen','Rok','Napredak',''].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:40, color:C.muted }}>Učitavanje...</td></tr>}
              {!loading && filtered.length===0 && (
                <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:48, color:C.muted }}>
                  <CheckSquare size={28} color={C.muted2} style={{ display:'block', margin:'0 auto 8px' }}/>
                  Nema zadataka
                </td></tr>
              )}
              {filtered.map(task => {
                const overdue = isOverdue(task.due_date, task.status)
                const pct = task.checklist_total>0 ? Math.round(task.checklist_done/task.checklist_total*100) : null
                return (
                  <tr key={task.id} style={{ cursor:'pointer', transition:'background .15s' }}
                    onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'}
                    onMouseOut={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>setModal({type:'edit', task})}>
                    {/* Quick checkbox */}
                    <td style={{ ...S.td, width:36 }} onClick={e=>{ e.stopPropagation(); quickStatus(task, task.status==='completed'?'open':'completed') }}>
                      <Checkbox checked={task.status==='completed'} onClick={()=>{}} color={C.green}/>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontWeight:600, color:task.status==='completed'?C.muted:'#E8F2F0', textDecoration:task.status==='completed'?'line-through':'none', fontSize:13 }}>
                        {task.title}
                      </div>
                      {task.module && <div style={{ fontSize:10, color:C.muted2, letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>{task.module}</div>}
                    </td>
                    <td style={S.td}><PriorityBadge priority={task.priority}/></td>
                    <td style={S.td}><StatusBadge status={task.status}/></td>
                    <td style={S.td}>
                      {task.assigned_to_name
                        ? <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <div style={{ width:24, height:24, borderRadius:'50%', background:`${C.teal}22`, border:`1px solid ${C.teal}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:C.teal, flexShrink:0 }}>
                              {task.assigned_to_name[0]}
                            </div>
                            <span style={{ fontSize:12 }}>{task.assigned_to_name}</span>
                          </div>
                        : <span style={{ color:C.muted, fontSize:12 }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize:12, color:overdue?C.red:C.muted, fontWeight:overdue?700:400, display:'flex', alignItems:'center', gap:4 }}>
                        {overdue&&<AlertTriangle size={11}/>}{fmtDate(task.due_date)}
                      </span>
                    </td>
                    <td style={{ ...S.td, minWidth:100 }}>
                      {pct!==null
                        ? <div>
                            <div style={{ height:5, background:C.surface3, borderRadius:3, overflow:'hidden', marginBottom:2 }}>
                              <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${C.teal},${C.teal}99)`, borderRadius:3 }}/>
                            </div>
                            <div style={{ fontSize:10, color:C.muted }}>{task.checklist_done}/{task.checklist_total} ({pct}%)</div>
                          </div>
                        : <span style={{ color:C.muted, fontSize:12 }}>—</span>}
                    </td>
                    <td style={S.td} onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button title="Dodijeli" onClick={()=>setModal({type:'assign',task})}
                          style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:3 }}
                          onMouseOver={e=>e.currentTarget.style.color=C.teal} onMouseOut={e=>e.currentTarget.style.color=C.muted}>
                          <User size={13}/>
                        </button>
                        <button title="Uredi" onClick={()=>setModal({type:'edit',task})}
                          style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:3 }}
                          onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.muted}>
                          <Edit2 size={13}/>
                        </button>
                        <button title="Obriši" onClick={()=>del(task.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:3 }}
                          onMouseOver={e=>e.currentTarget.style.color=C.red} onMouseOut={e=>e.currentTarget.style.color=C.muted}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'8px 14px', borderTop:`1px solid ${C.border}22`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, color:C.muted }}>{filtered.length} zadataka</span>
          <span style={{ fontSize:10, color:C.muted2 }}>Klik na redak → detalji | ✓ → brzo zatvaranje | <User size={9}/> → dodjela</span>
        </div>
      </div>

      {/* Modals */}
      {modal?.type==='new'    && <TaskModal task={null}       users={users} onClose={()=>setModal(null)} onSaved={()=>{ setModal(null); load() }}/>}
      {modal?.type==='edit'   && <TaskModal task={modal.task} users={users} onClose={()=>setModal(null)} onSaved={()=>{ setModal(null); load() }}/>}
      {modal?.type==='assign' && <AssignModal task={modal.task} users={users} onClose={()=>setModal(null)} onSaved={()=>{ setModal(null); load() }}/>}
    </div>
  )
}
