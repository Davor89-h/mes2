import { useState, useEffect, useCallback } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import {
  Plus, RefreshCw, Building2, FileSearch, ShoppingCart, Receipt,
  X, Check, ChevronDown, ChevronUp, Search, Trash2, ArrowRight,
  TrendingUp, Clock, AlertTriangle, DollarSign, Edit2, Eye, FileText
} from 'lucide-react'

// ─── COLOUR HELPERS ──────────────────────────────────────────────────────────
const SC = {
  novo: C.blue, u_obradi: C.orange, ponuda_poslana: C.teal, narudžba: C.green,
  odbijen: C.red, otkazan: C.muted, nova: C.blue, potvrđena: C.teal,
  u_izradi: C.orange, sprema_za_otpremu: C.accent, isporučena: C.green,
  fakturirana: C.green, otkazana: C.red, nacrt: C.muted, poslana: C.blue,
  prihvaćena: C.green, odbijena: C.red, plaćena: C.green,
}
const Pill = ({ s }) => (
  <span style={{ background: `${SC[s] || C.muted}22`, color: SC[s] || C.muted, border: `1px solid ${SC[s] || C.muted}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{s?.toUpperCase()}</span>
)

// ─── REUSABLE UI ─────────────────────────────────────────────────────────────
const Btn = ({ onClick, children, color = C.accent, sm, danger, style = {} }) => (
  <button onClick={onClick} style={{ background: danger ? C.red : color, color: (sm && color !== C.accent) ? C.gray : C.bg, border: 'none', borderRadius: sm ? 6 : 8, padding: sm ? '4px 10px' : '9px 18px', cursor: 'pointer', fontSize: sm ? 11 : 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, transition: 'opacity .15s', ...style }} onMouseOver={e => e.currentTarget.style.opacity = '.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>{children}</button>
)

const Inp = ({ label, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</label>}
    <input {...p} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', ...p.style }} />
  </div>
)

const Sel = ({ label, children, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</label>}
    <select {...p} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', ...p.style }}>{children}</select>
  </div>
)

const Textarea = ({ label, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</label>}
    <textarea {...p} rows={3} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', resize: 'vertical', ...p.style }} />
  </div>
)

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: wide ? 780 : 560, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ color: C.accent, margin: 0, fontSize: 16, fontFamily: "'Chakra Petch',sans-serif" }}>{title}</h3>
        <X size={18} style={{ cursor: 'pointer', color: C.muted }} onClick={onClose} />
      </div>
      {children}
    </div>
  </div>
)

const Divider = () => <div style={{ borderTop: `1px solid ${C.border}`, margin: '16px 0' }} />

const fmt = (n, currency = 'EUR') => Number(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
const fmtDate = d => d ? new Date(d).toLocaleDateString('hr-HR') : '—'
const isOverdue = d => d && new Date(d) < new Date()

// ─── SEARCH BAR ──────────────────────────────────────────────────────────────
const SearchBar = ({ value, onChange, placeholder }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Pretraga...'} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px 8px 32px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
  </div>
)

// ─── POSITIONS TABLE ─────────────────────────────────────────────────────────
const PositionRow = ({ pos, onDelete, editable }) => (
  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
    <td style={{ padding: '8px 6px', color: C.muted, fontSize: 12 }}>{pos.position_no}</td>
    <td style={{ padding: '8px 6px', color: C.gray, fontSize: 13, fontWeight: 600 }}>{pos.part_name || '—'}</td>
    <td style={{ padding: '8px 6px', color: C.muted, fontSize: 12 }}>{pos.drawing_number || '—'}</td>
    <td style={{ padding: '8px 6px', color: C.muted, fontSize: 12 }}>{pos.material || '—'}</td>
    <td style={{ padding: '8px 6px', color: C.gray, fontSize: 12, textAlign: 'right' }}>{pos.quantity} {pos.unit}</td>
    <td style={{ padding: '8px 6px', color: C.gray, fontSize: 12, textAlign: 'right' }}>{fmt(pos.unit_price)}</td>
    <td style={{ padding: '8px 6px', color: C.accent, fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{fmt(pos.total_price)}</td>
    {editable && <td style={{ padding: '8px 6px' }}><Trash2 size={13} style={{ color: C.red, cursor: 'pointer' }} onClick={onDelete} /></td>}
  </tr>
)

const PositionsTable = ({ positions, editable, onDelete }) => (
  <div style={{ overflowX: 'auto', marginTop: 8 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: C.surface3 }}>
          {['#', 'Naziv dijela', 'Crtež', 'Materijal', 'Kol.', 'Jed. cijena', 'Ukupno', editable ? '' : null].filter(Boolean).map(h => (
            <th key={h} style={{ padding: '7px 6px', color: C.muted, fontWeight: 700, letterSpacing: 0.5, textAlign: h === '#' ? 'left' : 'right', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => <PositionRow key={p.id || i} pos={p} editable={editable} onDelete={() => onDelete(p.id)} />)}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={editable ? 6 : 6} style={{ padding: '8px 6px', color: C.muted, fontSize: 12, textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ukupno bez PDV:</td>
          <td style={{ padding: '8px 6px', color: C.accent, fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{fmt(positions.reduce((s, p) => s + (p.total_price || 0), 0))}</td>
          {editable && <td />}
        </tr>
      </tfoot>
    </table>
  </div>
)

// ─── ADD POSITION FORM ───────────────────────────────────────────────────────
const AddPositionForm = ({ onAdd }) => {
  const [p, setP] = useState({ part_name: '', drawing_number: '', material: '', quantity: 1, unit: 'kom', unit_price: '', delivery_weeks: '', notes: '' })
  const set = k => e => setP(prev => ({ ...prev, [k]: e.target.value }))
  const total = (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0)
  return (
    <div style={{ background: C.surface3, borderRadius: 10, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>+ NOVA POZICIJA</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <Inp label="Naziv dijela *" value={p.part_name} onChange={set('part_name')} />
        <Inp label="Br. crteža" value={p.drawing_number} onChange={set('drawing_number')} />
        <Inp label="Materijal" value={p.material} onChange={set('material')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Inp label="Količina" type="number" value={p.quantity} onChange={set('quantity')} />
        <Sel label="Jed." value={p.unit} onChange={set('unit')}>
          {['kom','m','m²','m³','kg','t','h','set'].map(u => <option key={u}>{u}</option>)}
        </Sel>
        <Inp label="Jed. cijena (EUR)" type="number" value={p.unit_price} onChange={set('unit_price')} />
        <Inp label="Rok (tjedni)" type="number" value={p.delivery_weeks} onChange={set('delivery_weeks')} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>Ukupno: {fmt(total)}</span>
        <Btn onClick={() => { if (!p.part_name) return; onAdd(p); setP({ part_name: '', drawing_number: '', material: '', quantity: 1, unit: 'kom', unit_price: '', delivery_weeks: '', notes: '' }) }}><Plus size={13} /> Dodaj poziciju</Btn>
      </div>
    </div>
  )
}

// ─── MINI BAR CHART ──────────────────────────────────────────────────────────
const RevenueChart = ({ data }) => {
  if (!data || data.length === 0) return <div style={{ color: C.muted, textAlign: 'center', padding: 20, fontSize: 12 }}>Nema podataka o prihodu</div>
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
      {data.slice(-12).map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: `${C.accent}33`, borderRadius: '4px 4px 0 0', height: Math.max(4, (d.revenue / max) * 64), position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.accent, height: `${(d.revenue / max) * 100}%`, borderRadius: '4px 4px 0 0', transition: 'height .5s' }} />
          </div>
          <span style={{ fontSize: 9, color: C.muted, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d.month?.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── ACTIVITY FEED ───────────────────────────────────────────────────────────
const ActivityFeed = ({ activities }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {(activities || []).slice(0, 8).map((a, i) => (
      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${C.border}33` }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.action === 'paid' ? C.green : a.action === 'create' ? C.teal : C.accent, marginTop: 5, flexShrink: 0 }} />
        <div>
          <div style={{ color: C.gray, fontSize: 12 }}>{a.description}</div>
          <div style={{ color: C.muted, fontSize: 10 }}>{a.username} · {new Date(a.created_at).toLocaleString('hr-HR')}</div>
        </div>
      </div>
    ))}
    {!activities?.length && <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Nema aktivnosti</div>}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SalesPage() {
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState({ rfqs: [], orders: [], partners: [], invoices: [], stats: { rfq: {}, order: {} }, invStats: {}, revenue: [], activities: [] })
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)  // 'add-rfq' | 'add-order' | 'add-partner' | 'add-invoice' | 'view-rfq' | 'view-order' | 'edit-partner' | 'convert-rfq'
  const [form, setForm] = useState({})
  const [positions, setPositions] = useState([])
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [toast, showToast] = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rfqs, orders, partners, invoices, rfqStats, orderStats, invStats, revenue, activities] = await Promise.all([
        api.get('/sales/rfqs'),
        api.get('/sales/orders'),
        api.get('/sales/partners'),
        api.get('/sales/invoices'),
        api.get('/sales/rfqs/stats').catch(() => ({ data: {} })),
        api.get('/sales/orders/stats').catch(() => ({ data: {} })),
        api.get('/sales/invoice/stats').catch(() => ({ data: {} })),
        api.get('/sales/revenue/monthly').catch(() => ({ data: [] })),
        api.get('/sales/activities').catch(() => ({ data: [] })),
      ])
      setData({ rfqs: rfqs.data, orders: orders.data, partners: partners.data, invoices: invoices.data, stats: { rfq: rfqStats.data, order: orderStats.data }, invStats: invStats.data, revenue: revenue.data, activities: activities.data })
    } catch { showToast('Greška učitavanja podataka', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const inp = k => ({ value: form[k] || '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  const handleSubmit = async () => {
    try {
      if (modal === 'add-rfq') await api.post('/sales/rfqs', { ...form, positions })
      else if (modal === 'add-order') await api.post('/sales/orders', { ...form, positions })
      else if (modal === 'add-partner') await api.post('/sales/partners', form)
      else if (modal === 'edit-partner') await api.put(`/sales/partners/${selected?.id}`, form)
      else if (modal === 'add-invoice') await api.post('/sales/invoices', form)
      else if (modal === 'convert-rfq') {
        const res = await api.post(`/sales/rfqs/${selected?.id}/convert`, form)
        showToast(`Narudžba ${res.data.order.internal_id} kreirana!`)
        setModal(null); setForm({}); load(); return
      }
      showToast('Uspješno spremljeno!')
      setModal(null); setForm({}); setPositions([])
      load()
    } catch (e) { showToast(e.response?.data?.error || 'Greška pri spremanju', 'error') }
  }

  const updateStatus = async (type, id, status) => {
    try {
      await api.put(`/sales/${type}/${id}`, { status })
      load()
    } catch { showToast('Greška', 'error') }
  }

  const deleteEntity = async (type, id) => {
    if (!window.confirm('Sigurno obrišeš?')) return
    try { await api.delete(`/sales/${type}/${id}`); load() } catch { showToast('Greška brisanja', 'error') }
  }

  const markPaid = async (id) => {
    try { await api.put(`/sales/invoices/${id}/paid`); showToast('Faktura označena kao plaćena!'); load() } catch { showToast('Greška', 'error') }
  }

  const openView = async (type, id) => {
    try {
      const r = await api.get(`/sales/${type}/${id}`)
      setSelected(r.data); setModal(`view-${type}`)
    } catch { showToast('Greška učitavanja detalja', 'error') }
  }

  // ── Filter helpers ──
  const filterItems = (items) => {
    let f = items
    if (search) {
      const s = search.toLowerCase()
      f = f.filter(i => JSON.stringify(i).toLowerCase().includes(s))
    }
    if (filterStatus) f = f.filter(i => i.status === filterStatus)
    return f
  }

  const TAB = (k, l, Ic) => (
    <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, background: tab === k ? C.accent : 'transparent', color: tab === k ? C.bg : C.muted, border: `1px solid ${tab === k ? C.accent : C.border}`, transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Ic size={13} />{l}
    </button>
  )

  const card = (label, value, color = 'yellow', sub) => <StatCard label={label} value={value} color={color} sub={sub} />

  // ═══════════════ RENDER ════════════════════════════════════════════════════
  return (
    <div style={{ padding: 24, fontFamily: "'Chakra Petch',sans-serif", color: C.gray, minHeight: '100vh' }}>
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? C.red : C.green, color: '#fff', padding: '12px 20px', borderRadius: 10, zIndex: 9999, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>{toast.message}</div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: C.accent, margin: 0, fontSize: 24, letterSpacing: 1 }}>💰 SALES MODULE</h1>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Deer MES · Upravljanje prodajom</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /></Btn>
          {tab !== 'dashboard' && (
            <Btn onClick={() => { setForm({}); setPositions([]); setModal(`add-${tab === 'rfqs' ? 'rfq' : tab === 'orders' ? 'order' : tab === 'partners' ? 'partner' : 'invoice'}`) }}>
              <Plus size={14} /> Novi {tab === 'rfqs' ? 'Upit' : tab === 'orders' ? 'Narudžbu' : tab === 'partners' ? 'Partnera' : 'Fakturu'}
            </Btn>
          )}
        </div>
      </div>

      {/* ── KPI STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        {card('Aktivni upiti', data.stats.rfq?.u_obradi || 0, 'yellow')}
        {card('Ponude poslane', data.stats.rfq?.ponuda_poslana || 0, 'teal')}
        {card('Narudžbe u izradi', data.stats.order?.u_izradi || 0, 'orange')}
        {card('Kasni isporuka', data.stats.order?.kasni || 0, 'red')}
        {card('Neplaćeno', data.invStats?.pending_count || 0, 'orange', fmt(data.invStats?.pending_amount))}
        {card('Prihod ukupno', '', 'green', fmt(data.invStats?.total))}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TAB('dashboard', 'Dashboard', TrendingUp)}
        {TAB('rfqs', 'Upiti (RFQ)', FileSearch)}
        {TAB('orders', 'Narudžbe', ShoppingCart)}
        {TAB('partners', 'Partneri', Building2)}
        {TAB('invoices', 'Fakture', Receipt)}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DASHBOARD TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Revenue Chart */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>📈 PRIHODI PO MJESECIMA</div>
              <div style={{ color: C.muted, fontSize: 12 }}>zadnjih 12 mj.</div>
            </div>
            <RevenueChart data={data.revenue} />
          </div>

          {/* Invoice Summary */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ color: C.accent, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>💳 FAKTURE — SAŽETAK</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Ukupno fakturirano', value: fmt(data.invStats?.total), color: C.gray },
                { label: 'Plaćeno', value: fmt(data.invStats?.paid), color: C.green },
                { label: 'Neplaćeno', value: fmt(data.invStats?.pending_amount), color: C.orange },
                { label: 'Kasni plaćanje', value: fmt(data.invStats?.overdue_amount), color: C.red },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}33` }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 700, fontSize: 13 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ color: C.accent, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🕐 NEDAVNE AKTIVNOSTI</div>
            <ActivityFeed activities={data.activities} />
          </div>

          {/* Top Partners */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ color: C.accent, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🏆 TOP PARTNERI</div>
            {data.partners.filter(p => p.total_revenue > 0).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 6).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: C.muted, fontSize: 11, width: 16 }}>#{i + 1}</span>
                  <div>
                    <div style={{ color: C.gray, fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{p.order_count} narudžbi</div>
                  </div>
                </div>
                <span style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>{fmt(p.total_revenue)}</span>
              </div>
            ))}
            {data.partners.filter(p => p.total_revenue > 0).length === 0 && <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Nema podataka</div>}
          </div>

          {/* Overdue Orders */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ color: C.red, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⚠️ PREKORAČENI ROKOVI</div>
            {data.orders.filter(o => isOverdue(o.delivery_date) && !['isporučena', 'otkazana'].includes(o.status)).length === 0
              ? <div style={{ color: C.green, fontSize: 13 }}>✓ Nema prekoračenih rokova!</div>
              : data.orders.filter(o => isOverdue(o.delivery_date) && !['isporučena', 'otkazana'].includes(o.status)).map(o => (
                <div key={o.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}33` }}>
                  <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: C.accent, fontWeight: 700 }}>{o.internal_id}</span>
                    <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{o.partner_name}</span>
                  </div>
                  <span style={{ color: C.red, fontSize: 12 }}>Rok: {fmtDate(o.delivery_date)}</span>
                  <Pill s={o.status} />
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          RFQs TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'rfqs' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Pretraži upite..." />
            <Sel value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 150 }}>
              <option value="">Svi statusi</option>
              {['novo', 'u_obradi', 'ponuda_poslana', 'narudžba', 'odbijen'].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filterItems(data.rfqs).map(r => (
              <div key={r.id} style={{ background: C.surface, border: `1px solid ${isOverdue(r.deadline) && r.status !== 'narudžba' ? C.red + '66' : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [r.id]: !p[r.id] }))}>
                  <div>
                    <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{r.internal_id}</span>
                    <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{r.partner_name || '—'}</span>
                    {r.customer_rfq_id && <div style={{ color: C.muted, fontSize: 11 }}>Ref: {r.customer_rfq_id}</div>}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted }}>Rok odgovora</div>
                    <div style={{ color: isOverdue(r.deadline) && r.status !== 'narudžba' ? C.red : C.gray, fontWeight: 600 }}>{fmtDate(r.deadline)}</div>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted }}>{r.position_count || 0} poz.</div>
                    <div style={{ color: C.accent, fontWeight: 700 }}>{r.total_value > 0 ? fmt(r.total_value) : '—'}</div>
                  </div>
                  <Pill s={r.status} />
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {expanded[r.id] ? <ChevronUp size={16} style={{ color: C.muted }} /> : <ChevronDown size={16} style={{ color: C.muted }} />}
                  </div>
                </div>
                {expanded[r.id] && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', background: C.surface2 }}>
                    {r.notes && <div style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>📝 {r.notes}</div>}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      <Btn sm color={C.surface3} onClick={() => openView('rfqs', r.id)}><Eye size={12} /> Detalji & pozicije</Btn>
                      {r.status === 'novo' && <Btn sm color={C.orange + '33'} onClick={() => updateStatus('rfqs', r.id, 'u_obradi')}>▶ U obradi</Btn>}
                      {r.status === 'u_obradi' && <Btn sm color={C.teal + '33'} onClick={() => updateStatus('rfqs', r.id, 'ponuda_poslana')}>📤 Ponuda poslana</Btn>}
                      {['u_obradi', 'ponuda_poslana'].includes(r.status) && (
                        <Btn sm color={C.green + '33'} onClick={() => { setSelected(r); setForm({ delivery_date: r.deadline }); setModal('convert-rfq') }}><ArrowRight size={12} /> Pretvori u narudžbu</Btn>
                      )}
                      {!['narudžba', 'odbijen'].includes(r.status) && <Btn sm color={C.red + '22'} onClick={() => updateStatus('rfqs', r.id, 'odbijen')}>✗ Odbijen</Btn>}
                      <Btn sm danger onClick={() => deleteEntity('rfqs', r.id)}><Trash2 size={12} /></Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filterItems(data.rfqs).length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema upita {search ? `za "${search}"` : ''}</div>}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ORDERS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Pretraži narudžbe..." />
            <Sel value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Svi statusi</option>
              {['nova', 'potvrđena', 'u_izradi', 'sprema_za_otpremu', 'isporučena', 'fakturirana', 'otkazana'].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filterItems(data.orders).map(o => (
              <div key={o.id} style={{ background: C.surface, border: `1px solid ${isOverdue(o.delivery_date) && !['isporučena', 'otkazana'].includes(o.status) ? C.red + '66' : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, ['o' + o.id]: !p['o' + o.id] }))}>
                  <div>
                    <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{o.internal_id}</span>
                    <div style={{ color: C.muted, fontSize: 12 }}>{o.partner_name || '—'}</div>
                    {o.customer_order_id && <div style={{ color: C.muted, fontSize: 11 }}>Kupac: {o.customer_order_id}</div>}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted }}>Isporuka</div>
                    <div style={{ color: isOverdue(o.delivery_date) && !['isporučena', 'otkazana'].includes(o.status) ? C.red : C.gray, fontWeight: 600 }}>{fmtDate(o.delivery_date)}</div>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted }}>{o.position_count || 0} poz.</div>
                    {o.total_value > 0 && <div style={{ color: C.accent, fontWeight: 700 }}>{fmt(o.total_value)}</div>}
                  </div>
                  <Pill s={o.status} />
                  {isOverdue(o.delivery_date) && !['isporučena', 'otkazana'].includes(o.status) && <AlertTriangle size={14} style={{ color: C.red }} />}
                  {expanded['o' + o.id] ? <ChevronUp size={16} style={{ color: C.muted }} /> : <ChevronDown size={16} style={{ color: C.muted }} />}
                </div>
                {expanded['o' + o.id] && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', background: C.surface2 }}>
                    {o.notes && <div style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>📝 {o.notes}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Btn sm color={C.surface3} onClick={() => openView('orders', o.id)}><Eye size={12} /> Detalji</Btn>
                      {o.status === 'nova' && <Btn sm color={C.teal + '33'} onClick={() => updateStatus('orders', o.id, 'potvrđena')}>✓ Potvrdi</Btn>}
                      {o.status === 'potvrđena' && <Btn sm color={C.orange + '33'} onClick={() => updateStatus('orders', o.id, 'u_izradi')}>▶ U izradi</Btn>}
                      {o.status === 'u_izradi' && <Btn sm color={C.accent + '33'} onClick={() => updateStatus('orders', o.id, 'sprema_za_otpremu')}>📦 Sprema za otpremu</Btn>}
                      {o.status === 'sprema_za_otpremu' && <Btn sm color={C.green + '33'} onClick={() => updateStatus('orders', o.id, 'isporučena')}>🚚 Isporučena</Btn>}
                      {o.status === 'isporučena' && <Btn sm color={C.green + '33'} onClick={() => updateStatus('orders', o.id, 'fakturirana')}>🧾 Fakturirana</Btn>}
                      <Btn sm color={C.blue + '33'} onClick={() => { setForm({ order_id: o.id }); setModal('add-invoice') }}><Receipt size={12} /> Napravi fakturu</Btn>
                      <Btn sm danger onClick={() => deleteEntity('orders', o.id)}><Trash2 size={12} /></Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filterItems(data.orders).length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema narudžbi {search ? `za "${search}"` : ''}</div>}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PARTNERS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'partners' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Pretraži partnere..." />
            <Sel value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 130 }}>
              <option value="">Svi tipovi</option>
              <option value="customer">Kupci</option>
              <option value="supplier">Dobavljači</option>
              <option value="both">Oboje</option>
            </Sel>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {filterItems(data.partners).map(p => (
              <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ color: C.accent, fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <span style={{ background: `${C.teal}22`, color: C.teal, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.type?.toUpperCase()}</span>
                </div>
                <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                  {p.oib && <div style={{ color: C.muted }}>OIB: <span style={{ color: C.gray }}>{p.oib}</span></div>}
                  {p.country && <div style={{ color: C.muted }}>📍 {p.address ? `${p.address}, ` : ''}{p.country}</div>}
                  {p.contact_email && <div style={{ color: C.muted }}>✉️ <span style={{ color: C.gray }}>{p.contact_email}</span></div>}
                  {p.contact_phone && <div style={{ color: C.muted }}>📞 <span style={{ color: C.gray }}>{p.contact_phone}</span></div>}
                  {p.contact_name && <div style={{ color: C.muted }}>👤 <span style={{ color: C.gray }}>{p.contact_name}</span></div>}
                </div>
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: C.muted }}>{p.order_count} narudžbi · </span>
                    <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(p.total_revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn sm color={C.surface3} onClick={() => { setSelected(p); setForm({ ...p }); setModal('edit-partner') }}><Edit2 size={12} /></Btn>
                    <Btn sm danger onClick={() => deleteEntity('partners', p.id)}><Trash2 size={12} /></Btn>
                  </div>
                </div>
                {p.payment_terms && <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>⏱ Rok plaćanja: {p.payment_terms} dana</div>}
              </div>
            ))}
            {filterItems(data.partners).length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40, gridColumn: '1/-1' }}>Nema partnera</div>}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          INVOICES TAB
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'invoices' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Pretraži fakture..." />
            <Sel value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">Svi statusi</option>
              {['nacrt', 'poslana', 'plaćena', 'odbijena'].map(s => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filterItems(data.invoices).map(inv => {
              const overdue = isOverdue(inv.due_date) && inv.status !== 'plaćena'
              return (
                <div key={inv.id} style={{ background: C.surface, border: `1px solid ${overdue ? C.red + '66' : C.border}`, borderRadius: 12, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{inv.invoice_number}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{inv.partner_name || '—'}</div>
                    {inv.order_ref && <div style={{ color: C.muted, fontSize: 11 }}>Narudžba: {inv.order_ref}</div>}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted, fontSize: 11 }}>Bez PDV</div>
                    <div style={{ color: C.gray }}>{fmt(inv.amount)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(inv.total_amount)} <span style={{ color: C.muted, fontSize: 10, fontWeight: 400 }}>{inv.currency}</span></div>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: C.muted, fontSize: 11 }}>Rok plaćanja</div>
                    <div style={{ color: overdue ? C.red : C.gray, fontWeight: overdue ? 700 : 400 }}>{fmtDate(inv.due_date)}</div>
                  </div>
                  <Pill s={inv.status} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    {inv.status !== 'plaćena' && <Btn sm color={C.green + '33'} onClick={() => markPaid(inv.id)}><Check size={12} /> Plaćeno</Btn>}
                    {inv.status === 'nacrt' && <Btn sm color={C.blue + '33'} onClick={() => api.put(`/sales/invoices/${inv.id}`, { status: 'poslana' }).then(load)}>📤 Pošalji</Btn>}
                    <Btn sm danger onClick={() => deleteEntity('invoices', inv.id)}><Trash2 size={12} /></Btn>
                  </div>
                </div>
              )
            })}
            {filterItems(data.invoices).length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema faktura {search ? `za "${search}"` : ''}</div>}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* ADD RFQ */}
      {modal === 'add-rfq' && (
        <Modal title="📋 Novi upit (RFQ)" onClose={() => setModal(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Sel label="Partner *" {...inp('partner_id')}><option value="">— Odaberi —</option>{data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
            <Inp label="Kupčev broj upita" {...inp('customer_rfq_id')} />
            <Inp label="Rok odgovora" type="date" {...inp('deadline')} />
            <Textarea label="Napomena" {...inp('notes')} style={{ gridColumn: '1 / -1' }} />
          </div>
          <Divider />
          <div style={{ color: C.teal, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>POZICIJE ({positions.length})</div>
          {positions.length > 0 && <PositionsTable positions={positions} editable onDelete={id => setPositions(p => p.filter((_, i) => i !== id))} />}
          <AddPositionForm onAdd={p => setPositions(prev => [...prev, { ...p, id: prev.length, position_no: prev.length + 1, total_price: (parseFloat(p.quantity) || 1) * (parseFloat(p.unit_price) || 0) }])} />
          <Divider />
          <Btn onClick={handleSubmit}><Check size={14} /> Spremi upit</Btn>
        </Modal>
      )}

      {/* ADD ORDER */}
      {modal === 'add-order' && (
        <Modal title="📦 Nova narudžba" onClose={() => setModal(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Sel label="Partner *" {...inp('partner_id')}><option value="">— Odaberi —</option>{data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
            <Inp label="Kupčev broj narudžbe" {...inp('customer_order_id')} />
            <Inp label="Rok isporuke" type="date" {...inp('delivery_date')} />
            <Textarea label="Napomena" {...inp('notes')} style={{ gridColumn: '1 / -1' }} />
          </div>
          <Divider />
          <div style={{ color: C.teal, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>POZICIJE ({positions.length})</div>
          {positions.length > 0 && <PositionsTable positions={positions} editable onDelete={id => setPositions(p => p.filter((_, i) => i !== id))} />}
          <AddPositionForm onAdd={p => setPositions(prev => [...prev, { ...p, id: prev.length, position_no: prev.length + 1, total_price: (parseFloat(p.quantity) || 1) * (parseFloat(p.unit_price) || 0) }])} />
          <Divider />
          <Btn onClick={handleSubmit}><Check size={14} /> Spremi narudžbu</Btn>
        </Modal>
      )}

      {/* CONVERT RFQ → ORDER */}
      {modal === 'convert-rfq' && (
        <Modal title={`🔄 Pretvori RFQ → Narudžba (${selected?.internal_id})`} onClose={() => setModal(null)}>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Partner: <span style={{ color: C.gray }}>{selected?.partner_name}</span></div>
          <div style={{ display: 'grid', gap: 14 }}>
            <Inp label="Kupčev broj narudžbe" {...inp('customer_order_id')} />
            <Inp label="Rok isporuke" type="date" {...inp('delivery_date')} />
            <Textarea label="Napomena" {...inp('notes')} />
          </div>
          <Divider />
          <Btn onClick={handleSubmit} color={C.green}><ArrowRight size={14} /> Kreiraj narudžbu</Btn>
        </Modal>
      )}

      {/* ADD / EDIT PARTNER */}
      {(modal === 'add-partner' || modal === 'edit-partner') && (
        <Modal title={modal === 'edit-partner' ? `✏️ Uredi partnera` : '🏢 Novi partner'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Inp label="Naziv *" {...inp('name')} style={{ gridColumn: '1 / -1' }} />
            <Sel label="Tip" {...inp('type')}><option value="customer">Kupac</option><option value="supplier">Dobavljač</option><option value="both">Oboje</option></Sel>
            <Inp label="OIB" {...inp('oib')} />
            <Inp label="Zemlja" {...inp('country')} placeholder="Hrvatska" />
            <Inp label="Adresa" {...inp('address')} style={{ gridColumn: '1 / -1' }} />
            <Inp label="Kontakt osoba" {...inp('contact_name')} />
            <Inp label="Email" type="email" {...inp('contact_email')} />
            <Inp label="Telefon" {...inp('contact_phone')} />
            <Inp label="Rok plaćanja (dani)" type="number" {...inp('payment_terms')} placeholder="30" />
          </div>
          <Divider />
          <Btn onClick={handleSubmit}><Check size={14} /> {modal === 'edit-partner' ? 'Spremi promjene' : 'Dodaj partnera'}</Btn>
        </Modal>
      )}

      {/* ADD INVOICE */}
      {modal === 'add-invoice' && (
        <Modal title="🧾 Nova faktura" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Sel label="Narudžba" {...inp('order_id')}><option value="">— Bez narudžbe —</option>{data.orders.map(o => <option key={o.id} value={o.id}>{o.internal_id} – {o.partner_name}</option>)}</Sel>
            {!form.order_id && <Sel label="Partner" {...inp('partner_id')}><option value="">— Odaberi —</option>{data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>}
            <Inp label="Iznos bez PDV (EUR) *" type="number" {...inp('amount')} />
            <Inp label="PDV %" type="number" {...inp('vat_rate')} placeholder="25" />
            {form.amount && (
              <div style={{ background: C.surface3, borderRadius: 8, padding: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>Bez PDV:</span><span style={{ color: C.gray }}>{fmt(form.amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>PDV ({form.vat_rate || 25}%):</span><span style={{ color: C.gray }}>{fmt(parseFloat(form.amount) * (parseFloat(form.vat_rate || 25) / 100))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontWeight: 700 }}>UKUPNO:</span><span style={{ color: C.accent, fontWeight: 700, fontSize: 15 }}>{fmt(parseFloat(form.amount) * (1 + parseFloat(form.vat_rate || 25) / 100))}</span>
                </div>
              </div>
            )}
            <Inp label="Rok plaćanja" type="date" {...inp('due_date')} />
            <Textarea label="Napomena" {...inp('notes')} />
          </div>
          <Divider />
          <Btn onClick={handleSubmit}><Check size={14} /> Kreiraj fakturu</Btn>
        </Modal>
      )}

      {/* VIEW RFQ DETAIL */}
      {modal === 'view-rfqs' && selected && (
        <Modal title={`📋 ${selected.internal_id}`} onClose={() => setModal(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div style={{ color: C.muted, fontSize: 11 }}>PARTNER</div><div style={{ color: C.gray, fontWeight: 600 }}>{selected.partner_name || '—'}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>KUPČEV REF</div><div style={{ color: C.gray }}>{selected.customer_rfq_id || '—'}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>ROK</div><div style={{ color: isOverdue(selected.deadline) ? C.red : C.gray }}>{fmtDate(selected.deadline)}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>STATUS</div><Pill s={selected.status} /></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>KREIRAN</div><div style={{ color: C.gray, fontSize: 12 }}>{fmtDate(selected.created_at)}</div></div>
          </div>
          {selected.notes && <div style={{ color: C.muted, fontSize: 12, marginBottom: 12, background: C.surface3, borderRadius: 8, padding: 10 }}>📝 {selected.notes}</div>}
          <Divider />
          <div style={{ color: C.teal, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>POZICIJE ({selected.positions?.length || 0})</div>
          {selected.positions?.length > 0
            ? <PositionsTable positions={selected.positions} editable={false} onDelete={() => {}} />
            : <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 20 }}>Nema pozicija</div>
          }
        </Modal>
      )}

      {/* VIEW ORDER DETAIL */}
      {modal === 'view-orders' && selected && (
        <Modal title={`📦 ${selected.internal_id}`} onClose={() => setModal(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div style={{ color: C.muted, fontSize: 11 }}>PARTNER</div><div style={{ color: C.gray, fontWeight: 600 }}>{selected.partner_name || '—'}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>KUPAC REF</div><div style={{ color: C.gray }}>{selected.customer_order_id || '—'}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>ROK ISPORUKE</div><div style={{ color: isOverdue(selected.delivery_date) ? C.red : C.gray }}>{fmtDate(selected.delivery_date)}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>STATUS</div><Pill s={selected.status} /></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>VRIJEDNOST</div><div style={{ color: C.accent, fontWeight: 700 }}>{fmt(selected.total_value)}</div></div>
            <div><div style={{ color: C.muted, fontSize: 11 }}>EMAIL</div><div style={{ color: C.gray, fontSize: 12 }}>{selected.contact_email || '—'}</div></div>
          </div>
          {selected.notes && <div style={{ color: C.muted, fontSize: 12, marginBottom: 12, background: C.surface3, borderRadius: 8, padding: 10 }}>📝 {selected.notes}</div>}
          <Divider />
          <div style={{ color: C.teal, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>POZICIJE ({selected.positions?.length || 0})</div>
          {selected.positions?.length > 0
            ? <PositionsTable positions={selected.positions} editable={false} onDelete={() => {}} />
            : <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 20 }}>Nema pozicija</div>
          }
          {selected.invoices?.length > 0 && (
            <>
              <Divider />
              <div style={{ color: C.accent, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>FAKTURE ({selected.invoices.length})</div>
              {selected.invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}33`, fontSize: 12 }}>
                  <span style={{ color: C.accent }}>{inv.invoice_number}</span>
                  <span style={{ color: C.gray }}>{fmt(inv.total_amount)}</span>
                  <Pill s={inv.status} />
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
