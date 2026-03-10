import { useState, useEffect, useCallback } from 'react'
import { C, Btn, useToast } from '../components/UI'
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Plus, RefreshCw,
  ChevronRight, X, Check, Trash2, Edit2, BarChart3, Wrench,
  ClipboardList, Shield, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  LineChart, Line, ReferenceLine, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import api from '../utils/api'

// ─── constants ────────────────────────────────────────────────────────────────
const RESULT_COLOR = {
  odobreno:   '#4ADE80',
  odbijeno:   '#F87171',
  uvjetno:    '#FB923C',
  'na_čekanju': '#F5BC54',
}
const RESULT_LABEL = {
  odobreno:'Odobreno', odbijeno:'Odbijeno',
  uvjetno:'Uvjetno', 'na_čekanju':'Na čekanju',
}
const STATUS_COLOR = { aktivan:'#4ADE80', na_kalibraciji:'#F5BC54', u_kvaru:'#F87171', neaktivan:'#6B7280' }

// ─── reusable micro-components ───────────────────────────────────────────────
const Inp = ({label,w,...p}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4,gridColumn:w?`span ${w}`:undefined}}>
    {label&&<label style={{fontSize:10,color:C.muted,letterSpacing:1}}>{label}</label>}
    <input {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,
      padding:'8px 12px',color:'#e8f0ee',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',...(p.style||{})}}/>
  </div>
)
const Sel = ({label,children,w,...p}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4,gridColumn:w?`span ${w}`:undefined}}>
    {label&&<label style={{fontSize:10,color:C.muted,letterSpacing:1}}>{label}</label>}
    <select {...p} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,
      padding:'8px 12px',color:'#e8f0ee',fontSize:13,outline:'none',...(p.style||{})}}>
      {children}
    </select>
  </div>
)

function Modal({title,onClose,children,wide}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,
        width:'100%',maxWidth:wide?780:560,maxHeight:'92vh',overflowY:'auto',padding:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:'#e8f0ee'}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Badge({label,color}) {
  return <span style={{fontSize:9,padding:'3px 8px',borderRadius:10,background:`${color}20`,
    color,border:`1px solid ${color}40`,fontWeight:700,letterSpacing:.5}}>{label}</span>
}

function KpiCard({label,value,color,sub,icon:Icon}) {
  return (
    <div style={{background:`linear-gradient(145deg,${C.surface},${C.surface2})`,
      border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,
        background:`linear-gradient(90deg,${color},${color}55)`}}/>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
        {Icon&&<Icon size={11} color={color}/>}
        <span style={{fontSize:9,color:C.muted,letterSpacing:1}}>{label.toUpperCase()}</span>
      </div>
      <div style={{fontSize:24,fontWeight:800,color,fontFamily:"'Chakra Petch',sans-serif",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:C.muted2,marginTop:4}}>{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: INSPECTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function InspectionsTab({protocols, workOrders, onRefresh, toast}) {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)   // 'new' | 'detail' | 'measure'
  const [sel, setSel]         = useState(null)
  const [form, setForm]       = useState({type:'završna',quantity:1})
  const [measureForm, setMeasureForm] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try { setList((await api.get('/quality/inspections')).data) }
    catch(e) { toast(e.response?.data?.error||'Greška','error') }
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ load() },[load])

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  const save = async () => {
    try {
      await api.post('/quality/inspections', form)
      toast('Inspekcija kreirana!'); setModal(null); setForm({type:'završna',quantity:1}); load(); onRefresh()
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const decide = async (id, result) => {
    try {
      await api.put(`/quality/inspections/${id}/result`, {result})
      toast(`Rezultat: ${RESULT_LABEL[result]}`); load(); onRefresh()
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const remove = async (id) => {
    if (!confirm('Obriši inspekciju i sve mjere?')) return
    try { await api.delete(`/quality/inspections/${id}`); toast('Obrisano'); load(); onRefresh() }
    catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const openDetail = async (insp) => {
    try {
      const r = await api.get(`/quality/inspections/${insp.id}`)
      setSel(r.data); setModal('detail')
    } catch(e){ toast('Greška','error') }
  }

  const openMeasure = async (insp) => {
    // Load protocol measures to pre-fill form
    const proto = insp.protocol_id
      ? protocols.find(p=>p.id===insp.protocol_id)
      : null
    let measures = []
    if (proto) {
      try {
        const r = await api.get(`/quality/protocols/${proto.id}`)
        measures = r.data.measures||[]
      } catch(e){}
    }
    setSel({...insp, proto_measures: measures})
    // Init rows — one row per measure or empty row if no protocol
    const rows = measures.length
      ? measures.map(m=>({measure_id:m.id, measure_name:m.name, nominal:m.nominal,
          tolerance_min:m.tolerance_min, tolerance_max:m.tolerance_max,
          unit:m.unit||'mm', measured_value:'', sample_number:1}))
      : [{measure_name:'',nominal:'',tolerance_min:'',tolerance_max:'',unit:'mm',measured_value:'',sample_number:1}]
    setMeasureForm({rows, sample_number:1})
    setModal('measure')
  }

  const saveMeasures = async () => {
    const results = measureForm.rows
      .filter(r=>r.measure_name&&r.measured_value!=='')
      .map(r=>({...r, sample_number: parseInt(measureForm.sample_number)||1}))
    if (!results.length) return toast('Unesite barem jednu izmjenu','error')
    try {
      const r = await api.post(`/quality/inspections/${sel.id}/results`, {results})
      toast(r.data.nok_found ? '⚠️ Pronađene NOK mjere!' : '✅ Mjere spremljene!')
      setModal(null); load(); onRefresh()
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const updateRow = (i,k,v) => setMeasureForm(f=>({...f,rows:f.rows.map((r,idx)=>idx===i?{...r,[k]:v}:r)}))
  const addRow = () => setMeasureForm(f=>({...f,rows:[...f.rows,{measure_name:'',nominal:'',tolerance_min:'',tolerance_max:'',unit:'mm',measured_value:'',sample_number:1}]}))
  const removeRow = i => setMeasureForm(f=>({...f,rows:f.rows.filter((_,idx)=>idx!==i)}))

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:1.5}}>{list.length} INSPEKCIJA</div>
        <Btn sm onClick={()=>{setForm({type:'završna',quantity:1});setModal('new')}}>
          <Plus size={13} style={{marginRight:5}}/>Nova inspekcija
        </Btn>
      </div>

      {loading ? <div style={{textAlign:'center',padding:40,color:C.muted}}>Učitavanje...</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {list.map(i=>{
            const rc = RESULT_COLOR[i.result]||C.muted
            return (
              <div key={i.id} style={{background:C.surface,border:`1px solid ${rc}30`,borderRadius:12,
                padding:'12px 16px',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:12,alignItems:'center'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#e8f0ee'}}>{i.work_order_ref||'—'} · {i.part_name||'—'}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                    {i.protocol_name&&<span style={{color:C.teal}}>📋 {i.protocol_name} · </span>}
                    {new Date(i.created_at).toLocaleDateString('hr-HR')} · {i.inspector_name||'—'}
                  </div>
                  {(i.nok_count>0) && <div style={{fontSize:10,color:'#F87171',marginTop:2}}>⚠️ {i.nok_count} NOK mjera od {i.measure_count}</div>}
                </div>
                <div style={{fontSize:11,color:C.muted}}>{i.type?.toUpperCase()}</div>
                <div style={{fontSize:11}}>
                  <span style={{color:C.muted}}>Uzorci: </span>
                  <span style={{color:'#60A5FA',fontWeight:600}}>{i.quantity_measured}/{i.quantity}</span>
                </div>
                <Badge label={RESULT_LABEL[i.result]||i.result} color={rc}/>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {i.result==='na_čekanju' && <>
                    <button onClick={()=>openMeasure(i)} title="Unesi mjere"
                      style={{background:`#60A5FA15`,border:`1px solid #60A5FA30`,borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:10,color:'#60A5FA'}}>
                      Mjere
                    </button>
                    <button onClick={()=>decide(i.id,'odobreno')} title="Odobri"
                      style={{background:`#4ADE8020`,border:'none',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:'#4ADE80'}}><Check size={13}/></button>
                    <button onClick={()=>decide(i.id,'uvjetno')} title="Uvjetno"
                      style={{background:`#FB923C20`,border:'none',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:'#FB923C'}}>~</button>
                    <button onClick={()=>decide(i.id,'odbijeno')} title="Odbij"
                      style={{background:`#F8717120`,border:'none',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:'#F87171'}}><X size={13}/></button>
                  </>}
                  <button onClick={()=>openDetail(i)} title="Detalji"
                    style={{background:`${C.teal}15`,border:'none',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:C.teal}}><ChevronRight size={13}/></button>
                  <button onClick={()=>remove(i.id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:'5px'}}><Trash2 size={12}/></button>
                </div>
              </div>
            )
          })}
          {!list.length&&<div style={{textAlign:'center',padding:48,color:C.muted}}>Nema inspekcija. Kreirajte prvu.</div>}
        </div>
      )}

      {/* New inspection modal */}
      {modal==='new'&&<Modal title="Nova inspekcija" onClose={()=>setModal(null)}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="RADNI NALOG" {...inp('work_order_ref')} placeholder="WO-2025-xxx"/>
          <Inp label="NAZIV DIJELA" {...inp('part_name')}/>
          <Inp label="BROJ CRTEŽA" {...inp('drawing_number')}/>
          <Inp label="KOLIČINA" type="number" {...inp('quantity')}/>
          <Sel label="TIP" w={1} value={form.type||'završna'} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
            <option value="završna">Završna</option>
            <option value="međufazna">Međufazna</option>
            <option value="ulazna">Ulazna</option>
            <option value="procesna">Procesna</option>
          </Sel>
          <Sel label="PROTOKOL" w={1} value={form.protocol_id||''} onChange={e=>setForm(p=>({...p,protocol_id:e.target.value||null}))}>
            <option value="">— bez protokola —</option>
            {protocols.map(p=><option key={p.id} value={p.id}>{p.name} v{p.version}</option>)}
          </Sel>
          <div style={{gridColumn:'span 2'}}>
            <Inp label="NAPOMENA" {...inp('notes')} placeholder="Opcionalna napomena..."/>
          </div>
          <div style={{gridColumn:'span 2',display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}>
            <Btn v="secondary" sm onClick={()=>setModal(null)}>Odustani</Btn>
            <Btn sm onClick={save}><Check size={13} style={{marginRight:5}}/>Kreiraj inspekciju</Btn>
          </div>
        </div>
      </Modal>}

      {/* Detail modal */}
      {modal==='detail'&&sel&&<Modal title={`Inspekcija — ${sel.work_order_ref||sel.part_name||'—'}`} onClose={()=>setModal(null)} wide>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
          {[['Radni nalog',sel.work_order_ref||'—',C.teal],['Dio',sel.part_name||'—','#e8f0ee'],
            ['Tip',sel.type,'#60A5FA'],['Protokol',sel.protocol_name||'—','#A78BFA'],
            ['Inspektor',sel.inspector_name||'—',C.muted],['Rezultat',RESULT_LABEL[sel.result],RESULT_COLOR[sel.result]||C.muted]]
            .map(([l,v,c])=>(
            <div key={l} style={{background:C.surface2,borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:3}}>{l.toUpperCase()}</div>
              <div style={{fontSize:12,fontWeight:600,color:c}}>{v}</div>
            </div>
          ))}
        </div>
        {sel.verdict_notes&&<div style={{padding:'10px 14px',background:`${C.teal}08`,borderRadius:8,
          fontSize:12,color:C.muted2,marginBottom:14,lineHeight:1.6}}>📝 {sel.verdict_notes}</div>}
        {sel.results?.length>0&&(
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>REZULTATI MJERENJA ({sel.results.length})</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{color:C.muted,fontSize:10}}>
                    {['Naziv mjere','Nominal','Tol.min','Tol.max','Izmjereno','Devijacija','Uzorak','Status'].map(h=>(
                      <th key={h} style={{padding:'6px 10px',textAlign:'left',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sel.results.map((r,i)=>{
                    const sc = r.status==='nok'?'#F87171':'#4ADE80'
                    return (
                      <tr key={i} style={{background:i%2===0?'transparent':`${C.surface2}80`}}>
                        <td style={{padding:'7px 10px',color:'#e8f0ee',fontWeight:600}}>{r.measure_name}</td>
                        <td style={{padding:'7px 10px',color:C.muted}}>{r.nominal} {r.unit}</td>
                        <td style={{padding:'7px 10px',color:C.muted}}>{r.tolerance_min}</td>
                        <td style={{padding:'7px 10px',color:C.muted}}>{r.tolerance_max}</td>
                        <td style={{padding:'7px 10px',color:'#60A5FA',fontWeight:700}}>{parseFloat(r.measured_value).toFixed(4)} {r.unit}</td>
                        <td style={{padding:'7px 10px',color:r.deviation>0?'#F87171':r.deviation<0?'#60A5FA':'#4ADE80',fontWeight:600}}>
                          {r.deviation>0?'+':''}{parseFloat(r.deviation).toFixed(4)}
                        </td>
                        <td style={{padding:'7px 10px',color:C.muted}}>#{r.sample_number}</td>
                        <td style={{padding:'7px 10px'}}>
                          <Badge label={r.status.toUpperCase()} color={sc}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!sel.results?.length&&<div style={{textAlign:'center',padding:24,color:C.muted,fontSize:12}}>Nema unesenih mjerenja</div>}
      </Modal>}

      {/* Measure entry modal */}
      {modal==='measure'&&sel&&<Modal title={`Unos mjerenja — ${sel.work_order_ref||sel.part_name}`} onClose={()=>setModal(null)} wide>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
          <Inp label="BROJ UZORKA" type="number" value={measureForm.sample_number||1}
            onChange={e=>setMeasureForm(f=>({...f,sample_number:parseInt(e.target.value)||1}))}
            style={{width:100}}/>
          <div style={{fontSize:11,color:C.muted2,marginTop:16}}>Svaka mjera bit će pripisana ovom uzorku</div>
        </div>
        <div style={{overflowX:'auto',marginBottom:14}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{color:C.muted,fontSize:10}}>
                {['Naziv mjere','Nominal','Tol.min','Tol.max','Jed.','Izmjereno',''].map(h=>(
                  <th key={h} style={{padding:'6px 8px',textAlign:'left',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measureForm.rows?.map((row,i)=>(
                <tr key={i}>
                  <td style={{padding:'4px 8px'}}>
                    <input value={row.measure_name} onChange={e=>updateRow(i,'measure_name',e.target.value)}
                      style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 8px',
                        color:'#e8f0ee',fontSize:12,width:180}}/>
                  </td>
                  {['nominal','tolerance_min','tolerance_max'].map(k=>(
                    <td key={k} style={{padding:'4px 8px'}}>
                      <input type="number" step="0.001" value={row[k]||''} onChange={e=>updateRow(i,k,e.target.value)}
                        style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 8px',
                          color:'#e8f0ee',fontSize:12,width:80}}/>
                    </td>
                  ))}
                  <td style={{padding:'4px 8px'}}>
                    <input value={row.unit||'mm'} onChange={e=>updateRow(i,'unit',e.target.value)}
                      style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 8px',
                        color:'#e8f0ee',fontSize:12,width:55}}/>
                  </td>
                  <td style={{padding:'4px 8px'}}>
                    <input type="number" step="0.0001" value={row.measured_value||''} onChange={e=>updateRow(i,'measured_value',e.target.value)}
                      placeholder="Unesite..."
                      style={{background:C.surface2,border:`1px solid ${C.teal}50`,borderRadius:6,padding:'5px 8px',
                        color:C.teal,fontSize:12,fontWeight:700,width:100}}/>
                  </td>
                  <td style={{padding:'4px 8px'}}>
                    <button onClick={()=>removeRow(i)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><Trash2 size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <button onClick={addRow} style={{background:`${C.teal}15`,border:`1px solid ${C.teal}30`,borderRadius:8,
            padding:'6px 12px',color:C.teal,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
            <Plus size={13}/>Dodaj mjeru
          </button>
          <div style={{display:'flex',gap:10}}>
            <Btn v="secondary" sm onClick={()=>setModal(null)}>Odustani</Btn>
            <Btn sm onClick={saveMeasures}><Check size={13} style={{marginRight:5}}/>Spremi mjerenja</Btn>
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PROTOCOLS
// ═══════════════════════════════════════════════════════════════════════════════
function ProtocolsTab({onRefresh, toast}) {
  const [list, setList]         = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail]     = useState({})
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({version:'1.0',status:'aktivan'})
  const [mForm, setMForm]       = useState({unit:'mm',nominal:0,tolerance_min:0,tolerance_max:0})

  const load = useCallback(async()=>{
    try { setList((await api.get('/quality/protocols')).data) } catch(e){}
  },[])

  useEffect(()=>{ load() },[load])

  const loadDetail = async (id) => {
    if (expanded===id) { setExpanded(null); return }
    try {
      const r = await api.get(`/quality/protocols/${id}`)
      setDetail(d=>({...d,[id]:r.data})); setExpanded(id)
    } catch(e){}
  }

  const inp  = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})
  const minp = k => ({value:mForm[k]||'',onChange:e=>setMForm(p=>({...p,[k]:e.target.value}))})

  const save = async () => {
    try {
      if (modal==='new') { await api.post('/quality/protocols',form); toast('Protokol kreiran!') }
      else { await api.put(`/quality/protocols/${modal}`,form); toast('Protokol ažuriran!') }
      setModal(null); setForm({version:'1.0',status:'aktivan'}); load(); onRefresh()
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const remove = async id => {
    if (!confirm('Obriši protokol i sve mjere?')) return
    try { await api.delete(`/quality/protocols/${id}`); toast('Obrisano'); load(); setExpanded(null); onRefresh() }
    catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const addMeasure = async protoId => {
    if (!mForm.name) return toast('Naziv mjere je obavezan','error')
    try {
      await api.post(`/quality/protocols/${protoId}/measures`, mForm)
      toast('Mjera dodana!')
      setMForm({unit:'mm',nominal:0,tolerance_min:0,tolerance_max:0})
      const r = await api.get(`/quality/protocols/${protoId}`)
      setDetail(d=>({...d,[protoId]:r.data}))
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const removeMeasure = async (protoId, mId) => {
    try {
      await api.delete(`/quality/measures/${mId}`)
      toast('Mjera obrisana!')
      const r = await api.get(`/quality/protocols/${protoId}`)
      setDetail(d=>({...d,[protoId]:r.data}))
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const editProto = p => {
    setForm({name:p.name,version:p.version,project_name:p.project_name||'',
      drawing_number:p.drawing_number||'',material:p.material||'',
      status:p.status,description:p.description||''})
    setModal(p.id)
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:1.5}}>{list.length} PROTOKOLA</div>
        <Btn sm onClick={()=>{setForm({version:'1.0',status:'aktivan'});setModal('new')}}>
          <Plus size={13} style={{marginRight:5}}/>Novi protokol
        </Btn>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {list.map(p=>{
          const isOpen = expanded===p.id
          const det = detail[p.id]
          return (
            <div key={p.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}
                onClick={()=>loadDetail(p.id)}>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#e8f0ee'}}>{p.name}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                      v{p.version}
                      {p.project_name&&<span style={{color:C.teal}}> · {p.project_name}</span>}
                      {p.drawing_number&&<span> · DWG: {p.drawing_number}</span>}
                      {p.material&&<span> · {p.material}</span>}
                    </div>
                  </div>
                  <Badge label={p.status?.toUpperCase()} color={STATUS_COLOR[p.status]||C.muted}/>
                  <span style={{fontSize:10,color:C.muted}}>{p.measure_count} mjera</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button onClick={e=>{e.stopPropagation();editProto(p)}}
                    style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}}><Edit2 size={13}/></button>
                  <button onClick={e=>{e.stopPropagation();remove(p.id)}}
                    style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}}><Trash2 size={13}/></button>
                  {isOpen?<ChevronUp size={15} color={C.muted}/>:<ChevronDown size={15} color={C.muted}/>}
                </div>
              </div>

              {isOpen&&(
                <div style={{padding:'0 18px 18px',borderTop:`1px solid ${C.border}`}}>
                  {/* Measures table */}
                  {det?.measures?.length>0&&(
                    <div style={{marginBottom:16,marginTop:14}}>
                      <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:8}}>MJERE PROTOKOLA</div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{color:C.muted,fontSize:10}}>
                            {['Naziv','Nominal','Tol.min','Tol.max','Jedinica','Metoda',''].map(h=>(
                              <th key={h} style={{padding:'5px 10px',textAlign:'left',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {det.measures.map((m,i)=>(
                            <tr key={m.id} style={{background:i%2===0?'transparent':`${C.surface2}60`}}>
                              <td style={{padding:'6px 10px',color:'#e8f0ee',fontWeight:600}}>{m.name}</td>
                              <td style={{padding:'6px 10px',color:C.teal}}>{m.nominal}</td>
                              <td style={{padding:'6px 10px',color:'#F5BC54'}}>{m.tolerance_min}</td>
                              <td style={{padding:'6px 10px',color:'#4ADE80'}}>{m.tolerance_max}</td>
                              <td style={{padding:'6px 10px',color:C.muted}}>{m.unit}</td>
                              <td style={{padding:'6px 10px',color:C.muted2}}>{m.measurement_method||'—'}</td>
                              <td style={{padding:'6px 10px'}}>
                                <button onClick={()=>removeMeasure(p.id,m.id)}
                                  style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><Trash2 size={11}/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add measure inline */}
                  <div style={{background:C.surface2,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>DODAJ MJERU</div>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr',gap:8,alignItems:'end'}}>
                      <Inp label="NAZIV MJERE *" value={mForm.name||''} onChange={e=>setMForm(f=>({...f,name:e.target.value}))} placeholder="npr. Promjer Ø42h7"/>
                      <Inp label="NOMINAL" type="number" step="0.001" value={mForm.nominal||''} onChange={e=>setMForm(f=>({...f,nominal:e.target.value}))}/>
                      <Inp label="TOL.MIN" type="number" step="0.001" value={mForm.tolerance_min||''} onChange={e=>setMForm(f=>({...f,tolerance_min:e.target.value}))}/>
                      <Inp label="TOL.MAX" type="number" step="0.001" value={mForm.tolerance_max||''} onChange={e=>setMForm(f=>({...f,tolerance_max:e.target.value}))}/>
                      <Inp label="JEDINICA" value={mForm.unit||'mm'} onChange={e=>setMForm(f=>({...f,unit:e.target.value}))}/>
                      <Btn sm onClick={()=>addMeasure(p.id)}><Plus size={13} style={{marginRight:4}}/>Dodaj</Btn>
                    </div>
                    <Inp label="METODA MJERENJA (opcionalno)" value={mForm.measurement_method||''} onChange={e=>setMForm(f=>({...f,measurement_method:e.target.value}))}
                      placeholder="npr. pomično mjerilo, mikrometar..." style={{marginTop:8}}/>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!list.length&&<div style={{textAlign:'center',padding:48,color:C.muted}}>Nema protokola. Kreirajte prvi kontrolni plan.</div>}
      </div>

      {/* New/edit modal */}
      {modal&&<Modal title={modal==='new'?'Novi protokol':'Uredi protokol'} onClose={()=>setModal(null)}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="NAZIV *" w={2} value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="npr. Nosač osi X — kontrolni plan"/>
          <Inp label="VERZIJA" value={form.version||'1.0'} onChange={e=>setForm(p=>({...p,version:e.target.value}))}/>
          <Sel label="STATUS" value={form.status||'aktivan'} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
            <option value="aktivan">Aktivan</option>
            <option value="arhiviran">Arhiviran</option>
            <option value="nacrt">Nacrt</option>
          </Sel>
          <Inp label="PROJEKT / NARUČILAC" value={form.project_name||''} onChange={e=>setForm(p=>({...p,project_name:e.target.value}))}/>
          <Inp label="BROJ CRTEŽA" value={form.drawing_number||''} onChange={e=>setForm(p=>({...p,drawing_number:e.target.value}))}/>
          <Inp label="MATERIJAL" value={form.material||''} onChange={e=>setForm(p=>({...p,material:e.target.value}))} placeholder="npr. Č.1531"/>
          <div style={{gridColumn:'span 2'}}>
            <Inp label="OPIS" value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Opcionalni opis..."/>
          </div>
          <div style={{gridColumn:'span 2',display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}>
            <Btn v="secondary" sm onClick={()=>setModal(null)}>Odustani</Btn>
            <Btn sm onClick={save}><Check size={13} style={{marginRight:5}}/>Spremi</Btn>
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: INSTRUMENTS
// ═══════════════════════════════════════════════════════════════════════════════
function InstrumentsTab({toast}) {
  const [list, setList]   = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({status:'aktivan',unit:'mm'})

  const load = useCallback(async()=>{
    try { setList((await api.get('/quality/instruments')).data) } catch(e){}
  },[])

  useEffect(()=>{ load() },[load])

  const inp = k => ({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  const save = async () => {
    try {
      if (!form.id) await api.post('/quality/instruments',form)
      else await api.put(`/quality/instruments/${form.id}`,form)
      toast('Instrument spremljen!'); setModal(null); setForm({status:'aktivan',unit:'mm'}); load()
    } catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const remove = async id => {
    if (!confirm('Obriši instrument?')) return
    try { await api.delete(`/quality/instruments/${id}`); toast('Obrisano'); load() }
    catch(e){ toast(e.response?.data?.error||'Greška','error') }
  }

  const edit = ins => {
    setForm({...ins}); setModal('edit')
  }

  const today = new Date().toISOString().slice(0,10)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:1.5}}>{list.length} INSTRUMENATA</div>
        <Btn sm onClick={()=>{setForm({status:'aktivan',unit:'mm'});setModal('new')}}>
          <Plus size={13} style={{marginRight:5}}/>Novi instrument
        </Btn>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {list.map(ins=>{
          const sc = STATUS_COLOR[ins.status]||C.muted
          const overdue  = ins.calibration_overdue
          const dueSoon  = ins.calibration_due_soon && !overdue
          const borderC  = overdue?'#F87171':dueSoon?'#F5BC54':C.border
          return (
            <div key={ins.id} style={{background:C.surface,border:`1px solid ${borderC}`,borderRadius:12,
              padding:'14px 18px',display:'grid',gridTemplateColumns:'2.5fr 1fr 1.2fr 1.2fr 0.8fr auto',gap:12,alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#e8f0ee'}}>{ins.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                  {ins.type} · SN: {ins.serial_number||'—'} · {ins.manufacturer||'—'}
                  {ins.storage_location&&<span style={{color:C.teal}}> · 📍 {ins.storage_location}</span>}
                </div>
                {ins.accuracy&&<div style={{fontSize:10,color:'#60A5FA',marginTop:1}}>± {ins.accuracy}</div>}
              </div>
              <Badge label={ins.status?.toUpperCase()} color={sc}/>
              <div style={{fontSize:12}}>
                <div style={{color:C.muted,fontSize:10}}>Zadnja kalib.</div>
                <div style={{color:'#e8f0ee'}}>{ins.last_calibration?new Date(ins.last_calibration).toLocaleDateString('hr-HR'):'—'}</div>
              </div>
              <div style={{fontSize:12}}>
                <div style={{color:C.muted,fontSize:10}}>Sljedeća kalib.</div>
                <div style={{color:overdue?'#F87171':dueSoon?'#F5BC54':'#e8f0ee',fontWeight:overdue||dueSoon?700:400}}>
                  {ins.next_calibration?new Date(ins.next_calibration).toLocaleDateString('hr-HR'):'—'}
                  {overdue&&<span> ⚠️</span>}
                </div>
              </div>
              {(overdue||dueSoon)?
                <Badge label={overdue?'ISTEKLO':'USKORO'} color={overdue?'#F87171':'#F5BC54'}/>
                :<div/>}
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>edit(ins)} style={{background:`${C.teal}15`,border:'none',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:C.teal}}><Edit2 size={13}/></button>
                <button onClick={()=>remove(ins.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><Trash2 size={13}/></button>
              </div>
            </div>
          )
        })}
        {!list.length&&<div style={{textAlign:'center',padding:48,color:C.muted}}>Nema mjernih instrumenata.</div>}
      </div>

      {modal&&<Modal title={modal==='new'?'Novi mjerni instrument':'Uredi instrument'} onClose={()=>setModal(null)}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="NAZIV *" w={2} {...inp('name')} placeholder="npr. Pomično mjerilo 0-150mm"/>
          <Inp label="TIP" {...inp('type')} placeholder="pomično, mikrometar..."/>
          <Inp label="SERIJSKI BROJ" {...inp('serial_number')}/>
          <Inp label="PROIZVOĐAČ" {...inp('manufacturer')} placeholder="Mitutoyo..."/>
          <Inp label="LOKACIJA POHRANE" {...inp('storage_location')} placeholder="Polica A3..."/>
          <Inp label="TOČNOST" {...inp('accuracy')} placeholder="±0.02mm"/>
          <Inp label="ZADNJA KALIBRACIJA" type="date" {...inp('last_calibration')}/>
          <Inp label="SLJEDEĆA KALIBRACIJA" type="date" {...inp('next_calibration')}/>
          <Inp label="RASPON MIN" type="number" {...inp('range_min')}/>
          <Inp label="RASPON MAX" type="number" {...inp('range_max')}/>
          <Inp label="JEDINICA" {...inp('unit')} placeholder="mm"/>
          <Sel label="STATUS" value={form.status||'aktivan'} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
            <option value="aktivan">Aktivan</option>
            <option value="na_kalibraciji">Na kalibraciji</option>
            <option value="neaktivan">Neaktivan</option>
            <option value="u_kvaru">U kvaru</option>
          </Sel>
          <div style={{gridColumn:'span 2'}}>
            <Inp label="NAPOMENA" {...inp('notes')}/>
          </div>
          <div style={{gridColumn:'span 2',display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}>
            <Btn v="secondary" sm onClick={()=>setModal(null)}>Odustani</Btn>
            <Btn sm onClick={save}><Check size={13} style={{marginRight:5}}/>Spremi</Btn>
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOK + SPC
// ═══════════════════════════════════════════════════════════════════════════════
function NokTab({toast}) {
  const [nok, setNok]         = useState([])
  const [spc, setSpc]         = useState(null)
  const [spcLoading, setSpcLoading] = useState(false)

  useEffect(()=>{
    api.get('/quality/nok-analysis').then(r=>setNok(r.data)).catch(()=>{})
  },[])

  const loadSpc = async (name) => {
    setSpcLoading(true); setSpc(null)
    try {
      const r = await api.get(`/quality/spc/${encodeURIComponent(name)}`)
      setSpc(r.data)
    } catch(e){ toast('Greška pri učitavanju SPC podataka','error') }
    finally { setSpcLoading(false) }
  }

  const chartData = spc?.data?.map((r,i)=>({
    i:i+1,
    value: parseFloat(r.measured_value),
    ucl: parseFloat(r.nominal)+(parseFloat(r.tolerance_max)||0),
    lcl: parseFloat(r.nominal)+(parseFloat(r.tolerance_min)||0),
    nom: parseFloat(r.nominal),
    status: r.status,
  }))||[]

  return (
    <div style={{display:'grid',gridTemplateColumns:spc?'1fr 1fr':'1fr',gap:20}}>
      {/* NOK table */}
      <div>
        <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:12}}>NOK MJERE — ZADNJIH 30 DANA (klikni za SPC)</div>
        {nok.length===0&&<div style={{textAlign:'center',padding:48,color:'#4ADE80',fontSize:13}}>✅ Nema NOK mjera — odlično!</div>}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {nok.map((n,i)=>(
            <div key={i} onClick={()=>loadSpc(n.measure_name)}
              style={{background:spc?.measure_name===n.measure_name?`${C.teal}10`:C.surface,
                border:`1px solid ${spc?.measure_name===n.measure_name?C.teal:C.border}`,
                borderRadius:10,padding:'12px 16px',cursor:'pointer',transition:'all .15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'#F87171'}}>{n.measure_name}</div>
                <Badge label={`${n.nok_count}× NOK`} color="#F87171"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,fontSize:11}}>
                <div><div style={{color:C.muted,fontSize:9}}>NOMINAL</div><div style={{color:C.teal}}>{parseFloat(n.nominal).toFixed(3)} {n.unit}</div></div>
                <div><div style={{color:C.muted,fontSize:9}}>MIN</div><div style={{color:'#60A5FA'}}>{parseFloat(n.min_value).toFixed(4)}</div></div>
                <div><div style={{color:C.muted,fontSize:9}}>MAX</div><div style={{color:'#60A5FA'}}>{parseFloat(n.max_value).toFixed(4)}</div></div>
                <div><div style={{color:C.muted,fontSize:9}}>TOL</div><div style={{color:C.muted2}}>{n.tolerance_min} / {n.tolerance_max}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SPC chart */}
      {(spc||spcLoading)&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5}}>SPC — {spc?.measure_name}</div>
            <button onClick={()=>setSpc(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><X size={14}/></button>
          </div>
          {spcLoading&&<div style={{textAlign:'center',padding:40,color:C.muted}}>Učitavanje...</div>}
          {spc&&!spcLoading&&(
            <>
              {/* Cp/Cpk KPIs */}
              {spc.stats&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                  {[
                    ['n',spc.stats.n,'#60A5FA'],
                    ['Cpk',spc.stats.cpk??'—',spc.stats.cpk>=1.33?'#4ADE80':spc.stats.cpk>=1?'#F5BC54':'#F87171'],
                    ['Cp', spc.stats.cp??'—', spc.stats.cp>=1.33?'#4ADE80':spc.stats.cp>=1?'#F5BC54':'#F87171'],
                    ['NOK',spc.stats.nok_count,'#F87171'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:C.surface2,borderRadius:8,padding:'10px',textAlign:'center'}}>
                      <div style={{fontSize:9,color:C.muted}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:700,color:c,fontFamily:"'Chakra Petch',sans-serif"}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Chart */}
              {chartData.length>0?(
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:8,right:12,bottom:4,left:8}}>
                    <XAxis dataKey="i" tick={{fontSize:9,fill:C.muted}} label={{value:'Uzorak',position:'insideBottom',offset:-2,fill:C.muted,fontSize:9}}/>
                    <YAxis tick={{fontSize:9,fill:C.muted}} domain={['auto','auto']} width={52}/>
                    <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}
                      formatter={(v,n)=>[typeof v==='number'?v.toFixed(4):v,n]}/>
                    <ReferenceLine y={chartData[0]?.ucl} stroke="#F87171" strokeDasharray="4 2" label={{value:'UCL',fill:'#F87171',fontSize:9}}/>
                    <ReferenceLine y={chartData[0]?.lcl} stroke="#F87171" strokeDasharray="4 2" label={{value:'LCL',fill:'#F87171',fontSize:9}}/>
                    <ReferenceLine y={chartData[0]?.nom} stroke="#4ADE80" strokeDasharray="4 4" label={{value:'NOM',fill:'#4ADE80',fontSize:9}}/>
                    <Line type="monotone" dataKey="value" stroke={C.teal} strokeWidth={2} dot={(p)=>{
                      const isNok = spc.data[p.index]?.status==='nok'
                      return <circle key={p.index} cx={p.cx} cy={p.cy} r={isNok?5:3} fill={isNok?'#F87171':C.teal} stroke="none"/>
                    }} name="Izmjereno"/>
                  </LineChart>
                </ResponsiveContainer>
              ):<div style={{textAlign:'center',padding:32,color:C.muted,fontSize:12}}>Nema dovoljno podataka za SPC</div>}
              <div style={{fontSize:10,color:C.muted2,marginTop:8,lineHeight:1.6}}>
                {spc.stats&&<>Prosjek: <b style={{color:C.teal}}>{spc.stats.mean} {spc.data[0]?.unit}</b> · σ: <b style={{color:'#60A5FA'}}>{spc.stats.std}</b></>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function QualityPage() {
  const [tab, setTab]           = useState('inspections')
  const [stats, setStats]       = useState({})
  const [protocols, setProtocols] = useState([])
  const [trend, setTrend]       = useState([])
  const [toastState, setToastState] = useState({visible:false,message:'',type:'ok'})

  const toast = useCallback((message, type='ok') => {
    setToastState({visible:true,message,type})
    setTimeout(()=>setToastState(s=>({...s,visible:false})),3000)
  },[])

  const loadStats = useCallback(async () => {
    try {
      const [s,t,p] = await Promise.all([
        api.get('/quality/stats'),
        api.get('/quality/trend'),
        api.get('/quality/protocols'),
      ])
      setStats(s.data); setTrend(t.data); setProtocols(p.data)
    } catch(e){}
  },[])

  useEffect(()=>{ loadStats() },[loadStats])

  const TABS = [
    {k:'inspections', l:'Inspekcije',  Icon:ClipboardList},
    {k:'protocols',   l:'Protokoli',   Icon:Shield},
    {k:'instruments', l:'Instrumenti', Icon:Wrench},
    {k:'nok',         l:'NOK / SPC',   Icon:TrendingUp},
  ]

  return (
    <div>
      {/* Toast */}
      {toastState.visible&&(
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,
          background:toastState.type==='error'?'#F87171':'#4ADE80',
          color:'#0a1210',padding:'12px 20px',borderRadius:10,fontWeight:700,fontSize:13,
          boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
          {toastState.message}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:52,height:52,borderRadius:16,background:`#4ADE8018`,border:`1px solid #4ADE8035`,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Shield size={26} color="#4ADE80"/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>DEER MES · MODUL</div>
            <div style={{fontSize:20,fontWeight:700,color:'#e8f0ee',letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif"}}>KONTROLA KVALITETE</div>
            <div style={{fontSize:11,color:C.muted2}}>Inspekcije · Protokoli · Instrumenti · SPC analiza</div>
          </div>
        </div>
        <Btn v="secondary" sm onClick={loadStats}><RefreshCw size={13} style={{marginRight:6}}/>Osvježi</Btn>
      </div>

      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:24}}>
        <KpiCard label="Odobreno (30d)"    value={stats.approved||0}        color="#4ADE80"  icon={CheckCircle}/>
        <KpiCard label="Odbijeno (30d)"    value={stats.rejected||0}        color="#F87171"  icon={XCircle}/>
        <KpiCard label="Na čekanju"        value={stats.pending||0}         color="#F5BC54"  icon={Clock}/>
        <KpiCard label="Stopa odbijanja"   value={`${stats.reject_rate_pct||0}%`} color={stats.reject_rate_pct>10?'#F87171':stats.reject_rate_pct>5?'#F5BC54':'#4ADE80'} icon={BarChart3}/>
        <KpiCard label="NOK mjere (7d)"    value={stats.nok_week||0}        color={stats.nok_week>0?'#F87171':C.muted} icon={AlertTriangle}/>
        <KpiCard label="Kalibracije uskoro" value={stats.calibrations_due||0} color={stats.calibrations_due>0?'#F5BC54':C.muted} icon={Wrench}/>
      </div>

      {/* Trend mini-chart */}
      {trend.length>0&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 18px',marginBottom:20}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>TREND INSPEKCIJA — 14 DANA</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={trend} margin={{top:0,right:0,bottom:0,left:0}}>
              <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} tickFormatter={d=>d?.slice(5)}/>
              <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
              <Bar dataKey="ok"  stackId="a" fill="#4ADE80" name="Odobreno" radius={[0,0,0,0]}/>
              <Bar dataKey="nok" stackId="a" fill="#F87171" name="Odbijeno"  radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:0}}>
        {TABS.map(({k,l,Icon})=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'10px 18px',borderRadius:'8px 8px 0 0',cursor:'pointer',fontSize:13,fontWeight:700,
            background:tab===k?C.surface:C.surface2,color:tab===k?'#e8f0ee':C.muted,
            border:`1px solid ${C.border}`,borderBottom:tab===k?`1px solid ${C.surface}`:'none',
            display:'flex',alignItems:'center',gap:6,marginBottom:tab===k?-1:0,
            outline:'none',transition:'all .15s',
          }}>
            <Icon size={13}/>{l}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'0 12px 12px 12px',padding:20}}>
        {tab==='inspections' && <InspectionsTab protocols={protocols} onRefresh={loadStats} toast={toast}/>}
        {tab==='protocols'   && <ProtocolsTab  onRefresh={loadStats} toast={toast}/>}
        {tab==='instruments' && <InstrumentsTab toast={toast}/>}
        {tab==='nok'         && <NokTab toast={toast}/>}
      </div>
    </div>
  )
}
