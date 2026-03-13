import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Check, X, UserCheck, UserX, Calendar } from 'lucide-react'

const Inp = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}/></div>
const Sel = ({label,children,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}>{children}</select></div>
const Modal = ({title,onClose,children}) => <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',padding:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.accent,margin:0,fontSize:16}}>{title}</h3><X size={18} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/></div>{children}</div></div>
const Btn = ({onClick,children,color=C.accent,sm}) => <button onClick={onClick} style={{background:color,color:sm?C.gray:C.bg,border:'none',borderRadius:sm?6:8,padding:sm?'4px 10px':'8px 16px',cursor:'pointer',fontSize:sm?11:13,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>{children}</button>

export default function HRPage() {
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [trainings, setTrainings] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({})
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const [e, att, l, t, u, s] = await Promise.all([
        api.get('/hr'),
        api.get('/hr/attendance/today').catch(()=>({data:[]})),
        api.get('/hr/leaves/all').catch(()=>({data:[]})),
        api.get('/hr/trainings/all').catch(()=>({data:[]})),
        api.get('/users').catch(()=>({data:[]})),
        api.get('/hr/stats').catch(()=>({data:{}})),
      ])
      setEmployees(e.data); setAttendance(att.data); setLeaves(l.data)
      setTrainings(t.data); setUsers(u.data); setStats(s.data)
    } catch { showToast('Greška','error') }
  }

  useEffect(()=>{ load() },[])

  const save = async () => {
    try {
      if (modal==='new-emp') await api.post('/hr', form)
      if (modal==='new-leave') await api.post('/hr/leaves', form)
      if (modal==='new-training') await api.post('/hr/trainings', form)
      showToast('Uspješno!'); setModal(null); setForm({}); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const checkin = async (employee_id) => {
    try { await api.post('/hr/attendance/checkin', {employee_id}); showToast('Check-in!'); load() }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }
  const checkout = async (employee_id) => {
    try { await api.post('/hr/attendance/checkout', {employee_id}); showToast('Check-out!'); load() }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }
  const decideLeave = async (id, status) => {
    try { await api.put(`/hr/leaves/${id}/decide`, {status}); showToast('OK'); load() }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  const todayById = {}
  attendance.forEach(a => { todayById[a.employee_id] = a })

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{color:C.accent,margin:0,fontSize:22}}>👥 LJUDSKI RESURSI</h1>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14}/></Btn>
          <Btn onClick={()=>{setForm({});setModal(tab==='leaves'?'new-leave':tab==='trainings'?'new-training':'new-emp')}}><Plus size={14}/> Novo</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        <StatCard label="Ukupno zaposlen." value={stats.total||0} color="teal"/>
        <StatCard label="Prisutni danas" value={stats.present_today||0} color="green"/>
        <StatCard label="Na godišnjem" value={stats.on_leave||0} color="orange"/>
        <StatCard label="Zahtjevi dopusta" value={stats.pending_leaves||0} color="yellow"/>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['employees','Zaposlenici'],['attendance','Prisutnost danas'],['leaves','Dopusti'],['trainings','Edukacije']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,background:tab===k?C.accent:'transparent',color:tab===k?C.bg:C.muted,border:`1px solid ${tab===k?C.accent:C.border}`}}>{l}{k==='leaves'&&stats.pending_leaves>0?<span style={{marginLeft:6,background:C.orange,color:C.bg,borderRadius:10,padding:'0 6px',fontSize:10}}>{stats.pending_leaves}</span>:null}</button>
        ))}
      </div>

      {tab==='employees' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {employees.map(e=>{
            const att = todayById[e.id]
            return (
              <div key={e.id} style={{background:C.surface,border:`1px solid ${att?.check_in&&!att?.check_out?C.green:C.border}`,borderRadius:12,padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div>
                    <div style={{color:C.accent,fontWeight:700}}>{e.first_name} {e.last_name}</div>
                    <div style={{color:C.muted,fontSize:12}}>{e.position||'—'} · {e.department||'—'}</div>
                  </div>
                  {att?.check_in&&!att?.check_out
                    ? <span style={{background:`${C.green}22`,color:C.green,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>PRISUTAN</span>
                    : <span style={{background:`${C.muted}22`,color:C.muted,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>ODSUTAN</span>
                  }
                </div>
                <div style={{fontSize:11,color:C.muted}}>
                  {att?.check_in && <span>Ulaz: {new Date(att.check_in).toLocaleTimeString('hr',{hour:'2-digit',minute:'2-digit'})}</span>}
                  {att?.check_out && <span style={{marginLeft:8}}>Izlaz: {new Date(att.check_out).toLocaleTimeString('hr',{hour:'2-digit',minute:'2-digit'})}</span>}
                </div>
                <div style={{display:'flex',gap:6,marginTop:10}}>
                  {!att?.check_in && <Btn sm color={C.green+'33'} onClick={()=>checkin(e.id)}><UserCheck size={12}/>Ulaz</Btn>}
                  {att?.check_in && !att?.check_out && <Btn sm color={C.orange+'33'} onClick={()=>checkout(e.id)}><UserX size={12}/>Izlaz</Btn>}
                </div>
              </div>
            )
          })}
          {employees.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40,gridColumn:'1/-1'}}>Nema zaposlenika</div>}
        </div>
      )}

      {tab==='attendance' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {attendance.map(a=>(
            <div key={a.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.accent,fontWeight:700}}>{a.name}</div><div style={{color:C.muted,fontSize:12}}>{a.department||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Ulaz</div><div style={{color:C.green}}>{a.check_in?new Date(a.check_in).toLocaleTimeString('hr',{hour:'2-digit',minute:'2-digit'}):'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Izlaz</div><div style={{color:C.orange}}>{a.check_out?new Date(a.check_out).toLocaleTimeString('hr',{hour:'2-digit',minute:'2-digit'}):'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Sati</div><div>{a.hours_regular||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Smjena</div><div>{a.shift||'—'}</div></div>
            </div>
          ))}
          {attendance.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nitko se još nije prijavio danas</div>}
        </div>
      )}

      {tab==='leaves' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {leaves.map(l=>(
            <div key={l.id} style={{background:C.surface,border:`1px solid ${l.status==='pending'?C.orange:C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.accent,fontWeight:700}}>{l.employee_name}</div><div style={{color:C.muted,fontSize:12}}>{l.department||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Tip</div><div style={{color:C.teal}}>{l.type}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Period</div><div>{new Date(l.start_date).toLocaleDateString('hr')} – {new Date(l.end_date).toLocaleDateString('hr')}</div></div>
              <span style={{background:l.status==='approved'?`${C.green}22`:l.status==='rejected'?`${C.red}22`:`${C.orange}22`,color:l.status==='approved'?C.green:l.status==='rejected'?C.red:C.orange,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{l.status?.toUpperCase()}</span>
              {l.status==='pending' && <div style={{display:'flex',gap:6}}>
                <Btn sm color={C.green+'33'} onClick={()=>decideLeave(l.id,'approved')}><Check size={12}/></Btn>
                <Btn sm color={C.red+'33'} onClick={()=>decideLeave(l.id,'rejected')}><X size={12}/></Btn>
              </div>}
            </div>
          ))}
          {leaves.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema zahtjeva za dopust</div>}
        </div>
      )}

      {tab==='trainings' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {trainings.map(t=>(
            <div key={t.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{color:C.accent,fontWeight:700,marginBottom:4}}>{t.name}</div>
              <div style={{color:C.muted,fontSize:12}}>{t.type==='internal'?'Interna':'Externa'} · {t.duration_hours}h</div>
              {t.start_date && <div style={{color:C.muted,fontSize:11,marginTop:4}}><Calendar size={11} style={{display:'inline',marginRight:4}}/>{new Date(t.start_date).toLocaleDateString('hr')}</div>}
              <div style={{color:C.muted,fontSize:11,marginTop:4}}>Polaznici: {t.attendee_count}</div>
              <span style={{marginTop:8,display:'inline-block',background:t.status==='completed'?`${C.green}22`:`${C.blue}22`,color:t.status==='completed'?C.green:C.blue,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{t.status?.toUpperCase()}</span>
            </div>
          ))}
          {trainings.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40,gridColumn:'1/-1'}}>Nema edukacija</div>}
        </div>
      )}

      {modal==='new-emp' && <Modal title="Novi zaposlenik" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Sel label="KORISNIK *" {...inp('user_id')}><option value="">— Odaberi —</option>{users.map(u=><option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>)}</Sel>
          <Inp label="ODJEL" {...inp('department')}/>
          <Inp label="RADNO MJESTO" {...inp('position')}/>
          <Sel label="TIP UGOVORA" {...inp('contract_type')}><option value="full_time">Puno radno</option><option value="part_time">Pola radnog</option><option value="temporary">Privremeni</option></Sel>
          <Inp label="DATUM ZAPOSLENJA" type="date" {...inp('hire_date')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}

      {modal==='new-leave' && <Modal title="Zahtjev za dopust" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Sel label="ZAPOSLENIK *" {...inp('employee_id')}><option value="">— Odaberi —</option>{employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</Sel>
          <Sel label="TIP" {...inp('type')}><option value="vacation">Godišnji odmor</option><option value="sick">Bolovanje</option><option value="personal">Osobni</option><option value="maternity">Rodiljni</option></Sel>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Inp label="OD *" type="date" {...inp('start_date')}/>
            <Inp label="DO *" type="date" {...inp('end_date')}/>
          </div>
          <Inp label="RAZLOG" {...inp('reason')}/>
          <Btn onClick={save}><Check size={14}/> Pošalji zahtjev</Btn>
        </div>
      </Modal>}

      {modal==='new-training' && <Modal title="Nova edukacija" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <Sel label="TIP" {...inp('type')}><option value="internal">Interna</option><option value="external">Externa</option></Sel>
          <Inp label="DATUM" type="date" {...inp('start_date')}/>
          <Inp label="TRAJANJE (sati)" type="number" {...inp('duration_hours')}/>
          <Inp label="PREDAVAČ" {...inp('trainer')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}
    </div>
  )
}
