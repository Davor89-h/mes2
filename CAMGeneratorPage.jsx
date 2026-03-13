import { useState, useEffect, useCallback } from 'react'
import { C,StatCard,Badge,StatusBadge,QtyBar,Btn,Modal,Field,Inp,Sel,FGrid,SearchBar,FSel,TblWrap,TR,TD,RowActions,Toast,useToast,QtyAdjModal,Loading,EmptyState } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const TYPES = [{v:'stega',l:'Stega'},{v:'brusna_ploca',l:'Brusna ploča'},{v:'ostalo',l:'Ostalo'}]
const TYPE_ICON = { stega:'⬢', brusna_ploca:'◉', ostalo:'◫' }
const E = { internalId:'',name:'',type:'stega',dimensions:'',clampingRange:'',jawWidth:'',storageLocation:'',currentQuantity:0,minQuantity:1,notes:'' }

export default function StegePage() {
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
  const [qtyModal, setQtyModal] = useState(null)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try {
      const p={}; if(search)p.search=search; if(typeF)p.type=typeF
      const [it,st] = await Promise.all([api.get('/clamping',{params:p}),api.get('/clamping/stats')])
      setItems(it.data); setStats(st.data)
    } catch { setItems([]); setStats({total:0,available:0,low:0,critical:0}) }
    finally { setLoading(false) }
  },[search,typeF])

  useEffect(()=>{ load() },[load])

  const openAdd = () => { setEditItem(null); setForm(E); setModal(true) }
  const openEdit = (it) => {
    setEditItem(it)
    setForm({ internalId:it.internal_id||'',name:it.name,type:it.type||'stega',dimensions:it.dimensions||'',clampingRange:it.clamping_range||'',jawWidth:it.jaw_width||'',storageLocation:it.storage_location||'',currentQuantity:it.current_quantity,minQuantity:it.min_quantity,notes:it.notes||'' })
    setModal(true)
  }

  const save = async () => {
    if (!form.name) { showToast('Naziv je obavezan!','error'); return }
    setSaving(true)
    try {
      if (editItem) { const r=await api.put(`/clamping/${editItem.id}`,form); setItems(items.map(i=>i.id===editItem.id?r.data:i)); showToast('✓ Ažurirano') }
      else { const r=await api.post('/clamping',form); setItems([r.data,...items]); showToast('✓ Dodano') }
      setModal(false)
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Obrisati?')) return
    try { await api.delete(`/clamping/${id}`); setItems(items.filter(i=>i.id!==id)); showToast('Obrisano') }
    catch { showToast('Greška','error') }
  }

  const saveQty = async (change, note) => {
    try { const r=await api.patch(`/clamping/${qtyModal.id}/quantity`,{change,note}); setItems(items.map(i=>i.id===qtyModal.id?r.data:i)); showToast('✓ Količina ažurirana') }
    catch { showToast('Greška','error') }
  }

  const typeLabel = (t) => TYPES.find(x=>x.v===t)?.l||t

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:22 }}>
        <StatCard label="Ukupno" value={stats.total} color="yellow"/>
        <StatCard label="Dostupno" value={stats.available} color="green"/>
        <StatCard label="Niske zalihe" value={stats.low} color="orange"/>
        <StatCard label="Kritično" value={stats.critical} color="red"/>
      </div>

      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naziv ili ID..."/>
        <FSel value={typeF} onChange={e=>setTypeF(e.target.value)}>
          <option value="">Sve vrste</option>
          {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </FSel>
        {canEdit&&<Btn onClick={openAdd} style={{marginLeft:'auto'}}>+ Dodaj</Btn>}
      </div>

      {loading ? <Loading/> : !items.length ? <EmptyState icon="⬢" text="Nema stega. Dodaj prvu stavku."/> : (
        <TblWrap headers={['Naziv','Vrsta','Dimenzije','Raspon stezanja','Širina čeljusti','Lokacija','Zalihe','Status','']}>
          {items.map(it=>(
            <TR key={it.id}>
              <TD><div style={{ display:'flex',alignItems:'center',gap:9 }}>
                <div style={{ width:32,height:32,borderRadius:8,background:C.surface2,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>{TYPE_ICON[it.type]||'◫'}</div>
                <div><div style={{ fontWeight:600,color:'#e8f0ee',fontSize:13 }}>{it.name}</div><div style={{ fontSize:10,color:C.muted2,fontFamily:'monospace' }}>{it.internal_id}</div></div>
              </div></TD>
              <TD><Badge type="teal">{typeLabel(it.type)}</Badge></TD>
              <TD mono muted>{it.dimensions||'—'}</TD>
              <TD muted>{it.clamping_range||'—'}</TD>
              <TD muted>{it.jaw_width||'—'}</TD>
              <TD mono>{it.storage_location||'—'}</TD>
              <TD><QtyBar current={it.current_quantity} min={it.min_quantity}/></TD>
              <TD><StatusBadge status={it.status}/></TD>
              <TD><RowActions onQty={()=>setQtyModal(it)} onEdit={()=>openEdit(it)} onDelete={()=>del(it.id)} canEdit={canEdit}/></TD>
            </TR>
          ))}
        </TblWrap>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editItem?'Uredi':'Dodaj stegu / brusnu ploču'} width={580}>
        <FGrid>
          <Field label="Naziv" req><Inp placeholder="Stega Kurt D688" value={form.name} onChange={e=>f('name',e.target.value)}/></Field>
          <Field label="Interni ID"><Inp placeholder="CD-001" value={form.internalId} onChange={e=>f('internalId',e.target.value)}/></Field>
          <Field label="Vrsta" req><Sel value={form.type} onChange={e=>f('type',e.target.value)}>{TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</Sel></Field>
          <Field label="Dimenzije"><Inp placeholder="160×88mm" value={form.dimensions} onChange={e=>f('dimensions',e.target.value)}/></Field>
          {form.type==='stega'&&<>
            <Field label="Raspon stezanja"><Inp placeholder="0–160mm" value={form.clampingRange} onChange={e=>f('clampingRange',e.target.value)}/></Field>
            <Field label="Širina čeljusti"><Inp placeholder="88mm" value={form.jawWidth} onChange={e=>f('jawWidth',e.target.value)}/></Field>
          </>}
          <Field label="Lokacija"><Inp placeholder="G1-R1" value={form.storageLocation} onChange={e=>f('storageLocation',e.target.value)}/></Field>
          <Field label="Trenutna količina" req><Inp type="number" min="0" value={form.currentQuantity} onChange={e=>f('currentQuantity',parseInt(e.target.value)||0)}/></Field>
          <Field label="Minimalna količina" req><Inp type="number" min="1" value={form.minQuantity} onChange={e=>f('minQuantity',parseInt(e.target.value)||1)}/></Field>
          <Field label="Napomena" full><Inp placeholder="Opcijalno..." value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
        </FGrid>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:22 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Odustani</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'Spremi'}</Btn>
        </div>
      </Modal>

      <QtyAdjModal open={!!qtyModal} onClose={()=>setQtyModal(null)} item={qtyModal} onSave={saveQty}/>
      <Toast {...toast}/>
    </div>
  )
}
