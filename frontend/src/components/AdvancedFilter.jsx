import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, Btn, Inp, Sel } from './UI'

export default function AdvancedFilter({ fields, values, onChange, onReset }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const activeCount = Object.values(values).filter(v => v !== '' && v !== false && v !== null).length

  const set = (key, val) => onChange({ ...values, [key]: val })

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 14px',borderRadius:10,border:`1px solid ${open || activeCount > 0 ? C.teal : C.border}`,background:open?`${C.teal}12`:C.surface,color:open?C.teal:C.muted2,fontSize:12,cursor:'pointer',transition:'all .2s',fontFamily:"'Chakra Petch',sans-serif",fontWeight:500 }}
      >
        <span style={{ fontSize:13 }}>⊞</span>
        {t('common.advanced_filter')}
        {activeCount > 0 && (
          <span style={{ width:18,height:18,borderRadius:'50%',background:C.teal,color:'#000',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed',inset:0,zIndex:199 }}/>
          <div style={{ position:'absolute',top:'calc(100% + 8px)',left:0,zIndex:200,background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:16,padding:20,minWidth:360,maxWidth:480,boxShadow:`0 16px 48px rgba(0,0,0,.4), 0 0 0 1px ${C.teal}22` }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ color:C.teal,fontSize:14 }}>⊞</span>
                <span style={{ fontSize:11,color:C.teal,letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif" }}>{t('common.advanced_filter').toUpperCase()}</span>
              </div>
              {activeCount > 0 && (
                <button onClick={() => { onReset(); }} style={{ fontSize:11,color:C.orange,background:'none',border:'none',cursor:'pointer',letterSpacing:0.5 }}>
                  ✕ {t('common.reset')}
                </button>
              )}
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              {fields.map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1/-1' : undefined }}>
                  <label style={{ fontSize:9,color:C.muted,letterSpacing:1.3,display:'block',marginBottom:5,fontFamily:"'Chakra Petch',sans-serif" }}>
                    {field.label.toUpperCase()}
                  </label>
                  {field.type === 'select' ? (
                    <select value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                      style={{ width:'100%',background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',color:C.gray,fontSize:12,outline:'none' }}
                      onFocus={e=>e.target.style.borderColor=C.teal}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    >
                      <option value="">{field.placeholder || '—'}</option>
                      {field.options.map(o => (
                        <option key={o.v} value={o.v}>{o.l}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 0' }}>
                      <div onClick={() => set(field.key, !values[field.key])}
                        style={{ width:18,height:18,borderRadius:5,border:`1px solid ${values[field.key]?C.teal:C.border}`,background:values[field.key]?`${C.teal}22`:C.surface3,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s' }}
                      >
                        {values[field.key] && <span style={{ color:C.teal,fontSize:12,lineHeight:1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize:12,color:C.gray }}>{field.checkLabel || field.label}</span>
                    </label>
                  ) : field.type === 'date' ? (
                    <input type="date" value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                      style={{ width:'100%',background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',color:C.gray,fontSize:12,outline:'none',colorScheme:'dark' }}
                      onFocus={e=>e.target.style.borderColor=C.teal}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                  ) : (
                    <input type={field.type||'text'} value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{ width:'100%',background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',color:C.gray,fontSize:12,outline:'none' }}
                      onFocus={e=>e.target.style.borderColor=C.teal}
                      onBlur={e=>e.target.style.borderColor=C.border}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:'flex',justifyContent:'flex-end',marginTop:14,gap:8 }}>
              <button onClick={() => setOpen(false)}
                style={{ padding:'7px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.muted2,fontSize:11,cursor:'pointer',fontFamily:"'Chakra Petch',sans-serif" }}>
                {t('common.close')}
              </button>
              <button onClick={() => setOpen(false)}
                style={{ padding:'7px 16px',borderRadius:8,border:'none',background:C.teal,color:'#000',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'Chakra Petch',sans-serif" }}>
                {t('common.filter')} ✓
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
