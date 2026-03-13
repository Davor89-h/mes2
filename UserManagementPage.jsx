import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Check, X, FolderOpen, FileText, AlertCircle } from 'lucide-react'

const STATUS_COLOR = { draft:C.muted, review:C.orange, approved:C.green, archived:C.blue }
const Inp = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}/></div>
const Sel = ({label,children,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}>{children}</select></div>
const Modal = ({title,onClose,children}) => <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:'100%',maxWidth:540,maxHeight:'90vh',overflowY:'auto',padding:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.accent,margin:0,fontSize:16}}>{title}</h3><X size={18} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/></div>{children}</div></div>
const Btn = ({onClick,children,color=C.accent,sm}) => <button onClick={onClick} style={{background:color,color:sm?C.gray:C.bg,border:'none',borderRadius:sm?6:8,padding:sm?'4px 10px':'8px 16px',cursor:'pointer',fontSize:sm?11:13,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>{children}</button>

export default function DMSPage() {
  const [tab, setTab] = useState('docs')
  const [docs, setDocs] = useState([])
  const [folders, setFolders] = useState([])
  const [expiring, setExpiring] = useState([])
  const [stats, setStats] = useState({})
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [selFolder, setSelFolder] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (selFolder) params.set('folder_id', selFolder)
      if (search) params.set('search', search)
      const [d, f, e, s] = await Promise.all([
        api.get('/dms/documents?' + params.toString()),
        api.get('/dms/folders'),
        api.get('/dms/expiring').catch(()=>({data:[]})),
        api.get('/dms/stats').catch(()=>({data:{}})),
      ])
      setDocs(d.data); setFolders(f.data); setExpiring(e.data); setStats(s.data)
    } catch { showToast('Greška','error') }
  }

  useEffect(()=>{ load() },[selFolder, search])

  const save = async () => {
    try {
      if (modal==='new-doc') await api.post('/dms/documents', {...form, folder_id:selFolder||undefined})
      if (modal==='new-folder') await api.post('/dms/folders', form)
      showToast('Uspješno!'); setModal(null); setForm({}); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const approve = async (id) => {
    try { await api.put(`/dms/documents/${id}/approve`); showToast('Dokument odobren!'); load() }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const deleteDoc = async (id) => {
    if (!confirm('Obrisati dokument?')) return
    try { await api.delete(`/dms/documents/${id}`); load() }
    catch { showToast('Greška brisanja','error') }
  }

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{color:C.accent,margin:0,fontSize:22}}>📁 UPRAVLJANJE DOKUMENTIMA</h1>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14}/></Btn>
          <Btn onClick={()=>{setForm({});setModal('new-folder')}} color={C.surface3}><FolderOpen size={14}/> Nova mapa</Btn>
          <Btn onClick={()=>{setForm({});setModal('new-doc')}}><Plus size={14}/> Novi dokument</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
        <StatCard label="Ukupno" value={stats.total||0} color="teal"/>
        <StatCard label="Odobreno" value={stats.approved||0} color="green"/>
        <StatCard label="Nacrt" value={stats.draft||0} color="blue"/>
        <StatCard label="Uskoro ističe" value={stats.expiring_soon||0} color="orange"/>
        <StatCard label="Isteklo" value={stats.expired||0} color="red"/>
      </div>

      {expiring.length>0 && (
        <div style={{background:`${C.orange}15`,border:`1px solid ${C.orange}44`,borderRadius:12,padding:'12px 18px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><AlertCircle size={14} style={{color:C.orange}}/><span style={{color:C.orange,fontSize:12,fontWeight:700}}>Dokumenti kojima uskoro ističe valjanost:</span></div>
          {expiring.slice(0,3).map(d=><div key={d.id} style={{fontSize:11,color:C.muted,marginTop:2}}>{d.name} — {new Date(d.validity_date).toLocaleDateString('hr')}</div>)}
        </div>
      )}

      <div style={{display:'flex',gap:16}}>
        {/* Folder sidebar */}
        <div style={{width:200,flexShrink:0}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:8,fontWeight:700,letterSpacing:1}}>MAPE</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <div onClick={()=>setSelFolder(null)} style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',background:!selFolder?`${C.accent}22`:'transparent',border:`1px solid ${!selFolder?C.accent:C.border}`,display:'flex',alignItems:'center',gap:8,fontSize:12,color:!selFolder?C.accent:C.gray}}>
              <FolderOpen size={12}/> Sve
            </div>
            {folders.map(f=>(
              <div key={f.id} onClick={()=>setSelFolder(selFolder===f.id?null:f.id)} style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',background:selFolder===f.id?`${C.accent}22`:'transparent',border:`1px solid ${selFolder===f.id?C.accent:C.border}`,display:'flex',alignItems:'center',gap:8,fontSize:12,color:selFolder===f.id?C.accent:C.gray}}>
                <FolderOpen size={12}/><span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                <span style={{fontSize:10,color:C.muted}}>{f.doc_count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div style={{flex:1}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pretraži dokument..." style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',color:C.gray,fontSize:13,outline:'none',width:'100%',marginBottom:12}}/>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {docs.map(d=>(
              <div key={d.id} style={{background:C.surface,border:`1px solid ${d.expired?C.red:d.expiring_soon?C.orange:C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:12,alignItems:'center'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <FileText size={14} style={{color:C.teal,flexShrink:0}}/>
                    <div style={{color:C.accent,fontWeight:700,fontSize:13}}>{d.name}</div>
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:2}}>v{d.revision} · {d.type||'—'} · {d.folder_name||'—'}</div>
                  {d.description && <div style={{color:C.muted,fontSize:11,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{d.description}</div>}
                </div>
                <div style={{fontSize:11}}><div style={{color:C.muted}}>Autor</div><div>{d.author||'—'}</div></div>
                <div style={{fontSize:11}}>
                  <div style={{color:C.muted}}>Valjanost</div>
                  <div style={{color:d.expired?C.red:d.expiring_soon?C.orange:C.gray}}>{d.validity_date?new Date(d.validity_date).toLocaleDateString('hr'):'—'}</div>
                </div>
                <span style={{background:`${STATUS_COLOR[d.status]||C.muted}22`,color:STATUS_COLOR[d.status]||C.muted,border:`1px solid ${STATUS_COLOR[d.status]||C.muted}44`,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700,display:'inline-block'}}>{d.status?.toUpperCase()}</span>
                <div style={{display:'flex',gap:6}}>
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:6,padding:'3px 8px',fontSize:11,textDecoration:'none',fontWeight:700}}>↗</a>}
                  {d.status!=='approved' && <Btn sm color={C.green+'33'} onClick={()=>approve(d.id)}><Check size={11}/></Btn>}
                  <Btn sm color={C.red+'22'} onClick={()=>deleteDoc(d.id)}><X size={11}/></Btn>
                </div>
              </div>
            ))}
            {docs.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema dokumenata{selFolder?' u ovoj mapi':''}</div>}
          </div>
        </div>
      </div>

      {modal==='new-doc' && <Modal title="Novi dokument" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <Sel label="TIP" {...inp('type')}><option value="">—</option><option value="crtež">Crtež</option><option value="instrukcija">Radna instrukcija</option><option value="procedura">Procedura</option><option value="certifikat">Certifikat</option><option value="specifikacija">Specifikacija</option><option value="ostalo">Ostalo</option></Sel>
          <Sel label="MAPA" {...inp('folder_id')}><option value="">—</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</Sel>
          <Inp label="OPIS" {...inp('description')}/>
          <Inp label="KLJUČNE RIJEČI (odvojene zarezom)" {...inp('_keywords_raw')} placeholder="crteži, aluminij, rev2"/>
          <Inp label="VALJANOST DO" type="date" {...inp('validity_date')}/>
          <Inp label="URL DOKUMENTA" {...inp('url')} placeholder="https://..."/>
          <Btn onClick={()=>save({...form,keywords:form._keywords_raw?form._keywords_raw.split(',').map(k=>k.trim()):[]})}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}

      {modal==='new-folder' && <Modal title="Nova mapa" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV MAPE *" {...inp('name')}/>
          <Sel label="NADREĐENA MAPA (opcionalno)" {...inp('parent_id')}><option value="">— Korijenski nivo —</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</Sel>
          <Btn onClick={save}><Check size={14}/> Kreiraj mapu</Btn>
        </div>
      </Modal>}
    </div>
  )
}
