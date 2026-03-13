import { useState } from 'react'

// ============================================================
// DEER MES v3 — COLOR SYSTEM (banner-faithful)
// Background:  #2B3C3A  (tamno-zelena kao banner)
// Surface:     #324543  (malo svjetlija)
// Surface2:    #3B5450  
// Border:      #4A6B68
// Accent:      #F5BC54  (žuta)
// Teal:        #51FFFF  (tirkiz)
// Text:        #E8F2F0  (gotovo bijela)
// ============================================================
export const C = {
  bg:      '#243330',
  surface: '#2B3C3A',
  surface2:'#324543',
  surface3:'#3B5450',
  border:  '#4A6B68',
  border2: '#5A8480',
  accent:  '#F5BC54',
  teal:    '#51FFFF',
  gray:    '#C8DDD9',
  muted:   '#7AA8A4',
  muted2:  '#5A8480',
  green:   '#4ADE80',
  orange:  '#FB923C',
  red:     '#F87171',
  blue:    '#60A5FA',
}

export function useToast() {
  const [toast, setToast] = useState({ visible:false, message:'', type:'success' })
  const show = (message, type='success') => {
    setToast({ visible:true, message, type })
    setTimeout(() => setToast(t => ({ ...t, visible:false })), 3200)
  }
  return [toast, show]
}

export function StatCard({ label, value, sub, color='yellow', onClick }) {
  const m = { yellow:C.accent, green:C.green, orange:C.orange, red:C.red, teal:C.teal }
  const c = m[color]||C.accent
  return (
    <div onClick={onClick} style={{ background:`linear-gradient(145deg, ${C.surface}, ${C.surface2})`, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 22px', position:'relative', overflow:'hidden', cursor:onClick?'pointer':'default', transition:'all 0.25s', boxShadow:`0 4px 16px rgba(0,0,0,.25)` }}
      onMouseOver={e=>{if(onClick){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 28px rgba(0,0,0,.35), 0 0 0 1px ${c}44`}}}
      onMouseOut={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.25)'}}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${c},${c}88)`,borderRadius:'16px 16px 0 0' }}/>
      <div style={{ position:'absolute',top:-20,right:-10,width:80,height:80,borderRadius:'50%',background:`${c}08`,pointerEvents:'none' }}/>
      <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:8,fontFamily:"'Chakra Petch',sans-serif" }}>{label}</div>
      <div style={{ fontSize:38,fontWeight:700,color:c,lineHeight:1,fontFamily:"'Chakra Petch',sans-serif" }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11,color:C.muted2,marginTop:4 }}>{sub}</div>}
    </div>
  )
}

export function Badge({ children, type='yellow' }) {
  const styles = {
    yellow:{ background:`${C.accent}22`, color:C.accent, border:`1px solid ${C.accent}44` },
    green: { background:`${C.green}18`, color:C.green, border:`1px solid ${C.green}44` },
    orange:{ background:`${C.orange}18`, color:C.orange, border:`1px solid ${C.orange}44` },
    red:   { background:`${C.red}18`, color:C.red, border:`1px solid ${C.red}44` },
    blue:  { background:`${C.blue}18`, color:C.blue, border:`1px solid ${C.blue}33` },
    teal:  { background:`${C.teal}15`, color:C.teal, border:`1px solid ${C.teal}44` },
    gray:  { background:`${C.muted}22`, color:C.gray, border:`1px solid ${C.border2}` },
  }
  const s = styles[type]||styles.yellow
  return (
    <span style={{ display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,whiteSpace:'nowrap',letterSpacing:0.5,...s }}>
      {['green','orange','red'].includes(type) && <span style={{ width:5,height:5,borderRadius:'50%',background:s.color,marginRight:5,display:'inline-block' }}/>}
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const m = { 'Dostupan':'green','Niske zalihe':'orange','Kritično':'red','u_tijeku':'yellow','zavrsen':'green','kasni':'red','na_cekanju':'blue','otkazan':'gray','high':'orange','urgent':'red','low':'blue','normal':'gray' }
  const l = { u_tijeku:'U tijeku',zavrsen:'Završen',kasni:'Kasni',na_cekanju:'Na čekanju',otkazan:'Otkazan',high:'Visoki',urgent:'Hitno',low:'Nizak',normal:'Normalno' }
  return <Badge type={m[status]||'gray'}>{l[status]||status}</Badge>
}

export function QtyBar({ current, min, width=85 }) {
  const c=parseFloat(current), m=parseFloat(min)
  const max=Math.max(c,m*3,10), pct=Math.round((c/max)*100)
  const color=c<m?C.red:c<m*1.5?C.orange:C.green
  return (
    <div style={{ width }}>
      <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3 }}>
        <span style={{ color,fontWeight:600 }}>{current}</span>
        <span style={{ color:C.muted2 }}>/{min}</span>
      </div>
      <div style={{ height:4,background:C.surface3,borderRadius:2,overflow:'hidden' }}>
        <div style={{ width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${color},${color}cc)`,borderRadius:2,transition:'width .5s ease' }}/>
      </div>
    </div>
  )
}

export function Btn({ children, onClick, v='primary', disabled, sm, style:sx }) {
  const vs = {
    primary: { background:disabled?C.muted2:C.accent, color:'#1a2a28', border:'none', boxShadow:disabled?'none':`0 2px 12px ${C.accent}44` },
    secondary:{ background:'transparent', color:C.gray, border:`1px solid ${C.border2}` },
    teal:    { background:`${C.teal}18`, color:C.teal, border:`1px solid ${C.teal}44` },
    danger:  { background:`${C.red}15`, color:C.red, border:`1px solid ${C.red}44` },
  }
  const s = vs[v]||vs.primary
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...s, padding:sm?'7px 14px':'10px 22px', borderRadius:10, fontSize:sm?11:13, fontWeight:700, cursor:disabled?'not-allowed':'pointer', transition:'all 0.2s', opacity:disabled?.5:1, display:'inline-flex', alignItems:'center', gap:6, letterSpacing:0.3, ...sx }}
      onMouseOver={e=>{ if(!disabled&&v==='primary'){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 6px 20px ${C.accent}55`} }}
      onMouseOut={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=vs[v]?.boxShadow||''}}
    >{children}</button>
  )
}

export function Modal({ open, onClose, title, children, width=560 }) {
  if (!open) return null
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed',inset:0,background:'rgba(15,25,24,.88)',backdropFilter:'blur(6px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:20,padding:32,width,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',animation:'mi .22s ease',boxShadow:`0 24px 64px rgba(0,0,0,.5), 0 0 0 1px ${C.border2}44` }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <span style={{ fontSize:18,fontWeight:700,letterSpacing:2,color:C.accent,fontFamily:"'Chakra Petch',sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface3,color:C.muted,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s' }}
            onMouseOver={e=>{e.currentTarget.style.color=C.red;e.currentTarget.style.borderColor=C.red+'55'}}
            onMouseOut={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}
          >✕</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes mi{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

export function FGrid({ children, cols=2 }) {
  return <div style={{ display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:14 }}>{children}</div>
}

export function Field({ label, req, full, children }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:5,...(full?{gridColumn:'1/-1'}:{}) }}>
      <label style={{ fontSize:10,letterSpacing:1.3,color:C.muted,textTransform:'uppercase',fontFamily:"'Chakra Petch',sans-serif" }}>{label}{req&&<span style={{color:C.orange}}> *</span>}</label>
      {children}
    </div>
  )
}

const inpBase = { background:C.surface3, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', color:C.gray, fontSize:13, outline:'none', width:'100%', transition:'border .15s' }
export function Inp(p) {
  const { style:sx, ...rest } = p
  return <input {...rest} style={{ ...inpBase,...sx }} onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border}/>
}
export function Sel({ children, style:sx, ...p }) {
  return <select {...p} style={{ ...inpBase,...sx,background:C.surface3 }}>{children}</select>
}
export function Textarea({ style:sx, ...p }) {
  return <textarea {...p} style={{ ...inpBase,resize:'vertical',minHeight:70,...sx }} onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border}/>
}

export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative',flex:1,minWidth:180,maxWidth:320 }}>
      <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.muted,fontSize:14 }}>⌕</span>
      <input value={value} onChange={onChange} placeholder={placeholder||'Pretraži...'} style={{ width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px 9px 34px',color:C.gray,fontSize:12,outline:'none',transition:'border .15s' }}
        onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border}/>
    </div>
  )
}

export function FSel({ children, ...p }) {
  return <select {...p} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 14px',color:C.gray,fontSize:12,outline:'none' }}>{children}</select>
}

export function TblWrap({ headers, children, footer }) {
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden',boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:`linear-gradient(90deg,${C.surface2},${C.surface3})`,borderBottom:`1px solid ${C.border}` }}>
              {headers.map((h,i)=><th key={i} style={{ padding:'12px 16px',textAlign:'left',fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,whiteSpace:'nowrap',fontFamily:"'Chakra Petch',sans-serif" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

export function TR({ children, onClick }) {
  return (
    <tr onClick={onClick} style={{ borderBottom:`1px solid ${C.border}44`,transition:'background .12s',cursor:onClick?'pointer':'default' }}
      onMouseOver={e=>e.currentTarget.style.background=C.surface2+'cc'}
      onMouseOut={e=>e.currentTarget.style.background='transparent'}
    >{children}</tr>
  )
}

export function TD({ children, mono, muted, style:s }) {
  return <td style={{ padding:'13px 16px',fontSize:13,verticalAlign:'middle',fontFamily:mono?'monospace':"'Chakra Petch',sans-serif",color:muted?C.muted2:C.gray,...s }}>{children}</td>
}

export function RowActions({ onEdit, onDelete, onQty, onHistory, canEdit }) {
  const btn = (icon,cb,hc,title) => (
    <button title={title} onClick={e=>{e.stopPropagation();cb&&cb()}} style={{ width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.muted,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s' }}
      onMouseOver={e=>{e.currentTarget.style.borderColor=hc;e.currentTarget.style.color=hc;e.currentTarget.style.background=`${hc}15`}}
      onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;e.currentTarget.style.background=C.surface2}}
    >{icon}</button>
  )
  return (
    <div style={{ display:'flex',gap:4 }}>
      {onQty     && btn('±',onQty,C.teal,'Korekcija količine')}
      {onHistory && btn('◷',onHistory,C.accent,'Historija')}
      {canEdit&&onEdit   && btn('✎',onEdit,C.teal,'Uredi')}
      {canEdit&&onDelete && btn('✕',onDelete,C.red,'Obriši')}
    </div>
  )
}

export function Toast({ message, type, visible }) {
  if (!visible) return null
  const c = { success:C.green, error:C.red, info:C.teal }[type]||C.teal
  return (
    <div style={{ position:'fixed',bottom:24,right:24,background:C.surface2,border:`1px solid ${c}`,borderRadius:14,padding:'14px 22px',fontSize:13,zIndex:999,display:'flex',alignItems:'center',gap:10,boxShadow:`0 8px 32px rgba(0,0,0,.4), 0 0 0 1px ${c}22`,animation:'su .3s ease',maxWidth:380 }}>
      <style>{`@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <span style={{ color:c,fontSize:16 }}>{type==='success'?'✓':type==='error'?'✕':'ℹ'}</span>
      <span style={{ color:C.gray }}>{message}</span>
    </div>
  )
}

export function HistoryModal({ open, onClose, items, title }) {
  const al={add:'Dodano',remove:'Uklonjeno',create:'Kreirano',update:'Izmijenjeno',delete:'Obrisano'}
  const ac={add:C.green,remove:C.red,create:C.teal,update:C.accent,delete:C.red}
  const ago=(d)=>{ const diff=Math.round((Date.now()-new Date(d))/60000); return diff<1?'upravo':diff<60?`${diff}m`:diff<1440?`${Math.round(diff/60)}h`:`${Math.round(diff/1440)}d` }
  return (
    <Modal open={open} onClose={onClose} title={title||'Historija'} width={500}>
      <div style={{ maxHeight:420,overflowY:'auto' }}>
        {items?.length ? items.map((h,i)=>(
          <div key={i} style={{ display:'flex',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.border}44` }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:ac[h.action]||C.muted,marginTop:5,flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:12,color:ac[h.action]||C.teal,fontWeight:600 }}>{al[h.action]||h.action}</span>
              {h.quantity_change!=null&&<span style={{ fontSize:12,color:C.gray }}> {h.quantity_change>0?'+':''}{h.quantity_change} ({h.quantity_before}→{h.quantity_after})</span>}
              {h.note&&<div style={{ fontSize:11,color:C.muted2,marginTop:1 }}>{h.note}</div>}
              <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{h.user_name} · {ago(h.created_at)}</div>
            </div>
          </div>
        )) : <div style={{ textAlign:'center',padding:30,color:C.muted }}>Nema historije</div>}
      </div>
    </Modal>
  )
}

export function QtyAdjModal({ open, onClose, item, onSave, unit='' }) {
  const [change, setChange] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!change || change === 0) return
    setSaving(true)
    await onSave(parseInt(change)||parseFloat(change), note)
    setSaving(false); setChange(0); setNote(''); onClose()
  }
  if (!open||!item) return null
  const newQty = Math.max(0, parseFloat(item.current_quantity||0) + (parseFloat(change)||0))
  return (
    <Modal open={open} onClose={onClose} title="Korekcija količine" width={400}>
      <div style={{ background:C.surface3,borderRadius:10,padding:'14px 16px',marginBottom:20,border:`1px solid ${C.border}` }}>
        <div style={{ fontWeight:600,color:'#e8f0ee',fontSize:14,marginBottom:4 }}>{item.name}</div>
        <div style={{ fontSize:12,color:C.muted2 }}>
          Trenutno: <span style={{color:C.teal,fontWeight:600}}>{item.current_quantity} {unit}</span> · 
          Min: <span style={{color:C.orange}}>{item.min_quantity} {unit}</span>
        </div>
      </div>
      <Field label="Promjena (+dodaj / -ukloni)" req>
        <Inp type="number" value={change} onChange={e=>setChange(e.target.value)} placeholder="npr. 10 ili -3"/>
      </Field>
      {change!==0&&change!==''&&<div style={{ marginTop:8,fontSize:12,color:parseFloat(change)>0?C.green:C.orange }}>
        → Nova količina: {newQty} {unit}
      </div>}
      <div style={{ marginTop:12 }}>
        <Field label="Napomena">
          <Inp value={note} onChange={e=>setNote(e.target.value)} placeholder="Razlog izmjene (opcijalno)"/>
        </Field>
      </div>
      <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:20 }}>
        <Btn v="secondary" onClick={onClose}>Odustani</Btn>
        <Btn onClick={handleSave} disabled={saving||!change||change==0}>{saving?'Sprema...':'Spremi'}</Btn>
      </div>
    </Modal>
  )
}

export function Loading() { 
  return (
    <div style={{ textAlign:'center',padding:60,color:C.muted }}>
      <div style={{ fontSize:28,marginBottom:12,color:C.teal,animation:'spin 2s linear infinite',display:'inline-block' }}>◈</div>
      <div style={{ fontSize:11,letterSpacing:2,fontFamily:"'Chakra Petch',sans-serif" }}>UČITAVANJE...</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function EmptyState({ icon,text }) { 
  return (
    <div style={{ textAlign:'center',padding:'60px 20px',color:C.muted }}>
      <div style={{ fontSize:44,marginBottom:12,opacity:.3 }}>{icon||'📭'}</div>
      <div style={{ fontSize:13,letterSpacing:0.5 }}>{text||'Nema podataka'}</div>
    </div>
  )
}

export function PageHeader({ title, actions, children }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap' }}>
      {children}
      <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>{actions}</div>
    </div>
  )
}

export function SectionTitle({ children, style:sx }) {
  return (
    <div style={{ fontSize:10,color:C.muted,letterSpacing:1.8,textTransform:'uppercase',marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${C.border}44`,fontFamily:"'Chakra Petch',sans-serif",...sx }}>
      {children}
    </div>
  )
}
