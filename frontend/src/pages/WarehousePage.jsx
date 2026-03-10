import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Check, X, AlertTriangle } from 'lucide-react'

const Inp = ({label,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}/></div>
const Sel = ({label,children,...p}) => <div style={{display:'flex',flexDirection:'column',gap:4}}><label style={{fontSize:11,color:C.muted}}>{label}</label><select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.gray,fontSize:13,outline:'none'}}>{children}</select></div>
const Modal = ({title,onClose,children}) => <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',padding:28}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}><h3 style={{color:C.accent,margin:0,fontSize:16}}>{title}</h3><X size={18} style={{cursor:'pointer',color:C.muted}} onClick={onClose}/></div>{children}</div></div>
const Btn = ({onClick,children,color=C.accent,sm}) => <button onClick={onClick} style={{background:color,color:sm?C.gray:C.bg,border:'none',borderRadius:sm?6:8,padding:sm?'4px 10px':'8px 16px',cursor:'pointer',fontSize:sm?11:13,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>{children}</button>

export default function WarehousePage() {
  const [tab, setTab] = useState('materials')
  const [materials, setMaterials] = useState([])
  const [stocks, setStocks] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [partners, setPartners] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [toast, showToast] = useToast()

  const load = async () => {
    try {
      const [m, s, ls, w, p] = await Promise.all([
        api.get('/warehouse/materials'),
        api.get('/warehouse/stocks'),
        api.get('/warehouse/materials/low-stock').catch(()=>({data:[]})),
        api.get('/warehouse/warehouses').catch(()=>({data:[]})),
        api.get('/sales/partners').catch(()=>({data:[]})),
      ])
      setMaterials(m.data); setStocks(s.data); setLowStock(ls.data)
      setWarehouses(w.data); setPartners(p.data)
    } catch { showToast('Greška','error') }
  }

  useEffect(()=>{ load() },[])

  const save = async () => {
    try {
      if (modal==='new-mat') await api.post('/warehouse/materials', form)
      if (modal==='receive') await api.post('/warehouse/stocks/receive', form)
      if (modal==='new-wh') await api.post('/warehouse/warehouses', form)
      showToast('Uspješno!'); setModal(null); setForm({}); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
  }

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1 style={{color:C.accent,margin:0,fontSize:22}}>📦 SKLADIŠTE</h1>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14}/></Btn>
          <Btn onClick={()=>{setForm({});setModal(tab==='stocks'?'receive':tab==='warehouses'?'new-wh':'new-mat')}}><Plus size={14}/> Novo</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        <StatCard label="Materijali" value={materials.length} color="teal"/>
        <StatCard label="Zalihe (stavke)" value={stocks.length} color="blue"/>
        <StatCard label="Niska zaliha!" value={lowStock.length} color="red"/>
        <StatCard label="Skladišta" value={warehouses.length} color="yellow"/>
      </div>

      {lowStock.length>0 && (
        <div style={{background:`${C.red}15`,border:`1px solid ${C.red}44`,borderRadius:12,padding:'12px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <AlertTriangle size={16} style={{color:C.red,flexShrink:0}}/>
          <div style={{fontSize:13,color:C.red}}>⚠️ Niska zaliha: {lowStock.map(m=>m.name).join(', ')}</div>
        </div>
      )}

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['materials','Materijali'],['stocks','Zalihe / Šarže'],['warehouses','Skladišta']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,background:tab===k?C.accent:'transparent',color:tab===k?C.bg:C.muted,border:`1px solid ${tab===k?C.accent:C.border}`}}>{l}</button>
        ))}
      </div>

      {tab==='materials' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {materials.map(m=>(
            <div key={m.id} style={{background:C.surface,border:`1px solid ${parseFloat(m.total_stock)<=parseFloat(m.min_stock)?C.red:C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.accent,fontWeight:700}}>{m.name}</div><div style={{color:C.muted,fontSize:11}}>{m.internal_id} · {m.type} · {m.unit}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Slobodna zaliha</div><div style={{color:parseFloat(m.total_stock)<=parseFloat(m.min_stock)?C.red:C.gray,fontWeight:700}}>{parseFloat(m.total_stock||0).toFixed(2)} {m.unit}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Min zaliha</div><div>{m.min_stock} {m.unit}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Dobavljač</div><div style={{color:C.teal}}>{m.supplier||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Lokacija</div><div>{m.storage_location||'—'}</div></div>
            </div>
          ))}
          {materials.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema materijala</div>}
        </div>
      )}

      {tab==='stocks' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {stocks.map(s=>(
            <div key={s.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:12,alignItems:'center'}}>
              <div><div style={{color:C.accent,fontWeight:700}}>{s.material_name}</div><div style={{color:C.muted,fontSize:11}}>Šarža: {s.internal_batch||'—'} {s.external_batch&&`· Ext: ${s.external_batch}`}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Količina</div><div style={{color:C.gray,fontWeight:700}}>{parseFloat(s.quantity||0).toFixed(3)} {s.unit}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Dobavljač</div><div>{s.supplier_name||'—'}</div></div>
              <div style={{fontSize:12}}><div style={{color:C.muted}}>Skladište</div><div style={{color:C.teal}}>{s.warehouse_name||'—'}</div></div>
              <span style={{background:`${s.status==='slobodan'?C.green:C.orange}22`,color:s.status==='slobodan'?C.green:C.orange,borderRadius:12,padding:'2px 8px',fontSize:10,fontWeight:700}}>{s.status?.toUpperCase()}</span>
            </div>
          ))}
          {stocks.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40}}>Nema zaliha — napravite primku</div>}
        </div>
      )}

      {tab==='warehouses' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
          {warehouses.map(w=>(
            <div key={w.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{color:C.accent,fontWeight:700,marginBottom:4}}>{w.name}</div>
              <div style={{color:C.muted,fontSize:12}}>{w.type?.toUpperCase()} · {w.location||'—'}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:4}}>{w.stock_count} zaliha</div>
            </div>
          ))}
          {warehouses.length===0 && <div style={{color:C.muted,textAlign:'center',padding:40,gridColumn:'1/-1'}}>Nema skladišta</div>}
        </div>
      )}

      {modal==='new-mat' && <Modal title="Novi materijal" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Sel label="TIP" {...inp('type')}><option value="raw">Sirovina</option><option value="semi">Poluproizvod</option><option value="finished">Gotovi</option><option value="purchased">Kupljeni</option></Sel>
            <Inp label="JED. MJERE" {...inp('unit')} placeholder="kom"/>
          </div>
          <Inp label="INTERNI KOD" {...inp('internal_id')}/>
          <Inp label="MIN ZALIHA" type="number" {...inp('min_stock')} placeholder="0"/>
          <Inp label="LOKACIJA POHRANE" {...inp('storage_location')}/>
          <Inp label="DOBAVLJAČ" {...inp('supplier')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}

      {modal==='receive' && <Modal title="Primka — ulaz materijala" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Sel label="MATERIJAL *" {...inp('material_id')}><option value="">— Odaberi —</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.internal_id||'—'})</option>)}</Sel>
          <Sel label="SKLADIŠTE" {...inp('warehouse_id')}><option value="">—</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</Sel>
          <Sel label="DOBAVLJAČ" {...inp('supplier_id')}><option value="">—</option>{partners.filter(p=>p.type!=='customer').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
          <Inp label="KOLIČINA *" type="number" {...inp('quantity')}/>
          <Inp label="MASA (kg)" type="number" {...inp('mass_kg')}/>
          <Inp label="BROJ ŠARŽE DOBAVLJAČA" {...inp('external_batch')}/>
          <Btn onClick={save}><Check size={14}/> Potvrdi primku</Btn>
        </div>
      </Modal>}

      {modal==='new-wh' && <Modal title="Novo skladište" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gap:14}}>
          <Inp label="NAZIV *" {...inp('name')}/>
          <Sel label="TIP" {...inp('type')}><option value="main">Glavno</option><option value="production">Produkcijsko</option><option value="finished">Gotovi proizvodi</option><option value="external">Vanjsko</option></Sel>
          <Inp label="LOKACIJA" {...inp('location')}/>
          <Btn onClick={save}><Check size={14}/> Spremi</Btn>
        </div>
      </Modal>}
    </div>
  )
}
