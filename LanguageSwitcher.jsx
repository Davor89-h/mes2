import { useState, useEffect, useCallback } from 'react'
import { C, useToast } from '../components/UI'
import api from '../utils/api'
import {
  TrendingUp, TrendingDown, DollarSign, Target, Activity, Cpu,
  FileText, Plus, Edit2, Trash2, X, Save, Download, ChevronDown, ChevronUp
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EUR  = v => `€ ${(v||0).toLocaleString('hr-HR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const PCT  = v => `${(v||0).toFixed(1)} %`
const MJ   = ['','Sij','Velj','Ožu','Tra','Svi','Lip','Srp','Kol','Ruj','Lis','Stu','Pro']
const BKAT = ['Materijal','Rad','Režija','Stroj','Alati','Transport','Ostalo']
const NKAT = ['Materijal','Strojni sat','Rad operatera','Alati','Kooperacija','Ostalo']

// ─── Shared styles (DEER style) ───────────────────────────────────────────────
const S = {
  card:  { background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:14, padding:20, boxShadow:'0 4px 16px rgba(0,0,0,.2)' },
  input: { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.gray, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  label: { fontSize:11, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4, display:'block' },
  btn:   (col=C.accent)=>({ background:col, border:'none', borderRadius:8, padding:'8px 16px', color:col===C.accent?'#1a2a28':C.gray, fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }),
  ghost: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.muted, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  th:    { padding:'9px 12px', fontSize:10, color:C.muted, letterSpacing:1.2, textTransform:'uppercase', textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' },
  td:    { padding:'10px 12px', fontSize:13, color:C.gray, borderBottom:`1px solid ${C.border}22`, verticalAlign:'middle' },
}

// ─── KPI Tile (same pattern as KPIPage Tile) ─────────────────────────────────
function Tile({ label, value, sub, color=C.accent, warn }) {
  return (
    <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${warn?color:C.border}`, borderRadius:14, padding:'16px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},${color}88)` }}/>
      <div style={{ fontSize:10, color:C.muted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1, fontFamily:"'Chakra Petch',sans-serif" }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ─── SVG Bar Chart (no external deps) ────────────────────────────────────────
function BarChart({ data, keys, colors, height=160 }) {
  if (!data?.length) return <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:30 }}>Nema podataka</div>
  const allVals = data.flatMap(d => keys.map(k => d[k]||0))
  const maxVal  = Math.max(...allVals, 1)
  const barW    = Math.floor((360 / data.length) / keys.length) - 4
  const groupW  = Math.floor(360 / data.length)
  return (
    <svg width="100%" viewBox={`0 0 360 ${height+30}`} style={{ overflow:'visible' }}>
      {/* Y grid lines */}
      {[0,0.25,0.5,0.75,1].map(f => (
        <g key={f}>
          <line x1={0} y1={height*(1-f)} x2={360} y2={height*(1-f)} stroke={C.border} strokeWidth={0.5} strokeDasharray="4 4"/>
          <text x={-4} y={height*(1-f)+4} fill={C.muted} fontSize={8} textAnchor="end">{Math.round(maxVal*f).toLocaleString()}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={i} transform={`translate(${i*groupW},0)`}>
          {keys.map((k, ki) => {
            const val = d[k]||0
            const bh  = Math.max(2, (val/maxVal)*height)
            return (
              <g key={k}>
                <rect x={ki*(barW+2)+2} y={height-bh} width={barW} height={bh} rx={3} fill={colors[ki]} opacity={0.85}/>
                <title>{k}: {val.toLocaleString()}</title>
              </g>
            )
          })}
          <text x={groupW/2} y={height+14} fill={C.muted} fontSize={9} textAnchor="middle">{d.name||d.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ data, keys, colors, height=140 }) {
  if (!data?.length) return <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:30 }}>Nema podataka</div>
  const allVals = data.flatMap(d => keys.map(k => d[k]||0))
  const maxVal  = Math.max(...allVals, 1)
  const w = 360
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height+24}`} style={{ overflow:'visible' }}>
      {[0,0.25,0.5,0.75,1].map(f => (
        <line key={f} x1={0} y1={height*(1-f)} x2={w} y2={height*(1-f)} stroke={C.border} strokeWidth={0.5} strokeDasharray="4 4"/>
      ))}
      {keys.map((k, ki) => {
        const pts = data.map((d,i) => {
          const x = data.length > 1 ? (i/(data.length-1))*w : w/2
          const y = height - ((d[k]||0)/maxVal)*height
          return `${x},${y}`
        }).join(' ')
        const fill = data.map((d,i) => {
          const x = data.length > 1 ? (i/(data.length-1))*w : w/2
          const y = height - ((d[k]||0)/maxVal)*height
          return `${x},${y}`
        })
        return (
          <g key={k}>
            <polyline points={`0,${height} ${pts} ${w},${height}`} fill={colors[ki]+'18'} stroke="none"/>
            <polyline points={pts} fill="none" stroke={colors[ki]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            {data.map((d,i) => {
              const x = data.length > 1 ? (i/(data.length-1))*w : w/2
              const y = height - ((d[k]||0)/maxVal)*height
              return <circle key={i} cx={x} cy={y} r={3} fill={colors[ki]}><title>{k}: {(d[k]||0).toLocaleString()}</title></circle>
            })}
          </g>
        )
      })}
      {data.map((d,i) => (
        <text key={i} x={data.length>1?(i/(data.length-1))*w:w/2} y={height+16} fill={C.muted} fontSize={9} textAnchor="middle">{d.label||d.mj}</text>
      ))}
    </svg>
  )
}

// ─── SVG Donut / Pie ──────────────────────────────────────────────────────────
function DonutChart({ segments, size=120 }) {
  const total = segments.reduce((s,x)=>s+(x.value||0),0)
  if (!total) return <div style={{ color:C.muted, fontSize:12, textAlign:'center', padding:20 }}>Nema podataka</div>
  const r=46, cx=60, cy=60, circ=2*Math.PI*r
  let offset=0
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface3} strokeWidth={14}/>
      {segments.map((seg,i) => {
        const dash = (seg.value/total)*circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset}
            style={{ transform:'rotate(-90deg)', transformOrigin:'60px 60px', transition:'stroke-dasharray .5s ease' }}>
            <title>{seg.label}: {EUR(seg.value)}</title>
          </circle>
        )
        offset += dash
        return el
      })}
      <text x={60} y={57} fill={C.gray} fontSize={10} fontWeight={700} textAnchor="middle">{segments.length}</text>
      <text x={60} y={69} fill={C.muted} fontSize={7} textAnchor="middle">stavki</text>
    </svg>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {items.map((it,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:it.color, flexShrink:0 }}/>
          <span style={{ fontSize:11, color:C.gray, flex:1 }}>{it.label}</span>
          {it.value !== undefined && <span style={{ fontSize:11, fontWeight:700, color:it.color }}>{typeof it.value==='number'&&it.value>100?EUR(it.value):it.value}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Section header (DEER style) ─────────────────────────────────────────────
function SectionHead({ color=C.teal, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <div style={{ width:3, height:16, background:`linear-gradient(${color},${color}44)`, borderRadius:2 }}/>
      <div style={{ fontSize:10, color, letterSpacing:2 }}>{label}</div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(10,20,18,.88)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:18, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:`1px solid ${C.border}44` }}>
          <span style={{ fontWeight:700, color:C.accent, letterSpacing:1.5, fontFamily:"'Chakra Petch',sans-serif", fontSize:14 }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={18}/></button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label style={S.label}>{label}</label>{children}</div>
}
function Inp({ value, onChange, type='text', placeholder='' }) {
  return <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={S.input}/>
}
function Sel({ value, onChange, options }) {
  return (
    <select value={value||''} onChange={e=>onChange(e.target.value)} style={S.input}>
      <option value="">— odaberi —</option>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  )
}
function SaveRow({ onSave, onClose, loading }) {
  return (
    <div style={{ display:'flex', gap:10, paddingTop:6 }}>
      <button onClick={onSave} disabled={loading} style={{ ...S.btn(), flex:1, justifyContent:'center', opacity:loading?.6:1 }}><Save size={14}/>{loading?'Sprema...':'Spremi'}</button>
      <button onClick={onClose} style={S.ghost}><X size={13}/> Odustani</button>
    </div>
  )
}

function exportCSV(rows, headers, filename) {
  const csv = [headers, ...rows].map(r=>r.join(';')).join('\n')
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download=filename; a.click()
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: PREGLED
// ════════════════════════════════════════════════════════════════════════════
function TabPregled({ godina }) {
  const [summary, setSummary] = useState(null)
  const [trend,   setTrend]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [s,t] = await Promise.all([
      api.get(`/kontroling/summary?godina=${godina}`),
      api.get(`/kontroling/trend?godina=${godina}`)
    ])
    setSummary(s.data)
    setTrend(t.data.map(r=>({...r, label:MJ[r.mj]||r.mj})))
    setLoading(false)
  },[godina])
  useEffect(()=>{ load() },[load])

  if (loading) return <div style={{ color:C.muted, padding:40, textAlign:'center', fontFamily:"'Chakra Petch',sans-serif" }}>Učitavanje...</div>
  if (!summary) return null

  const { kpi, budzet, strojniSat } = summary

  const budzetBars = budzet.map(b=>({ name:b.kategorija.slice(0,4), Plan:+(b.plan||0).toFixed(0), Stvarni:+(b.stvarni||0).toFixed(0) }))
  const strojSegments = strojniSat.filter(s=>s.trosak_ukupno_sat>0).slice(0,5).map((s,i)=>({ label:s.name||`Stroj ${i+1}`, value:+(s.trosak_ukupno_sat||0), color:[C.teal,C.accent,C.blue,C.green,C.orange][i%5] }))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* KPI tiles */}
      <SectionHead color={C.teal} label="KLJUČNI POKAZATELJI"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <Tile label="Prihod" value={EUR(kpi.prihod)} color={C.green}/>
        <Tile label="Bruto dobit" value={EUR(kpi.dobit)} color={kpi.dobit>=0?C.teal:C.red} warn={kpi.dobit<0}/>
        <Tile label="Avg. marža" value={PCT(kpi.avgMarza)} color={kpi.avgMarza>=20?C.green:kpi.avgMarza>=10?C.orange:C.red} warn={kpi.avgMarza<10}/>
        <Tile label="Varijanca bud." value={EUR(kpi.varijanca)} sub={`Plan: ${EUR(kpi.totalPlan)}`} color={kpi.varijanca>=0?C.green:C.red} warn={kpi.varijanca<0}/>
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Trend line chart */}
        <div style={S.card}>
          <SectionHead color={C.accent} label={`TREND PRIHODA / TROŠKA / DOBITI — ${godina}`}/>
          <LineChart data={trend} keys={['prihod','trosak','dobit']} colors={[C.green,C.red,C.teal]}/>
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
            <Legend items={[{label:'Prihod',color:C.green},{label:'Trošak',color:C.red},{label:'Dobit',color:C.teal}]}/>
          </div>
        </div>

        {/* Budžet bar chart */}
        <div style={S.card}>
          <SectionHead color={C.blue} label="BUDŽET VS. STVARNI PO KATEGORIJI"/>
          <BarChart data={budzetBars} keys={['Plan','Stvarni']} colors={[C.blue,C.teal]}/>
          <div style={{ display:'flex', gap:16, marginTop:10 }}>
            <Legend items={[{label:'Plan',color:C.blue},{label:'Stvarni',color:C.teal}]}/>
          </div>
        </div>
      </div>

      {/* Strojni sat donut + summary table */}
      {strojSegments.length > 0 && (
        <div style={S.card}>
          <SectionHead color={C.orange} label="TROŠAK/SAT PO STROJU (€/h)"/>
          <div style={{ display:'flex', alignItems:'center', gap:32 }}>
            <DonutChart segments={strojSegments} size={130}/>
            <Legend items={strojSegments.map(s=>({ label:s.label, value:s.value, color:s.color }))}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: BUDŽET
// ════════════════════════════════════════════════════════════════════════════
function TabBudzet({ godina }) {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(()=>api.get('/kontroling/budzet').then(r=>setRows(r.data)),[])
  useEffect(()=>{ load() },[load])

  const save = async () => {
    setSaving(true)
    if (modal==='new') await api.post('/kontroling/budzet',form)
    else await api.put(`/kontroling/budzet/${form.id}`,form)
    setSaving(false); setModal(null); load()
  }
  const del = async id => { if(confirm('Obrisati?')){ await api.delete(`/kontroling/budzet/${id}`); load() } }

  const filtered = rows.filter(r=>!search||(r.kategorija+r.opis).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ ...S.input, width:200, padding:'7px 12px' }}/>
        <button onClick={()=>exportCSV(filtered.map(r=>[r.godina,r.mjesec,r.kategorija,r.opis,r.iznos_plan,r.iznos_stvarni,(r.iznos_plan-r.iznos_stvarni).toFixed(2)]),['God','Mj','Kat','Opis','Plan','Stvarni','Razlika'],'budzet.csv')}
          style={S.ghost}><Download size={13}/> CSV</button>
        <button onClick={()=>{ setForm({godina,mjesec:new Date().getMonth()+1,kategorija:'',iznos_plan:0,iznos_stvarni:0}); setModal('new') }}
          style={{ ...S.btn(), marginLeft:'auto' }}><Plus size={14}/> Dodaj</button>
      </div>
      <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:C.surface2 }}>
            <tr>{['God.','Mj','Kategorija','Opis','Plan (€)','Stvarni (€)','Razlika',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:32, color:C.muted }}>Nema podataka</td></tr>}
            {filtered.map(r=>{
              const raz=(r.iznos_plan||0)-(r.iznos_stvarni||0)
              return (
                <tr key={r.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <td style={S.td}>{r.godina}</td>
                  <td style={S.td}>{MJ[r.mjesec]}</td>
                  <td style={S.td}><span style={{ background:C.teal+'22', color:C.teal, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600 }}>{r.kategorija}</span></td>
                  <td style={{ ...S.td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.opis||'—'}</td>
                  <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.iznos_plan)}</td>
                  <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.iznos_stvarni)}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:raz>=0?C.green:C.red }}>{raz>=0?'+':''}{EUR(raz)}</td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{ setForm({...r}); setModal('edit') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Edit2 size={13}/></button>
                      <button onClick={()=>del(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.red} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal==='new'?'NOVI BUDŽET':'UREDI BUDŽET'} onClose={()=>setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Godina"><Inp type="number" value={form.godina} onChange={v=>F('godina',+v)}/></Field>
            <Field label="Mjesec"><Sel value={form.mjesec} onChange={v=>F('mjesec',+v)} options={MJ.slice(1).map((m,i)=>({value:i+1,label:m}))}/></Field>
          </div>
          <Field label="Kategorija"><Sel value={form.kategorija} onChange={v=>F('kategorija',v)} options={BKAT}/></Field>
          <Field label="Opis"><Inp value={form.opis} onChange={v=>F('opis',v)}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Plan (€)"><Inp type="number" value={form.iznos_plan} onChange={v=>F('iznos_plan',+v)}/></Field>
            <Field label="Stvarni (€)"><Inp type="number" value={form.iznos_stvarni} onChange={v=>F('iznos_stvarni',+v)}/></Field>
          </div>
          <Field label="Napomena"><Inp value={form.napomena} onChange={v=>F('napomena',v)}/></Field>
          <SaveRow onSave={save} onClose={()=>setModal(null)} loading={saving}/>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: TROŠKOVI STROJA/SAT
// ════════════════════════════════════════════════════════════════════════════
function TabStrojni() {
  const [rows, setRows] = useState([])
  const [machines, setMachines] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async()=>{ const [r,m]=await Promise.all([api.get('/kontroling/strojni-troskovi'),api.get('/machines')]); setRows(r.data); setMachines(m.data) },[])
  useEffect(()=>{ load() },[load])

  const ukupno = f => (+f.am||0)+(+f.el||0)+(+f.od||0)+(+f.os||0)
  const save = async()=>{
    setSaving(true)
    const p={ machine_id:form.machine_id, 'trošak_amortizacija':+form.am||0, 'trošak_struja':+form.el||0, 'trošak_odrzavanje':+form.od||0, 'trošak_ostalo':+form.os||0, vrijedi_od:form.vrijedi_od, napomena:form.napomena }
    if(modal==='new') await api.post('/kontroling/strojni-troskovi',p)
    else await api.put(`/kontroling/strojni-troskovi/${form.id}`,p)
    setSaving(false); setModal(null); load()
  }
  const del = async id=>{ if(confirm('Obrisati?')){ await api.delete(`/kontroling/strojni-troskovi/${id}`); load() } }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={()=>exportCSV(rows.map(r=>[r.stroj_naziv,r.trosak_amortizacija,r.trosak_struja,r.trosak_odrzavanje,r.trosak_ostalo,r.trosak_ukupno_sat,r.vrijedi_od]),['Stroj','Amort','Struja','Odrzav','Ostalo','Ukupno/h','Od'],'strojni.csv')} style={S.ghost}><Download size={13}/> CSV</button>
        <button onClick={()=>{ setForm({vrijedi_od:new Date().toISOString().slice(0,10)}); setModal('new') }} style={{ ...S.btn(), marginLeft:'auto' }}><Plus size={14}/> Dodaj</button>
      </div>
      <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:C.surface2 }}>
            <tr>{['Stroj','Amortizacija','Struja','Održavanje','Ostalo','Ukupno/sat','Vrijedi od',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:32, color:C.muted }}>Nema podataka</td></tr>}
            {rows.map(r=>(
              <tr key={r.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, fontWeight:600, color:'#E8F2F0' }}>{r.stroj_naziv||'—'}</td>
                <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.trosak_amortizacija)}</td>
                <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.trosak_struja)}</td>
                <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.trosak_odrzavanje)}</td>
                <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.trosak_ostalo)}</td>
                <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:C.teal }}>{EUR(r.trosak_ukupno_sat)}/h</td>
                <td style={{ ...S.td, fontSize:11, color:C.muted }}>{r.vrijedi_od}</td>
                <td style={S.td}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>{ setForm({...r,am:r.trosak_amortizacija,el:r.trosak_struja,od:r.trosak_odrzavanje,os:r.trosak_ostalo}); setModal('edit') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Edit2 size={13}/></button>
                    <button onClick={()=>del(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.red} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal==='new'?'NOVI TROŠAK STROJA/SAT':'UREDI TROŠAK'} onClose={()=>setModal(null)}>
          <Field label="Stroj"><Sel value={form.machine_id} onChange={v=>F('machine_id',+v)} options={machines.map(m=>({value:m.id,label:m.name}))}/></Field>
          <Field label="Vrijedi od"><Inp type="date" value={form.vrijedi_od} onChange={v=>F('vrijedi_od',v)}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Amortizacija (€/h)"><Inp type="number" value={form.am} onChange={v=>F('am',v)}/></Field>
            <Field label="Struja (€/h)"><Inp type="number" value={form.el} onChange={v=>F('el',v)}/></Field>
            <Field label="Održavanje (€/h)"><Inp type="number" value={form.od} onChange={v=>F('od',v)}/></Field>
            <Field label="Ostalo (€/h)"><Inp type="number" value={form.os} onChange={v=>F('os',v)}/></Field>
          </div>
          <div style={{ background:C.surface3, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, color:C.muted }}>UKUPNO</span>
            <span style={{ fontSize:18, fontWeight:700, color:C.accent, fontFamily:"'Chakra Petch',sans-serif" }}>{EUR(ukupno(form))}/h</span>
          </div>
          <Field label="Napomena"><Inp value={form.napomena} onChange={v=>F('napomena',v)}/></Field>
          <SaveRow onSave={save} onClose={()=>setModal(null)} loading={saving}/>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: TROŠKOVI NALOGA
// ════════════════════════════════════════════════════════════════════════════
function TabNalog() {
  const [rows, setRows] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState({})
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async()=>{ const [r,w]=await Promise.all([api.get('/kontroling/nalog-troskovi'),api.get('/work-orders')]); setRows(r.data); setWorkOrders(w.data) },[])
  useEffect(()=>{ load() },[load])

  const save = async()=>{
    setSaving(true)
    const p={...form,kolicina:+form.kolicina||1,jedinicna_cijena:+form.jedinicna_cijena||0}
    if(modal==='new') await api.post('/kontroling/nalog-troskovi',p)
    else await api.put(`/kontroling/nalog-troskovi/${form.id}`,p)
    setSaving(false); setModal(null); load()
  }
  const del = async id=>{ if(confirm('Obrisati?')){ await api.delete(`/kontroling/nalog-troskovi/${id}`); load() } }

  const filtered = rows.filter(r=>!search||(r.nalog_broj||'').toLowerCase().includes(search.toLowerCase())||(r.part_name||'').toLowerCase().includes(search.toLowerCase()))

  // Group by work order
  const groups = {}
  filtered.forEach(r=>{ const k=r.nalog_broj||r.work_order_id; if(!groups[k]) groups[k]={nalog:r.nalog_broj,part:r.part_name,items:[],total:0}; groups[k].items.push(r); groups[k].total+=r.ukupno||0 })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <input placeholder="Pretraži nalog, dio..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, width:220, padding:'7px 12px' }}/>
        <button onClick={()=>exportCSV(filtered.map(r=>[r.nalog_broj,r.part_name,r.kategorija,r.opis,r.kolicina,r.jedinicna_cijena,r.ukupno]),['Nalog','Dio','Kat','Opis','Kol','JedCij','Ukupno'],'nalog_troskovi.csv')} style={S.ghost}><Download size={13}/> CSV</button>
        <button onClick={()=>{ setForm({kolicina:1,jedinicna_cijena:0}); setModal('new') }} style={{ ...S.btn(), marginLeft:'auto' }}><Plus size={14}/> Dodaj</button>
      </div>
      {Object.values(groups).length===0 && <div style={{ ...S.card, textAlign:'center', padding:40, color:C.muted }}>Nema podataka</div>}
      {Object.values(groups).map(g=>(
        <div key={g.nalog} style={{ ...S.card, padding:0, overflow:'hidden' }}>
          <div onClick={()=>setOpen(o=>({...o,[g.nalog]:!o[g.nalog]}))}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer', background:C.surface2+'66', borderBottom:`1px solid ${C.border}44` }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <FileText size={14} color={C.accent}/>
              <span style={{ fontWeight:700, color:'#E8F2F0', fontSize:13 }}>{g.nalog}</span>
              <span style={{ color:C.muted, fontSize:12 }}>{g.part}</span>
              <span style={{ fontSize:10, color:C.muted2 }}>{g.items.length} stavki</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontWeight:700, color:C.teal, fontFamily:"'Chakra Petch',sans-serif" }}>{EUR(g.total)}</span>
              {open[g.nalog]?<ChevronUp size={14} color={C.muted}/>:<ChevronDown size={14} color={C.muted}/>}
            </div>
          </div>
          {open[g.nalog] && (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:C.surface3+'44' }}>
                <tr>{['Kategorija','Opis','Kol','Jed. cijena','Ukupno',''].map(h=><th key={h} style={{ ...S.th, fontSize:9 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {g.items.map(r=>(
                  <tr key={r.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'44'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <td style={S.td}><span style={{ background:C.surface3, color:C.muted, borderRadius:4, padding:'1px 7px', fontSize:11 }}>{r.kategorija}</span></td>
                    <td style={S.td}>{r.opis||'—'}</td>
                    <td style={S.td}>{r.kolicina}</td>
                    <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.jedinicna_cijena)}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'#E8F2F0' }}>{EUR(r.ukupno)}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>{ setForm(r); setModal('edit') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Edit2 size={12}/></button>
                        <button onClick={()=>del(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.red} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {modal && (
        <Modal title={modal==='new'?'NOVI TROŠAK NALOGA':'UREDI TROŠAK'} onClose={()=>setModal(null)}>
          <Field label="Radni nalog"><Sel value={form.work_order_id} onChange={v=>F('work_order_id',+v)} options={workOrders.map(w=>({value:w.id,label:`${w.work_order_id} — ${w.part_name}`}))}/></Field>
          <Field label="Kategorija"><Sel value={form.kategorija} onChange={v=>F('kategorija',v)} options={NKAT}/></Field>
          <Field label="Opis"><Inp value={form.opis} onChange={v=>F('opis',v)}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Količina"><Inp type="number" value={form.kolicina} onChange={v=>F('kolicina',v)}/></Field>
            <Field label="Jed. cijena (€)"><Inp type="number" value={form.jedinicna_cijena} onChange={v=>F('jedinicna_cijena',v)}/></Field>
          </div>
          <div style={{ background:C.surface3, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:C.muted }}>UKUPNO</span>
            <span style={{ fontSize:16, fontWeight:700, color:C.accent, fontFamily:"'Chakra Petch',sans-serif" }}>{EUR((+form.kolicina||1)*(+form.jedinicna_cijena||0))}</span>
          </div>
          <Field label="Napomena"><Inp value={form.napomena} onChange={v=>F('napomena',v)}/></Field>
          <SaveRow onSave={save} onClose={()=>setModal(null)} loading={saving}/>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: PROFITABILNOST
// ════════════════════════════════════════════════════════════════════════════
function TabProfit({ godina }) {
  const [rows, setRows] = useState([])
  const [partners, setPartners] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async()=>{ const [r,p]=await Promise.all([api.get('/kontroling/profitabilnost'),api.get('/sales/partners')]); setRows(r.data); setPartners(p.data) },[])
  useEffect(()=>{ load() },[load])

  const total = f => (+f.mat||0)+(+f.rad||0)+(+f.rez||0)
  const dobit = f => (+f.prihod||0)-total(f)
  const save = async()=>{
    setSaving(true)
    const p={partner_id:form.partner_id||null,proizvod:form.proizvod,period_god:+form.period_god,period_mj:+form.period_mj,prihod:+form.prihod||0,'trošak_materijal':+form.mat||0,'trošak_rad':+form.rad||0,'trošak_rezija':+form.rez||0,napomena:form.napomena}
    if(modal==='new') await api.post('/kontroling/profitabilnost',p)
    else await api.put(`/kontroling/profitabilnost/${form.id}`,p)
    setSaving(false); setModal(null); load()
  }
  const del = async id=>{ if(confirm('Obrisati?')){ await api.delete(`/kontroling/profitabilnost/${id}`); load() } }
  const filtered = rows.filter(r=>!search||(r.proizvod||'').toLowerCase().includes(search.toLowerCase())||(r.partner_naziv||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder="Pretraži proizvod, partner..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, width:240, padding:'7px 12px' }}/>
        <button onClick={()=>exportCSV(filtered.map(r=>[r.proizvod,r.partner_naziv||'—',`${r.period_god}/${MJ[r.period_mj]}`,r.prihod,r.ukupni_trosak,r.bruto_dobit,r.marza_posto?.toFixed(1)]),['Proizvod','Partner','Period','Prihod','Troš.','Dobit','Marža%'],'profitabilnost.csv')} style={S.ghost}><Download size={13}/> CSV</button>
        <button onClick={()=>{ setForm({period_god:godina,period_mj:new Date().getMonth()+1,prihod:0,mat:0,rad:0,rez:0}); setModal('new') }} style={{ ...S.btn(), marginLeft:'auto' }}><Plus size={14}/> Dodaj</button>
      </div>
      <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:C.surface2 }}>
            <tr>{['Proizvod','Partner','Period','Prihod','Ukupni troš.','Bruto dobit','Marža',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={8} style={{ ...S.td, textAlign:'center', padding:32, color:C.muted }}>Nema podataka</td></tr>}
            {filtered.map(r=>{
              const mc = r.marza_posto>=20?C.green:r.marza_posto>=10?C.orange:C.red
              return (
                <tr key={r.id} onMouseOver={e=>e.currentTarget.style.background=C.surface2+'88'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...S.td, fontWeight:600, color:'#E8F2F0' }}>{r.proizvod}</td>
                  <td style={{ ...S.td, fontSize:11, color:C.muted }}>{r.partner_naziv||'—'}</td>
                  <td style={{ ...S.td, fontSize:11 }}>{r.period_god}/{MJ[r.period_mj]}</td>
                  <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.prihod)}</td>
                  <td style={{ ...S.td, fontFamily:'monospace' }}>{EUR(r.ukupni_trosak)}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:r.bruto_dobit>=0?C.green:C.red }}>{EUR(r.bruto_dobit)}</td>
                  <td style={S.td}><span style={{ background:mc+'22', color:mc, borderRadius:20, padding:'2px 9px', fontSize:11, fontWeight:700 }}>{PCT(r.marza_posto)}</span></td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{ setForm({...r,mat:r.trosak_materijal,rad:r.trosak_rad,rez:r.trosak_rezija}); setModal('edit') }} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Edit2 size={13}/></button>
                      <button onClick={()=>del(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }} onMouseOver={e=>e.currentTarget.style.color=C.red} onMouseOut={e=>e.currentTarget.style.color=C.muted}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal==='new'?'NOVI UNOS PROFITABILNOSTI':'UREDI UNOS'} onClose={()=>setModal(null)}>
          <Field label="Proizvod / naziv dijela"><Inp value={form.proizvod} onChange={v=>F('proizvod',v)} placeholder="npr. Nosač osi X"/></Field>
          <Field label="Partner / kupac"><Sel value={form.partner_id} onChange={v=>F('partner_id',+v)} options={[{value:'',label:'— bez partnera —'},...partners.map(p=>({value:p.id,label:p.name}))]}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Godina"><Inp type="number" value={form.period_god} onChange={v=>F('period_god',v)}/></Field>
            <Field label="Mjesec"><Sel value={form.period_mj} onChange={v=>F('period_mj',+v)} options={MJ.slice(1).map((m,i)=>({value:i+1,label:m}))}/></Field>
          </div>
          <Field label="Prihod (€)"><Inp type="number" value={form.prihod} onChange={v=>F('prihod',v)}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <Field label="Materijal (€)"><Inp type="number" value={form.mat} onChange={v=>F('mat',v)}/></Field>
            <Field label="Rad (€)"><Inp type="number" value={form.rad} onChange={v=>F('rad',v)}/></Field>
            <Field label="Režija (€)"><Inp type="number" value={form.rez} onChange={v=>F('rez',v)}/></Field>
          </div>
          <div style={{ background:C.surface3, borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between' }}>
            <div><span style={{ fontSize:10, color:C.muted }}>UKUPNI TROŠAK</span><div style={{ fontSize:15, fontWeight:700, color:C.red, fontFamily:"'Chakra Petch',sans-serif" }}>{EUR(total(form))}</div></div>
            <div style={{ textAlign:'right' }}><span style={{ fontSize:10, color:C.muted }}>DOBIT</span><div style={{ fontSize:15, fontWeight:700, color:dobit(form)>=0?C.green:C.red, fontFamily:"'Chakra Petch',sans-serif" }}>{EUR(dobit(form))}</div></div>
          </div>
          <Field label="Napomena"><Inp value={form.napomena} onChange={v=>F('napomena',v)}/></Field>
          <SaveRow onSave={save} onClose={()=>setModal(null)} loading={saving}/>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function KontrolingPage() {
  const [tab,    setTab]    = useState('pregled')
  const [godina, setGodina] = useState(new Date().getFullYear())
  const [toast,  showToast] = useToast()

  const TABS = [
    { id:'pregled',  label:'PREGLED'        },
    { id:'budzet',   label:'BUDŽET'         },
    { id:'strojni',  label:'TROŠ. STROJA/h' },
    { id:'nalog',    label:'TROŠ. NALOGA'   },
    { id:'profit',   label:'PROFITABILNOST' },
  ]

  return (
    <div style={{ fontFamily:"'Chakra Petch',sans-serif", color:C.gray }}>
      {toast.visible && <div style={{ position:'fixed', top:20, right:20, background:toast.type==='error'?C.red:C.green, color:'#fff', padding:'12px 20px', borderRadius:10, zIndex:9999, fontWeight:700 }}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:2, marginBottom:4 }}>DEER MES v6</div>
          <h1 style={{ margin:0, fontSize:22, color:C.accent, letterSpacing:2 }}>💰 KONTROLING</h1>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Troškovi · Budžet · Profitabilnost · Strojni sat</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:C.muted }}>GODINA</span>
          <select value={godina} onChange={e=>setGodina(+e.target.value)}
            style={{ ...S.input, width:'auto', padding:'7px 12px', fontFamily:"'Chakra Petch',sans-serif" }}>
            {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:C.surface2, borderRadius:10, padding:4, marginBottom:20, width:'fit-content', flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background: tab===t.id ? `linear-gradient(145deg,${C.surface3},${C.surface})` : 'transparent',
            border: tab===t.id ? `1px solid ${C.border}` : '1px solid transparent',
            borderRadius:8, padding:'7px 14px', cursor:'pointer',
            color: tab===t.id ? C.accent : C.muted,
            fontSize:11, fontWeight:700, letterSpacing:0.8,
            fontFamily:"'Chakra Petch',sans-serif",
            transition:'all .15s',
            boxShadow: tab===t.id ? '0 2px 8px rgba(0,0,0,.25)' : 'none'
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab==='pregled' && <TabPregled godina={godina}/>}
      {tab==='budzet'  && <TabBudzet  godina={godina}/>}
      {tab==='strojni' && <TabStrojni/>}
      {tab==='nalog'   && <TabNalog/>}
      {tab==='profit'  && <TabProfit  godina={godina}/>}
    </div>
  )
}
