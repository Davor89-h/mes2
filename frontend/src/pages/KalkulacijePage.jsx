import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { C, useToast } from '../components/UI'
import {
  Calculator, Plus, Trash2, Edit2, Copy, FileText, ChevronRight,
  ChevronLeft, Save, Download, Search, Eye, CheckCircle, Clock,
  XCircle, ArrowLeft, Printer, Package, Settings, DollarSign, X
} from 'lucide-react'

// ─────────── MASTER DATA (from Excel Material sheet) ───────────
const GUSTOCA = {
  'Aluminij': 2700, 'Čelik': 7850, 'Nehrđajući čelik': 8000,
  'Bakar': 8900, 'Mesing': 8500, 'Bronca': 8300, 'Titan': 4600,
  'PEEK': 1310, 'POM': 1390, 'Superlegure': 8890, 'Polimeri': 1360
}
const CIJENA_MAT = {
  'Aluminij': 5, 'Čelik': 1, 'Poboljšani čelik': 2, 'Nehrđajući čelik': 5,
  'Bakar': 8, 'Mesing': 8, 'Bronca': 8, 'Titan': 56, 'PEEK': 130,
  'POM': 10, 'Super legure': 40, '1.4404': 7, 'PA6 (Ertalon)': 1.6,
  'PPSU medicine': 40, 'Teflon PTFE': 19, 'PP': 7.5
}
const DUZINA_MAT = { 'Aluminij': null, 'Čelik': 3000, 'Nehrđajući čelik': 3000, default: 6000 }
const FAKTOR_MAT = {
  'Aluminij, mesing': 0.5, 'Konstrukcijski čelici (20%)': 0.7, 'Titan (30%)': 0.8,
  'Nehrđajući čelici (40 %)': 0.9, 'Superlegure (60%)': 1.1, 'Polimeri': 0.6
}
const FAKTOR_HITNOST = {
  '1 tjedan (40%)': 1.4, '2 tjedna (30%)': 1.3, '3 tjedna (20%)': 1.2,
  '4 tjedna (10%)': 1.1, '6-8 tjedana (5%)': 1.05, '12 tjedana': 1, '1 godina': 1
}
const FAKTOR_TOCNOST = {
  '+/- 0,2': 0.5, '+/- 0,1 (5%)': 0.55, '+/- 0,05 (10%)': 0.6,
  '+/- 0,02 (20%)': 0.7, '+/- 0,01 (40%)': 0.9, '+/-< 0,01 (80%)': 1.3
}
const FAKTOR_MJERENJE = {
  'Ručno': 0.3, 'Mikroskop/projektor': 0.5, 'Zeiss': 0.75
}
const FAKTOR_OBRADA = {
  '3 osi': 0.5, '4 osi (20%)': 0.7, '5 osi (50%)': 1.0, '5 osi simultano (70%)': 1.2,
  'Tokarenje': 0.5, 'Tokarenje + glodanje C,X os (20%)': 0.7,
  'Tokarenje + glodanje C,X,Y os (30%)': 0.8, 'Tokarenje 2 spindel + glodanje C,X,Y (40%)': 0.9,
  'Tokarenje 2 kanala automati (50%)': 1.0, 'Tokarenje 2 kanala twin (60%)': 1.1
}
const FAKTOR_CIKLUS = {
  '<1 min (50%)': 1, '1-5 min (40%)': 0.9, '5-10 min (30%)': 0.8,
  '10-20 min (20%)': 0.7, '20-30 min (10%)': 0.6, '30-60 min (5%)': 0.55, '>60 min': 0.5
}
const VRSTA_SIROVCA = ['Okrugle šipke', 'Šesterokutne šipke', 'Kružne cijevi', 'Kvadratne cijevi', 'Limovi']
const POVRSINSKA_OBRADA = [
  'Eloxieren', 'Vernickeln', 'Verzinken', 'Elektropolieren', 'Harten',
  'Nitrieren, nitrokarburieren,plazmanitrieren',
  'SurTec < f50', 'SurTec f50 - f100x50', 'SurTec > f-100x200',
  'SurTec <100x100x100', 'SurTec >100x100x100'
]

const DEFAULT_OPERACIJE = [
  { korak: 10, radno_mjesto: 40800, opis: 'Priprema dokumenata', faktor: 0.3, prep_vrijeme: 20, jed_vrijeme: 0 },
  { korak: 20, radno_mjesto: 40900, opis: 'Priprema materijala prema listi materijala', faktor: 0.3, prep_vrijeme: 20, jed_vrijeme: 0 },
  { korak: 30, radno_mjesto: 41100, opis: 'Priprema alata i naprava', faktor: 0.3, prep_vrijeme: 60, jed_vrijeme: 0 },
  { korak: 40, radno_mjesto: 40200, opis: 'Priprema mjernih i ispitnih sredstava', faktor: 0.3, prep_vrijeme: 30, jed_vrijeme: 0 },
  { korak: 50, radno_mjesto: 40100, opis: 'Izrada CNC programa', faktor: 0.3, prep_vrijeme: 840, jed_vrijeme: 0 },
  { korak: 60, radno_mjesto: 40200, opis: 'Priprema i uhodavanje stroja', faktor: 0.3, prep_vrijeme: 60, jed_vrijeme: 0 },
  { korak: 70, radno_mjesto: 40100, opis: 'Strojna obrada', faktor: 0, prep_vrijeme: 0, jed_vrijeme: 0, parent: true },
  { korak: null, radno_mjesto: null, opis: 'Tokarenje', faktor: null, prep_vrijeme: 0, jed_vrijeme: 0, sub: true },
  { korak: null, radno_mjesto: null, opis: 'Glodanje', faktor: null, prep_vrijeme: 0, jed_vrijeme: 0, sub: true },
  { korak: null, radno_mjesto: null, opis: 'Automati', faktor: null, prep_vrijeme: 0, jed_vrijeme: 0, sub: true },
  { korak: 80, radno_mjesto: 40200, opis: 'QS provjera prvog komada', faktor: null, prep_vrijeme: 300, jed_vrijeme: 0 },
  { korak: null, radno_mjesto: null, opis: 'Vanjska usluga', faktor: 1, prep_vrijeme: 0, jed_vrijeme: 0 },
  { korak: null, radno_mjesto: null, opis: 'Završna obrada', faktor: 0.3, prep_vrijeme: 0, jed_vrijeme: 0 },
  { korak: 130, radno_mjesto: 40200, opis: 'QS - Završna kontrola', faktor: null, prep_vrijeme: 30, jed_vrijeme: 0.5 },
  { korak: 140, radno_mjesto: 40900, opis: 'Pakiranje', faktor: 0.3, prep_vrijeme: 30, jed_vrijeme: 0.1 },
  { korak: 150, radno_mjesto: 40900, opis: 'Stavljanje komada na lager', faktor: 0.3, prep_vrijeme: 30, jed_vrijeme: 0 },
]

const DEFAULT_DATA = {
  // Header
  broj_upita: '',
  // Operacije
  operacije: DEFAULT_OPERACIJE.map((o, i) => ({ ...o, id: i })),
  // Dodaci
  dodatak_materijal: 'Nehrđajući čelici (40 %)',
  dodatak_obrada: '5 osi (50%)',
  dodatak_tocnost: '+/- 0,02 (20%)',
  dodatak_ciklus: '20-30 min (10%)',
  dodatak_mjerenje: 'Zeiss',
  dodatak_hitnost: '6-8 tjedana (5%)',
  minimalni_faktor_rucni: null,
  // Materijal za proračun
  materijal_proracun: 'Nehrđajući čelik',
  standardni_materijal: 'Nehrđajući čelik',
  specijalni_materijal: '',
  specijalni_cijena: '',
  // Sirovo
  vrsta_sirovca: 'Limovi',
  dim_B: 100, dim_H: 50, dim_L: 90,
  dim_dv: 0, dim_t: 0, dim_w: 0,
  // Vanjska usluga
  vs1_naziv: '', vs1_cijena: 0, vs1_transport: 0,
  vs2_naziv: '', vs2_cijena: 0, vs2_transport: 0,
  vs3_naziv: '', vs3_cijena: 0, vs3_transport: 0,
  // Površinska obrada
  povrsinska: '',
  // Ponuda
  kolicina: 20,
  napomena_ponuda: '',
  // Angebot items
  angebot_items: [{ ident_nr: '', material: '', description: '', kolicina: 20, crtez: '' }]
}

// ─────────── CALCULATION ENGINE ───────────
function calculate(data, varijanta) {
  const gustoca = GUSTOCA[data.materijal_proracun] || 8000
  // Mass calculation based on raw material type
  const { dim_B, dim_H, dim_L, dim_dv, dim_t, dim_w } = data
  let masa = 0, volumen = 0
  if (data.vrsta_sirovca === 'Okrugle šipke') {
    volumen = (((dim_dv / 2) ** 2 * 3.14159) * dim_L) / 1e9
  } else if (data.vrsta_sirovca === 'Šesterokutne šipke') {
    volumen = (((Math.sqrt(3) * dim_w ** 2) / 2) * dim_L) / 1e9
  } else if (data.vrsta_sirovca === 'Kružne cijevi') {
    volumen = (((dim_dv - dim_t) * 3.14159 * dim_t) * dim_L) / 1e9
  } else if (data.vrsta_sirovca === 'Kvadratne cijevi') {
    volumen = (((dim_B * dim_H) - ((dim_B - 2 * dim_t) * (dim_H - 2 * dim_t))) * dim_L) / 1e9
  } else { // Limovi
    volumen = (dim_B * dim_H * dim_L) / 1e9
  }
  masa = volumen * gustoca
  volumen = (masa / gustoca) * 1000 // dm3

  // Material cost
  const cijenaKg = data.specijalni_materijal && data.specijalni_cijena
    ? parseFloat(data.specijalni_cijena) || 0
    : (CIJENA_MAT[data.standardni_materijal] || CIJENA_MAT[data.materijal_proracun] || 5)
  const trosakMat = masa * cijenaKg * 1.1

  // Faktori dodaci
  const fMat = FAKTOR_MAT[data.dodatak_materijal] ?? 0.9
  const fObrada = FAKTOR_OBRADA[data.dodatak_obrada] ?? 1.0
  const fTocnost = FAKTOR_TOCNOST[data.dodatak_tocnost] ?? 0.7
  const fCiklus = FAKTOR_CIKLUS[data.dodatak_ciklus] ?? 0.6
  const fMjerenje = FAKTOR_MJERENJE[data.dodatak_mjerenje] ?? 0.75
  const fHitnost = FAKTOR_HITNOST[data.dodatak_hitnost] ?? 1.05
  const minFaktorAuto = (fMat + fObrada + fTocnost + fCiklus + fMjerenje + fHitnost) / 6
  const minFaktor = data.minimalni_faktor_rucni ? parseFloat(data.minimalni_faktor_rucni) : minFaktorAuto

  // Operacije calc
  const operacije = (data.operacije || []).map(op => {
    let faktor = op.faktor
    // Steps that use mjerenje factor
    if (['QS provjera prvog komada', 'QS - Završna kontrola'].includes(op.opis)) faktor = fMjerenje
    // Sub ops use min factor
    if (op.sub) faktor = minFaktor
    const trosak_lot = (op.prep_vrijeme || 0) * (faktor || 0)
    const trosak_kom = ((op.jed_vrijeme || 0) + 0) * (faktor || 0)
    return { ...op, faktor_calc: faktor, trosak_lot, trosak_kom }
  })

  // Vanjska usluga
  const vs_trosak_lot = (data.vs1_cijena || 0) + (data.vs2_cijena || 0) + (data.vs3_cijena || 0)
    + (data.vs1_transport || 0) + (data.vs2_transport || 0) + (data.vs3_transport || 0)
  const vs_trosak_kom = (data.vs3_cijena || 0)

  const summe_lot = operacije.reduce((s, o) => s + (o.trosak_lot || 0), 0) + vs_trosak_lot
  const summe_kom = operacije.reduce((s, o) => s + (o.trosak_kom || 0), 0) + trosakMat + vs_trosak_kom

  const ukupno_lot = summe_lot * fHitnost
  const ukupno_kom = summe_kom * fHitnost

  const kolicina = parseInt(data.kolicina) || 1
  const cijena_kom = kolicina > 0 ? (ukupno_lot / kolicina) + ukupno_kom : 0
  const ukupno = cijena_kom * kolicina

  // Dužina materijala u mm / broj komada
  const duzinaMat = DUZINA_MAT[data.materijal_proracun] || 3000
  const sirovac_dim = data.vrsta_sirovca === 'Limovi' ? dim_L
    : data.vrsta_sirovca === 'Okrugle šipke' || data.vrsta_sirovca === 'Šesterokutne šipke' ? dim_L
    : dim_L
  const brKomada = sirovac_dim > 0 ? duzinaMat / sirovac_dim : 0

  return {
    masa, volumen, trosakMat, cijenaKg, gustoca,
    fMat, fObrada, fTocnost, fCiklus, fMjerenje, fHitnost, minFaktor, minFaktorAuto,
    operacije, vs_trosak_lot, vs_trosak_kom,
    summe_lot, summe_kom, ukupno_lot, ukupno_kom,
    cijena_kom, ukupno, kolicina,
    duzinaMat, brKomada
  }
}

// ─────────── UI HELPERS ───────────
const S = {
  page: { padding: '24px', maxWidth: 1400, margin: '0 auto' },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { fontSize: 11, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  input: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', color: C.gray, fontSize: 13, outline: 'none', width: '100%' },
  select: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', color: C.gray, fontSize: 13, outline: 'none', width: '100%' },
  btn: (color = C.accent) => ({ background: color, border: 'none', borderRadius: 8, padding: '8px 16px', color: color === C.accent ? '#1a2a28' : C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }),
  btnGhost: { background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  th: { padding: '8px 10px', fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'left', borderBottom: `1px solid ${C.border}` },
  td: { padding: '7px 10px', fontSize: 13, color: C.gray, borderBottom: `1px solid ${C.border}22` },
  stepBtn: (active) => ({ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: 'none', background: active ? C.accent : C.surface2, color: active ? '#1a2a28' : C.muted, transition: 'all .2s' }),
}

function Inp({ label, value, onChange, type = 'text', style = {} }) {
  return (
    <div>
      {label && <span style={S.label}>{label}</span>}
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ ...S.input, ...style }} />
    </div>
  )
}
function Sel({ label, value, onChange, options, style = {} }) {
  return (
    <div>
      {label && <span style={S.label}>{label}</span>}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ ...S.select, ...style }}>
        <option value="">— odaberi —</option>
        {options.map(o => <option key={typeof o === 'object' ? o.value : o} value={typeof o === 'object' ? o.value : o}>{typeof o === 'object' ? o.label : o}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    draft: { bg: `${C.muted}22`, color: C.muted, label: 'Nacrt', Icon: Clock },
    final: { bg: `${C.green}22`, color: C.green, label: 'Finalno', Icon: CheckCircle },
    sent: { bg: `${C.blue}22`, color: C.blue, label: 'Poslano', Icon: FileText },
    rejected: { bg: `${C.red}22`, color: C.red, label: 'Odbijeno', Icon: XCircle },
  }
  const c = cfg[status] || cfg.draft
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <c.Icon size={11} />{c.label}
    </span>
  )
}

const fmt = (n, dec = 2) => typeof n === 'number' ? n.toFixed(dec).replace('.', ',') : '—'
const fmtEur = (n) => typeof n === 'number' ? `${n.toFixed(2).replace('.', ',')} €` : '—'

// ─────────── WIZARD STEPS ───────────
const STEPS = ['Osnovni podaci', 'Operacije', 'Materijal & Sirovo', 'Dodaci', 'Vanjska usluga', 'Rezultati', 'Ponuda']

// ─────────── MAIN COMPONENT ───────────
export default function KalkulacijePage() {
  const [view, setView] = useState('list') // list | editor
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [toast, showToast] = useToast()
  const [step, setStep] = useState(0)

  // Editor state
  const [header, setHeader] = useState({ naziv: '', broj_nacrta: '', materijal: '', naziv_dijela: '', ident_nr: '', varijanta: '50', status: 'draft', napomena: '' })
  const [data, setData] = useState({ ...DEFAULT_DATA })

  const fetchList = async () => {
    setLoading(true)
    const r = await api.get('/kalkulacije').catch(() => ({ data: [] }))
    setList(r.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  const setD = (key, val) => setData(d => ({ ...d, [key]: val }))

  const calc = calculate(data, header.varijanta)

  const openNew = () => {
    setEditId(null)
    setHeader({ naziv: '', broj_nacrta: '', materijal: '', naziv_dijela: '', ident_nr: '', varijanta: '50', status: 'draft', napomena: '' })
    setData({ ...DEFAULT_DATA, operacije: DEFAULT_OPERACIJE.map((o, i) => ({ ...o, id: i })) })
    setStep(0)
    setView('editor')
  }

  const openEdit = async (id) => {
    const r = await api.get(`/kalkulacije/${id}`).catch(() => null)
    if (!r) return
    const k = r.data
    setEditId(id)
    setHeader({ naziv: k.naziv, broj_nacrta: k.broj_nacrta, materijal: k.materijal, naziv_dijela: k.naziv_dijela, ident_nr: k.ident_nr, varijanta: k.varijanta, status: k.status, napomena: k.napomena })
    setData({ ...DEFAULT_DATA, ...(k.data || {}) })
    setStep(0)
    setView('editor')
  }

  const save = async (statusOverride) => {
    const payload = { ...header, status: statusOverride || header.status, data }
    if (editId) {
      await api.put(`/kalkulacije/${editId}`, payload)
      showToast('Kalkulacija ažurirana')
    } else {
      const r = await api.post('/kalkulacije', payload)
      setEditId(r.data.id)
      showToast('Kalkulacija spremljena')
    }
    fetchList()
  }

  const duplicate = async (id) => {
    await api.post(`/kalkulacije/${id}/duplicate`)
    showToast('Kopija kreirana')
    fetchList()
  }

  const deleteKalk = async (id) => {
    if (!confirm('Obrisati kalkulaciju?')) return
    await api.delete(`/kalkulacije/${id}`)
    showToast('Obrisano', 'error')
    fetchList()
  }

  const printPonuda = () => {
    const win = window.open('', '_blank')
    win.document.write(generatePonudaHTML(header, data, calc))
    win.document.close()
    win.print()
  }

  const filtered = list.filter(k =>
    !search || k.naziv?.toLowerCase().includes(search.toLowerCase())
      || k.broj_nacrta?.toLowerCase().includes(search.toLowerCase())
      || k.naziv_dijela?.toLowerCase().includes(search.toLowerCase())
  )

  if (view === 'list') return (
    <div style={S.page}>
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? C.red : C.green, color: '#fff', borderRadius: 10, padding: '12px 22px', fontWeight: 600, zIndex: 9999, fontSize: 14 }}>
          {toast.message}
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Calculator size={24} color={C.accent} />
            <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Chakra Petch',sans-serif", letterSpacing: 1 }}>KALKULACIJE</h1>
          </div>
          <div style={{ color: C.muted, fontSize: 13 }}>Izrada kalkulacija troškova i ponuda prema Excel predlošku</div>
        </div>
        <button style={S.btn()} onClick={openNew}>
          <Plus size={15} /> Nova kalkulacija
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Ukupno', val: list.length, color: C.accent },
          { label: 'Nacrt', val: list.filter(x => x.status === 'draft').length, color: C.muted },
          { label: 'Finalno', val: list.filter(x => x.status === 'final').length, color: C.green },
          { label: 'Poslano', val: list.filter(x => x.status === 'sent').length, color: C.blue },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color, fontFamily: "'Chakra Petch',sans-serif" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div style={S.card}>
        <div style={{ marginBottom: 14, display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input placeholder="Pretraži kalkulacije..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...S.input, paddingLeft: 32 }} />
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Učitavanje...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
            <Calculator size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>Nema kalkulacija. Kreirajte novu!</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Naziv', 'Br. Nacrta', 'Naziv dijela', 'Materijal', 'Varijanta', 'Status', 'Datum', 'Kreirao', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => (
                  <tr key={k.id} style={{ cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = `${C.surface2}88`}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...S.td, fontWeight: 600, color: C.accent }} onClick={() => openEdit(k.id)}>{k.naziv}</td>
                    <td style={S.td} onClick={() => openEdit(k.id)}>{k.broj_nacrta}</td>
                    <td style={S.td} onClick={() => openEdit(k.id)}>{k.naziv_dijela}</td>
                    <td style={S.td} onClick={() => openEdit(k.id)}>{k.materijal}</td>
                    <td style={{ ...S.td }} onClick={() => openEdit(k.id)}>
                      <span style={{ background: `${C.teal}22`, color: C.teal, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        v{k.varijanta}
                      </span>
                    </td>
                    <td style={S.td} onClick={() => openEdit(k.id)}><StatusBadge status={k.status} /></td>
                    <td style={{ ...S.td, color: C.muted, fontSize: 12 }} onClick={() => openEdit(k.id)}>{k.created_at?.substring(0, 10)}</td>
                    <td style={{ ...S.td, color: C.muted, fontSize: 12 }} onClick={() => openEdit(k.id)}>{k.kreirao_ime}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...S.btnGhost, padding: '4px 8px' }} title="Uredi" onClick={() => openEdit(k.id)}><Edit2 size={13} /></button>
                        <button style={{ ...S.btnGhost, padding: '4px 8px' }} title="Kopiraj" onClick={() => duplicate(k.id)}><Copy size={13} /></button>
                        <button style={{ ...S.btnGhost, padding: '4px 8px', color: C.red }} title="Obriši" onClick={() => deleteKalk(k.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  // ─── EDITOR VIEW ───
  return (
    <div style={S.page}>
      {toast.visible && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: toast.type === 'error' ? C.red : C.green, color: '#fff', borderRadius: 10, padding: '12px 22px', fontWeight: 600, zIndex: 9999, fontSize: 14 }}>
          {toast.message}
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={S.btnGhost} onClick={() => setView('list')}><ArrowLeft size={14} /> Natrag</button>
          <div>
            <div style={{ color: C.accent, fontWeight: 700, fontSize: 16, fontFamily: "'Chakra Petch',sans-serif" }}>
              {header.naziv || 'Nova kalkulacija'}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>Varijanta {header.varijanta} · {editId ? `ID: ${editId}` : 'Novo'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn(C.surface2)} onClick={() => save('draft')}><Save size={14} /> Spremi nacrt</button>
          <button style={S.btn(C.green)} onClick={() => save('final')}><CheckCircle size={14} /> Finaliziraj</button>
          {step === 6 && <button style={S.btn(C.blue)} onClick={printPonuda}><Printer size={14} /> Ponuda (PDF)</button>}
        </div>
      </div>

      {/* Step nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={i} style={S.stepBtn(step === i)} onClick={() => setStep(i)}>
            <span style={{ marginRight: 6, fontSize: 11, opacity: 0.7 }}>{i + 1}.</span>{s}
          </button>
        ))}
      </div>

      {/* STEP CONTENT */}
      {step === 0 && <StepOsnovni header={header} setHeader={setHeader} S={S} Inp={Inp} Sel={Sel} />}
      {step === 1 && <StepOperacije data={data} setD={setD} calc={calc} S={S} fmtEur={fmtEur} fmt={fmt} C={C} />}
      {step === 2 && <StepMaterijal data={data} setD={setD} calc={calc} S={S} Inp={Inp} Sel={Sel} fmtEur={fmtEur} fmt={fmt} />}
      {step === 3 && <StepDodaci data={data} setD={setD} calc={calc} S={S} Sel={Sel} fmtEur={fmtEur} Inp={Inp} />}
      {step === 4 && <StepVanjskaUsluga data={data} setD={setD} calc={calc} S={S} Inp={Inp} Sel={Sel} fmtEur={fmtEur} />}
      {step === 5 && <StepRezultati data={data} setD={setD} calc={calc} S={S} Inp={Inp} fmtEur={fmtEur} fmt={fmt} />}
      {step === 6 && <StepPonuda data={data} setD={setD} header={header} setHeader={setHeader} calc={calc} S={S} Inp={Inp} Sel={Sel} fmtEur={fmtEur} fmt={fmt} />}

      {/* Step nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button style={S.btnGhost} onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft size={14} /> Prethodni
        </button>
        <button style={S.btn()} onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
          Sljedeći <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ─────────── STEP 0: OSNOVNI PODACI ───────────
function StepOsnovni({ header, setHeader, S, Inp, Sel }) {
  const set = (k, v) => setHeader(h => ({ ...h, [k]: v }))
  return (
    <div style={S.card}>
      <h3 style={{ color: C.accent, margin: '0 0 18px', fontSize: 15 }}>Osnovni podaci kalkulacije</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Inp label="Naziv kalkulacije *" value={header.naziv} onChange={v => set('naziv', v)} />
        <Inp label="Broj upita / nacrta" value={header.broj_nacrta} onChange={v => set('broj_nacrta', v)} />
        <Inp label="Naziv dijela" value={header.naziv_dijela} onChange={v => set('naziv_dijela', v)} />
        <Inp label="Ident. broj" value={header.ident_nr} onChange={v => set('ident_nr', v)} />
        <Inp label="Materijal (opis)" value={header.materijal} onChange={v => set('materijal', v)} />
        <div>
          <span style={S.label}>Varijanta kalkulacije</span>
          <select value={header.varijanta} onChange={e => set('varijanta', e.target.value)} style={S.select}>
            <option value="50">Varijanta 50 — Standardna</option>
            <option value="50b">Varijanta 50b — Alternativna</option>
          </select>
        </div>
        <div>
          <span style={S.label}>Status</span>
          <select value={header.status} onChange={e => set('status', e.target.value)} style={S.select}>
            <option value="draft">Nacrt</option>
            <option value="final">Finalno</option>
            <option value="sent">Poslano</option>
            <option value="rejected">Odbijeno</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <Inp label="Napomena" value={header.napomena} onChange={v => set('napomena', v)} />
        </div>
      </div>
    </div>
  )
}

// ─────────── STEP 1: OPERACIJE ───────────
function StepOperacije({ data, setD, calc, S, fmtEur, fmt, C: Colors }) {
  const ops = data.operacije || []

  const updateOp = (id, key, val) => {
    setD('operacije', ops.map(o => o.id === id ? { ...o, [key]: val } : o))
  }

  return (
    <div style={S.card}>
      <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Operacije i vremena</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Korak', 'Radno mjesto', 'Opis operacije', 'Faktor troška', 'Pripr.vr. (min)', 'Jed.vr. (min)', 'Troš.lot (€)', 'Troš/kom (€)'].map(h => (
                <th key={h} style={{ ...S.th, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.operacije.map((op, idx) => {
              const isTitle = op.parent
              const isSub = op.sub
              const isFixed = ['QS provjera prvog komada', 'QS - Završna kontrola'].includes(op.opis)
              return (
                <tr key={op.id ?? idx} style={{ background: isTitle ? `${C.surface3}88` : 'transparent' }}>
                  <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{op.korak ?? ''}</td>
                  <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{op.radno_mjesto ?? ''}</td>
                  <td style={{ ...S.td, paddingLeft: isSub ? 28 : 10, fontWeight: isTitle ? 600 : 400, color: isTitle ? C.teal : C.gray }}>
                    {isSub ? '↳ ' : ''}{op.opis}
                  </td>
                  <td style={S.td}>
                    {isFixed || isSub ? (
                      <span style={{ color: C.muted, fontSize: 12 }}>{fmt(op.faktor_calc, 4)}</span>
                    ) : op.faktor === null ? (
                      <span style={{ color: C.muted, fontSize: 12 }}>auto</span>
                    ) : (
                      <input type="number" value={op.faktor ?? ''} onChange={e => updateOp(op.id, 'faktor', parseFloat(e.target.value))}
                        style={{ ...S.input, width: 70, padding: '4px 6px' }} step="0.05" />
                    )}
                  </td>
                  <td style={S.td}>
                    <input type="number" value={op.prep_vrijeme ?? ''} onChange={e => updateOp(op.id, 'prep_vrijeme', parseFloat(e.target.value))}
                      style={{ ...S.input, width: 80, padding: '4px 6px' }} />
                  </td>
                  <td style={S.td}>
                    <input type="number" value={op.jed_vrijeme ?? ''} onChange={e => updateOp(op.id, 'jed_vrijeme', parseFloat(e.target.value))}
                      style={{ ...S.input, width: 80, padding: '4px 6px' }} step="0.1" />
                  </td>
                  <td style={{ ...S.td, color: op.trosak_lot > 0 ? C.accent : C.muted, fontWeight: op.trosak_lot > 0 ? 600 : 400 }}>
                    {fmtEur(op.trosak_lot)}
                  </td>
                  <td style={{ ...S.td, color: op.trosak_kom > 0 ? C.green : C.muted }}>
                    {fmtEur(op.trosak_kom)}
                  </td>
                </tr>
              )
            })}
            {/* Summe */}
            <tr style={{ background: `${C.surface3}` }}>
              <td colSpan={6} style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: C.muted, fontSize: 12 }}>SUMME:</td>
              <td style={{ ...S.td, fontWeight: 700, color: C.accent }}>{fmtEur(calc.summe_lot)}</td>
              <td style={{ ...S.td, fontWeight: 700, color: C.green }}>{fmtEur(calc.summe_kom)}</td>
            </tr>
            <tr style={{ background: `${C.surface3}` }}>
              <td colSpan={5} style={{ ...S.td, textAlign: 'right', color: C.muted, fontSize: 12 }}>Faktor hitnosti ({fmt(calc.fHitnost, 2)}x):</td>
              <td colSpan={1} />
              <td style={{ ...S.td, fontWeight: 700, color: C.accent, borderTop: `1px solid ${C.accent}44` }}>{fmtEur(calc.ukupno_lot)}</td>
              <td style={{ ...S.td, fontWeight: 700, color: C.green, borderTop: `1px solid ${C.green}44` }}>{fmtEur(calc.ukupno_kom)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.accent}11`, borderRadius: 8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.muted }}>💡 Faktor troška za QS korake automatski se izračunava iz odabira mjerenja</span>
        <span style={{ fontSize: 12, color: C.muted }}>Podkoraci Tokarenje/Glodanje/Automati koriste minimalni faktor: <strong style={{ color: C.accent }}>{fmt(calc.minFaktor, 4)}</strong></span>
      </div>
    </div>
  )
}

// ─────────── STEP 2: MATERIJAL & SIROVO ───────────
function StepMaterijal({ data, setD, calc, S, Inp, Sel, fmtEur, fmt }) {
  const vrsta = data.vrsta_sirovca

  const dimFields = {
    'Okrugle šipke': [['dim_dv', 'Ø Dv — Promjer (mm)'], ['dim_L', 'L — Dužina (mm)']],
    'Šesterokutne šipke': [['dim_w', 'W — Širina (mm)'], ['dim_L', 'L — Dužina (mm)']],
    'Kružne cijevi': [['dim_dv', 'Ø Dv — Vanjski promjer (mm)'], ['dim_t', 'T — Debljina stijenke (mm)'], ['dim_L', 'L — Dužina (mm)']],
    'Kvadratne cijevi': [['dim_B', 'B — Širina (mm)'], ['dim_H', 'H — Visina (mm)'], ['dim_t', 'T — Debljina (mm)'], ['dim_L', 'L — Dužina (mm)']],
    'Limovi': [['dim_B', 'B — Širina (mm)'], ['dim_H', 'H — Debljina (mm)'], ['dim_L', 'L — Dužina (mm)']],
  }

  return (
    <div>
      <div style={S.card}>
        <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Materijal za proračun</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Sel label="Materijal (gustoća)" value={data.materijal_proracun} onChange={v => setD('materijal_proracun', v)}
            options={Object.keys(GUSTOCA)} />
          <div>
            <span style={S.label}>Gustoća (kg/m³)</span>
            <div style={{ ...S.input, background: `${C.surface3}`, color: C.teal, fontWeight: 600 }}>{calc.gustoca}</div>
          </div>
          <div />
          <Sel label="Standardni materijal (cijena)" value={data.standardni_materijal} onChange={v => setD('standardni_materijal', v)}
            options={Object.keys(CIJENA_MAT)} />
          <div>
            <span style={S.label}>Cijena stand. mat. (€/kg)</span>
            <div style={{ ...S.input, background: `${C.surface3}`, color: C.green, fontWeight: 600 }}>
              {CIJENA_MAT[data.standardni_materijal] ?? '—'} €/kg
            </div>
          </div>
          <div />
          <Inp label="Specijalni materijal (naziv)" value={data.specijalni_materijal} onChange={v => setD('specijalni_materijal', v)} />
          <Inp label="Cijena spec. mat. (€/kg)" value={data.specijalni_cijena} onChange={v => setD('specijalni_cijena', v)} type="number" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              {data.specijalni_materijal && data.specijalni_cijena
                ? <span style={{ color: C.orange }}>⚠ Koristi se specijalni materijal</span>
                : <span>Koristi se standardna cijena</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Dimenzije sirovca</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          <Sel label="Vrsta sirovog materijala" value={data.vrsta_sirovca} onChange={v => setD('vrsta_sirovca', v)}
            options={VRSTA_SIROVCA} style={{ gridColumn: 'span 1' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {(dimFields[vrsta] || []).map(([key, label]) => (
            <Inp key={key} label={label} value={data[key]} onChange={v => setD(key, parseFloat(v) || 0)} type="number" />
          ))}
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16, padding: '14px 16px', background: `${C.surface3}`, borderRadius: 10 }}>
          {[
            { label: 'Težina (kg)', val: fmt(calc.masa, 3), color: C.teal },
            { label: 'Volumen (dm³)', val: fmt(calc.volumen, 3), color: C.teal },
            { label: 'Cijena mat. (€/kg)', val: fmtEur(calc.cijenaKg), color: C.green },
            { label: 'Trošak mat. (€/kom)', val: fmtEur(calc.trosakMat), color: C.accent },
          ].map(r => (
            <div key={r.label}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: r.color, fontFamily: "'Chakra Petch',sans-serif" }}>{r.val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
          <div>
            <span style={S.label}>Dužina materijala (mm)</span>
            <div style={{ ...S.input, background: `${C.surface3}`, color: C.gray }}>{calc.duzinaMat} mm</div>
          </div>
          <div>
            <span style={S.label}>Broj komada iz šipke</span>
            <div style={{ ...S.input, background: `${C.surface3}`, color: C.green, fontWeight: 600 }}>{fmt(calc.brKomada, 1)} kom</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────── STEP 3: DODACI ───────────
function StepDodaci({ data, setD, calc, S, Sel, fmtEur, Inp }) {
  const dodaci = [
    { key: 'dodatak_materijal', label: 'Za materijale', options: Object.keys(FAKTOR_MAT), val: calc.fMat },
    { key: 'dodatak_obrada', label: 'Za vrstu obrade', options: Object.keys(FAKTOR_OBRADA), val: calc.fObrada },
    { key: 'dodatak_tocnost', label: 'Za točnost', options: Object.keys(FAKTOR_TOCNOST), val: calc.fTocnost },
    { key: 'dodatak_ciklus', label: 'Za trajanje ciklusa', options: Object.keys(FAKTOR_CIKLUS), val: calc.fCiklus },
    { key: 'dodatak_mjerenje', label: 'Za mjerenje', options: Object.keys(FAKTOR_MJERENJE), val: calc.fMjerenje },
    { key: 'dodatak_hitnost', label: 'Za hitnost', options: Object.keys(FAKTOR_HITNOST), val: calc.fHitnost },
  ]
  return (
    <div>
      <div style={S.card}>
        <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Faktori dodataka</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {dodaci.map(d => (
            <div key={d.key} style={{ background: C.surface2, borderRadius: 10, padding: 14 }}>
              <Sel label={d.label} value={data[d.key]} onChange={v => setD(d.key, v)} options={d.options} />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Faktor:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.accent, fontFamily: "'Chakra Petch',sans-serif" }}>
                  {d.val ? d.val.toFixed(2) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Minimalni faktor (strojna obrada)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'end' }}>
          <div>
            <span style={S.label}>Auto izračun (AVERAGE svih faktora)</span>
            <div style={{ ...S.input, background: `${C.surface3}`, color: C.teal, fontWeight: 600, fontSize: 16 }}>
              {calc.minFaktorAuto.toFixed(4)}
            </div>
          </div>
          <Inp label="Ručni unos min. faktora (override)" value={data.minimalni_faktor_rucni}
            onChange={v => setD('minimalni_faktor_rucni', v)} type="number" />
          <div>
            <span style={S.label}>Aktivan faktor</span>
            <div style={{ ...S.input, background: `${C.accent}22`, color: C.accent, fontWeight: 700, fontSize: 16, border: `1px solid ${C.accent}66` }}>
              {calc.minFaktor.toFixed(4)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
          💡 Ovaj faktor se automatski primjenjuje na podkorake Tokarenje, Glodanje i Automati. Unesite ručnu vrijednost samo ako želite overridati auto izračun.
        </div>
      </div>
    </div>
  )
}

// ─────────── STEP 4: VANJSKA USLUGA ───────────
function StepVanjskaUsluga({ data, setD, calc, S, Inp, Sel, fmtEur }) {
  return (
    <div style={S.card}>
      <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>Vanjska usluga & Površinska obrada</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
        <span style={{ ...S.label, alignSelf: 'end' }}>Naziv usluge</span>
        <span style={{ ...S.label, alignSelf: 'end' }}>Cijena (€/kg ili €)</span>
        <span style={{ ...S.label, alignSelf: 'end' }}>Transport (€)</span>
      </div>
      {[1, 2, 3].map(n => (
        <div key={n} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
          <Sel label={`Usluga ${n}`} value={data[`vs${n}_naziv`]} onChange={v => setD(`vs${n}_naziv`, v)}
            options={POVRSINSKA_OBRADA} />
          <Inp label="" value={data[`vs${n}_cijena`]} onChange={v => setD(`vs${n}_cijena`, parseFloat(v) || 0)} type="number" />
          <Inp label="" value={data[`vs${n}_transport`]} onChange={v => setD(`vs${n}_transport`, parseFloat(v) || 0)} type="number" />
        </div>
      ))}

      <div style={{ marginTop: 16, padding: '14px 16px', background: `${C.surface3}`, borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Ukupno lot (€)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: "'Chakra Petch',sans-serif" }}>{fmtEur(calc.vs_trosak_lot)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Trošak/kom (€)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green, fontFamily: "'Chakra Petch',sans-serif" }}>{fmtEur(calc.vs_trosak_kom)}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 14px', background: `${C.surface2}`, borderRadius: 8, fontSize: 12, color: C.muted }}>
        💡 Usluge 1 i 2 računaju se u trošak lota, usluga 3 (kom. cijena) direktno u trošak po komadu
      </div>
    </div>
  )
}

// ─────────── STEP 5: REZULTATI ───────────
function StepRezultati({ data, setD, calc, S, Inp, fmtEur, fmt }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
        {/* Main result card */}
        <div style={{ ...S.card, margin: 0, background: `linear-gradient(145deg, ${C.surface}, #1e3330)`, border: `1px solid ${C.accent}44` }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>Kalkulacija</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Σ Troš. lot (€)', val: fmtEur(calc.summe_lot), color: C.accent },
              { label: 'Σ Troš. kom (€)', val: fmtEur(calc.summe_kom), color: C.green },
              { label: 'Lot × hitnost', val: fmtEur(calc.ukupno_lot), color: C.accent },
              { label: 'Kom × hitnost', val: fmtEur(calc.ukupno_kom), color: C.green },
            ].map(r => (
              <div key={r.label} style={{ background: C.surface2, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{r.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: r.color, fontFamily: "'Chakra Petch',sans-serif" }}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Price table */}
        <div style={{ ...S.card, margin: 0 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Cijena po količini</div>
          <div style={{ marginBottom: 12 }}>
            <Inp label="Količina (kom)" value={data.kolicina} onChange={v => setD('kolicina', v)} type="number" />
          </div>
          <div style={{ padding: '14px 16px', background: `${C.surface3}`, borderRadius: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Komada</span>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Cijena/kom</span>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Ukupno</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.gray, fontFamily: "'Chakra Petch',sans-serif" }}>{calc.kolicina}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: "'Chakra Petch',sans-serif" }}>{fmtEur(calc.cijena_kom)}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: "'Chakra Petch',sans-serif" }}>{fmtEur(calc.ukupno)}</span>
            </div>
          </div>
          {/* Extra quantities */}
          <div style={{ marginTop: 12 }}>
            {[1, 5, 10, 20, 50, 100].map(q => {
              const cp = q > 0 ? (calc.ukupno_lot / q) + calc.ukupno_kom : 0
              return (
                <div key={q} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{q} kom</span>
                  <span style={{ color: q === calc.kolicina ? C.accent : C.gray, fontWeight: q === calc.kolicina ? 700 : 400 }}>{fmtEur(cp)}/kom</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{fmtEur(cp * q)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Factor summary */}
      <div style={S.card}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Sažetak faktora</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {[
            { label: 'Materijal', val: calc.fMat, desc: data.dodatak_materijal },
            { label: 'Obrada', val: calc.fObrada, desc: data.dodatak_obrada },
            { label: 'Točnost', val: calc.fTocnost, desc: data.dodatak_tocnost },
            { label: 'Ciklus', val: calc.fCiklus, desc: data.dodatak_ciklus },
            { label: 'Mjerenje', val: calc.fMjerenje, desc: data.dodatak_mjerenje },
            { label: 'Hitnost', val: calc.fHitnost, desc: data.dodatak_hitnost },
          ].map(f => (
            <div key={f.label} style={{ background: C.surface2, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: "'Chakra Petch',sans-serif" }}>{fmt(f.val, 2)}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: `${C.accent}22`, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '8px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>MIN. FAKTOR (strojna obrada)</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.accent, fontFamily: "'Chakra Petch',sans-serif" }}>{fmt(calc.minFaktor, 4)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────── STEP 6: PONUDA (ANGEBOT) ───────────
function StepPonuda({ data, setD, header, setHeader, calc, S, Inp, Sel, fmtEur, fmt }) {
  const items = data.angebot_items || [{ ident_nr: '', material: '', description: '', kolicina: 20, crtez: '' }]

  const updateItem = (i, key, val) => {
    const updated = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it)
    setD('angebot_items', updated)
  }
  const addItem = () => setD('angebot_items', [...items, { ident_nr: '', material: '', description: '', kolicina: data.kolicina, crtez: '' }])
  const removeItem = (i) => setD('angebot_items', items.filter((_, idx) => idx !== i))

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: C.accent, margin: 0, fontSize: 15 }}>Ponuda (Angebot)</h3>
          <button style={S.btn(C.surface2)} onClick={addItem}><Plus size={13} /> Dodaj poziciju</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Br.', 'Ident. Nr.', 'Material', 'Opis', 'Kolicina', 'Cijena/kom (€)', 'Crtež', 'Površ.', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, color: C.muted }}>{i + 1}</td>
                  <td style={S.td}><input value={it.ident_nr} onChange={e => updateItem(i, 'ident_nr', e.target.value)} style={{ ...S.input, width: 90, padding: '4px 6px' }} /></td>
                  <td style={S.td}><input value={it.material} onChange={e => updateItem(i, 'material', e.target.value)} style={{ ...S.input, width: 100, padding: '4px 6px' }} /></td>
                  <td style={S.td}><input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ ...S.input, width: 160, padding: '4px 6px' }} /></td>
                  <td style={S.td}><input type="number" value={it.kolicina} onChange={e => updateItem(i, 'kolicina', parseInt(e.target.value))} style={{ ...S.input, width: 70, padding: '4px 6px' }} /></td>
                  <td style={{ ...S.td, color: C.accent, fontWeight: 600 }}>
                    {fmtEur(it.kolicina > 0 ? (calc.ukupno_lot / it.kolicina) + calc.ukupno_kom : 0)}
                  </td>
                  <td style={S.td}><input value={it.crtez} onChange={e => updateItem(i, 'crtez', e.target.value)} style={{ ...S.input, width: 80, padding: '4px 6px' }} /></td>
                  <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{data.vs1_naziv || data.vs2_naziv || data.vs3_naziv || '—'}</td>
                  <td style={S.td}>
                    {items.length > 1 && <button style={{ ...S.btnGhost, padding: '3px 7px', color: C.red }} onClick={() => removeItem(i)}><Trash2 size={12} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h4 style={{ color: C.muted, margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Napomena za ponudu</h4>
            <textarea value={data.napomena_ponuda} onChange={e => setD('napomena_ponuda', e.target.value)}
              style={{ ...S.input, height: 80, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Uvjeti plaćanja, rok isporuke, napomene..." />
          </div>
          <div>
            <h4 style={{ color: C.muted, margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Pregled kalkulacije</h4>
            <div style={{ background: C.surface2, borderRadius: 8, padding: 14 }}>
              {[
                ['Trošak lota', fmtEur(calc.ukupno_lot)],
                ['Trošak/kom', fmtEur(calc.ukupno_kom)],
                ['Faktor hitnosti', `${fmt(calc.fHitnost, 2)}x`],
                ['Min. faktor', fmt(calc.minFaktor, 4)],
                ['Masa sirovca', `${fmt(calc.masa, 3)} kg`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ color: C.gray, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Print preview hint */}
      <div style={{ ...S.card, background: `${C.blue}11`, border: `1px solid ${C.blue}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.blue, fontSize: 13 }}>
          <Printer size={16} />
          <span>Kliknite <strong>"Ponuda (PDF)"</strong> gumb gore desno za generiranje i printanje/download ponude</span>
        </div>
      </div>
    </div>
  )
}

// ─────────── HTML PONUDA GENERATOR ───────────
function generatePonudaHTML(header, data, calc) {
  const items = data.angebot_items || []
  const today = new Date().toLocaleDateString('hr-HR')
  const rows = items.map((it, i) => {
    const cp = it.kolicina > 0 ? (calc.ukupno_lot / it.kolicina) + calc.ukupno_kom : 0
    const total = cp * it.kolicina
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${it.ident_nr || header.ident_nr || '-'}</td>
        <td>${it.material || header.materijal || '-'}</td>
        <td>${it.description || header.naziv_dijela || '-'}</td>
        <td style="text-align:center">${it.kolicina}</td>
        <td style="text-align:right">${cp.toFixed(2).replace('.', ',')} €</td>
        <td style="text-align:right">${total.toFixed(2).replace('.', ',')} €</td>
        <td>${it.crtez || header.broj_nacrta || '-'}</td>
        <td>${data.vs1_naziv || data.vs2_naziv || '-'}</td>
      </tr>`
  }).join('')

  const totalAll = items.reduce((s, it) => {
    const cp = it.kolicina > 0 ? (calc.ukupno_lot / it.kolicina) + calc.ukupno_kom : 0
    return s + cp * it.kolicina
  }, 0)

  return `<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="UTF-8">
<title>Ponuda — ${header.naziv || 'DEER MES'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 2px solid #2B3C3A; }
  .logo-text { font-size: 24px; font-weight: 900; color: #2B3C3A; letter-spacing: 2px; }
  .logo-sub { font-size: 11px; color: #666; letter-spacing: 3px; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-info h2 { font-size: 18px; color: #2B3C3A; margin-bottom: 6px; }
  .doc-info p { color: #555; font-size: 11px; line-height: 1.6; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }
  .info-block { background: #f5f5f5; border-radius: 6px; padding: 12px 14px; }
  .info-block h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; }
  .info-block p { font-size: 12px; line-height: 1.8; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead tr { background: #2B3C3A; color: white; }
  thead th { padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
  tbody tr:nth-child(even) { background: #f9f9f9; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
  .total-row td { font-weight: 700; font-size: 13px; background: #f0f8f5; border-top: 2px solid #2B3C3A; }
  .note-box { background: #fffbec; border: 1px solid #f5bc54; border-radius: 6px; padding: 12px 14px; margin-bottom: 18px; }
  .note-box h4 { font-size: 10px; text-transform: uppercase; color: #b88a00; margin-bottom: 6px; }
  .note-box p { font-size: 12px; color: #555; }
  .footer { border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
  .stamp-area { display: flex; justify-content: flex-end; gap: 60px; margin-top: 40px; }
  .stamp-box { text-align: center; }
  .stamp-box div { width: 140px; border-top: 1px solid #333; padding-top: 6px; font-size: 10px; color: #666; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-text">🦌 DEER MES</div>
      <div class="logo-sub">MANUFACTURING EXECUTION SYSTEM</div>
    </div>
    <div class="doc-info">
      <h2>PONUDA / ANGEBOT</h2>
      <p>Datum: <strong>${today}</strong><br>
      Br. dokumenta: <strong>${header.broj_nacrta || '—'}</strong><br>
      Kalkulacija: <strong>${header.naziv || '—'}</strong></p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h4>Podaci o dijelu</h4>
      <p><strong>Naziv dijela:</strong> ${header.naziv_dijela || '—'}<br>
      <strong>Ident. broj:</strong> ${header.ident_nr || '—'}<br>
      <strong>Materijal:</strong> ${header.materijal || data.materijal_proracun || '—'}<br>
      <strong>Varijanta:</strong> ${header.varijanta}</p>
    </div>
    <div class="info-block">
      <h4>Kalkulacijski parametri</h4>
      <p><strong>Masa sirovca:</strong> ${calc.masa.toFixed(3)} kg<br>
      <strong>Volumen:</strong> ${calc.volumen.toFixed(3)} dm³<br>
      <strong>Faktor hitnosti:</strong> ${calc.fHitnost.toFixed(2)}x (${data.dodatak_hitnost})<br>
      <strong>Obrada:</strong> ${data.dodatak_obrada}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Br.</th>
        <th>Ident. Nr.</th>
        <th>Material</th>
        <th>Opis / Bezeichnung</th>
        <th>Menge</th>
        <th>Preis/Stk</th>
        <th>Ukupno</th>
        <th>Crtež</th>
        <th>Površina</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6" style="text-align:right">UKUPNO / GESAMT:</td>
        <td>${totalAll.toFixed(2).replace('.', ',')} €</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  ${data.napomena_ponuda ? `
  <div class="note-box">
    <h4>Napomena / Bemerkung</h4>
    <p>${data.napomena_ponuda}</p>
  </div>` : ''}

  <div class="stamp-area">
    <div class="stamp-box"><div>Potpis / Unterschrift</div></div>
    <div class="stamp-box"><div>Pečat / Stempel</div></div>
  </div>

  <div class="footer">
    <span>DEER MES — Kalkulacijski modul</span>
    <span>Generirao: ${today}</span>
    <span>Svi iznosi su bez PDV-a</span>
  </div>
</body>
</html>`
}
