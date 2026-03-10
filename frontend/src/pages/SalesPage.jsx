import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { Plus, RefreshCw, Building2, FileSearch, ShoppingCart, Receipt, ChevronDown, ChevronUp, X, Check, Clock } from 'lucide-react'

const STATUS_COLOR = {
  novo: C.blue, u_obradi: C.orange, ponuda_poslana: C.teal, narudžba: C.green, odbijen: C.red, otkazan: C.muted,
  nova: C.blue, potvrđena: C.teal, u_izradi: C.orange, sprema_za_otpremu: C.accent, isporučena: C.green, fakturirana: C.green, otkazana: C.red,
  nacrt: C.muted, poslana: C.blue, prihvaćena: C.green, odbijena: C.red,
}

const Pill = ({ s }) => (
  <span style={{ background: `${STATUS_COLOR[s] || C.muted}22`, color: STATUS_COLOR[s] || C.muted, border: `1px solid ${STATUS_COLOR[s] || C.muted}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{s?.toUpperCase()}</span>
)

const TAB_STYLE = (active) => ({
  padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
  background: active ? C.accent : 'transparent', color: active ? C.bg : C.muted, border: `1px solid ${active ? C.accent : C.border}`, transition: 'all .2s'
})

const Inp = ({ label, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>{label}</label>
    <input {...p} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', ...p.style }} />
  </div>
)

const Sel = ({ label, children, ...p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>{label}</label>
    <select {...p} style={{ background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none' }}>{children}</select>
  </div>
)

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ color: C.accent, margin: 0, fontSize: 16 }}>{title}</h3>
        <X size={18} style={{ cursor: 'pointer', color: C.muted }} onClick={onClose} />
      </div>
      {children}
    </div>
  </div>
)

export default function SalesPage() {
  const [tab, setTab] = useState('rfqs')
  const [data, setData] = useState({ rfqs: [], orders: [], partners: [], invoices: [], stats: {} })
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [toast, showToast] = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [rfqs, orders, partners, invoices, rfqStats, orderStats] = await Promise.all([
        api.get('/sales/rfqs'),
        api.get('/sales/orders'),
        api.get('/sales/partners'),
        api.get('/sales/invoices'),
        api.get('/sales/rfqs/stats').catch(() => ({ data: {} })),
        api.get('/sales/orders/stats').catch(() => ({ data: {} })),
      ])
      setData({ rfqs: rfqs.data, orders: orders.data, partners: partners.data, invoices: invoices.data, stats: { rfq: rfqStats.data, order: orderStats.data } })
    } catch { showToast('Greška učitavanja', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async () => {
    try {
      if (modal === 'add-rfq') await api.post('/sales/rfqs', { ...form, positions: form.positions || [] })
      if (modal === 'add-order') await api.post('/sales/orders', { ...form })
      if (modal === 'add-partner') await api.post('/sales/partners', form)
      if (modal === 'add-invoice') await api.post('/sales/invoices', form)
      showToast('Uspješno spremljeno!')
      setModal(null); setForm({})
      load()
    } catch (e) { showToast(e.response?.data?.error || 'Greška', 'error') }
  }

  const Btn = ({ onClick, children, color = C.accent, sm }) => (
    <button onClick={onClick} style={{ background: color, color: sm ? C.gray : C.bg, border: 'none', borderRadius: sm ? 6 : 8, padding: sm ? '4px 10px' : '8px 16px', cursor: 'pointer', fontSize: sm ? 11 : 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>{children}</button>
  )

  const inp = (k) => ({ value: form[k] || '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) })

  return (
    <div style={{ padding: 24, fontFamily: "'Chakra Petch',sans-serif", color: C.gray }}>
      {toast.visible && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? C.red : C.green, color: '#fff', padding: '12px 20px', borderRadius: 10, zIndex: 9999, fontWeight: 700 }}>{toast.message}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: C.accent, margin: 0, fontSize: 22 }}>💰 SALES MODULE</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={load} color={C.surface3} sm><RefreshCw size={14} /></Btn>
          <Btn onClick={() => { setForm({}); setModal(`add-${tab === 'rfqs' ? 'rfq' : tab === 'orders' ? 'order' : tab === 'partners' ? 'partner' : 'invoice'}`) }}><Plus size={14} /> Novi</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Upiti aktivni" value={data.stats.rfq?.u_obradi || 0} color="blue" />
        <StatCard label="Ponude poslane" value={data.stats.rfq?.ponuda || 0} color="teal" />
        <StatCard label="Narudžbe aktivne" value={data.stats.order?.u_izradi || 0} color="yellow" />
        <StatCard label="Kasnimo" value={data.stats.order?.kasni || 0} color="red" />
        <StatCard label="Partneri" value={data.partners.length} color="green" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['rfqs', 'Upiti (RFQ)', FileSearch], ['orders', 'Narudžbe', ShoppingCart], ['partners', 'Partneri', Building2], ['invoices', 'Fakture', Receipt]].map(([k, l, Ic]) => (
          <button key={k} style={TAB_STYLE(tab === k)} onClick={() => setTab(k)}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ic size={14} />{l}</span></button>
        ))}
      </div>

      {/* RFQs */}
      {tab === 'rfqs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.rfqs.map(r => (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
              <div><div style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{r.internal_id}</div><div style={{ color: C.muted, fontSize: 12 }}>{r.partner_name || '—'}</div></div>
              <div style={{ fontSize: 12 }}><span style={{ color: C.muted }}>Rok: </span><span style={{ color: r.deadline && new Date(r.deadline) < new Date() ? C.red : C.gray }}>{r.deadline ? new Date(r.deadline).toLocaleDateString('hr') : '—'}</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Pill s={r.status} /><span style={{ color: C.muted, fontSize: 11 }}>{r.position_count} poz.</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn sm color={C.teal + '33'} onClick={() => api.put(`/sales/rfqs/${r.id}`, { status: 'u_obradi' }).then(load).catch(() => {})}>▶</Btn>
                <Btn sm color={C.green + '33'} onClick={() => api.put(`/sales/rfqs/${r.id}`, { status: 'ponuda_poslana' }).then(load).catch(() => {})}>✓</Btn>
              </div>
            </div>
          ))}
          {data.rfqs.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema upita</div>}
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.orders.map(o => (
            <div key={o.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
              <div><div style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{o.internal_id}</div><div style={{ color: C.muted, fontSize: 12 }}>{o.partner_name || '—'}</div></div>
              <div style={{ fontSize: 12 }}><div style={{ color: C.muted }}>Kupac ref:</div><div style={{ color: C.gray }}>{o.customer_order_id || '—'}</div></div>
              <div style={{ fontSize: 12 }}><span style={{ color: C.muted }}>Rok: </span><span style={{ color: o.delivery_date && new Date(o.delivery_date) < new Date() ? C.red : C.gray }}>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('hr') : '—'}</span></div>
              <Pill s={o.status} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['u_izradi', 'sprema_za_otpremu', 'isporučena'].map(s => (
                  <Btn key={s} sm color={STATUS_COLOR[s] + '33'} onClick={() => api.put(`/sales/orders/${o.id}`, { status: s }).then(load).catch(() => {})}>{s.slice(0, 3)}</Btn>
                ))}
              </div>
            </div>
          ))}
          {data.orders.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema narudžbi</div>}
        </div>
      )}

      {/* Partners */}
      {tab === 'partners' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {data.partners.map(p => (
            <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ color: C.accent, fontWeight: 700 }}>{p.name}</div>
                <span style={{ background: `${C.teal}22`, color: C.teal, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{p.type?.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{p.country} · {p.payment_terms}d plaćanje</div>
              {p.oib && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>OIB: {p.oib}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{p.order_count} narudžbi</div>
            </div>
          ))}
          {data.partners.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40, gridColumn: '1/-1' }}>Nema partnera</div>}
        </div>
      )}

      {/* Invoices */}
      {tab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.invoices.map(inv => (
            <div key={inv.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
              <div><div style={{ color: C.accent, fontWeight: 700 }}>{inv.invoice_number}</div><div style={{ color: C.muted, fontSize: 12 }}>{inv.partner_name || '—'}</div></div>
              <div style={{ fontSize: 13, color: C.gray, fontWeight: 700 }}>{parseFloat(inv.total_amount || 0).toLocaleString('hr')} {inv.currency || 'EUR'}</div>
              <div style={{ fontSize: 12 }}><span style={{ color: C.muted }}>Rok: </span><span style={{ color: inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'plaćena' ? C.red : C.gray }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('hr') : '—'}</span></div>
              <Pill s={inv.status} />
              {inv.status !== 'plaćena' && <Btn sm color={C.green + '33'} onClick={() => api.put(`/sales/invoices/${inv.id}/paid`).then(load).catch(() => {})}><Check size={12} /></Btn>}
            </div>
          ))}
          {data.invoices.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Nema faktura</div>}
        </div>
      )}

      {/* MODALS */}
      {modal === 'add-rfq' && (
        <Modal title="Novi upit (RFQ)" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Sel label="PARTNER" {...inp('partner_id')}><option value="">— Odaberi —</option>{data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
            <Inp label="KUPČEV BROJ UPITA" {...inp('customer_rfq_id')} />
            <Inp label="ROK ODGOVORA" type="date" {...inp('deadline')} />
            <Inp label="NAPOMENA" {...inp('notes')} />
            <Btn onClick={handleSubmit}><Check size={14} /> Spremi</Btn>
          </div>
        </Modal>
      )}
      {modal === 'add-order' && (
        <Modal title="Nova narudžba" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Sel label="PARTNER" {...inp('partner_id')}><option value="">— Odaberi —</option>{data.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
            <Inp label="KUPČEV BROJ NARUDŽBE" {...inp('customer_order_id')} />
            <Inp label="ROK ISPORUKE" type="date" {...inp('delivery_date')} />
            <Inp label="NAPOMENA" {...inp('notes')} />
            <Btn onClick={handleSubmit}><Check size={14} /> Spremi</Btn>
          </div>
        </Modal>
      )}
      {modal === 'add-partner' && (
        <Modal title="Novi partner" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Inp label="NAZIV *" {...inp('name')} />
            <Sel label="TIP" {...inp('type')}><option value="customer">Kupac</option><option value="supplier">Dobavljač</option><option value="both">Oboje</option></Sel>
            <Inp label="OIB" {...inp('oib')} />
            <Inp label="ZEMLJA" {...inp('country')} placeholder="Hrvatska" />
            <Inp label="ADRESA" {...inp('address')} />
            <Inp label="ROK PLAĆANJA (dani)" type="number" {...inp('payment_terms')} placeholder="30" />
            <Btn onClick={handleSubmit}><Check size={14} /> Spremi</Btn>
          </div>
        </Modal>
      )}
      {modal === 'add-invoice' && (
        <Modal title="Nova faktura" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Sel label="NARUDŽBA" {...inp('order_id')}><option value="">— Odaberi —</option>{data.orders.map(o => <option key={o.id} value={o.id}>{o.internal_id} – {o.partner_name}</option>)}</Sel>
            <Inp label="IZNOS (bez PDV) *" type="number" {...inp('amount')} />
            <Inp label="PDV %" type="number" {...inp('vat_rate')} placeholder="25" />
            <Inp label="ROK PLAĆANJA" type="date" {...inp('due_date')} />
            <Btn onClick={handleSubmit}><Check size={14} /> Spremi</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
