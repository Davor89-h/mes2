import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { C, StatCard, Badge, Btn, Modal, Field, Inp, Sel, FGrid, SearchBar, TblWrap, TR, TD, RowActions, Toast, useToast, Loading, EmptyState, SectionTitle } from '../components/UI'
import AdvancedFilter from '../components/AdvancedFilter'
import ExcelBar from '../components/ExcelBar'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { mapExcelToFixture, mapFixtureToExcel } from '../utils/excel'

const TYPES = (t) => [
  {v:'manual',l:t('fixtures.types.manual')},{v:'hydraulic',l:t('fixtures.types.hydraulic')},
  {v:'pneumatic',l:t('fixtures.types.pneumatic')},{v:'magnetic',l:t('fixtures.types.magnetic')},
  {v:'other',l:t('fixtures.types.other')},
]
const STATUSES = (t) => [
  {v:'active',l:t('fixtures.statuses.active')},{v:'in_production',l:t('fixtures.statuses.in_production')},
  {v:'maintenance',l:t('fixtures.statuses.maintenance')},{v:'retired',l:t('fixtures.statuses.retired')},
]
const STATUS_COLOR = { active:'green', in_production:'teal', maintenance:'orange', retired:'gray' }
const TYPE_ICON = { manual:'⬡', hydraulic:'◈', pneumatic:'◉', magnetic:'✦', other:'◫' }
const EMPTY_FORM = { internalId:'',name:'',description:'',type:'manual',status:'active',material:'',weight:'',dimensions:'',clampingPoints:'',maxForce:'',estimatedValue:'',notes:'',locationId:'' }
const EMPTY_FILTER = { status:'', type:'', valueFrom:'', valueTo:'', hasLocation:false, inUse:false }

export default function FixturesPage() {
  const { t, i18n } = useTranslation()
  const { canEdit } = useAuth()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({})
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTER)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [detailModal, setDetailModal] = useState(false)
  const [toast, showToast] = useToast()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const load = useCallback(async () => {
    try {
      const p = {}
      if (search) p.search = search
      if (filters.status) p.status = filters.status
      if (filters.type) p.type = filters.type
      const [it, st, lc] = await Promise.all([
        api.get('/fixtures', {params:p}),
        api.get('/fixtures/stats'),
        api.get('/locations'),
      ])
      let data = it.data
      // Client-side advanced filters
      if (filters.valueFrom) data = data.filter(i => parseFloat(i.estimated_value||0) >= parseFloat(filters.valueFrom))
      if (filters.valueTo) data = data.filter(i => parseFloat(i.estimated_value||0) <= parseFloat(filters.valueTo))
      if (filters.hasLocation) data = data.filter(i => i.location_id)
      if (filters.inUse) data = data.filter(i => parseInt(i.active_uses||0) > 0)
      setItems(data); setStats(st.data); setLocations(lc.data)
    } catch { setItems([]); setStats({}) }
    finally { setLoading(false) }
  }, [search, filters])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setModal(true) }
  const openEdit = (it) => {
    setEditItem(it)
    setForm({ internalId:it.internal_id||'',name:it.name,description:it.description||'',type:it.type||'manual',status:it.status||'active',material:it.material||'',weight:it.weight||'',dimensions:it.dimensions||'',clampingPoints:it.clamping_points||'',maxForce:it.max_force||'',estimatedValue:it.estimated_value||'',notes:it.notes||'',locationId:it.location_id||'' })
    setModal(true)
  }
  const openDetail = async (it) => {
    try { const r = await api.get(`/fixtures/${it.id}`); setDetailItem(r.data); setDetailModal(true) }
    catch { showToast('Greška pri učitavanju','error') }
  }

  const save = async () => {
    if (!form.name) { showToast(t('fixtures.name') + ' ' + t('common.save'), 'error'); return }
    setSaving(true)
    try {
      if (editItem) { const r=await api.put(`/fixtures/${editItem.id}`,form); setItems(items.map(i=>i.id===editItem.id?{...i,...r.data}:i)); showToast('✓ ' + t('common.save')) }
      else { const r=await api.post('/fixtures',form); setItems([r.data,...items]); showToast('✓ ' + t('fixtures.new')) }
      setModal(false)
    } catch(e) { showToast(e.response?.data?.error||'Greška','error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm(t('common.confirm_delete'))) return
    try { await api.delete(`/fixtures/${id}`); setItems(items.filter(i=>i.id!==id)); showToast(t('common.delete')) }
    catch { showToast('Greška','error') }
  }

  // Excel handlers
  const handleExport = async () => items.map(i => mapFixtureToExcel(i, i18n.language))
  const handleImport = async (rows) => {
    const mapped = rows.map(mapExcelToFixture).filter(r => r.name)
    let ok = 0
    for (const row of mapped) {
      try { const r = await api.post('/fixtures', row); setItems(p => [r.data, ...p]); ok++ }
      catch {}
    }
    if (ok < mapped.length) showToast(`${ok}/${mapped.length} ${t('common.rows_imported')}`, 'info')
    load()
  }

  const advFields = [
    { key:'status', type:'select', label:t('common.status'), options:STATUSES(t), placeholder:t('fixtures.filter.all_statuses') },
    { key:'type', type:'select', label:t('common.type'), options:TYPES(t), placeholder:t('fixtures.filter.all_types') },
    { key:'valueFrom', type:'number', label:t('fixtures.filter.value_from'), placeholder:'0' },
    { key:'valueTo', type:'number', label:t('fixtures.filter.value_to'), placeholder:'99999' },
    { key:'hasLocation', type:'checkbox', label:t('fixtures.filter.has_location'), checkLabel:t('fixtures.filter.has_location') },
    { key:'inUse', type:'checkbox', label:t('fixtures.filter.in_use'), checkLabel:t('fixtures.filter.in_use') },
  ]

  const types = TYPES(t)
  const statuses = STATUSES(t)

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:22 }}>
        <StatCard label={t('fixtures.total')} value={stats.total} color="yellow"/>
        <StatCard label={t('fixtures.active')} value={stats.active} color="green"/>
        <StatCard label={t('fixtures.in_production')} value={stats.in_production} color="teal"/>
        <StatCard label={t('fixtures.maintenance')} value={stats.maintenance} color="orange"/>
        <StatCard label={t('fixtures.overdue')} value={stats.overdue_maintenance} color="red"/>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('fixtures.filter.search_placeholder')}/>
        <AdvancedFilter fields={advFields} values={filters} onChange={setFilters} onReset={()=>setFilters(EMPTY_FILTER)}/>
        <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>
          <ExcelBar
            onExport={handleExport}
            onImport={handleImport}
            templateHeaders={t('fixtures.import_template', {returnObjects:true})}
            templateName="fixtures"
            exportFilename="deer_fixtures"
            showToast={showToast}
          />
          {canEdit && <Btn onClick={openAdd}>+ {t('fixtures.new')}</Btn>}
        </div>
      </div>

      {/* Table */}
      {loading ? <Loading/> : !items.length ? <EmptyState icon="⬡" text={t('common.noData')}/> : (
        <TblWrap headers={[t('fixtures.name'),t('fixtures.type'),t('common.status'),t('fixtures.dimensions'),t('fixtures.location'),t('fixtures.clamping_points'),t('fixtures.estimated_value'),'',t('common.actions')]}>
          {items.map(it=>(
            <TR key={it.id} onClick={()=>openDetail(it)}>
              <TD>
                <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                  <div style={{ width:34,height:34,borderRadius:9,background:`${C.teal}11`,border:`1px solid ${C.teal}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:C.teal }}>
                    {TYPE_ICON[it.type]||'⬡'}
                  </div>
                  <div>
                    <div style={{ fontWeight:600,color:'#E8F2F0',fontSize:13 }}>{it.name}</div>
                    <div style={{ fontSize:10,color:C.muted2,fontFamily:'monospace' }}>{it.internal_id||'—'}</div>
                  </div>
                </div>
              </TD>
              <TD><Badge type="teal">{types.find(x=>x.v===it.type)?.l||it.type}</Badge></TD>
              <TD><Badge type={STATUS_COLOR[it.status]||'gray'}>{statuses.find(x=>x.v===it.status)?.l||it.status}</Badge></TD>
              <TD mono muted>{it.dimensions||'—'}</TD>
              <TD muted>{it.hall ? `${it.hall}/${it.rack||''}/${it.shelf||''}` : '—'}</TD>
              <TD muted>{it.clamping_points||'—'}</TD>
              <TD muted>{it.estimated_value ? `${parseFloat(it.estimated_value).toLocaleString()} €` : '—'}</TD>
              <TD>{parseInt(it.active_uses)>0 ? <Badge type="orange">{it.active_uses}× {t('fixtures.active_uses')}</Badge> : <Badge type="gray">{t('fixtures.free')}</Badge>}</TD>
              <TD onClick={e=>e.stopPropagation()}>
                <RowActions onEdit={()=>openEdit(it)} onDelete={()=>del(it.id)} canEdit={canEdit}/>
              </TD>
            </TR>
          ))}
        </TblWrap>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editItem?t('fixtures.edit'):t('fixtures.new')} width={640}>
        <FGrid cols={2}>
          <Field label={t('fixtures.internal_id')}><Inp value={form.internalId} onChange={e=>f('internalId',e.target.value)} placeholder="FL-101"/></Field>
          <Field label={t('fixtures.name')} req><Inp value={form.name} onChange={e=>f('name',e.target.value)}/></Field>
          <Field label={t('fixtures.type')}>
            <Sel value={form.type} onChange={e=>f('type',e.target.value)}>
              {types.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </Sel>
          </Field>
          <Field label={t('common.status')}>
            <Sel value={form.status} onChange={e=>f('status',e.target.value)}>
              {statuses.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </Sel>
          </Field>
          <Field label={t('fixtures.material')}><Inp value={form.material} onChange={e=>f('material',e.target.value)} placeholder="Čelik Č1530"/></Field>
          <Field label={t('fixtures.weight')}><Inp value={form.weight} onChange={e=>f('weight',e.target.value)} placeholder="12.5 kg"/></Field>
          <Field label={t('fixtures.dimensions')}><Inp value={form.dimensions} onChange={e=>f('dimensions',e.target.value)} placeholder="200×150×80 mm"/></Field>
          <Field label={t('fixtures.max_force')}><Inp value={form.maxForce} onChange={e=>f('maxForce',e.target.value)} placeholder="25 kN"/></Field>
          <Field label={t('fixtures.clamping_points')}><Inp type="number" value={form.clampingPoints} onChange={e=>f('clampingPoints',e.target.value)}/></Field>
          <Field label={t('fixtures.estimated_value')}><Inp type="number" value={form.estimatedValue} onChange={e=>f('estimatedValue',e.target.value)}/></Field>
          <Field label={t('fixtures.location')}>
            <Sel value={form.locationId} onChange={e=>f('locationId',e.target.value)}>
              <option value="">—</option>
              {locations.map(l=><option key={l.id} value={l.id}>{l.hall} / {l.rack} / {l.shelf}</option>)}
            </Sel>
          </Field>
          <Field label={t('common.notes')} full><Inp value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
        </FGrid>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:22 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>{t('common.cancel')}</Btn>
          <Btn onClick={save} disabled={saving}>{saving?t('common.saving'):t('common.save')}</Btn>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={()=>setDetailModal(false)} title={detailItem?.name||''} width={700}>
        {detailItem && (
          <div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20 }}>
              {[
                ['ID', detailItem.internal_id||'—'],
                [t('fixtures.type'), types.find(x=>x.v===detailItem.type)?.l||detailItem.type],
                [t('common.status'), statuses.find(x=>x.v===detailItem.status)?.l||detailItem.status],
                [t('fixtures.material'), detailItem.material||'—'],
                [t('fixtures.dimensions'), detailItem.dimensions||'—'],
                [t('fixtures.weight'), detailItem.weight||'—'],
                [t('fixtures.max_force'), detailItem.max_force||'—'],
                [t('fixtures.estimated_value'), detailItem.estimated_value?`${parseFloat(detailItem.estimated_value).toLocaleString()} €`:'—'],
              ].map(([label,value]) => (
                <div key={label} style={{ padding:'9px 12px',background:C.surface3,borderRadius:9,border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:9,color:C.muted,letterSpacing:1.2,marginBottom:3,fontFamily:"'Chakra Petch',sans-serif" }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize:13,color:'#E8F2F0',fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
            {detailItem.hall && <div style={{ marginBottom:14,padding:'10px 14px',background:`${C.teal}0c`,border:`1px solid ${C.teal}22`,borderRadius:10,fontSize:12,color:C.gray }}>
              📍 {t('fixtures.location')}: <strong style={{color:C.teal}}>{detailItem.hall} / {detailItem.rack||'—'} / {detailItem.shelf||'—'}</strong>
            </div>}
            {detailItem.parts?.length > 0 && <>
              <SectionTitle>{t('fixtures.parts_bom')} ({detailItem.parts.length})</SectionTitle>
              <div style={{ marginBottom:14 }}>
                {detailItem.parts.map((p,i)=>(
                  <div key={i} style={{ display:'flex',gap:12,padding:'7px 0',borderBottom:`1px solid ${C.border}33`,fontSize:12,color:C.gray }}>
                    <span style={{ color:C.teal,minWidth:20 }}>{i+1}.</span>
                    <span style={{ flex:1 }}>{p.name}</span>
                    <span style={{ color:C.muted2 }}>{p.material||'—'}</span>
                    <span style={{ color:C.accent,fontWeight:600 }}>×{p.quantity}</span>
                  </div>
                ))}
              </div>
            </>}
            {detailItem.maintenance?.length > 0 && <>
              <SectionTitle>{t('fixtures.service_schedule')}</SectionTitle>
              {detailItem.maintenance.map((m,i)=>(
                <div key={i} style={{ padding:'8px 12px',background:new Date(m.next_inspection_date)<new Date()?`${C.red}11`:`${C.teal}09`,border:`1px solid ${new Date(m.next_inspection_date)<new Date()?C.red+'33':C.teal+'22'}`,borderRadius:8,marginBottom:6,fontSize:12 }}>
                  <strong style={{ color:new Date(m.next_inspection_date)<new Date()?C.red:C.teal }}>{new Date(m.next_inspection_date).toLocaleDateString()}</strong>
                  <span style={{ color:C.muted2,marginLeft:10 }}>svakih {m.interval_days} dana</span>
                </div>
              ))}
            </>}
          </div>
        )}
      </Modal>

      <Toast {...toast}/>
    </div>
  )
}
