import { useState, useEffect, useCallback } from 'react'
import { C, Btn, Modal, Field, Inp, FGrid, TblWrap, TR, TD, RowActions, Toast, useToast, Loading, EmptyState, StatCard } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const E = { hall:'', rack:'', side:'', shelf:'', rowNum:'', notes:'' }

export default function LocationsPage() {
  const { canEdit } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(E)
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try { const r = await api.get('/locations'); setItems(r.data) }
    catch { setItems([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.hall) { showToast('Hala je obavezna!','error'); return }
    setSaving(true)
    try { const r=await api.post('/locations',form); setItems([r.data,...items]); setModal(false); showToast('✓ Lokacija dodana') }
    catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Obrisati lokaciju?')) return
    try { await api.delete(`/locations/${id}`); setItems(items.filter(i=>i.id!==id)); showToast('Obrisano') }
    catch { showToast('Greška','error') }
  }

  const totalFixtures = items.reduce((s,i)=>s+parseInt(i.fixture_count||0),0)
  const halls = [...new Set(items.map(i=>i.hall).filter(Boolean))].length

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        <StatCard label="Lokacija ukupno" value={items.length} color="yellow"/>
        <StatCard label="Hale" value={halls} color="teal"/>
        <StatCard label="Naprava na lokacijama" value={totalFixtures} color="green"/>
      </div>

      <div style={{ display:'flex', alignItems:'center', marginBottom:16 }}>
        {canEdit && <Btn onClick={()=>{setForm(E);setModal(true)}} style={{marginLeft:'auto'}}>+ Dodaj lokaciju</Btn>}
      </div>

      {loading ? <Loading/> : !items.length ? <EmptyState icon="◈" text="Nema lokacija. Dodaj prvu."/> : (
        <TblWrap headers={['Hala','Rack/Polica','Strana','Red','Napomena','Naprava','']}>
          {items.map(it=>(
            <TR key={it.id}>
              <TD><span style={{ fontWeight:600,color:C.teal }}>{it.hall}</span></TD>
              <TD muted>{[it.rack,it.shelf].filter(Boolean).join(' / ')||'—'}</TD>
              <TD muted>{it.side||'—'}</TD>
              <TD muted>{it.row_num||'—'}</TD>
              <TD muted>{it.notes||'—'}</TD>
              <TD><span style={{ fontSize:13,color:it.fixture_count>0?C.accent:C.muted }}>{it.fixture_count||0}</span></TD>
              <TD><RowActions onDelete={()=>del(it.id)} canEdit={canEdit}/></TD>
            </TR>
          ))}
        </TblWrap>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Nova lokacija" width={500}>
        <FGrid cols={2}>
          <Field label="Hala" req><Inp value={form.hall} onChange={e=>f('hall',e.target.value)} placeholder="npr. Hala A"/></Field>
          <Field label="Rack/Ormar"><Inp value={form.rack} onChange={e=>f('rack',e.target.value)} placeholder="npr. R-01"/></Field>
          <Field label="Strana (L/D)"><Inp value={form.side} onChange={e=>f('side',e.target.value)} placeholder="L ili D"/></Field>
          <Field label="Polica"><Inp value={form.shelf} onChange={e=>f('shelf',e.target.value)} placeholder="npr. P-3"/></Field>
          <Field label="Red"><Inp value={form.rowNum} onChange={e=>f('rowNum',e.target.value)} placeholder="npr. 2"/></Field>
          <Field label="Napomena"><Inp value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
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
