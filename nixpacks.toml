import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { C, useToast } from '../components/UI'
import { Wrench, AlertTriangle, CheckCircle, RefreshCcw, Plus, X, Save, RotateCcw } from 'lucide-react'

const STATUS_CFG = {
  ok:      { label:'OK',       color:C.green,  bg:C.green+'22'  },
  warning: { label:'Upozorenje',color:C.orange, bg:C.orange+'22' },
  replace: { label:'ZAMJENA!', color:C.red,    bg:C.red+'22'    },
}

function LifeBar({ pct, color }) {
  const c = pct >= 100 ? C.red : pct >= 85 ? C.orange : C.green
  return (
    <div style={{ width:'100%' }}>
      <div style={{ height:8, background:C.surface3, borderRadius:4, overflow:'hidden', marginBottom:3 }}>
        <div style={{ width:`${Math.min(100,pct)}%`, height:'100%',
          background:`linear-gradient(90deg,${c},${c}88)`, borderRadius:4, transition:'width .5s ease' }}/>
      </div>
      <div style={{ fontSize:10, color:c, fontWeight:600 }}>{Math.round(pct)}% životnog vijeka</div>
    </div>
  )
}

const S = {
  card:  { background: C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
  input: { background: C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.gray, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  label: { fontSize:11, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4, display:'block' },
  btn: (col=C.accent) => ({ background:col, border:'none', borderRadius:8, padding:'8px 16px', color:col===C.accent?'#1a2a28':C.gray, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }),
  ghost: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  th: { padding:'9px 12px', fontSize:10, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', textAlign:'left', borderBottom:`1px solid ${C.border}` },
  td: { padding:'10px 12px', fontSize:13, color:C.gray, borderBottom:`1px solid ${C.border}22` },
}

function ConfigModal({ open, onClose, onSave, tools, existing }) {
  const [form, setForm] = useState({ tool_id:'', life_limit_strokes:2000, life_limit_minutes:100, notes:'' })
  useEffect(() => {
    if (existing) setForm({ tool_id:existing.tool_id||'', life_limit_strokes:existing.life_limit_strokes||2000, life_limit_minutes:existing.life_limit_minutes||100, notes:existing.notes||'' })
    else setForm({ tool_id:'', life_limit_strokes:2000, life_limit_minutes:100, notes:'' })
  }, [open, existing])
  if (!open) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:480,maxWidth:'100%' }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:24 }}>
          <span style={{ fontSize:16,fontWeight:700,color:C.accent,letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif" }}>KONFIGURACIJA ŽIVOTNOG VIJEKA</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {!existing && (
            <div>
              <label style={S.label}>Alat *</label>
              <select style={S.input} value={form.tool_id} onChange={e=>setForm(f=>({...f,tool_id:e.target.value}))}>
                <option value="">— odaberi alat —</option>
                {tools.map(t=><option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={S.label}>Limit hodova (strokes)</label>
            <input type="number" style={S.input} value={form.life_limit_strokes} onChange={e=>setForm(f=>({...f,life_limit_strokes:parseInt(e.target.value)||0}))} min="0"/>
            <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>0 = ne prati hodove</div>
          </div>
          <div>
            <label style={S.label}>Limit minuta</label>
            <input type="number" style={S.input} value={form.life_limit_minutes} onChange={e=>setForm(f=>({...f,life_limit_minutes:parseFloat(e.target.value)||0}))} min="0" step="0.5"/>
            <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>0 = ne prati minute</div>
          </div>
          <div>
            <label style={S.label}>Napomena</label>
            <input style={S.input} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="npr. Oštri se kod 1800 hodova"/>
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:24 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn()} onClick={()=>onSave(form)}><Save size={14}/> Spremi</button>
        </div>
      </div>
    </div>
  )
}

function UseModal({ open, onClose, onSave, tool }) {
  const [strokes, setStrokes] = useState(0)
  const [minutes, setMinutes] = useState(0)
  useEffect(() => { setStrokes(0); setMinutes(0) }, [open])
  if (!open || !tool) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:18,padding:32,width:400 }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:20 }}>
          <span style={{ fontSize:15,fontWeight:700,color:C.accent,letterSpacing:1 }}>DODAJ UPOTREBU</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:C.muted,cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:16 }}>{tool.tool_name}</div>
        <div style={{ marginBottom:12 }}>
          <label style={S.label}>Hodovi (strokes)</label>
          <input type="number" style={S.input} value={strokes} onChange={e=>setStrokes(parseInt(e.target.value)||0)} min="0"/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={S.label}>Minute</label>
          <input type="number" style={S.input} value={minutes} onChange={e=>setMinutes(parseFloat(e.target.value)||0)} min="0" step="0.1"/>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:10 }}>
          <button style={S.ghost} onClick={onClose}>Odustani</button>
          <button style={S.btn(C.teal)} onClick={()=>{onSave(tool.id,strokes,minutes);onClose()}}><CheckCircle size={14}/> Dodaj</button>
        </div>
      </div>
    </div>
  )
}

export default function ToolLifePage() {
  const [list, setList] = useState([])
  const [alerts, setAlerts] = useState([])
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [useModal, setUseModal] = useState(false)
  const [useTool, setUseTool] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lifeR, alertsR, toolsR] = await Promise.all([
        api.get('/tool-life'),
        api.get('/tool-life/alerts/pending'),
        api.get('/tools'),
      ])
      setList(lifeR.data || [])
      setAlerts(alertsR.data || [])
      setTools(toolsR.data || [])
    } catch { showToast('Greška pri učitavanju', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async (form) => {
    try {
      await api.post('/tool-life', form)
      showToast('Konfiguracija spremljena')
      setModal(false); setEditItem(null); load()
    } catch { showToast('Greška', 'error') }
  }

  const recordUse = async (id, strokes, minutes) => {
    try {
      await api.patch(`/tool-life/${id}/use`, { strokes, minutes })
      showToast('Upotreba evidentirana')
      load()
    } catch { showToast('Greška', 'error') }
  }

  const resetTool = async (id) => {
    if (!confirm('Resetirati životni vijek? (npr. nakon oštrenja)')) return
    try {
      await api.patch(`/tool-life/${id}/reset`)
      showToast('Alat resetiran — životni vijek osvježen')
      load()
    } catch { showToast('Greška', 'error') }
  }

  const filtered = list.filter(t => {
    const ms = !search || t.tool_name?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase())
    const mf = filterStatus === 'all' || t.status === filterStatus
    return ms && mf
  })

  // Alati koji još nisu konfigurirani za praćenje
  const trackedToolIds = new Set(list.map(l => l.tool_id))
  const untrackedTools = tools.filter(t => !trackedToolIds.has(t.id))

  return (
    <div style={{ padding:24, maxWidth:1300, margin:'0 auto' }}>
      {toast.visible && <div style={{ position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',borderRadius:10,padding:'12px 22px',fontWeight:600,zIndex:9999 }}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
            <Wrench size={24} color={C.accent}/>
            <h1 style={{ color:C.accent,fontSize:22,fontWeight:700,margin:0,fontFamily:"'Chakra Petch',sans-serif",letterSpacing:1 }}>ŽIVOTNI VIJEK ALATA</h1>
          </div>
          <div style={{ color:C.muted,fontSize:13 }}>Praćenje habanja CNC alata — upozorenja i zamjena</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button style={S.ghost} onClick={load}><RefreshCcw size={14}/></button>
          <button style={S.btn()} onClick={()=>{setEditItem(null);setModal(true)}}><Plus size={14}/> Dodaj praćenje</button>
        </div>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div style={{ ...S.card, marginBottom:16, borderLeft:`4px solid ${C.red}`, background:`${C.red}08` }}>
          <div style={{ fontSize:11,color:C.red,letterSpacing:1.5,marginBottom:10,fontWeight:700,display:'flex',alignItems:'center',gap:6 }}>
            <AlertTriangle size={13}/> ZAHTIJEVA AKCIJU — {alerts.length} ALAT(A)
          </div>
          <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
            {alerts.map(a => (
              <div key={a.id} style={{ background:a.status==='replace'?`${C.red}22`:`${C.orange}22`, border:`1px solid ${a.status==='replace'?C.red:C.orange}44`, borderRadius:8, padding:'8px 14px' }}>
                <div style={{ fontSize:12,fontWeight:700,color:a.status==='replace'?C.red:C.orange }}>{a.tool_name}</div>
                <div style={{ fontSize:10,color:C.muted }}>{a.category} · {Math.round(a.life_pct)}% iskorišteno</div>
                <div style={{ fontSize:11,color:a.status==='replace'?C.red:C.orange,marginTop:3,fontWeight:600 }}>
                  {a.status==='replace'?'⛔ ZAMIJENI ODMAH':'⚠ Pripremi zamjenu'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        {[
          { label:'Praćenih alata', val:list.length,                           color:C.accent },
          { label:'OK',             val:list.filter(l=>l.status==='ok').length, color:C.green  },
          { label:'Upozorenje',     val:list.filter(l=>l.status==='warning').length, color:C.orange },
          { label:'Zamjena!',       val:list.filter(l=>l.status==='replace').length, color:C.red    },
        ].map(s=>(
          <div key={s.label} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 16px',borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:28,fontWeight:700,color:s.color,fontFamily:"'Chakra Petch',sans-serif" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...S.card, marginBottom:16, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder="Pretraži alate..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ ...S.input, maxWidth:260 }} />
        <div style={{ display:'flex',gap:6 }}>
          {['all','ok','warning','replace'].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              style={{ background:filterStatus===s?(STATUS_CFG[s]?.bg||C.accent+'22'):'transparent',
                       border:`1px solid ${filterStatus===s?(STATUS_CFG[s]?.color||C.accent):C.border}`,
                       color:filterStatus===s?(STATUS_CFG[s]?.color||C.accent):C.muted,
                       borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer' }}>
              {s==='all'?'Sve':STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...S.card, overflowX:'auto' }}>
        {loading ? (
          <div style={{ textAlign:'center',padding:40,color:C.muted }}>Učitavanje...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center',padding:60,color:C.muted }}>
            <Wrench size={40} style={{ opacity:.3,marginBottom:12 }}/>
            <div>Nema praćenih alata. Dodajte prvi!</div>
          </div>
        ) : (
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Alat','Kategorija','Status','Životni vijek','Hodovi','Minute','Akcije'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const st = STATUS_CFG[t.status] || STATUS_CFG.ok
                return (
                  <tr key={t.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...S.td, fontWeight:700 }}>{t.tool_name}</td>
                    <td style={{ ...S.td, color:C.muted }}>{t.category}</td>
                    <td style={S.td}>
                      <span style={{ background:st.bg,color:st.color,borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, minWidth:180 }}>
                      <LifeBar pct={parseFloat(t.life_pct)||0}/>
                    </td>
                    <td style={{ ...S.td, color:C.muted }}>
                      {t.life_limit_strokes>0 ? `${t.strokes_used} / ${t.life_limit_strokes}` : '—'}
                    </td>
                    <td style={{ ...S.td, color:C.muted }}>
                      {t.life_limit_minutes>0 ? `${Math.round(t.minutes_used*10)/10} / ${t.life_limit_minutes}` : '—'}
                    </td>
                    <td style={S.td}>
                      <div style={{ display:'flex',gap:4 }}>
                        <button style={{ ...S.ghost,padding:'4px 8px',color:C.teal }} title="Dodaj upotrebu" onClick={()=>{setUseTool(t);setUseModal(true)}}>+</button>
                        <button style={{ ...S.ghost,padding:'4px 8px',color:C.blue }} title="Konfiguriraj" onClick={()=>{setEditItem(t);setModal(true)}}><Save size={11}/></button>
                        <button style={{ ...S.ghost,padding:'4px 8px',color:C.orange }} title="Reset (oštrenje)" onClick={()=>resetTool(t.id)}><RotateCcw size={11}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Untracked tools */}
      {untrackedTools.length > 0 && (
        <div style={{ ...S.card, marginTop:16 }}>
          <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,marginBottom:12 }}>ALATI BEZ PRAĆENJA ({untrackedTools.length})</div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {untrackedTools.map(t=>(
              <button key={t.id} style={{ ...S.ghost,fontSize:11,padding:'4px 10px' }}
                onClick={()=>{setEditItem(null);setModal(true)}}>
                + {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <ConfigModal open={modal} onClose={()=>{setModal(false);setEditItem(null)}} onSave={saveConfig} tools={untrackedTools} existing={editItem}/>
      <UseModal open={useModal} onClose={()=>{setUseModal(false);setUseTool(null)}} onSave={recordUse} tool={useTool}/>
    </div>
  )
}
