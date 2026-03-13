import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/index.js'
import { C } from './UI'

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  const change = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('deer_lang', code)
    setOpen(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:6,padding:compact?'6px 10px':'8px 14px',borderRadius:9,border:`1px solid ${open?C.teal:C.border}`,background:open?`${C.teal}12`:C.surface3,color:open?C.teal:C.gray,fontSize:12,cursor:'pointer',transition:'all .2s',fontFamily:"'Chakra Petch',sans-serif" }}
      >
        <span style={{ fontSize:15 }}>{current.flag}</span>
        {!compact && <span style={{ letterSpacing:0.5 }}>{current.code.toUpperCase()}</span>}
        <span style={{ fontSize:9,color:C.muted2 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed',inset:0,zIndex:299 }}/>
          <div style={{ position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:300,background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',boxShadow:`0 12px 32px rgba(0,0,0,.4)`,minWidth:160 }}>
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => change(lang.code)}
                style={{ width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 16px',background:lang.code===i18n.language?`${C.teal}15`:'transparent',color:lang.code===i18n.language?C.teal:C.gray,border:'none',cursor:'pointer',fontSize:13,transition:'background .15s',fontFamily:"'Chakra Petch',sans-serif",borderLeft:lang.code===i18n.language?`3px solid ${C.teal}`:'3px solid transparent' }}
                onMouseOver={e=>{if(lang.code!==i18n.language)e.currentTarget.style.background=C.surface3}}
                onMouseOut={e=>{if(lang.code!==i18n.language)e.currentTarget.style.background='transparent'}}
              >
                <span style={{ fontSize:18 }}>{lang.flag}</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:13,fontWeight:lang.code===i18n.language?600:400 }}>{lang.label}</div>
                  <div style={{ fontSize:9,color:C.muted,letterSpacing:1 }}>{lang.code.toUpperCase()}</div>
                </div>
                {lang.code===i18n.language && <span style={{ marginLeft:'auto',color:C.teal,fontSize:12 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
