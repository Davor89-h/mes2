import { useState, useEffect, useCallback } from 'react'
import { C, useToast } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  FileText, Plus, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, X, Save, User, Calendar, Edit2, Trash2,
  Search, Filter, RefreshCw, MessageSquare
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  tool_request:        { label: '🔧 Zahtjev za alat',       color: C.blue   },
  maintenance_request: { label: '⚙️ Zahtjev za servis',     color: C.orange },
  purchase_request:    { label: '🛒 Nabavni zahtjev',       color: C.teal   },
  production_issue:    { label: '⚠️ Produkcijski problem',  color: C.red    },
  custom:              { label: '📋 Ostalo',                 color: C.muted  },
}

const STATUS_CONFIG = {
  draft:        { color: C.muted,  label: 'Skica',     bg: C.muted+'22'  },
  submitted:    { color: C.accent, label: 'Podnesen',  bg: C.accent+'22' },
  under_review: { color: C.blue,   label: 'U obradi',  bg: C.blue+'22'   },
  approved:     { color: C.green,  label: 'Odobren',   bg: C.green+'22'  },
  rejected:     { color: C.red,    label: 'Odbijen',   bg: C.red+'22'    },
  completed:    { color: C.teal,   label: 'Završen',   bg: C.teal+'22'   },
}

const PRIORITY_CONFIG = {
  low:    { color: C.muted,  label: 'Nizak'   },
  normal: { color: C.blue,   label: 'Normalan'},
  high:   { color: C.orange, label: 'Visok'   },
  urgent: { color: C.red,    label: 'Hitno'   },
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card:  { background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,.2)' },
  input: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  btn:   (col=C.accent) => ({ background: col, border: 'none', borderRadius: 8, padding: '8px 16px', color: col===C.accent?'#1a2a28':C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }),
  ghost: { background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
}
const PriorityBadge = ({ priority }) => {
  const p = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal
  return <span style={{ color: p.color, fontSize: 11, fontWeight: 700 }}>{p.label}</span>
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function Tile({ label, value, color=C.accent, warn }) {
  return (
    <div style={{ background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${warn?color:C.border}`, borderRadius: 14, padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${color},${color}88)` }}/>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1, fontFamily: "'Chakra Petch',sans-serif" }}>{value ?? 0}</div>
    </div>
  )
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function FormModal({ form: editForm, onClose, onSaved }) {
  const isNew = !editForm?.id
  const [form, setForm] = useState({
    type:        editForm?.form_type   || 'tool_request',
    title:       editForm?.title       || '',
    description: editForm?.description || '',
    priority:    editForm?.priority    || 'normal',
  })
  const [saving, setSaving] = useState(false)
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (isNew) await api.post('/forms', form)
      else await api.put(`/forms/${editForm.id}`, form)
      onSaved()
      onClose()
    } catch (e) { alert(e.response?.data?.error || e.message) }
    setSaving(false)
  }

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,18,.88)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}44` }}>
          <span style={{ fontWeight: 700, color: C.accent, letterSpacing: 1.5, fontFamily: "'Chakra Petch',sans-serif", fontSize: 14 }}>
            {isNew ? 'NOVI ZAHTJEV' : 'UREDI ZAHTJEV'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18}/></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.label}>Tip zahtjeva</label>
            <select value={form.type} onChange={e => F('type', e.target.value)} style={S.input}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Naslov *</label>
            <input value={form.title} onChange={e => F('title', e.target.value)} placeholder="Kratak opis zahtjeva..." style={S.input}/>
          </div>
          <div>
            <label style={S.label}>Opis / Detalji</label>
            <textarea value={form.description} onChange={e => F('description', e.target.value)} rows={4}
              placeholder="Detaljan opis zahtjeva, razlog, urgentnost..."
              style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}/>
          </div>
          <div>
            <label style={S.label}>Prioritet</label>
            <select value={form.priority} onChange={e => F('priority', e.target.value)} style={S.input}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}44` }}>
          <button onClick={save} disabled={saving || !form.title.trim()} style={{ ...S.btn(), flex: 1, justifyContent: 'center', opacity: saving ? .6 : 1 }}>
            <Save size={14}/>{saving ? 'Slanje...' : 'Pošalji zahtjev'}
          </button>
          <button onClick={onClose} style={S.ghost}><X size={13}/> Odustani</button>
        </div>
      </div>
    </div>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ form, action, onSubmit, onClose }) {
  const [notes, setNotes] = useState('')
  const isApprove = action === 'approve'
  const color = isApprove ? C.green : C.red

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,18,.88)', backdropFilter: 'blur(6px)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${color}44`, borderRadius: 18, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, color, letterSpacing: 1.2, fontFamily: "'Chakra Petch',sans-serif" }}>
            {isApprove ? '✅ ODOBRAVANJE' : '❌ ODBIJANJE'} ZAHTJEVA
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={16}/></button>
        </div>
        <div style={{ background: C.surface3, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.gray }}>
          {form.title}
        </div>
        <label style={S.label}>Napomena recenzenta (opcionalno)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Razlog odobrenja / odbijanja..."
          style={{ ...S.input, resize: 'none', fontFamily: 'inherit', marginBottom: 16 }}/>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSubmit(notes)} style={{ ...S.btn(color), flex: 1, justifyContent: 'center', color: isApprove ? '#1a2a28' : C.gray }}>
            {isApprove ? <CheckCircle size={14}/> : <XCircle size={14}/>}
            {isApprove ? 'Odobri zahtjev' : 'Odbij zahtjev'}
          </button>
          <button onClick={onClose} style={S.ghost}><X size={13}/></button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Card ────────────────────────────────────────────────────────────────
function FormCard({ form, isAdmin, isVoditelj, onReview, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft
  const pc = PRIORITY_CONFIG[form.priority] || PRIORITY_CONFIG.normal
  const tc = TYPE_LABELS[form.form_type] || TYPE_LABELS.custom
  const canReview = isAdmin || isVoditelj

  return (
    <div style={{ background: `linear-gradient(145deg,${C.surface},${C.surface2})`, border: `1px solid ${expanded ? C.teal+'55' : C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border .2s', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        {/* Type icon strip */}
        <div style={{ width: 4, height: 40, borderRadius: 2, background: tc.color, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E8F2F0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {form.title}
          </div>
          <div style={{ fontSize: 10, color: C.muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: tc.color }}>{tc.label}</span>
            <span>·</span>
            <span>{form.submitter_name || '—'}</span>
            <span>·</span>
            <span>{new Date(form.created_at).toLocaleDateString('hr-HR')}</span>
          </div>
        </div>
        <PriorityBadge priority={form.priority}/>
        <StatusBadge status={form.status}/>
        {expanded ? <ChevronUp size={14} color={C.muted}/> : <ChevronDown size={14} color={C.muted}/>}
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.border}33` }}>
          {/* Description */}
          <div style={{ paddingTop: 14, fontSize: 13, color: C.muted2, lineHeight: 1.7, marginBottom: 14 }}>
            {form.description || <span style={{ color: C.muted, fontStyle: 'italic' }}>Nema opisa</span>}
          </div>

          {/* Review notes */}
          {form.review_notes && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: `${C.teal}10`, borderRadius: 8, fontSize: 12, color: C.teal, border: `1px solid ${C.teal}22` }}>
              <strong>Napomena recenzenta:</strong> {form.review_notes}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Admin review actions */}
            {canReview && form.status === 'submitted' && (
              <>
                <button onClick={() => onReview(form, 'approve')} style={{ ...S.btn(C.green), padding: '6px 12px', fontSize: 12, color: '#1a2a28' }}>
                  <CheckCircle size={13}/> Odobri
                </button>
                <button onClick={() => onReview(form, 'reject')} style={{ ...S.btn(C.red), padding: '6px 12px', fontSize: 12 }}>
                  <XCircle size={13}/> Odbij
                </button>
                <button onClick={() => onStatusChange(form.id, 'under_review')} style={{ ...S.ghost, padding: '6px 12px', fontSize: 12 }}>
                  <Clock size={12}/> U obradu
                </button>
              </>
            )}
            {canReview && form.status === 'under_review' && (
              <>
                <button onClick={() => onReview(form, 'approve')} style={{ ...S.btn(C.green), padding: '6px 12px', fontSize: 12, color: '#1a2a28' }}>
                  <CheckCircle size={13}/> Odobri
                </button>
                <button onClick={() => onReview(form, 'reject')} style={{ ...S.btn(C.red), padding: '6px 12px', fontSize: 12 }}>
                  <XCircle size={13}/> Odbij
                </button>
              </>
            )}
            {canReview && form.status === 'approved' && (
              <button onClick={() => onStatusChange(form.id, 'completed')} style={{ ...S.btn(C.teal), padding: '6px 12px', fontSize: 12, color: '#1a2a28' }}>
                <CheckCircle size={13}/> Označi završenim
              </button>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }}/>

            {/* Edit / Delete */}
            {(canReview || form.is_mine) && (
              <>
                <button onClick={() => onEdit(form)} style={{ ...S.ghost, padding: '6px 10px', fontSize: 12 }}>
                  <Edit2 size={12}/> Uredi
                </button>
                <button onClick={() => onDelete(form.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '6px', display: 'flex', alignItems: 'center' }}
                  onMouseOver={e => e.currentTarget.style.color=C.red}
                  onMouseOut={e => e.currentTarget.style.color=C.muted}>
                  <Trash2 size={14}/>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FormsPage() {
  const { user, isAdmin, isVoditelj } = useAuth()
  const [forms,        setForms]        = useState([])
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(null)   // null | 'new' | form object
  const [reviewModal,  setReviewModal]  = useState(null)   // { form, action }
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [search,       setSearch]       = useState('')
  const [toast,        showToast]       = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterType)   params.type   = filterType
      const [fr, sr] = await Promise.all([
        api.get('/forms', { params }),
        api.get('/forms/stats'),
      ])
      setForms(fr.data.forms || [])
      setStats(sr.data)
    } catch (e) {
      showToast('Greška učitavanja zahtjeva', 'error')
    }
    setLoading(false)
  }, [filterStatus, filterType])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/forms/${id}/status`, { status })
      load()
    } catch (e) { showToast('Greška promjene statusa', 'error') }
  }

  const handleReview = async (notes) => {
    const { form, action } = reviewModal
    const status = action === 'approve' ? 'approved' : 'rejected'
    await api.patch(`/forms/${form.id}/status`, { status, review_notes: notes })
    setReviewModal(null)
    load()
    showToast(action === 'approve' ? 'Zahtjev odobren' : 'Zahtjev odbijen')
  }

  const handleDelete = async (id) => {
    if (!confirm('Obrisati zahtjev?')) return
    await api.delete(`/forms/${id}`)
    load()
  }

  const filtered = forms.filter(f => {
    if (!search) return true
    return f.title?.toLowerCase().includes(search.toLowerCase()) ||
           f.submitter_name?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div style={{ fontFamily: "'Chakra Petch',sans-serif", color: C.gray }}>
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type==='error'?C.red:C.green, color: '#fff', padding: '12px 20px', borderRadius: 10, zIndex: 9999, fontWeight: 700 }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>DEER MES · WORKFLOW</div>
          <h1 style={{ margin: 0, fontSize: 22, color: C.accent, letterSpacing: 2 }}>📋 ZAHTJEVI I FORME</h1>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Kreiranje · Pregled · Odobrenje · Praćenje</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={S.ghost}><RefreshCw size={14}/> Osvježi</button>
          <button onClick={() => setModal('new')} style={S.btn()}>
            <Plus size={15}/> Novi zahtjev
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
          <Tile label="Ukupno"    value={stats.total}     color={C.teal}/>
          <Tile label="Na čekanju" value={stats.pending}  color={C.accent}  warn={stats.pending>0}/>
          <Tile label="U obradi"  value={stats.reviewing} color={C.blue}/>
          <Tile label="Odobreno"  value={stats.approved}  color={C.green}/>
          <Tile label="Hitno"     value={stats.urgent}    color={C.red}     warn={stats.urgent>0}/>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={12} color={C.muted} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži..."
            style={{ ...S.input, width: 180, paddingLeft: 28, padding: '7px 10px 7px 28px', fontSize: 12 }}/>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="">Svi statusi</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...S.input, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="">Svi tipovi</option>
          {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11, color: C.muted }}>{filtered.length} zahtjeva</span>
      </div>

      {/* Forms list */}
      {loading && <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>Učitavanje...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          <FileText size={36} color={C.muted2} style={{ display: 'block', margin: '0 auto 12px' }}/>
          Nema zahtjeva
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(f => (
          <FormCard
            key={f.id}
            form={{ ...f, is_mine: f.requested_by === user?.id }}
            isAdmin={isAdmin}
            isVoditelj={isVoditelj}
            onReview={(form, action) => setReviewModal({ form, action })}
            onEdit={(form) => setModal(form)}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* Modals */}
      {modal && (
        <FormModal
          form={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); showToast('Zahtjev spremljen') }}
        />
      )}
      {reviewModal && (
        <ReviewModal
          form={reviewModal.form}
          action={reviewModal.action}
          onSubmit={handleReview}
          onClose={() => setReviewModal(null)}
        />
      )}
    </div>
  )
}
