import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { C,StatCard,Badge,StatusBadge,QtyBar,Btn,Modal,Field,Inp,Sel,FGrid,SearchBar,FSel,TblWrap,TR,TD,RowActions,Toast,useToast,HistoryModal,QtyAdjModal,Loading,EmptyState,SectionTitle } from '../components/UI'
import AdvancedFilter from '../components/AdvancedFilter'
import ExcelBar from '../components/ExcelBar'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { mapToolToExcel } from '../utils/excel'

// ─── Constants ──────────────────────────────────────────────────────────────
const CATS = ['Glodalo','Svrdlo','Stega','Brusna ploča','Tokarenje','Mjerilo','Bušilica','Rezač','Ostalo']
const PURS = ['Gruba obrada','Fina obrada','Bušenje','Glodanje','Brušenje','Kontrola','Prihvat','Tokarenje','Rezanje']
const UNITS = ['kom','par','set','m','kg']
const CAT_ICON = { 'Glodalo':'⚙','Svrdlo':'⬡','Stega':'⬢','Brusna ploča':'◉','Tokarenje':'◈','Mjerilo':'≡','Bušilica':'⬛','Rezač':'◆' }
const CAT_COLOR = { 'Glodalo':'#51FFFF','Svrdlo':'#F5BC54','Stega':'#60A5FA','Brusna ploča':'#FB923C','Tokarenje':'#4ADE80','Mjerilo':'#C8DDD9','Bušilica':'#F87171','Rezač':'#51FFFF' }

const EMPTY = {
  internalId:'', name:'', category:'', purpose:'', dimensions:'', connectionType:'',
  storageLocation:'', currentQuantity:0, minQuantity:1, minOrderQuantity:1,
  projectedLifespanDays:'', unitPrice:'', supplier:'', supplierContact:'',
  machineApplicability:'', notes:'', unit:'kom',
  requiresCalibration:false, calibrationIntervalDays:'', serviceIntervalDays:''
}
const EMPTY_FILTER = { category:'', status:'', qtyMin:'', qtyMax:'', location:'', supplier:'' }

// ─── Helpers ────────────────────────────────────────────────────────────────
const ago = (d) => { const diff=Math.round((Date.now()-new Date(d))/60000); return diff<1?'upravo':diff<60?diff+'m':diff<1440?Math.round(diff/60)+'h':Math.round(diff/1440)+'d' }
const rokColor = (d) => !d?'#5A8480':d<20?'#F87171':d<45?'#FB923C':'#5A8480'
const calibColor = (d) => {
  if (!d) return '#F87171'
  const days = Math.round((new Date(d) - new Date()) / 86400000)
  return days < 0 ? '#F87171' : days < 7 ? '#FB923C' : days < 30 ? '#F5BC54' : '#4ADE80'
}
const calibDays = (d) => {
  if (!d) return 'Nije zakazana'
  const days = Math.round((new Date(d) - new Date()) / 86400000)
  if (days < 0) return `Kasni ${Math.abs(days)} d`
  if (days === 0) return 'Danas'
  return `Za ${days} d`
}

// ─── QR Code generator (uses canvas, no lib needed) ─────────────────────────
function generateQRDataURL(text) {
  // Simple QR-like visual using canvas - for real QR use qrcode lib after npm install
  return new Promise((resolve) => {
    try {
      const QRCode = window.QRCode
      if (QRCode) {
        const canvas = document.createElement('canvas')
        QRCode.toCanvas(canvas, text, { width: 200 }, (err) => {
          resolve(err ? null : canvas.toDataURL())
        })
        return
      }
    } catch(e) {}
    // Fallback: canvas barcode-style visual
    const canvas = document.createElement('canvas')
    canvas.width = 200; canvas.height = 200
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,200)
    ctx.fillStyle = '#000'
    // Draw simple pattern based on text hash
    let hash = 0
    for (let i=0; i<text.length; i++) hash = ((hash<<5)-hash)+text.charCodeAt(i)
    const size = 10
    for (let r=0; r<20; r++) {
      for (let c=0; c<20; c++) {
        if ((hash ^ (r*17+c*13)) & 1) ctx.fillRect(c*size, r*size, size, size)
      }
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(2,2,196,196)
    resolve(canvas.toDataURL())
  })
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function exportToolsPDF(tools, stats) {
  try {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation:'landscape', unit:'mm' })
    
    // Header
    doc.setFillColor(36, 51, 48)
    doc.rect(0, 0, 297, 25, 'F')
    doc.setTextColor(245, 188, 84)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('DEER MES — Alatnica', 14, 16)
    doc.setTextColor(200, 221, 217)
    doc.setFontSize(9)
    doc.text(`Izvoz: ${new Date().toLocaleString('hr-HR')}`, 220, 16)
    
    // Stats row
    doc.setTextColor(36, 51, 48)
    doc.setFillColor(245, 188, 84)
    doc.roundedRect(14, 30, 55, 14, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica','bold')
    doc.text(`Ukupno: ${stats.total}`, 16, 38)
    doc.text(`Dostupni: ${stats.available}  Niske zalihe: ${stats.low}  Kritično: ${stats.critical}`, 16, 43)
    
    doc.setTextColor(36, 51, 48)
    autoTable(doc, {
      startY: 50,
      head: [['Naziv alata','ID','Kategorija','Namjena','Dimenzije','Lokacija','Kol.','Min.','Status','Dobavljač','Cijena','Rok (d)']],
      body: tools.map(t => [
        t.name, t.internal_id||'—', t.category||'—', t.purpose||'—', t.dimensions||'—',
        t.storage_location||'—', t.current_quantity, t.min_quantity,
        t.status, t.supplier||'—',
        t.unit_price ? parseFloat(t.unit_price).toFixed(2)+'€' : '—',
        t.projected_lifespan_days||'—'
      ]),
      headStyles: { fillColor: [36,51,48], textColor: [245,188,84], fontStyle:'bold', fontSize:7 },
      bodyStyles: { fontSize:7 },
      alternateRowStyles: { fillColor: [240,248,245] },
      columnStyles: { 6:{halign:'center'}, 7:{halign:'center'}, 8:{halign:'center'} },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          if (data.cell.raw === 'Kritično') data.cell.styles.textColor = [248, 113, 113]
          else if (data.cell.raw === 'Niske zalihe') data.cell.styles.textColor = [251, 146, 60]
          else data.cell.styles.textColor = [74, 222, 128]
        }
      }
    })
    
    doc.save(`deer_alatnica_${new Date().toISOString().slice(0,10)}.pdf`)
    return true
  } catch(e) {
    // Fallback: CSV download
    const csv = [
      ['Naziv','ID','Kategorija','Namjena','Dimenzije','Lokacija','Kol.','Min.','Status','Dobavljač','Cijena'],
      ...tools.map(t => [t.name,t.internal_id,t.category,t.purpose,t.dimensions,t.storage_location,t.current_quantity,t.min_quantity,t.status,t.supplier,t.unit_price])
    ].map(r => r.map(v => `"${v||''}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `deer_alatnica_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    return true
  }
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display:'flex', gap:4, marginBottom:22, borderBottom:`1px solid #4A6B6844` }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)} style={{
          background: active===t.key ? '#F5BC54' : 'transparent',
          color: active===t.key ? '#1a2a28' : '#7AA8A4',
          border: 'none', borderRadius:'8px 8px 0 0', padding:'8px 18px',
          fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:1.2,
          fontFamily:"'Chakra Petch',sans-serif", textTransform:'uppercase',
          borderBottom: active===t.key ? '2px solid #F5BC54' : '2px solid transparent',
          transition:'all .2s', position:'relative'
        }}>
          {t.icon} {t.label}
          {t.badge > 0 && <span style={{ position:'absolute', top:2, right:2, background:'#F87171', color:'#fff', borderRadius:'50%', width:14, height:14, fontSize:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

// ─── Photo upload component ───────────────────────────────────────────────────
function PhotoUpload({ currentUrl, onUpload, toolId }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          // Try multipart upload first
          const formData = new FormData()
          formData.append('photo', file)
          const r = await fetch('/api/uploads/tool-photo', {
            method:'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('deer_token')}` },
            body: formData
          })
          const data = await r.json()
          if (data.url) { onUpload(data.url); return }
        } catch(e) {}
        // Fallback: base64
        try {
          const r = await fetch('/api/uploads/tool-photo', {
            method:'POST',
            headers: { 'Content-Type':'application/json', Authorization: `Bearer ${localStorage.getItem('deer_token')}` },
            body: JSON.stringify({ base64: e.target.result, filename: file.name })
          })
          const data = await r.json()
          if (data.url) onUpload(data.url)
        } catch(err) {
          // Store as data URL locally
          onUpload(e.target.result)
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch(e) { setUploading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      {currentUrl ? (
        <div style={{ position:'relative' }}>
          <img src={currentUrl} alt="Alat" style={{ width:120, height:120, objectFit:'cover', borderRadius:10, border:`2px solid #4A6B68` }}/>
          <button onClick={() => onUpload('')} style={{ position:'absolute', top:-6, right:-6, background:'#F87171', border:'none', borderRadius:'50%', width:20, height:20, color:'#fff', cursor:'pointer', fontSize:10 }}>✕</button>
        </div>
      ) : (
        <div onClick={() => fileRef.current?.click()} style={{ width:120, height:120, borderRadius:10, border:`2px dashed #4A6B68`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'#243330', gap:6 }}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='#F5BC54'}}
          onDragLeave={e=>{e.currentTarget.style.borderColor='#4A6B68'}}
          onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0])}}>
          <span style={{ fontSize:28, opacity:.4 }}>📷</span>
          <span style={{ fontSize:9, color:'#5A8480', textAlign:'center' }}>{uploading ? 'Učitava...' : 'Dodaj foto'}</span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])}/>
      {!currentUrl && <button onClick={() => fileRef.current?.click()} style={{ fontSize:10, color:'#7AA8A4', background:'transparent', border:`1px solid #4A6B68`, borderRadius:4, padding:'3px 10px', cursor:'pointer' }}>
        {uploading ? '📤 Učitava...' : '📷 Odaberi / Snimi'}
      </button>}
    </div>
  )
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({ open, onClose, tool }) {
  const [qrUrl, setQrUrl] = useState('')
  const canvasRef = useRef()

  useEffect(() => {
    if (open && tool) {
      const qrText = `DEER-TOOL:${tool.id}|${tool.internal_id||''}|${tool.name}`
      generateQRDataURL(qrText).then(url => setQrUrl(url))
    }
  }, [open, tool])

  if (!open || !tool) return null
  const catColor = CAT_COLOR[tool.category] || '#51FFFF'

  const print = () => {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>QR — ${tool.name}</title>
      <style>body{font-family:monospace;text-align:center;padding:20px;background:#fff}
      .card{border:2px solid #000;border-radius:8px;padding:16px;display:inline-block;max-width:220px}
      h2{font-size:14px;margin:0 0 8px}p{font-size:10px;color:#555;margin:2px 0}</style>
      </head><body>
      <div class="card">
        <h2>${tool.name}</h2>
        ${qrUrl ? `<img src="${qrUrl}" style="width:180px;height:180px"/>` : ''}
        <p>ID: ${tool.internal_id||'—'}</p>
        <p>Kat: ${tool.category||'—'} · ${tool.dimensions||'—'}</p>
        <p>Lok: ${tool.storage_location||'—'}</p>
        <p style="font-size:8px;margin-top:8px;color:#999">DEER MES · ${new Date().toLocaleDateString('hr')}</p>
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <Modal open={open} onClose={onClose} title={`QR Naljepnica — ${tool.name}`} width={360}>
      <div style={{ textAlign:'center' }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, display:'inline-block', marginBottom:16, boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          {qrUrl ? <img src={qrUrl} style={{ width:180, height:180, display:'block' }}/> : <div style={{ width:180, height:180, background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center' }}>⟳</div>}
        </div>
        <div style={{ background:'#fff', borderRadius:8, padding:'10px 16px', marginBottom:14, fontSize:11, color:'#243330', fontFamily:'monospace', lineHeight:1.8 }}>
          <div style={{ fontWeight:700, fontSize:13 }}>{tool.name}</div>
          <div>ID: {tool.internal_id||'—'}</div>
          <div>Kat: {tool.category} · {tool.dimensions||'—'}</div>
          <div>Lok: {tool.storage_location||'—'}</div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          <Btn onClick={print}>🖨️ Ispis naljepnice</Btn>
          {qrUrl && <Btn v="secondary" onClick={() => { const a=document.createElement('a'); a.href=qrUrl; a.download=`qr_${tool.internal_id||tool.id}.png`; a.click() }}>⬇ Preuzmi PNG</Btn>}
        </div>
      </div>
    </Modal>
  )
}

// ─── Calibration modal ───────────────────────────────────────────────────────
function CalibrationModal({ open, onClose, tool, onSave }) {
  const [form, setForm] = useState({ calibration_date: new Date().toISOString().slice(0,10), next_date:'', performed_by:'', result:'passed', notes:'', certificate_ref:'' })
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    if (open && tool) {
      api.get(`/tools/${tool.id}/calibration`).then(r => setHistory(r.data)).catch(()=>{})
    }
  }, [open, tool])

  const save = async () => {
    setSaving(true)
    try { await onSave(form); onClose() }
    catch(e) {}
    finally { setSaving(false) }
  }

  if (!open || !tool) return null
  return (
    <Modal open={open} onClose={onClose} title={`Kalibracija — ${tool.name}`} width={540}>
      <SectionTitle>Nova kalibracija</SectionTitle>
      <FGrid>
        <Field label="Datum kalibracije" req><Inp type="date" value={form.calibration_date} onChange={e=>f('calibration_date',e.target.value)}/></Field>
        <Field label="Sljedeća kalibracija"><Inp type="date" value={form.next_date} onChange={e=>f('next_date',e.target.value)}/></Field>
        <Field label="Tko je kalibrirao"><Inp placeholder="Ime, tvrtka..." value={form.performed_by} onChange={e=>f('performed_by',e.target.value)}/></Field>
        <Field label="Rezultat">
          <Sel value={form.result} onChange={e=>f('result',e.target.value)}>
            <option value="passed">✓ Prošlo</option>
            <option value="adjusted">~ Podešeno</option>
            <option value="failed">✗ Nije prošlo</option>
          </Sel>
        </Field>
        <Field label="Broj certifikata"><Inp placeholder="CAL-2024-001" value={form.certificate_ref} onChange={e=>f('certificate_ref',e.target.value)}/></Field>
        <Field label="Napomena"><Inp placeholder="Opcijsko..." value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
      </FGrid>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
        <Btn v="secondary" onClick={onClose}>Odustani</Btn>
        <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'📋 Spremi kalibraciju'}</Btn>
      </div>
      {history.length > 0 && <>
        <SectionTitle style={{ marginTop:20 }}>Historija kalibracija</SectionTitle>
        <div style={{ maxHeight:180, overflowY:'auto' }}>
          {history.map((h,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:`1px solid #4A6B6822`, fontSize:11 }}>
              <span style={{ color:h.result==='passed'?'#4ADE80':h.result==='adjusted'?'#F5BC54':'#F87171', fontWeight:700 }}>
                {h.result==='passed'?'✓':h.result==='adjusted'?'~':'✗'}
              </span>
              <span style={{ color:'#e8f0ee' }}>{h.calibration_date}</span>
              {h.next_date && <span style={{ color:'#7AA8A4' }}>→ {h.next_date}</span>}
              {h.performed_by && <span style={{ color:'#5A8480' }}>{h.performed_by}</span>}
              {h.certificate_ref && <span style={{ color:'#F5BC54', fontFamily:'monospace' }}>{h.certificate_ref}</span>}
            </div>
          ))}
        </div>
      </>}
    </Modal>
  )
}

// ─── Usage link modal ─────────────────────────────────────────────────────────
function UsageModal({ open, onClose, tool, onSave }) {
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState({ order_id:'', quantity_used:1, operation:'', notes:'' })
  const [usage, setUsage] = useState([])
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    if (open && tool) {
      api.get('/orders', { params:{ limit:100 } }).then(r => setOrders(r.data?.orders || r.data || [])).catch(()=>{})
      api.get(`/tools/${tool.id}/usage`).then(r => setUsage(r.data)).catch(()=>{})
    }
  }, [open, tool])

  const save = async () => {
    setSaving(true)
    try { await onSave(form); api.get(`/tools/${tool.id}/usage`).then(r=>setUsage(r.data)).catch(()=>{}); setForm({order_id:'',quantity_used:1,operation:'',notes:''}) }
    catch(e) {}
    finally { setSaving(false) }
  }

  if (!open || !tool) return null
  return (
    <Modal open={open} onClose={onClose} title={`Evidencija korištenja — ${tool.name}`} width={540}>
      <SectionTitle>Novo korištenje</SectionTitle>
      <FGrid>
        <Field label="Proizvodni nalog">
          <Sel value={form.order_id} onChange={e=>f('order_id',e.target.value)}>
            <option value="">Bez naloga (interni rad)</option>
            {orders.slice(0,50).map(o => <option key={o.id} value={o.id}>{o.order_number||o.id.slice(0,8)} — {o.product_name||o.name||''}</option>)}
          </Sel>
        </Field>
        <Field label="Količina (kom)"><Inp type="number" min="1" value={form.quantity_used} onChange={e=>f('quantity_used',parseInt(e.target.value)||1)}/></Field>
        <Field label="Operacija"><Inp placeholder="Glodanje, Bušenje..." value={form.operation} onChange={e=>f('operation',e.target.value)}/></Field>
        <Field label="Napomena"><Inp placeholder="..." value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
      </FGrid>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
        <Btn v="secondary" onClick={onClose}>Zatvori</Btn>
        <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'📝 Evidentiraj'}</Btn>
      </div>
      {usage.length > 0 && <>
        <SectionTitle style={{ marginTop:20 }}>Zadnja korištenja</SectionTitle>
        <div style={{ maxHeight:200, overflowY:'auto' }}>
          {usage.map((u,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom:`1px solid #4A6B6822`, fontSize:11 }}>
              <span style={{ color:'#F5BC54', fontWeight:600 }}>×{u.quantity_used}</span>
              {u.order_number && <span style={{ color:'#51FFFF', fontFamily:'monospace' }}>{u.order_number}</span>}
              {u.operation && <span style={{ color:'#e8f0ee' }}>{u.operation}</span>}
              <span style={{ color:'#5A8480', marginLeft:'auto' }}>{u.user_name} · {ago(u.used_at)}</span>
            </div>
          ))}
        </div>
      </>}
    </Modal>
  )
}

// ─── Email alert modal ────────────────────────────────────────────────────────
function AlertModal({ open, onClose, criticalCount }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const send = async () => {
    setSending(true)
    try {
      const r = await api.post('/tools/alert-critical', { email })
      setResult(r.data)
    } catch(e) { setResult({ sent:false, reason:e.message }) }
    finally { setSending(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="📧 Email upozorenje — kritične zalihe" width={440}>
      <div style={{ background:'#F8717115', border:'1px solid #F8717144', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
        <div style={{ color:'#F87171', fontWeight:600, fontSize:13 }}>⚠ {criticalCount} alata s kritičnim zalihama</div>
        <div style={{ color:'#5A8480', fontSize:11, marginTop:4 }}>Sustav će poslati detaljan email s popisom svih kritičnih alata.</div>
      </div>
      <Field label="Email adresa primatelja" req>
        <Inp type="email" placeholder="nabava@tvrtka.hr" value={email} onChange={e=>setEmail(e.target.value)}/>
      </Field>
      {result && (
        <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:result.sent?'#4ADE8015':'#F8717115', border:`1px solid ${result.sent?'#4ADE8044':'#F8717144'}`, fontSize:12, color:result.sent?'#4ADE80':'#F87171' }}>
          {result.sent ? '✓ Email uspješno poslan!' : `Email nije poslan: ${result.reason||'SMTP nije konfiguriran'}`}
          {!result.sent && <div style={{ color:'#5A8480', fontSize:11, marginTop:4 }}>Konfigurirajte SMTP u .env fajlu da aktivirate email notifikacije.</div>}
        </div>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
        <Btn v="secondary" onClick={onClose}>Zatvori</Btn>
        <Btn onClick={send} disabled={sending||!email}>{sending?'Šalje...':'📧 Pošalji upozorenje'}</Btn>
      </div>
    </Modal>
  )
}

// ─── Tool Detail Drawer ───────────────────────────────────────────────────────
function ToolDetail({ tool, onClose, onEdit, onQty, onQR, onCalib, onUsage, canEdit }) {
  if (!tool) return null
  const catColor = CAT_COLOR[tool.category] || '#51FFFF'
  const inf = (label, val, mono, color) => val ? (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:9, color:'#7AA8A4', letterSpacing:1.4, textTransform:'uppercase', marginBottom:2, fontFamily:"'Chakra Petch',sans-serif" }}>{label}</div>
      <div style={{ fontSize:13, color:color||'#e8f0ee', fontFamily:mono?'monospace':'inherit' }}>{val}</div>
    </div>
  ) : null
  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:380, background:'#2B3C3A', borderLeft:`1px solid #4A6B68`, zIndex:200, overflowY:'auto', boxShadow:'-8px 0 40px rgba(0,0,0,.5)' }}>
      {/* Photo + header */}
      <div style={{ position:'relative' }}>
        {tool.photo_url ? (
          <img src={tool.photo_url} alt={tool.name} style={{ width:'100%', height:160, objectFit:'cover' }}/>
        ) : (
          <div style={{ width:'100%', height:100, background:`linear-gradient(135deg, ${catColor}22, #243330)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, color:catColor }}>
            {CAT_ICON[tool.category]||'⚙'}
          </div>
        )}
        <button onClick={onClose} style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.5)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
      </div>
      <div style={{ padding:'16px 20px 8px' }}>
        <div style={{ fontWeight:700, fontSize:17, color:'#e8f0ee', lineHeight:1.3 }}>{tool.name}</div>
        <div style={{ fontSize:11, color:'#5A8480', fontFamily:'monospace', marginTop:3 }}>{tool.internal_id}</div>
        <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
          <StatusBadge status={tool.status}/>
          {tool.category && <Badge type="teal">{tool.category}</Badge>}
          {tool.requires_calibration && <Badge type="blue">📋 Kalibracija</Badge>}
        </div>
      </div>

      {/* Action buttons */}
      {canEdit && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, padding:'0 16px 16px' }}>
          <button onClick={()=>onQty(tool)} style={{ background:'#324543', border:'1px solid #4A6B68', borderRadius:8, padding:'8px 4px', color:'#C8DDD9', fontSize:10, cursor:'pointer', fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:16 }}>±</span>Korekcija
          </button>
          <button onClick={()=>onQR(tool)} style={{ background:'#324543', border:'1px solid #4A6B68', borderRadius:8, padding:'8px 4px', color:'#C8DDD9', fontSize:10, cursor:'pointer', fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:16 }}>▦</span>QR Kod
          </button>
          {tool.requires_calibration && <button onClick={()=>onCalib(tool)} style={{ background:'#324543', border:'1px solid #60A5FA66', borderRadius:8, padding:'8px 4px', color:'#60A5FA', fontSize:10, cursor:'pointer', fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:16 }}>📋</span>Kalib.
          </button>}
          <button onClick={()=>onUsage(tool)} style={{ background:'#324543', border:'1px solid #4ADE8044', borderRadius:8, padding:'8px 4px', color:'#4ADE80', fontSize:10, cursor:'pointer', fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:16 }}>📝</span>Korištenje
          </button>
          <button onClick={()=>onEdit(tool)} style={{ background:'#F5BC5422', border:'1px solid #F5BC5466', borderRadius:8, padding:'8px 4px', color:'#F5BC54', fontSize:10, cursor:'pointer', fontWeight:600, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:16 }}>✏</span>Uredi
          </button>
        </div>
      )}

      <div style={{ padding:'0 20px 20px' }}>
        {/* Stock */}
        <div style={{ background:'#324543', borderRadius:10, padding:'14px', marginBottom:14, border:`1px solid #4A6B68` }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11, color:'#7AA8A4' }}>Trenutne zalihe</span>
            <span style={{ fontSize:24, fontWeight:700, color:tool.current_quantity<tool.min_quantity?'#F87171':'#4ADE80', fontFamily:"'Chakra Petch',sans-serif" }}>{tool.current_quantity} <span style={{ fontSize:12, color:'#5A8480' }}>{tool.unit||'kom'}</span></span>
          </div>
          <QtyBar current={tool.current_quantity} min={tool.min_quantity} width="100%"/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, color:'#5A8480' }}>
            <span>Min: {tool.min_quantity} {tool.unit||'kom'}</span>
            {tool.min_order_quantity && <span>Min. narudžba: {tool.min_order_quantity}</span>}
          </div>
          {tool.unit_price && <div style={{ fontSize:12, color:'#F5BC54', marginTop:6, fontWeight:600 }}>
            {parseFloat(tool.unit_price).toFixed(2)}€/kom · Ukupno: {(parseFloat(tool.unit_price)*tool.current_quantity).toFixed(2)}€
          </div>}
        </div>

        {/* Calibration status */}
        {tool.requires_calibration && (
          <div style={{ background:'#60A5FA11', border:`1px solid #60A5FA33`, borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
            <div style={{ fontSize:10, color:'#60A5FA', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>📋 Kalibracija</div>
            <div style={{ fontSize:12, display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'#5A8480' }}>Zadnja:</span>
              <span style={{ color:'#e8f0ee' }}>{tool.last_calibration_date ? new Date(tool.last_calibration_date).toLocaleDateString('hr') : '—'}</span>
            </div>
            <div style={{ fontSize:12, display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ color:'#5A8480' }}>Sljedeća:</span>
              <span style={{ color:calibColor(tool.next_calibration_date), fontWeight:600 }}>{calibDays(tool.next_calibration_date)}</span>
            </div>
          </div>
        )}

        <SectionTitle>Detalji</SectionTitle>
        {inf('Dimenzije', tool.dimensions, true)}
        {inf('Spoj/prihvat', tool.connection_type, true)}
        {inf('Lokacija', tool.storage_location)}
        {inf('Namjena', tool.purpose)}
        {inf('Rok trajanja', tool.projected_lifespan_days ? tool.projected_lifespan_days+' dana' : null)}

        {tool.machine_applicability && <>
          <SectionTitle style={{ marginTop:12 }}>Primjena na strojevima</SectionTitle>
          <div style={{ background:'#324543', borderRadius:8, padding:'10px 14px', border:`1px solid #4A6B6844`, fontSize:12, color:'#C8DDD9', lineHeight:1.8 }}>
            {tool.machine_applicability.split(',').map((m,i) => <div key={i}>▸ {m.trim()}</div>)}
          </div>
        </>}

        {(tool.supplier || tool.supplier_contact) && <>
          <SectionTitle style={{ marginTop:12 }}>Dobavljač</SectionTitle>
          {inf('Dobavljač', tool.supplier)}
          {inf('Kontakt', tool.supplier_contact)}
        </>}

        {tool.notes && <>
          <SectionTitle style={{ marginTop:12 }}>Napomena</SectionTitle>
          <div style={{ fontSize:12, color:'#7AA8A4', lineHeight:1.6 }}>{tool.notes}</div>
        </>}

        <div style={{ marginTop:12, fontSize:9, color:'#3B5450', fontFamily:'monospace' }}>
          Kreirano: {tool.created_at ? new Date(tool.created_at).toLocaleString('hr') : '—'}<br/>
          {tool.created_by_name && 'Kreirao: '+tool.created_by_name}
        </div>
      </div>
    </div>
  )
}

function OrderStatusBadge({ status }) {
  const m = { pending:'orange', ordered:'blue', received:'green', cancelled:'gray' }
  const l = { pending:'Čeka', ordered:'Naručeno', received:'Primljeno', cancelled:'Otkazano' }
  return <Badge type={m[status]||'gray'}>{l[status]||status}</Badge>
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AlatnicaPage() {
  const { t, i18n } = useTranslation()
  const { canEdit } = useAuth()
  const [tab, setTab] = useState('tools')

  // Data
  const [tools, setTools] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [calibDue, setCalibDue] = useState([])

  // Filters
  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState('')
  const [statF, setStatF] = useState('')
  const [advFilters, setAdvFilters] = useState(EMPTY_FILTER)

  // Modals
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [detailTool, setDetailTool] = useState(null)
  const [histModal, setHistModal] = useState(null)
  const [histItems, setHistItems] = useState([])
  const [qtyModal, setQtyModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [calibModal, setCalibModal] = useState(null)
  const [usageModal, setUsageModal] = useState(null)
  const [alertModal, setAlertModal] = useState(false)
  const [orderModal, setOrderModal] = useState(false)
  const [orderForm, setOrderForm] = useState({ tool_id:'', quantity:1, supplier:'', notes:'', expected_date:'', send_email:false })
  const [orderSaving, setOrderSaving] = useState(false)

  const [toast, showToast] = useToast()

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fo = (k, v) => setOrderForm(p => ({ ...p, [k]: v }))

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const p = {}
      if (search) p.search = search
      if (catF) p.category = catF
      if (statF) p.status = statF
      const [toolsRes, statsRes] = await Promise.all([
        api.get('/tools', { params:p }),
        api.get('/tools/stats')
      ])
      setTools(toolsRes.data.tools || toolsRes.data)
      setStats(statsRes.data)
    } catch { setTools([]); setStats({}) }
    finally { setLoading(false) }
  }, [search, catF, statF])

  useEffect(() => { load() }, [load])

  const loadOrders = useCallback(async () => {
    if (tab !== 'orders') return
    setOrdersLoading(true)
    try { const r = await api.get('/tools/orders'); setOrders(r.data) }
    catch { setOrders([]) }
    finally { setOrdersLoading(false) }
  }, [tab])

  useEffect(() => { loadOrders() }, [loadOrders])

  const loadCalibDue = useCallback(async () => {
    if (tab !== 'calibration') return
    try { const r = await api.get('/tools/calibration-due'); setCalibDue(r.data) }
    catch { setCalibDue([]) }
  }, [tab])

  useEffect(() => { loadCalibDue() }, [loadCalibDue])

  // ── Tool CRUD ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditItem(null); setForm(EMPTY); setModal(true) }
  const openEdit = (tool) => {
    setDetailTool(null)
    setEditItem(tool)
    setForm({
      internalId:tool.internal_id||'', name:tool.name, category:tool.category||'',
      purpose:tool.purpose||'', dimensions:tool.dimensions||'',
      connectionType:tool.connection_type||'', storageLocation:tool.storage_location||'',
      currentQuantity:tool.current_quantity, minQuantity:tool.min_quantity,
      minOrderQuantity:tool.min_order_quantity||1, projectedLifespanDays:tool.projected_lifespan_days||'',
      unitPrice:tool.unit_price||'', supplier:tool.supplier||'', supplierContact:tool.supplier_contact||'',
      machineApplicability:tool.machine_applicability||'', notes:tool.notes||'', unit:tool.unit||'kom',
      requiresCalibration:tool.requires_calibration||false,
      calibrationIntervalDays:tool.calibration_interval_days||'',
      serviceIntervalDays:tool.service_interval_days||'',
      photoUrl:tool.photo_url||''
    })
    setModal(true)
  }
  const openHistory = async (tool) => {
    setHistModal(tool)
    try { const r = await api.get(`/tools/${tool.id}/history`); setHistItems(r.data) }
    catch { setHistItems([]) }
  }

  const save = async () => {
    if (!form.name) { showToast('Naziv je obavezan!', 'error'); return }
    setSaving(true)
    try {
      if (editItem) {
        const r = await api.put(`/tools/${editItem.id}`, form)
        setTools(tools.map(t => t.id===editItem.id ? r.data : t))
        if (detailTool?.id === editItem.id) setDetailTool(r.data)
        showToast('✓ Alat ažuriran')
      } else {
        const r = await api.post('/tools', form)
        setTools([r.data, ...tools])
        showToast('✓ Alat dodan')
      }
      setModal(false); load()
    } catch(e) { showToast(e.response?.data?.error||'Greška', 'error') }
    finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Obrisati alat?')) return
    try { await api.delete(`/tools/${id}`); setTools(tools.filter(t=>t.id!==id)); showToast('Alat obrisan'); load() }
    catch { showToast('Greška', 'error') }
  }

  const saveQty = async (change, note) => {
    try {
      const r = await api.patch(`/tools/${qtyModal.id}/quantity`, { change, note })
      setTools(tools.map(t => t.id===qtyModal.id ? r.data : t))
      if (detailTool?.id === qtyModal.id) setDetailTool(r.data)
      showToast('✓ Količina ažurirana')
    } catch { showToast('Greška', 'error') }
  }

  const saveCalibration = async (calibForm) => {
    try {
      await api.post(`/tools/${calibModal.id}/calibration`, calibForm)
      showToast('✓ Kalibracija evidentirana')
      load()
    } catch { showToast('Greška', 'error') }
  }

  const saveUsage = async (usageForm) => {
    try {
      await api.post(`/tools/${usageModal.id}/usage`, usageForm)
      showToast('✓ Korištenje evidentirano')
    } catch { showToast('Greška', 'error') }
  }

  const quickOrder = (tool) => {
    setOrderForm({ tool_id:tool.id, quantity:tool.min_order_quantity||1, supplier:tool.supplier||'', notes:'', expected_date:'', send_email:false })
    setOrderModal(true)
    setTab('orders')
  }

  const saveOrder = async () => {
    if (!orderForm.tool_id || !orderForm.quantity) { showToast('Odaberi alat i količinu', 'error'); return }
    setOrderSaving(true)
    try {
      await api.post('/tools/orders', orderForm)
      showToast('✓ Narudžba kreirana')
      setOrderModal(false); loadOrders()
    } catch(e) { showToast(e.response?.data?.error||'Greška', 'error') }
    finally { setOrderSaving(false) }
  }

  const updateOrderStatus = async (id, status) => {
    try {
      await api.patch(`/tools/orders/${id}`, { status })
      setOrders(orders.map(o => o.id===id ? {...o, status} : o))
      if (status === 'received') { showToast('✓ Primljeno — zalihe ažurirane'); load() }
      else showToast('✓ Status ažuriran')
    } catch { showToast('Greška', 'error') }
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const filtered = tools.filter(t => {
    if (advFilters.qtyMin && t.current_quantity < parseInt(advFilters.qtyMin)) return false
    if (advFilters.qtyMax && t.current_quantity > parseInt(advFilters.qtyMax)) return false
    if (advFilters.location && !t.storage_location?.toLowerCase().includes(advFilters.location.toLowerCase())) return false
    if (advFilters.supplier && !t.supplier?.toLowerCase().includes(advFilters.supplier.toLowerCase())) return false
    return true
  })

  const totalValue = tools.reduce((s,t) => s + parseFloat(t.unit_price||0)*t.current_quantity, 0)
  const calibDueCount = tools.filter(t => t.requires_calibration && (!t.next_calibration_date || new Date(t.next_calibration_date) <= new Date(Date.now() + 7*86400000))).length
  const openOrdersCount = orders.filter(o => o.status==='pending'||o.status==='ordered').length

  return (
    <div style={{ position:'relative' }}>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:20 }}>
        <StatCard label="Ukupno alata" value={stats.total} color="yellow"/>
        <StatCard label="Dostupni" value={stats.available} sub={Math.round((stats.available/Math.max(stats.total,1))*100)+'%'} color="green"/>
        <StatCard label="Niske zalihe" value={stats.low} color="orange"/>
        <StatCard label="Kritično" value={stats.critical} sub="Naruči odmah" color="red" onClick={()=>setStatF('Kritično')}/>
        <StatCard label="Vrijednost zaliha" value={totalValue>0?totalValue.toFixed(0)+'€':'—'} color="teal"/>
        <StatCard label="Narudžbe/Kalib." value={(parseInt(stats.open_orders)||0)+'/'+(parseInt(stats.calib_due)||0)} sub="otvoreno/uskoro" color="blue"/>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <TabBar
        tabs={[
          { key:'tools', label:'Alati', icon:'⚙' },
          { key:'orders', label:'Narudžbe', icon:'📦', badge: parseInt(stats.open_orders)||0 },
          { key:'calibration', label:'Kalibracija', icon:'📋', badge: parseInt(stats.calib_due)||0 },
          { key:'stats', label:'Analitika', icon:'📊' },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          TOOLS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'tools' && (
        <>
          {/* Toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <SearchBar value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naziv, ID alata..."/>
            <FSel value={catF} onChange={e=>setCatF(e.target.value)}>
              <option value="">Sve kategorije</option>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </FSel>
            <FSel value={statF} onChange={e=>setStatF(e.target.value)}>
              <option value="">Svi statusi</option>
              <option>Dostupan</option><option>Niske zalihe</option><option>Kritično</option>
            </FSel>
            <AdvancedFilter
              fields={[
                { key:'qtyMin', type:'number', label:'Količina min.', placeholder:'0' },
                { key:'qtyMax', type:'number', label:'Količina maks.', placeholder:'999' },
                { key:'location', type:'text', label:'Lokacija', placeholder:'npr. A3' },
                { key:'supplier', type:'text', label:'Dobavljač', placeholder:'Sandvik...' },
              ]}
              values={advFilters}
              onChange={setAdvFilters}
              onReset={()=>setAdvFilters(EMPTY_FILTER)}
            />
            <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <ExcelBar
                onExport={async () => tools.map(tool => mapToolToExcel(tool, i18n.language))}
                onImport={async () => showToast('Import uskoro', 'info')}
                templateHeaders={['ID','Naziv','Kategorija','Namjena','Dimenzije','Spoj','Lokacija','Kol.','Min.Kol.','Min.Narudžba','Jedinica','Cijena','Dobavljač','Kontakt','Strojevi','Kalibracija','Napomena']}
                templateName="tools" exportFilename="deer_tools" showToast={showToast}
              />
              <Btn v="secondary" onClick={()=>exportToolsPDF(filtered, stats)} style={{ fontSize:11 }}>📄 PDF</Btn>
              {stats.critical > 0 && <Btn v="secondary" onClick={()=>setAlertModal(true)} style={{ fontSize:11, color:'#F87171', borderColor:'#F8717166' }}>📧 Alert</Btn>}
              {canEdit && <Btn onClick={openAdd}>+ Dodaj alat</Btn>}
            </div>
          </div>

          {/* Critical alert */}
          {stats.critical > 0 && (
            <div style={{ background:'#F8717112', border:'1px solid #F8717144', borderRadius:10, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
              <span>🚨</span>
              <span style={{ fontSize:12, color:'#F87171', fontWeight:600 }}>{stats.critical} alata ispod minimalne zalihe!</span>
              <Btn v="secondary" onClick={()=>setAlertModal(true)} style={{ marginLeft:'auto', fontSize:10, padding:'4px 12px', color:'#F87171' }}>📧 Pošalji alert</Btn>
              {statF!=='Kritično' ? <Btn v="secondary" onClick={()=>setStatF('Kritično')} style={{ fontSize:10, padding:'4px 12px' }}>Prikaži kritične</Btn>
                : <Btn v="secondary" onClick={()=>setStatF('')} style={{ fontSize:10, padding:'4px 12px' }}>Prikaži sve</Btn>}
            </div>
          )}

          {/* Table */}
          {loading ? <Loading/> : !filtered.length ? <EmptyState icon="⚙" text="Nema alata. Dodaj prvi alat."/> : (
            <TblWrap headers={['Naziv alata','Kat.','Namjena','Dimenzije','Lokacija','Zalihe','Dobavljač','Cijena','Status','Kalibracija','Rok','']}>
              {filtered.map(tool => (
                <TR key={tool.id} onClick={()=>setDetailTool(tool)} style={{ cursor:'pointer' }}>
                  <TD>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {tool.photo_url
                        ? <img src={tool.photo_url} style={{ width:32, height:32, borderRadius:6, objectFit:'cover', flexShrink:0 }}/>
                        : <div style={{ width:32, height:32, borderRadius:8, background:(CAT_COLOR[tool.category]||'#51FFFF')+'18', border:'1px solid '+(CAT_COLOR[tool.category]||'#51FFFF')+'44', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, color:CAT_COLOR[tool.category]||'#51FFFF' }}>{CAT_ICON[tool.category]||'⚙'}</div>}
                      <div>
                        <div style={{ fontWeight:600, color:'#e8f0ee', fontSize:13 }}>{tool.name}</div>
                        <div style={{ fontSize:10, color:'#5A8480', fontFamily:'monospace' }}>{tool.internal_id}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge type="teal">{tool.category}</Badge></TD>
                  <TD muted>{tool.purpose}</TD>
                  <TD mono muted>{tool.dimensions}</TD>
                  <TD mono>{tool.storage_location}</TD>
                  <TD><QtyBar current={tool.current_quantity} min={tool.min_quantity}/>{tool.unit&&<span style={{ fontSize:9, color:'#5A8480', display:'block', marginTop:1 }}>{tool.unit}</span>}</TD>
                  <TD muted style={{ fontSize:11 }}>{tool.supplier||'—'}</TD>
                  <TD mono muted style={{ fontSize:11 }}>{tool.unit_price ? parseFloat(tool.unit_price).toFixed(2)+'€' : '—'}</TD>
                  <TD>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      <StatusBadge status={tool.status}/>
                      {tool.status==='Kritično' && canEdit && (
                        <button onClick={e=>{e.stopPropagation();quickOrder(tool)}} style={{ background:'#FB923C22', color:'#FB923C', border:'1px solid #FB923C44', borderRadius:4, padding:'2px 6px', fontSize:9, cursor:'pointer', fontWeight:600 }}>📦 Naruči</button>
                      )}
                    </div>
                  </TD>
                  <TD>
                    {tool.requires_calibration ? (
                      <span style={{ fontSize:10, color:calibColor(tool.next_calibration_date), fontWeight:600 }}>
                        {calibDays(tool.next_calibration_date)}
                      </span>
                    ) : <span style={{ fontSize:10, color:'#3B5450' }}>—</span>}
                  </TD>
                  <TD style={{ fontFamily:'monospace', fontSize:11, color:rokColor(tool.projected_lifespan_days) }}>{tool.projected_lifespan_days||'—'}</TD>
                  <TD onClick={e=>e.stopPropagation()}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={e=>{e.stopPropagation();setQrModal(tool)}} title="QR naljepnica" style={{ background:'transparent', border:'none', color:'#5A8480', cursor:'pointer', fontSize:13, padding:'2px' }}>▦</button>
                      <RowActions onQty={()=>setQtyModal(tool)} onHistory={()=>openHistory(tool)} onEdit={()=>openEdit(tool)} onDelete={()=>del(tool.id)} canEdit={canEdit}/>
                    </div>
                  </TD>
                </TR>
              ))}
            </TblWrap>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ORDERS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ flex:1, fontSize:12, color:'#7AA8A4' }}>Upravljanje narudžbama — kreiranje, praćenje, primanje (automatski ažurira zalihe)</div>
            {canEdit && <Btn onClick={()=>{setOrderForm({tool_id:'',quantity:1,supplier:'',notes:'',expected_date:'',send_email:false});setOrderModal(true)}}>+ Nova narudžba</Btn>}
          </div>

          {ordersLoading ? <Loading/> : !orders.length ? (
            <EmptyState icon="📦" text="Nema narudžbi. Kreiraj prvu narudžbu za kritične alate."/>
          ) : (
            <TblWrap headers={['Alat','Količina','Dobavljač','Status','Naručeno','Isporuka','Kreirao','Napomena','']}>
              {orders.map(o => (
                <TR key={o.id}>
                  <TD>
                    <div style={{ fontWeight:600, fontSize:12, color:'#e8f0ee' }}>{o.tool_name}</div>
                    <div style={{ fontSize:10, color:'#5A8480', fontFamily:'monospace' }}>{o.tool_internal_id}</div>
                  </TD>
                  <TD><span style={{ fontFamily:'monospace', color:'#F5BC54', fontWeight:700 }}>{o.quantity}</span> <span style={{ fontSize:10, color:'#5A8480' }}>{o.unit||'kom'}</span></TD>
                  <TD muted style={{ fontSize:11 }}>{o.supplier||'—'}</TD>
                  <TD><OrderStatusBadge status={o.status}/></TD>
                  <TD mono muted style={{ fontSize:11 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('hr') : '—'}</TD>
                  <TD mono style={{ fontSize:11, color: o.expected_date && new Date(o.expected_date) < new Date() && o.status!=='received' ? '#F87171' : '#5A8480' }}>{o.expected_date ? new Date(o.expected_date).toLocaleDateString('hr') : '—'}</TD>
                  <TD muted style={{ fontSize:10 }}>{o.created_by_name||'—'}</TD>
                  <TD muted style={{ fontSize:11 }}>{o.notes||'—'}</TD>
                  <TD>
                    {canEdit && o.status!=='received' && o.status!=='cancelled' && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {o.status==='pending' && <button onClick={()=>updateOrderStatus(o.id,'ordered')} style={{ background:'#60A5FA22', color:'#60A5FA', border:'1px solid #60A5FA44', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>Naručeno</button>}
                        {o.status==='ordered' && <button onClick={()=>updateOrderStatus(o.id,'received')} style={{ background:'#4ADE8022', color:'#4ADE80', border:'1px solid #4ADE8044', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer', fontWeight:700 }}>✓ Primljeno</button>}
                        <button onClick={()=>updateOrderStatus(o.id,'cancelled')} style={{ background:'#F8717115', color:'#F87171', border:'1px solid #F8717133', borderRadius:4, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>✕</button>
                      </div>
                    )}
                    {o.status==='received' && <span style={{ fontSize:10, color:'#4ADE80' }}>✓ Zalihe ažurirane</span>}
                  </TD>
                </TR>
              ))}
            </TblWrap>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CALIBRATION TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'calibration' && (
        <>
          <div style={{ fontSize:12, color:'#7AA8A4', marginBottom:14 }}>Pregled kalibracije mjernih instrumenata i preciznih alata — s automatskim podsjetnikom i evidencijom certifikata.</div>
          {tools.filter(t=>t.requires_calibration).length === 0 ? (
            <EmptyState icon="📋" text="Nema alata s omogućenom kalibracijom. Uredi alat i označi 'Zahtijeva kalibraciju'."/>
          ) : (
            <div style={{ display:'grid', gap:8 }}>
              {tools.filter(t=>t.requires_calibration).sort((a,b)=>(a.next_calibration_date||'9999')>(b.next_calibration_date||'9999')?1:-1).map(t => {
                const color = calibColor(t.next_calibration_date)
                const daysText = calibDays(t.next_calibration_date)
                const isUrgent = !t.next_calibration_date || new Date(t.next_calibration_date) <= new Date(Date.now() + 7*86400000)
                return (
                  <div key={t.id} style={{ background:'#2B3C3A', border:`1px solid ${isUrgent?color+'55':'#4A6B6844'}`, borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:10, background:'#324543', border:`2px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, color }}>{CAT_ICON[t.category]||'⚙'}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:'#e8f0ee', fontSize:13 }}>{t.name} <span style={{ fontFamily:'monospace', fontSize:10, color:'#5A8480' }}>{t.internal_id}</span></div>
                      <div style={{ fontSize:11, color:'#5A8480', marginTop:2 }}>
                        {t.storage_location&&`${t.storage_location} · `}
                        Zadnja: {t.last_calibration_date ? new Date(t.last_calibration_date).toLocaleDateString('hr') : 'Nikad'}
                        {t.calibration_interval_days&&` · Interval: ${t.calibration_interval_days} dana`}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:700, color, fontSize:14 }}>{daysText}</div>
                      {t.next_calibration_date && <div style={{ fontSize:10, color:'#5A8480' }}>{new Date(t.next_calibration_date).toLocaleDateString('hr')}</div>}
                    </div>
                    {canEdit && <button onClick={()=>setCalibModal(t)} style={{ background:color+'22', color, border:`1px solid ${color}55`, borderRadius:8, padding:'8px 14px', fontSize:11, cursor:'pointer', fontWeight:700, flexShrink:0 }}>📋 Evidentiraj</button>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'flex-end' }}>
            <Btn v="secondary" onClick={()=>exportToolsPDF(tools, stats)} style={{ fontSize:11 }}>📄 Izvezi PDF izvještaj</Btn>
          </div>
          <SectionTitle>Alati po kategorijama</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:22 }}>
            {CATS.map(cat => {
              const catTools = tools.filter(t=>t.category===cat)
              if (!catTools.length) return null
              const catVal = catTools.reduce((s,t)=>s+parseFloat(t.unit_price||0)*t.current_quantity, 0)
              const crit = catTools.filter(t=>t.status==='Kritično').length
              const color = CAT_COLOR[cat]||'#51FFFF'
              return (
                <div key={cat} style={{ background:'#2B3C3A', border:'1px solid #4A6B68', borderRadius:12, padding:'14px 16px', borderTop:'3px solid '+color }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:18, color }}>{CAT_ICON[cat]||'⚙'}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#C8DDD9', fontFamily:"'Chakra Petch',sans-serif" }}>{cat}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#7AA8A4' }}>
                    <span>Vrsta: <b style={{ color:'#C8DDD9' }}>{catTools.length}</b></span>
                    {crit > 0 && <span style={{ color:'#F87171' }}>⚠ {crit} kritično</span>}
                  </div>
                  {catVal > 0 && <div style={{ fontSize:11, color:'#F5BC54', marginTop:4 }}>Vrijednost: {catVal.toFixed(0)}€</div>}
                </div>
              )
            }).filter(Boolean)}
          </div>

          <SectionTitle>Alati koji trebaju narudžbu</SectionTitle>
          {tools.filter(t=>t.status!=='Dostupan').length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px', color:'#4ADE80', fontSize:13 }}>✓ Sve zalihe su uredne</div>
          ) : (
            <div style={{ display:'grid', gap:7 }}>
              {tools.filter(t=>t.status!=='Dostupan').map(t => (
                <div key={t.id} style={{ background:'#2B3C3A', border:`1px solid ${t.status==='Kritično'?'#F8717155':'#FB923C44'}`, borderRadius:10, padding:'11px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ fontSize:18, color:t.status==='Kritično'?'#F87171':'#FB923C' }}>{CAT_ICON[t.category]||'⚙'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:12, color:'#e8f0ee' }}>{t.name}</div>
                    <div style={{ fontSize:11, color:'#5A8480' }}>{t.storage_location} · Kol: {t.current_quantity}/{t.min_quantity} {t.unit||'kom'} · {t.supplier||'Bez dobavljača'}</div>
                  </div>
                  <StatusBadge status={t.status}/>
                  {canEdit && <button onClick={()=>quickOrder(t)} style={{ background:'#F5BC54', color:'#1a2a28', border:'none', borderRadius:6, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📦 Naruči</button>}
                </div>
              ))}
            </div>
          )}

          {(() => {
            const suppliers = [...new Set(tools.map(t=>t.supplier).filter(Boolean))]
            if (!suppliers.length) return null
            return (
              <div style={{ marginTop:22 }}>
                <SectionTitle>Dobavljači ({suppliers.length})</SectionTitle>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                  {suppliers.map(sup => {
                    const supTools = tools.filter(t=>t.supplier===sup)
                    const supVal = supTools.reduce((s,t)=>s+parseFloat(t.unit_price||0)*t.current_quantity, 0)
                    const crit = supTools.filter(t=>t.status==='Kritično').length
                    return (
                      <div key={sup} style={{ background:'#2B3C3A', border:`1px solid ${crit>0?'#F8717133':'#4A6B68'}`, borderRadius:10, padding:'12px 16px' }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'#C8DDD9', marginBottom:4 }}>{sup}</div>
                        <div style={{ fontSize:11, color:'#7AA8A4' }}>{supTools.length} vrsta alata{supVal>0?' · '+supVal.toFixed(0)+'€':''}</div>
                        {crit > 0 && <div style={{ fontSize:10, color:'#F87171', marginTop:4 }}>⚠ {crit} kritično</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ─── Tool Detail Drawer ───────────────────────────────────────────── */}
      {detailTool && (
        <ToolDetail
          tool={detailTool}
          onClose={()=>setDetailTool(null)}
          onEdit={openEdit}
          onQty={t=>{setQtyModal(t);setDetailTool(null)}}
          onQR={t=>setQrModal(t)}
          onCalib={t=>setCalibModal(t)}
          onUsage={t=>setUsageModal(t)}
          canEdit={canEdit}
        />
      )}

      {/* ─── Add/Edit Modal ───────────────────────────────────────────────── */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editItem?'Uredi alat':'Dodaj alat'} width={700}>
        {/* Photo upload */}
        <div style={{ display:'flex', gap:20, marginBottom:16, alignItems:'flex-start' }}>
          <PhotoUpload
            currentUrl={form.photoUrl}
            onUpload={url=>f('photoUrl',url)}
            toolId={editItem?.id}
          />
          <div style={{ flex:1 }}>
            <SectionTitle>Osnovni podaci</SectionTitle>
            <FGrid>
              <Field label="Naziv alata" req><Inp placeholder="Glodalo Ø12 4-rezno" value={form.name} onChange={e=>f('name',e.target.value)}/></Field>
              <Field label="Interni ID"><Inp placeholder="ALT-001" value={form.internalId} onChange={e=>f('internalId',e.target.value)}/></Field>
              <Field label="Kategorija" req>
                <Sel value={form.category} onChange={e=>f('category',e.target.value)}>
                  <option value="">Odaberi...</option>{CATS.map(c=><option key={c}>{c}</option>)}
                </Sel>
              </Field>
              <Field label="Namjena">
                <Sel value={form.purpose} onChange={e=>f('purpose',e.target.value)}>
                  <option value="">Odaberi...</option>{PURS.map(p=><option key={p}>{p}</option>)}
                </Sel>
              </Field>
            </FGrid>
          </div>
        </div>
        <FGrid>
          <Field label="Dimenzije" req><Inp placeholder="Ø12×75mm" value={form.dimensions} onChange={e=>f('dimensions',e.target.value)}/></Field>
          <Field label="Spoj / prihvat"><Inp placeholder="HSK-A63" value={form.connectionType} onChange={e=>f('connectionType',e.target.value)}/></Field>
        </FGrid>

        <SectionTitle style={{ marginTop:14 }}>Zalihe i lokacija</SectionTitle>
        <FGrid>
          <Field label="Lokacija / Polica"><Inp placeholder="A3-R2" value={form.storageLocation} onChange={e=>f('storageLocation',e.target.value)}/></Field>
          <Field label="Jedinica"><Sel value={form.unit} onChange={e=>f('unit',e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</Sel></Field>
          <Field label="Trenutna količina" req><Inp type="number" min="0" value={form.currentQuantity} onChange={e=>f('currentQuantity',parseInt(e.target.value)||0)}/></Field>
          <Field label="Minimalna količina" req><Inp type="number" min="1" value={form.minQuantity} onChange={e=>f('minQuantity',parseInt(e.target.value)||1)}/></Field>
          <Field label="Min. kol. narudžbe"><Inp type="number" min="1" value={form.minOrderQuantity} onChange={e=>f('minOrderQuantity',parseInt(e.target.value)||1)}/></Field>
          <Field label="Projektirani rok (dana)"><Inp type="number" placeholder="90" value={form.projectedLifespanDays} onChange={e=>f('projectedLifespanDays',e.target.value)}/></Field>
        </FGrid>

        <SectionTitle style={{ marginTop:14 }}>Dobavljač i cijena</SectionTitle>
        <FGrid>
          <Field label="Dobavljač"><Inp placeholder="Sandvik, Iscar..." value={form.supplier} onChange={e=>f('supplier',e.target.value)}/></Field>
          <Field label="Kontakt dobavljača"><Inp placeholder="email ili tel." value={form.supplierContact} onChange={e=>f('supplierContact',e.target.value)}/></Field>
          <Field label="Cijena/kom (€)"><Inp type="number" step="0.01" placeholder="0.00" value={form.unitPrice} onChange={e=>f('unitPrice',e.target.value)}/></Field>
        </FGrid>

        <SectionTitle style={{ marginTop:14 }}>Kalibracija i servis</SectionTitle>
        <div style={{ background:'#243330', borderRadius:8, padding:'12px 14px', marginBottom:8, border:'1px solid #4A6B6844' }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <input type="checkbox" checked={form.requiresCalibration} onChange={e=>f('requiresCalibration',e.target.checked)} style={{ width:16, height:16, accentColor:'#F5BC54' }}/>
            <span style={{ color:'#C8DDD9', fontSize:12, fontWeight:600 }}>Alat zahtijeva kalibraciju (mjerila, instrumenti...)</span>
          </label>
          {form.requiresCalibration && (
            <FGrid style={{ marginTop:12 }}>
              <Field label="Interval kalibracije (dana)"><Inp type="number" placeholder="180" value={form.calibrationIntervalDays} onChange={e=>f('calibrationIntervalDays',e.target.value)}/></Field>
              <Field label="Interval servisa (dana)"><Inp type="number" placeholder="365" value={form.serviceIntervalDays} onChange={e=>f('serviceIntervalDays',e.target.value)}/></Field>
            </FGrid>
          )}
        </div>

        <SectionTitle style={{ marginTop:14 }}>Primjena na alatnim mjestima</SectionTitle>
        <Field label="Strojevi / operacije (odvojite zarezom)" full>
          <Inp placeholder="CNC-001, CNC-002, Tokarilica A" value={form.machineApplicability} onChange={e=>f('machineApplicability',e.target.value)}/>
        </Field>
        <div style={{ marginTop:8 }}>
          <Field label="Napomena" full><Inp placeholder="Opcijsko..." value={form.notes} onChange={e=>f('notes',e.target.value)}/></Field>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Odustani</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Sprema...':'Spremi'}</Btn>
        </div>
      </Modal>

      {/* ─── Order Modal ──────────────────────────────────────────────────── */}
      <Modal open={orderModal} onClose={()=>setOrderModal(false)} title="Nova narudžba alata" width={500}>
        <Field label="Alat" req>
          <Sel value={orderForm.tool_id} onChange={e=>{
            const tool=tools.find(t=>t.id===e.target.value)
            fo('tool_id',e.target.value)
            if (tool) { fo('supplier',tool.supplier||''); fo('quantity',tool.min_order_quantity||1) }
          }}>
            <option value="">Odaberi alat...</option>
            {tools.map(t=><option key={t.id} value={t.id}>{t.name} ({t.internal_id||t.id.slice(0,8)}) — {t.current_quantity}/{t.min_quantity}</option>)}
          </Sel>
        </Field>
        <FGrid>
          <Field label="Količina" req><Inp type="number" min="1" value={orderForm.quantity} onChange={e=>fo('quantity',parseInt(e.target.value)||1)}/></Field>
          <Field label="Dobavljač"><Inp placeholder="Naziv / email dobavljača" value={orderForm.supplier} onChange={e=>fo('supplier',e.target.value)}/></Field>
          <Field label="Očekivana isporuka"><Inp type="date" value={orderForm.expected_date} onChange={e=>fo('expected_date',e.target.value)}/></Field>
        </FGrid>
        <Field label="Napomena" full><Inp placeholder="Hitna narudžba, spec. zahtjevi..." value={orderForm.notes} onChange={e=>fo('notes',e.target.value)}/></Field>
        <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, cursor:'pointer' }}>
          <input type="checkbox" checked={orderForm.send_email} onChange={e=>fo('send_email',e.target.checked)} style={{ width:15, height:15, accentColor:'#F5BC54' }}/>
          <span style={{ color:'#C8DDD9', fontSize:12 }}>Automatski pošalji email dobavljaču (ako je Dobavljač = email adresa)</span>
        </label>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <Btn v="secondary" onClick={()=>setOrderModal(false)}>Odustani</Btn>
          <Btn onClick={saveOrder} disabled={orderSaving}>{orderSaving?'Sprema...':'📦 Kreiraj narudžbu'}</Btn>
        </div>
      </Modal>

      {/* ─── Specialty modals ─────────────────────────────────────────────── */}
      <QRModal open={!!qrModal} onClose={()=>setQrModal(null)} tool={qrModal}/>
      <CalibrationModal open={!!calibModal} onClose={()=>setCalibModal(null)} tool={calibModal} onSave={saveCalibration}/>
      <UsageModal open={!!usageModal} onClose={()=>setUsageModal(null)} tool={usageModal} onSave={saveUsage}/>
      <AlertModal open={alertModal} onClose={()=>setAlertModal(false)} criticalCount={parseInt(stats.critical)||0}/>

      <QtyAdjModal open={!!qtyModal} onClose={()=>setQtyModal(null)} item={qtyModal} onSave={saveQty}/>
      <HistoryModal open={!!histModal} onClose={()=>setHistModal(null)} items={histItems} title={'Historija: '+(histModal?.name||'')}/>
      <Toast {...toast}/>
    </div>
  )
}
