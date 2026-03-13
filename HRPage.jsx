import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Check, X, AlertTriangle, Wrench, Clock } from 'lucide-react'

const PRIORITY_COLOR = { urgent: C.red, high: C.orange, normal: C.teal, low: C.muted }
const STATUS_COLOR = { open: C.orange, in_progress: C.blue, completed: C.green, cancelled: C.muted }

const Inp = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}/></div>
const Sel = ({label,children,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}>{children}</select></div>
const Textarea = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><textarea {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none',resize:'vertical',minHeight:70}}/></div>
const Modal = ({title,onClose,children}) => <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',padding:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.accent,margin:0,fontSize:16}}>{title}</h3><X size={18} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/></div>{children}</div></div>
const Btn = ({onClick,children,color=C.accent,sm,disabled}) => <button onClick={onClick} disabled={disabled} style={{background:color,color:C.bg,border:'none',borderRadius:sm?6:8,padding:sm?'4px 10px':'8px 16px',cursor:disabled?'not-allowed':'pointer',fontSize:sm?11:13,fontWeight:700,display:'flex',alignItems:'center',gap:4,opacity:disabled?.5:1}}>{children}</button>

const Pill = ({label,color}) => <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>{label?.toUpperCase()}</span>

export default function MachineMaintPage() {
  const [orders, setOrders] = useState([])
  const [machines, setMachines] = useState([])
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [filter, setFilter] = useState('all')
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const [mo, mc, us] = await Promise.all([
        api.get('/maintenance'),
        api.get('/machines'),
        api.get('/users').catch(()=>({data:[]}))
      ])
      setOrders(mo.data); setMachines(mc.data); setUsers(us.data)
    } catch { showToast('Greška učitavanja', 'error') }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    try {
      if (selected) {
        await api.put(`/maintenance/${selected.id}`, form)
      } else {
        await api.post('/maintenance', form)
      }
      showToast('Spremljeno!')
      setModal(null); setForm({}); setSelected(null)
      load()
    } catch(e) { showToast(e.response?.data?.error||'Greška', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Obrisati nalog?')) return
    await api.delete(`/maintenance/${id}`).catch(()=>{})
    showToast('Obrisano')
    load()
  }

  const handleStatus = async (id, status) => {
    await api.put(`/maintenance/${id}`, { status }).catch(()=>{})
    load()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const stats = {
    open: orders.filter(o=>o.status==='open').length,
    in_progress: orders.filter(o=>o.status==='in_progress').length,
    urgent: orders.filter(o=>o.priority==='urgent'&&o.status!=='completed').length,
    completed: orders.filter(o=>o.status==='completed').length,
  }

  const inp = k => ({ value: form[k]||'', onChange: e => setForm(p=>({...p,[k]:e.target.value})) })

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{color:C.accent,margin:0,fontSize:22}}>🔧 ODRŽAVANJE STROJEVA</h1>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14}/></Btn>
          <Btn onClick={()=>{setForm({type:'preventive',priority:'normal'});setSelected(null);setModal('form')}}><Plus size={14}/> Novi nalog</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        <StatCard label="Otvoreni" value={stats.open} color="orange"/>
        <StatCard label="U tijeku" value={stats.in_progress} color="teal"/>
        <StatCard label="Hitno!" value={stats.urgent} color="red"/>
        <StatCard label="Završeno" value={stats.completed} color="green"/>
      </div>

      {/* Filter tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['all','Svi'],['open','Otvoreni'],['in_progress','U tijeku'],['completed','Završeni']].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:'7px 16px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,background:filter===k?C.accent:'transparent',color:filter===k?C.bg:C.muted,border:`1px solid ${filter===k?C.accent:C.border}`,transition:'all .2s'}}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
              {['Stroj','Naziv','Tip','Prioritet','Status','Rok','Akcije'].map(h=>(
                <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o=>(
              <tr key={o.id} style={{borderBottom:`1px solid ${C.border}44`}} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'aa'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'12px 14px',fontSize:13}}><span style={{color:C.teal,fontWeight:600}}>{o.machine_name||'—'}</span></td>
                <td style={{padding:'12px 14px',fontSize:13}}>{o.title}<br/><span style={{fontSize:11,color:C.muted}}>{o.description?.slice(0,50)}</span></td>
                <td style={{padding:'12px 14px'}}><Pill label={o.type} color={o.type==='preventive'?C.teal:C.orange}/></td>
                <td style={{padding:'12px 14px'}}><Pill label={o.priority} color={PRIORITY_COLOR[o.priority]||C.muted}/></td>
                <td style={{padding:'12px 14px'}}><Pill label={o.status} color={STATUS_COLOR[o.status]||C.muted}/></td>
                <td style={{padding:'12px 14px',fontSize:12,color:o.scheduled_date&&new Date(o.scheduled_date)<new Date()&&o.status!=='completed'?C.red:C.muted}}>{o.scheduled_date||'—'}</td>
                <td style={{padding:'12px 14px'}}>
                  <div style={{display:'flex',gap:4}}>
                    {o.status==='open'&&<Btn sm color={C.teal+'33'} onClick={()=>handleStatus(o.id,'in_progress')}><Wrench size={12}/></Btn>}
                    {o.status==='in_progress'&&<Btn sm color={C.green+'33'} onClick={()=>handleStatus(o.id,'completed')}><Check size={12}/></Btn>}
                    <Btn sm color={C.accent+'22'} onClick={()=>{setSelected(o);setForm({...o,machine_id:o.machine_id||''});setModal('form')}}>✎</Btn>
                    <Btn sm color={C.red+'22'} onClick={()=>handleDelete(o.id)}>✕</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:C.muted}}>Nema naloga za održavanje</td></tr>}
          </tbody>
        </table>
      </div>

      {modal==='form' && (
        <Modal title={selected?'Uredi nalog':'Novi nalog za održavanje'} onClose={()=>{setModal(null);setForm({});setSelected(null)}}>
          <div style={{display:'grid',gap:14}}>
            <Sel label="STROJ" {...inp('machine_id')}>
              <option value="">— Odaberi stroj —</option>
              {machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </Sel>
            <Inp label="NAZIV NALOGA *" {...inp('title')} placeholder="npr. Preventivni servis Q1"/>
            <Textarea label="OPIS" {...inp('description')} placeholder="Detalji radova..."/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="TIP" {...inp('type')}>
                <option value="preventive">Preventivno</option>
                <option value="corrective">Korektivno</option>
                <option value="predictive">Prediktivno</option>
                <option value="emergency">Hitno</option>
              </Sel>
              <Sel label="PRIORITET" {...inp('priority')}>
                <option value="low">Nizak</option>
                <option value="normal">Normalan</option>
                <option value="high">Visok</option>
                <option value="urgent">Hitan</option>
              </Sel>
            </div>
            <Inp label="PLANIRANI DATUM" type="date" {...inp('scheduled_date')}/>
            {selected && (
              <Sel label="STATUS" {...inp('status')}>
                <option value="open">Otvoren</option>
                <option value="in_progress">U tijeku</option>
                <option value="completed">Završen</option>
                <option value="cancelled">Otkazan</option>
              </Sel>
            )}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <Btn color={C.surface3} onClick={()=>{setModal(null);setForm({});setSelected(null)}}>Odustani</Btn>
              <Btn onClick={handleSave} disabled={!form.title}><Check size={14}/> Spremi</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
