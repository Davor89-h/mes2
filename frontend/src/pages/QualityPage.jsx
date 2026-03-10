import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Check, X, AlertCircle } from 'lucide-react'

const Inp = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}/></div>
const Sel = ({label,children,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}>{children}</select></div>
const Modal = ({title,onClose,children}) => <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',padding:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.accent,margin:0,fontSize:16}}>{title}</h3><X size={18} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/></div>{children}</div></div>
const Btn = ({onClick,children,color=C.accent,sm}) => <button onClick={onClick} style={{background:color,color:sm?C.gray:C.bg,border:'none',borderRadius:sm?6:8,padding:sm?'4px 10px':'8px 16px',cursor:'pointer',fontSize:sm?11:13,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>{children}</button>

export default function QualityPage() {
  const [tab, setTab] = useState('inspections')
  const [inspections, setInspections] = useState([])
  const [protocols, setProtocols] = useState([])
  const [instruments, setInstruments] = useState([])
  const [stats, setStats] = useState({})
  const [nokData, setNokData] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const [i, p, ins, s, nok] = await Promise.all([
        api.get('/quality/inspections'),
        api.get('/quality/protocols'),
        api.get('/quality/instruments'),
        api.get('/quality/stats').catch(()=>({data:{}})),
        api.get('/quality/nok-analysis').catch(()=>({data:[]})),
      ])
      setInspections(i.data); setProtocols(p.data); setInstruments(ins.data)
      setStats(s.data); setNokData(nok.data)
    } catch { showToast('Greška','error') }
  }

  useEffect(()=>{ load() },[])

  const save = async () => {
    try {
      if (modal==='new-proto') await api.post('/quality/protocols', form)
      if (modal==='new-instr') await api.post('/quality/instruments', form)
      if (modal==='new-insp') await api.post('/quality/inspections', form)
      showToast('Uspješno!'); setModal(null); setForm({}); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const decide = async (id, result) => {
    try {
      await api.put(`/quality/inspections/${id}/result`, { result })
      showToast('Rezultat spremljen!'); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})
  const RESULT_COLOR = { odobreno:C.green, odbijeno:C.red, uvjetno:C.orange, na_čekanju:C.muted }

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{color:C.accent,margin:0,fontSize:22}}>✅ KONTROLA KVALITETE</h1>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14}/></Btn>
          <Btn onClick={()=>{setForm({});setModal(tab==='instruments'?'new-instr':tab==='protocols'?'new-proto':'new-insp')}}><Plus size={14}/> Novi</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        <StatCard label="Odobreno (30d)" value={stats.approved||0} color="green"/>
        <StatCard label="Odbijeno (30d)" value={stats.rejected||0} color="red"/>
        <StatCard label="Na čekanju" value={stats.pending||0} color="orange"/>
        <StatCard label="Kalibracije uskoro" value={stats.calibrations_due||0} color="yellow"/>
        <StatCard label="NOK mjere (7d)" value={stats.nok_week||0} color="red"/>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['inspections','Inspekcije'],['protocols','Protokoli'],['instruments','Instrumenti'],['nok','NOK Analiza']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,background:tab===k?C.accent:'transparent',color:tab===k?C.bg:C.muted,border:`1px solid ${tab===k?C.accent:C.border}`}}>{l}</button>
        ))}
      </div>

      {tab==='inspections' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {inspections.map(i=>(
            <div key={i.id} style={{background:C.surface,border:`1px solid ${RESULT_COLOR[i.result]||C.border}44`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.accent,fontWeight:700,fontSize:13}}>{i.work_order_ref||'—'}</div><div style={{color:C.gray,fontSize:12}}>{i.project_name||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Tip</div><div style={{color:C.teal}}>{i.type?.toUpperCase()}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Inspektor</div><div>{i.inspector_name||'—'}</div></div>
              <span style={{background:`${RESULT_COLOR[i.result]||C.muted}22`,color:RESULT_COLOR[i.result]||C.muted,border:`1px solid ${RESULT_COLOR[i.result]||C.muted}44`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>{i.result?.toUpperCase()}</span>
              {i.result==='na_čekanju' && (
                <div style={{display:'flex',gap:6}}>
                  <Btn sm color={C.green+'33'} onClick={()=>decide(i.id,'odobreno')}><Check size={12}/>OK</Btn>
                  <Btn sm color={C.orange+'33'} onClick={()=>decide(i.id,'uvjetno')}>Uvj.</Btn>
                  <Btn sm color={C.red+'33'} onClick={()=>decide(i.id,'odbijeno')}><X size={12}/>NOK</Btn>
                </div>
              )}
            </div>
          ))}
          {inspections.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema inspekcija</div>}
        </div>
      )}

      {tab==='protocols' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
          {protocols.map(p=>(
            <div key={p.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{color:C.accent,fontWeight:700,marginBottom:4}}>{p.name}</div>
              <div style={{color:C.muted,fontSize:12}}>v{p.version} · {p.measure_count} mjera</div>
              {p.project_name && <div style={{color:C.teal,fontSize:11,marginTop:4}}>Projekt: {p.project_name}</div>}
              <div style={{marginTop:8}}><span style={{background:p.status==='aktivan'?`${C.green}22`:`${C.muted}22`,color:p.status==='aktivan'?C.green:C.muted,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{p.status?.toUpperCase()}</span></div>
            </div>
          ))}
          {protocols.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40,gridColumn:'1/-1'}}>Nema protokola</div>}
        </div>
      )}

      {tab==='instruments' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {instruments.map(ins=>(
            <div key={ins.id} style={{background:C.surface,border:`1px solid ${ins.calibration_due_soon?C.orange:C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:12,alignItems:'center'}}>
              <div>
                <div style={{color:C.accent,fontWeight:700}}>{ins.name}</div>
                <div style={{color:C.muted,fontSize:12}}>{ins.type} · {ins.manufacturer||'—'}</div>
                <div style={{color:C.muted,fontSize:11}}>SN: {ins.serial_number||'—'} · Loc: {ins.storage_location||'—'}</div>
              </div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Zadnja kalib.</div><div>{ins.last_calibration?new Date(ins.last_calibration).toLocaleDateString('hr'):'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Sljedeća kalib.</div><div style={{color:ins.calibration_due_soon?C.orange:C.gray}}>{ins.next_calibration?new Date(ins.next_calibration).toLocaleDateString('hr'):'—'}</div></div>
              <span style={{background:`${ins.status==='aktivan'?C.green:C.orange}22`,color:ins.status==='aktivan'?C.green:C.orange,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{ins.status?.toUpperCase()}</span>
              {ins.calibration_due_soon && <AlertCircle size={16} style={{color:C.orange}}/>}
            </div>
          ))}
          {instruments.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema mjernih instrumenata</div>}
        </div>
      )}

      {tab==='nok' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{color:C.muted,fontSize:12,marginBottom:8}}>TOP NOK mjere — zadnjih 30 dana</div>
          {nokData.map((n,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.red,fontWeight:700}}>{n.measure_name}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>NOK</div><div style={{color:C.red,fontWeight:700}}>{n.nok_count}×</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Nominal</div><div>{n.nominal||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Min/Max</div><div>{n.min_value!=null?parseFloat(n.min_value).toFixed(3):'—'} / {n.max_value!=null?parseFloat(n.max_value).toFixed(3):'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Tolerancija</div><div style={{color:C.teal}}>{n.tolerance_min||'—'} ~ {n.tolerance_max||'—'}</div></div>
            </div>
          ))}
          {nokData.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema NOK podataka za zadnjih 30 dana 👍</div>}
        </div>
      )}

      {modal==='new-insp' && <Modal title="Nova inspekcija" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Sel label="TIP" {...inp('type')}><option value="završna">Završna</option><option value="međufazna">Međufazna</option><option value="ulazna">Ulazna</option></Sel>
          <Inp label="NAPOMENA" {...inp('notes')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}

      {modal==='new-proto' && <Modal title="Novi mjerni protokol" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <Inp label="VERZIJA" {...inp('version')} placeholder="1.0"/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}

      {modal==='new-instr' && <Modal title="Novi mjerni instrument" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <Inp label="TIP (pomično, mikrometar...)" {...inp('type')}/>
          <Inp label="SERIJSKI BROJ" {...inp('serial_number')}/>
          <Inp label="ZADNJA KALIBRACIJA" type="date" {...inp('last_calibration')}/>
          <Inp label="SLJEDEĆA KALIBRACIJA" type="date" {...inp('next_calibration')}/>
          <Inp label="LOKACIJA POHRANE" {...inp('storage_location')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}
    </div>
  )
}
