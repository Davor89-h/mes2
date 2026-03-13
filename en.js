import { useState, useEffect, useCallback } from 'react'
import { C,StatCard,Badge,StatusBadge,QtyBar,Btn,Modal,Field,Inp,Sel,FGrid,SearchBar,FSel,TblWrap,TR,TD,RowActions,Toast,useToast,HistoryModal,QtyAdjModal,Loading,EmptyState } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const TYPES = ['Okrugla šipka','Četvrtasta šipka','Lim','Ploča','Cijev','Profil','Ostalo']
const UNITS = ['kom','kg','m','m²','m³','l','paket']
const E = { internalId:'',name:'',type:'',dimension:'',unit:'kom',currentQuantity:0,minQuantity:1,storageLocation:'',supplier:'',notes:'' }

export default function MaterialsPage() {
  const { canEdit } = useAuth()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('')
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(E)
  const [saving, setSaving] = useState(false)
  const [histModal, setHistModal] = useState(null)
  const [histItems, setHistItems] = useState([])
  const [qtyModal, setQtyModal] = useState(null)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try {
      const p={}; if(search)p.search=search; if(typeF)p.type=typeF
      const [it,st] = await Promise.all([api.get('/materials',{params:p}),api.get('/materials/stats')])
      setItems(it.data); setStats(st.data)
    } catch { setItems([]); setStats({total:0,available:0,low:0,critical:0}) }
    finally { setLoading(false) }
  },[search,typeF])

  useEffect(()=>{ load() },[load])

  const openAdd = () => { setEditItem(null); setForm(E); setModal(true) }
  const openEdit = (it) => {
    setEditItem(it)
    setForm({ internalId:it.internal_id||'',name:it.name,type:it.type||'',dimension:it.dimension||'',unit:it.unit||'kom',currentQuantity:it.current_quantity,minQuantity:it.min_quantity,storageLocation:it.storage_location||'',supplier:it.supplier||'',notes:it.notes||'' })
    setModal(true)
  }
  const openHistory = async (it) => {
    setHistModal(it)
    try { const r=await api.get(`/materials/${it.id}/history`); setHistItems(r.data) } catch { setHistItems([]) }
  }

  const save = async () => {
    if (!form.name) { showToast('Naziv je obavezan!','error'); return }
    setSaving(true)
    try {
      if (editItem) { const r=await api.put(`/materials/${editItem.id}`,form); setItems(items.map(i=>i.id===editItem.id?r.data:i)); showToast('✓ Ažurirano') }
      else { const r=await api.post('/materials',form); setItems([r.data,...items]); showToast('✓ Dodano') }
      setModal(false)
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Obrisati materijal?')) return
    try { await api.delete(`/materials/${id}`); setItems(items.filter(i=>i.id!==id)); showToast('Obrisano') }
    catch { showToast('Greška','error') }
  }

  const saveQty = async (change, note) => {
    try { const r=await api.patch(`/materials/${qtyModal.id}/quantity`,{change,note}); setItems(items.map(i=>i.id===qtyModal.id?r.data:i)); showToast('✓ Količina ažurirana') }
    catch { showToast('Greška','error') }
  }

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:22 }}>
        <StatCard label="Vrsta materijala" value={stats.total} color="yellow"/>
        <StatCard label="Na zalihi" value={stats.available} color="green"/>
        <StatCard label="Niske zalihe" value={stats.low} color="orange"/>
        <StatCard label="Kritično" value={stats.critical} color="red"/>
      </div>

      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naziv ili ID materijala..."/>
        <FSel value={typeF} onChange={e=>setTypeF(e.target.value)}>
          <option value="">Sve vrste</option>
          {TYPES.map(t=><option key={t}>{t}</option>)}
        </FSel>
        {canEdit&&<Btn onClick={openAdd} style={{marginLeft:'auto'}}>+ Dodaj materijal</Btn>}
      </div>

      {loading ? <Loading/> : !items.length ? <EmptyState icon="◈" text="Nema materijala."/> : (
        <TblWrap headers={['Naziv','Vrsta','Dimenzija','Jed.','Zalihe','Lokacija','Dobavljač','Status','']}>
          {items.map(it=>(
            <TR key={it.id}>
              <TD><div style={{ fontWeight:600,color:'#e8f0ee',fontSize:13 }}>{it.name}<div style={{ fontSize:10,color:C.muted2,fontFamily:'monospace' }}>{it.internal_id}</div></div></TD>
              <TD><Badge type="blue">{it.type||'—'}</Badge></TD>
              <TD mono muted>{it.dimension||'—'}</TD>
              <TD muted>{it.unit}</TD>
              <TD><QtyBar current={it.current_quantity} min={it.min_quantity}/></TD>
              <TD mono>{it.storage_location||'—'}</TD>
              <TD muted style={{fontSize:11}}>{it.supplier||'—'}</TD>
              <TD><StatusBadge status={it.status}/></TD>
              <TD><RowActions onQty={()=>setQtyModal(it)} onHistory={()=>openHistory(it)} onEdit={()=>openEdit(it)} onDelete={()=>del(it.id)} canEdit={canEdit}/></TD>
            </TR>
          ))}
        </TblWrap>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editItem?'Uredi materijal':'Dodaj materijal'} width={600}>
        <FGrid>
          <Field label="Naziv" req><Inp placeholder="Čelik S235 Ø50mm" value={form.name} onChange={e=>f('name',e.target.value)}/></Field>
          <Field label="Interni ID"><Inp placeholder="MAT-001" value={form.internalId} onChange={e=>f('internalId',e.target.value)}/></Field>
          <Field label="Vrsta"><Sel value={form.type} onChange={e=>f('type',e.target.value)}><option value="">Odaberi...</option>{TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
          <Field label="Mjerna jedinica" req><Sel value={form.unit} onChange={e=>f('unit',e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</Sel></Field>
          <Field label="Dimenzija" full><Inp placeholder="Ø50×3000mm" value={form.dimension} onChange={e=>f('dimension',e.target.value)}/></Field>
          <Field label="Trenutna količina" req><Inp type="number" min="0" step="0.01" value={form.currentQuantity} onChange={e=>f('currentQuantity',e.target.value)}/></Field>
          <Field label="Minimalna količina" req><Inp type="number" min="0" step="0.01" value={form.minQuantity} onChange={e=>f('minQuantity',e.target.value)}/></Field>
          <Field label="Lokacija"><Inp placeholder="Sk-B2" value={form.storageLocation} onChange={e=>f('storageLocation',e.target.value)}/></Field>
          <Field label="Dobavljač" full><Inp placeholder="Ferromet d.o.o." value={form.supplier} onChange={e=>f('supplier',e.target.value)}/></Field>
          <Field label="Napomena" full><Inp placeholder="Opcijalno..." value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
        </FGrid>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:22 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Odustani</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'Spremi'}</Btn>
        </div>
      </Modal>

      <QtyAdjModal open={!!qtyModal} onClose={()=>setQtyModal(null)} item={qtyModal} onSave={saveQty} unit={qtyModal?.unit}/>
      <HistoryModal open={!!histModal} onClose={()=>setHistModal(null)} items={histItems} title={`Historija: ${histModal?.name||''}`}/>
      <Toast {...toast}/>
    </div>
  )
}
