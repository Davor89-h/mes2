import { useState, useEffect, useCallback } from 'react'
import { C, StatCard, Badge, Btn, Modal, Field, Sel, FGrid, FSel, TblWrap, TR, TD, Toast, useToast, Loading, EmptyState } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const STATUS_COLOR = { in_machine:'teal', reserved:'yellow', transport:'blue', returned:'green', available:'gray' }
const STATUS_LABEL = { in_machine:'U stroju', reserved:'Rezervirano', transport:'Transport', returned:'Vraćeno', available:'Slobodno', maintenance:'Servis' }

export default function UsageTrackingPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ fixtureId:'', machineId:'', workOrder:'' })
  const [saving, setSaving] = useState(false)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try {
      const p = {}
      if (statusF) p.status = statusF
      const [u, fx, mc] = await Promise.all([
        api.get('/usage', {params:p}),
        api.get('/fixtures', {params:{status:'active'}}),
        api.get('/machines'),
      ])
      setItems(u.data); setFixtures(fx.data); setMachines(mc.data)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [statusF])
  useEffect(() => { load() }, [load])

  const checkout = async () => {
    if (!form.fixtureId) { showToast('Odaberi napravu!','error'); return }
    setSaving(true)
    try {
      await api.post('/usage/checkout', form)
      showToast('✓ Naprava preuzeta — u stroju'); setModal(false); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const returnFixture = async (id) => {
    if (!confirm('Potvrditi povrat naprave?')) return
    try { await api.patch(`/usage/${id}/return`); showToast('✓ Naprava vraćena'); load() }
    catch { showToast('Greška','error') }
  }

  const active = items.filter(i=>i.status==='in_machine').length
  const today = items.filter(i=>new Date(i.checkout_time).toDateString()===new Date().toDateString()).length

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
        <StatCard label="Trenutno u stroju" value={active} color="orange"/>
        <StatCard label="Preuzeto danas" value={today} color="teal"/>
        <StatCard label="Ukupno evidencija" value={items.length} color="yellow"/>
        <StatCard label="Slobodne naprave" value={fixtures.filter(f=>f.status==='active').length} color="green"/>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <FSel value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option value="">Svi statusi</option>
          <option value="in_machine">U stroju</option>
          <option value="reserved">Rezervirano</option>
          <option value="returned">Vraćeno</option>
        </FSel>
        <Btn onClick={()=>{setForm({fixtureId:'',machineId:'',workOrder:''});setModal(true)}} style={{marginLeft:'auto'}}>
          + Preuzmi napravu
        </Btn>
      </div>

      {loading ? <Loading/> : !items.length ? <EmptyState icon="⟳" text="Nema evidencija korištenja."/> : (
        <TblWrap headers={['Naprava','Operater','Stroj','Radni nalog','Preuzeto','Vraćeno','Status','']}>
          {items.map(it=>(
            <TR key={it.id}>
              <TD>
                <div style={{ fontWeight:600,color:'#e8f0ee',fontSize:13 }}>{it.fixture_name}</div>
                <div style={{ fontSize:10,color:C.muted2,fontFamily:'monospace' }}>{it.fixture_internal_id||''}</div>
              </TD>
              <TD muted>{it.operator_name||'—'}</TD>
              <TD><span style={{ color:C.teal }}>{it.machine_name||'—'}</span></TD>
              <TD mono muted>{it.work_order||'—'}</TD>
              <TD muted style={{ fontSize:11 }}>{it.checkout_time?new Date(it.checkout_time).toLocaleString('hr-HR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</TD>
              <TD muted style={{ fontSize:11 }}>{it.return_time?new Date(it.return_time).toLocaleString('hr-HR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</TD>
              <TD><Badge type={STATUS_COLOR[it.status]||'gray'}>{STATUS_LABEL[it.status]||it.status}</Badge></TD>
              <TD>
                {it.status==='in_machine'&&(
                  <Btn sm v="teal" onClick={()=>returnFixture(it.id)}>Povrat ↩</Btn>
                )}
              </TD>
            </TR>
          ))}
        </TblWrap>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Preuzimanje naprave" width={480}>
        <FGrid cols={1}>
          <Field label="Naprava" req>
            <Sel value={form.fixtureId} onChange={e=>f('fixtureId',e.target.value)}>
              <option value="">— Odaberi napravu —</option>
              {fixtures.filter(f=>f.status==='active').map(fx=>(
                <option key={fx.id} value={fx.id}>{fx.name} {fx.internal_id?`(${fx.internal_id})`:''}</option>
              ))}
            </Sel>
          </Field>
          <Field label="Stroj">
            <Sel value={form.machineId} onChange={e=>f('machineId',e.target.value)}>
              <option value="">— Odaberi stroj —</option>
              {machines.map(m=>(
                <option key={m.id} value={m.id}>{m.name} {m.machine_id?`(${m.machine_id})`:''}</option>
              ))}
            </Sel>
          </Field>
          <Field label="Radni nalog">
            <input value={form.workOrder} onChange={e=>f('workOrder',e.target.value)} placeholder="npr. RN-2025-001"
              style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',color:C.gray,fontSize:13,outline:'none',width:'100%' }}
              onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border}/>
          </Field>
        </FGrid>
        <div style={{ marginTop:16,padding:'10px 14px',background:`${C.teal}09`,border:`1px solid ${C.teal}22`,borderRadius:10,fontSize:12,color:C.muted2 }}>
          Operater: <strong style={{ color:C.teal }}>{user?.firstName} {user?.lastName}</strong>
        </div>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:22 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Odustani</Btn>
          <Btn onClick={checkout} disabled={saving}>{saving?'Sprema...':'Preuzmi napravu'}</Btn>
        </div>
      </Modal>
      <Toast {...toast}/>
    </div>
  )
}
