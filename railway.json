import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { C } from '../components/UI'
import LanguageSwitcher from '../components/LanguageSwitcher'
import logo from '../assets/logo.png'

export default function LoginPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState({ username:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const submit = async () => {
    if (!form.username || !form.password) { setError(t('auth.username') + ' / ' + t('auth.password')); return }
    setLoading(true); setError('')
    try { await login(form.username, form.password); navigate('/') }
    catch(e) { setError(e.response?.data?.error || t('auth.wrong_credentials')) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', position:'relative', overflow:'hidden' }}>
      {/* LEFT panel */}
      <div style={{ flex:1,background:`linear-gradient(145deg,${C.surface} 0%,${C.surface2} 50%,${C.surface3} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',inset:0,opacity:.06,backgroundImage:`linear-gradient(${C.teal} 1px,transparent 1px),linear-gradient(90deg,${C.teal} 1px,transparent 1px)`,backgroundSize:'40px 40px',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',top:'20%',left:'10%',width:300,height:300,borderRadius:'50%',background:`radial-gradient(circle,${C.teal}18,transparent 70%)`,pointerEvents:'none' }}/>
        <div style={{ position:'absolute',bottom:'15%',right:'5%',width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${C.accent}14,transparent 70%)`,pointerEvents:'none' }}/>

        <div style={{ position:'relative',zIndex:1,textAlign:'center',maxWidth:400 }}>
          <div style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:120,height:120,borderRadius:30,background:`linear-gradient(145deg,${C.surface3},${C.surface2})`,border:`2px solid ${C.teal}44`,marginBottom:32,boxShadow:`0 0 60px ${C.teal}22,0 8px 32px rgba(0,0,0,.4)` }}>
            <img src={logo} alt="DEER" style={{ width:88,height:'auto' }}/>
          </div>
          <div style={{ fontSize:36,fontWeight:700,color:'#E8F2F0',letterSpacing:8,marginBottom:6,fontFamily:"'Chakra Petch',sans-serif",textShadow:`0 0 40px ${C.teal}44` }}>DEER</div>
          <div style={{ fontSize:13,color:C.teal,letterSpacing:4,marginBottom:28,fontFamily:"'Chakra Petch',sans-serif" }}>MES PLATFORM</div>
          <div style={{ fontSize:13,color:C.muted,lineHeight:1.8,textAlign:'left' }}>
            {(t('auth.features', {returnObjects:true})||[]).map((feature,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                <span style={{ color:C.teal,fontSize:12 }}>▸</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:36,padding:'12px 20px',background:`${C.teal}0c`,border:`1px solid ${C.teal}22`,borderRadius:10,fontSize:11,color:C.muted,textAlign:'left' }}>
            <span style={{ color:C.teal,fontWeight:600 }}>DEER MES v2.0</span> · Fixture Intelligence Platform
          </div>
        </div>
      </div>

      {/* RIGHT login panel */}
      <div style={{ width:460,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:48,borderLeft:`1px solid ${C.border}`,position:'relative' }}>
        {/* Language switcher top-right */}
        <div style={{ position:'absolute',top:20,right:20 }}>
          <LanguageSwitcher/>
        </div>

        <div style={{ width:'100%',maxWidth:360 }}>
          <div style={{ marginBottom:36 }}>
            <div style={{ fontSize:11,color:C.muted,letterSpacing:2,marginBottom:8,fontFamily:"'Chakra Petch',sans-serif" }}>{t('auth.welcome')}</div>
            <div style={{ fontSize:24,fontWeight:700,color:'#E8F2F0',letterSpacing:2,fontFamily:"'Chakra Petch',sans-serif" }}>{t('auth.login_title')}</div>
            <div style={{ width:40,height:3,background:`linear-gradient(90deg,${C.accent},${C.teal})`,borderRadius:2,marginTop:10 }}/>
          </div>

          {error && (
            <div style={{ background:`${C.red}14`,border:`1px solid ${C.red}44`,borderRadius:10,padding:'12px 16px',marginBottom:22,fontSize:12,color:C.red,display:'flex',alignItems:'center',gap:8 }}>
              <span>⚠</span>{error}
            </div>
          )}

          <div style={{ display:'flex',flexDirection:'column',gap:18 }}>
            {[['username','text',t('auth.username')],['password','password',t('auth.password')]].map(([key,type,label])=>(
              <div key={key}>
                <label style={{ fontSize:10,color:C.muted,letterSpacing:1.5,display:'block',marginBottom:8,fontFamily:"'Chakra Petch',sans-serif" }}>{label}</label>
                <input type={type} value={form[key]} onChange={e=>f(key,e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&submit()}
                  placeholder={type==='password'?'••••••••':key}
                  style={{ width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 16px',color:C.gray,fontSize:13,outline:'none',transition:'all .2s',boxSizing:'border-box' }}
                  onFocus={e=>{e.target.style.borderColor=C.teal;e.target.style.boxShadow=`0 0 0 3px ${C.teal}18`}}
                  onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow='none'}}
                />
              </div>
            ))}
          </div>

          <button onClick={submit} disabled={loading}
            style={{ width:'100%',marginTop:26,padding:'14px',borderRadius:12,border:'none',background:loading?C.muted2:`linear-gradient(90deg,${C.accent},${C.accent}dd)`,color:'#1a2a28',fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',transition:'all .25s',letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif",boxShadow:loading?'none':`0 4px 20px ${C.accent}44` }}
            onMouseOver={e=>{if(!loading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 28px ${C.accent}55`}}}
            onMouseOut={e=>{e.currentTarget.style.transform='none'}}
          >{loading?t('auth.logging_in'):t('auth.login_btn')}</button>

          <div style={{ textAlign:'center',marginTop:22,fontSize:12,color:C.muted }}>
            {t('auth.no_account')}{' '}
            <a href="/register" style={{ color:C.teal,textDecoration:'none',fontWeight:600 }}>{t('auth.register')}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
