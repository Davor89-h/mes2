import { useState, useEffect, useCallback } from 'react'
import { C, StatCard, Badge, Btn, Modal, Field, Inp, Sel, FGrid, SearchBar, TblWrap, TR, TD, RowActions, Toast, useToast, Loading, EmptyState } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const TYPES = ['CNC obradni centar','CNC tokarilica','CNC glodalica','Bušilica','Brusilica','Prešalica','Ostalo']
const E = { machineId:'', name:'', manufacturer:'', type:'', tableSize:'', maxLoad:'', location:'', notes:'' }

export default function MachinesPage() {
  const { canEdit } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(E)
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try {
      const r = await api.get('/machines')
      setItems(r.data)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditItem(null); setForm(E); setModal(true) }
  const openEdit = (it) => {
    setEditItem(it)
    setForm({ machineId:it.machine_id||'', name:it.name, manufacturer:it.manufacturer||'', type:it.type||'', tableSize:it.table_size||'', maxLoad:it.max_load||'', location:it.location||'', notes:it.notes||'' })
    setModal(true)
  }

  const save = async () => {
    if (!form.name) { showToast('Naziv je obavezan!','error'); return }
    setSaving(true)
    try {
      if (editItem) { const r=await api.put(`/machines/${editItem.id}`,form); setItems(items.map(i=>i.id===editItem.id?r.data:i)); showToast('✓ Ažurirano') }
      else { const r=await api.post('/machines',form); setItems([r.data,...items]); showToast('✓ Dodano') }
      setModal(false)
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Obrisati stroj?')) return
    try { await api.delete(`/machines/${id}`); setItems(items.filter(i=>i.id!==id)); showToast('Obrisano') }
    catch { showToast('Greška','error') }
  }

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.machine_id||'').toLowerCase().includes(search.toLowerCase()))
  const inUse = items.filter(i => parseInt(i.active_fixtures||0) > 0).length

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        <StatCard label="Ukupno strojeva" value={items.length} color="yellow"/>
        <StatCard label="Sa aktivnim napravama" value={inUse} color="teal"/>
        <StatCard label="Slobodni strojevi" value={items.length - inUse} color="green"/>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <SearchBar value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naziv stroja ili ID..."/>
        {canEdit && <Btn onClick={openAdd} style={{marginLeft:'auto'}}>+ Dodaj stroj</Btn>}
      </div>

      {loading ? <Loading/> : !filtered.length ? <EmptyState icon="⚙" text="Nema strojeva. Dodaj prvi."/> : (
        <TblWrap headers={['Stroj','ID','Tip','Proizvođač','Veličina stola','Maks. opterećenje','Lokacija','Aktivne naprave','']}>
          {filtered.map(it=>(
            <TR key={it.id}>
              <TD><div style={{ fontWeight:600,color:'#e8f0ee' }}>{it.name}</div></TD>
              <TD mono muted>{it.machine_id||'—'}</TD>
              <TD><Badge type="teal">{it.type||'—'}</Badge></TD>
              <TD muted>{it.manufacturer||'—'}</TD>
              <TD muted>{it.table_size||'—'}</TD>
              <TD muted>{it.max_load||'—'}</TD>
              <TD muted>{it.location||'—'}</TD>
              <TD>
                {parseInt(it.active_fixtures||0) > 0
                  ? <Badge type="orange">{it.active_fixtures} naprava</Badge>
                  : <Badge type="gray">Slobodan</Badge>}
              </TD>
              <TD><RowActions onEdit={()=>openEdit(it)} onDelete={()=>del(it.id)} canEdit={canEdit}/></TD>
            </TR>
          ))}
        </TblWrap>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editItem?'Uredi stroj':'Novi stroj'} width={580}>
        <FGrid cols={2}>
          <Field label="ID stroja"><Inp value={form.machineId} onChange={e=>f('machineId',e.target.value)} placeholder="npr. C42"/></Field>
          <Field label="Naziv" req><Inp value={form.name} onChange={e=>f('name',e.target.value)} placeholder="naziv stroja"/></Field>
          <Field label="Proizvođač"><Inp value={form.manufacturer} onChange={e=>f('manufacturer',e.target.value)} placeholder="npr. DMG Mori"/></Field>
          <Field label="Tip">
            <Sel value={form.type} onChange={e=>f('type',e.target.value)}>
              <option value="">— Odaberi —</option>
              {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </Sel>
          </Field>
          <Field label="Veličina radnog stola"><Inp value={form.tableSize} onChange={e=>f('tableSize',e.target.value)} placeholder="npr. 800×500 mm"/></Field>
          <Field label="Maks. opterećenje"><Inp value={form.maxLoad} onChange={e=>f('maxLoad',e.target.value)} placeholder="npr. 500 kg"/></Field>
          <Field label="Lokacija" full><Inp value={form.location} onChange={e=>f('location',e.target.value)} placeholder="npr. Hala A, pozicija 12"/></Field>
          <Field label="Napomene" full><Inp value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
        </FGrid>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:22 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Odustani</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'Spremi'}</Btn>
        </div>
      </Modal>
      <Toast {...toast}/>
    </div>
  )
}
