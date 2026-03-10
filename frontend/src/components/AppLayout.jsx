import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { C } from '../components/UI'
import LanguageSwitcher from './LanguageSwitcher'
import logo from '../assets/logo.png'
import api from '../utils/api'
import {
  LayoutDashboard, Wrench, Cpu, MapPin, Package, Boxes,
  FileText, Brain, Activity, BarChart3,
  LogOut, Bell, ChevronRight, ChevronLeft, MessageSquare,
  Code2, Calendar, Monitor, Layers, Hammer, Menu, X,
  ShoppingCart, FolderOpen, BarChart2, CheckSquare, Warehouse, UserCircle, Calculator,
  ClipboardList, Activity as ActivityIcon, Gauge, TrendingUp, CalendarDays, PieChart, Users, Box
} from 'lucide-react'

const NAV_ITEMS = [
  { to:'/', key:'dashboard', Icon:LayoutDashboard, exact:true, group:'main' },
  { to:'/tasks', key:'tasks', Icon:CheckSquare, group:'main' },
  { to:'/kpi', key:'kpi', Icon:BarChart2, group:'v6' },
  { to:'/kalkulacije', key:'kalkulacije', Icon:Calculator, group:'v6' },
  { to:'/kontroling', key:'kontroling', Icon:PieChart, group:'v6' },
  { to:'/user-management', key:'user_management', Icon:Users, group:'v6' },
  { to:'/work-orders', key:'work_orders', Icon:ClipboardList, group:'mes2' },
  { to:'/production-planning', key:'production_planning', Icon:CalendarDays, group:'mes2' },
  { to:'/oee-monitoring', key:'oee_monitoring', Icon:Gauge, group:'mes2' },
  { to:'/tool-life', key:'tool_life', Icon:TrendingUp, group:'mes2' },
  { to:'/sales', key:'sales', Icon:ShoppingCart, group:'v6' },
  { to:'/quality', key:'quality', Icon:CheckSquare, group:'v6' },
  { to:'/warehouse', key:'warehouse', Icon:Warehouse, group:'v6' },
  { to:'/hr', key:'hr', Icon:UserCircle, group:'v6' },
  { to:'/dms', key:'dms', Icon:FolderOpen, group:'v6' },
  { to:'/machines', key:'machines', Icon:Cpu, group:'fixture' },
  { to:'/machines-live', key:'machines_live', Icon:Monitor, group:'fixture' },
  { to:'/locations', key:'locations', Icon:MapPin, group:'fixture' },
  { to:'/alatnica', key:'tools', Icon:Wrench, group:'mes' },
  { to:'/stege', key:'clamping', Icon:Package, group:'mes' },
  { to:'/fixtures', key:'fixtures', Icon:Package, group:'mes' },
  { to:'/materijali', key:'materials', Icon:Boxes, group:'mes' },
  { to:'/usage', key:'usage', Icon:Activity, group:'mes' },
  { to:'/ai-insights', key:'ai', Icon:Brain, group:'ai' },
  { to:'/ai-chat', key:'ai_chat', Icon:MessageSquare, group:'ai' },
  { to:'/oee', key:'oee', Icon:BarChart3, group:'ai' },
  { to:'/gcode', key:'gcode', Icon:Code2, group:'ai' },
  { to:'/cam', key:'cam_generator', Icon:Box, group:'ai' },
  { to:'/ai-schedule', key:'ai_schedule', Icon:Calendar, group:'ai' },
  { to:'/digital-twin', key:'digital_twin', Icon:Layers, group:'ai' },
  { to:'/forms', key:'forms', Icon:FileText, group:'workflow' },
  { to:'/machine-maintenance', key:'machine_maint', Icon:Hammer, group:'workflow' },
]

const GROUP_LABELS = { main:'GLAVNI IZBORNIK', v6:'MES v6', mes2:'MES v2 — PRODUKCIJA', fixture:'STROJEVI', mes:'ALATI & NAPRAVE', ai:'ML / AI', workflow:'WORKFLOW' }

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer
  const [expanded, setExpanded] = useState(false)       // desktop expand
  const [notifOpen, setNotifOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [unread, setUnread] = useState(0)
  const drawerRef = useRef(null)

  // Close mobile sidebar on navigation
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    api.get('/dashboard/stats').then(r => {
      setAlerts(r.data.alerts || [])
      setUnread((r.data.alerts||[]).filter(a=>!a.is_read).length)
    }).catch(()=>{})
  }, [location.pathname])

  const doLogout = () => { logout(); navigate('/login') }

  // Desktop sidebar width
  const sideW = isMobile ? 0 : (expanded ? 210 : 66)

  const currentNav = NAV_ITEMS.find(n => n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== '/')
    || (location.pathname === '/' ? NAV_ITEMS[0] : null)
  const pageTitle = currentNav ? t(`nav.${currentNav.key}`, currentNav.key).toUpperCase() : 'DEER MES'

  const markRead = async (id) => {
    await api.patch(`/dashboard/alerts/${id}/read`).catch(()=>{})
    setAlerts(a=>a.map(x=>x.id===id?{...x,is_read:true}:x))
    setUnread(n=>Math.max(0,n-1))
  }
  const markAllRead = async () => {
    await api.post('/dashboard/alerts/read-all').catch(()=>{})
    setAlerts(a=>a.map(x=>({...x,is_read:true}))); setUnread(0)
  }

  // Shared nav content
  const NavContent = ({ mobile = false }) => {
    let lastGroup = 'main'
    return (
      <>
        {NAV_ITEMS.map((item) => {
          const showSep = item.group !== 'main' && item.group !== lastGroup
          lastGroup = item.group
          const label = t(`nav.${item.key}`, item.key)
          const { Icon } = item
          return (
            <div key={item.to}>
              {showSep && (mobile || expanded) && (
                <div style={{ padding:'10px 16px 4px', fontSize:9, color:C.muted2, letterSpacing:2, marginTop:4 }}>
                  {GROUP_LABELS[item.group]}
                </div>
              )}
              {showSep && !mobile && !expanded && (
                <div style={{ margin:'6px 10px', height:1, background:`${C.border}66` }}/>
              )}
              <NavLink to={item.to} end={item.exact} title={label}
                style={({isActive})=>({
                  display:'flex', alignItems:'center', gap:10,
                  margin:'1px 8px', padding: mobile ? '12px 16px' : expanded ? '9px 12px' : '9px',
                  borderRadius:10, textDecoration:'none',
                  background: isActive ? `linear-gradient(90deg,${C.teal}20,${C.teal}08)` : 'transparent',
                  color: isActive ? C.teal : C.muted2,
                  borderLeft: isActive ? `3px solid ${C.teal}` : '3px solid transparent',
                  transition:'all 0.15s',
                  justifyContent: (mobile || expanded) ? 'flex-start' : 'center',
                })}
              >
                <Icon size={mobile ? 20 : 16} style={{ flexShrink:0 }}/>
                {(mobile || expanded) && (
                  <span style={{ fontSize: mobile ? 14 : 12, fontWeight:500, whiteSpace:'nowrap', letterSpacing:0.3 }}>
                    {label}
                  </span>
                )}
              </NavLink>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.bg, fontFamily:"'Chakra Petch',sans-serif" }}>

      {/* ── DESKTOP SIDEBAR ── */}
      {!isMobile && (
        <aside style={{ width:sideW, background:`linear-gradient(180deg,${C.surface} 0%,${C.surface2} 100%)`, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', position:'fixed', top:0, bottom:0, left:0, zIndex:100, transition:'width 0.25s ease', overflow:'hidden', boxShadow:`4px 0 24px rgba(0,0,0,.25)` }}>
          {/* Logo */}
          <div style={{ padding:'16px 0 14px', borderBottom:`1px solid ${C.border}44`, display:'flex', alignItems:'center', justifyContent:expanded?'flex-start':'center', paddingLeft:expanded?16:0, gap:12, minHeight:62, flexShrink:0 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${C.teal}15`, border:`1px solid ${C.teal}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src={logo} alt="DEER" style={{ width:28, height:'auto' }}/>
            </div>
            {expanded && <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#E8F2F0', letterSpacing:3, lineHeight:1 }}>DEER</div>
              <div style={{ fontSize:9, color:C.teal, letterSpacing:2 }}>MES v6</div>
            </div>}
          </div>

          {/* Toggle button */}
          <button onClick={()=>setExpanded(e=>!e)}
            style={{ position:'absolute', top:20, right:-11, width:22, height:22, borderRadius:'50%', background:C.surface3, border:`1px solid ${C.border}`, color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:101, transition:'all .2s' }}
            onMouseOver={e=>{e.currentTarget.style.background=C.teal;e.currentTarget.style.color='#000'}}
            onMouseOut={e=>{e.currentTarget.style.background=C.surface3;e.currentTarget.style.color=C.muted}}
          >{expanded ? <ChevronLeft size={12}/> : <ChevronRight size={12}/>}</button>

          <nav style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'8px 0', display:'flex', flexDirection:'column', gap:1 }}>
            <NavContent/>
          </nav>

          <div style={{ padding:'10px 8px', borderTop:`1px solid ${C.border}44`, flexShrink:0, display:'flex', flexDirection:'column', gap:6 }}>
            {expanded && <div style={{ padding:'0 4px' }}><LanguageSwitcher/></div>}
            <button onClick={doLogout} title={t('nav.logout')}
              style={{ width:'100%', padding:expanded?'9px 12px':'9px', borderRadius:10, border:`1px solid ${C.border}44`, background:'transparent', color:C.muted2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:expanded?'flex-start':'center', gap:10, transition:'all 0.15s' }}
              onMouseOver={e=>{e.currentTarget.style.color=C.red;e.currentTarget.style.background=`${C.red}10`}}
              onMouseOut={e=>{e.currentTarget.style.color=C.muted2;e.currentTarget.style.background='transparent'}}
            >
              <LogOut size={15}/>
              {expanded && <span style={{ fontSize:12 }}>{t('nav.logout')}</span>}
            </button>
          </div>
        </aside>
      )}

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div onClick={()=>setSidebarOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:200, backdropFilter:'blur(2px)' }}
          />
          {/* Drawer */}
          <aside ref={drawerRef} style={{ position:'fixed', top:0, left:0, bottom:0, width:280, background:`linear-gradient(180deg,${C.surface} 0%,${C.surface2} 100%)`, zIndex:201, display:'flex', flexDirection:'column', boxShadow:`8px 0 40px rgba(0,0,0,.5)`, animation:'slideIn .25s ease' }}>
            <style>{`@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>

            {/* Drawer header */}
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}44`, display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:62 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${C.teal}15`, border:`1px solid ${C.teal}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <img src={logo} alt="DEER" style={{ width:28, height:'auto' }}/>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#E8F2F0', letterSpacing:3, lineHeight:1 }}>DEER</div>
                  <div style={{ fontSize:9, color:C.teal, letterSpacing:2 }}>MES v6</div>
                </div>
              </div>
              <button onClick={()=>setSidebarOpen(false)}
                style={{ width:34, height:34, borderRadius:8, border:`1px solid ${C.border}`, background:C.surface3, color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={16}/>
              </button>
            </div>

            {/* User info */}
            <div style={{ padding:'12px 20px', borderBottom:`1px solid ${C.border}33`, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${C.teal}55,${C.accent}33)`, border:`1px solid ${C.teal}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:C.teal, flexShrink:0 }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#E8F2F0' }}>{user?.firstName} {user?.lastName}</div>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:1 }}>{user?.role?.toUpperCase()}</div>
              </div>
            </div>

            <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
              <NavContent mobile={true}/>
            </nav>

            <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}44`, display:'flex', flexDirection:'column', gap:8 }}>
              <LanguageSwitcher/>
              <button onClick={doLogout}
                style={{ width:'100%', padding:'12px 16px', borderRadius:10, border:`1px solid ${C.border}44`, background:'transparent', color:C.muted2, cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14 }}>
                <LogOut size={18}/> {t('nav.logout')}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft:sideW, flex:1, display:'flex', flexDirection:'column', minWidth:0, transition:'margin-left 0.25s ease' }}>

        {/* Header */}
        <header style={{ height:58, background:`linear-gradient(90deg,${C.surface},${C.surface2})`, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:10, position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 16px rgba(0,0,0,.2)' }}>

          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={()=>setSidebarOpen(true)}
              style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.border}`, background:C.surface3, color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Menu size={18}/>
            </button>
          )}

          {/* Logo on mobile */}
          {isMobile && (
            <div style={{ width:28, height:28, borderRadius:8, background:`${C.teal}15`, border:`1px solid ${C.teal}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <img src={logo} alt="DEER" style={{ width:20, height:'auto' }}/>
            </div>
          )}

          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:isMobile?8:9, color:C.muted, letterSpacing:2 }}>DEER MES v6</div>
            <div style={{ fontSize:isMobile?12:15, fontWeight:700, color:'#E8F2F0', letterSpacing:isMobile?1:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pageTitle}</div>
          </div>

          <div style={{ flex:1 }}/>

          {!isMobile && <LanguageSwitcher compact/>}

          {/* Notifications */}
          <button onClick={()=>setNotifOpen(o=>!o)}
            style={{ width:36, height:36, borderRadius:10, border:`1px solid ${unread>0?C.accent:C.border}`, background:C.surface3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexShrink:0 }}>
            <Bell size={16} color={unread>0?C.orange:C.muted}/>
            {unread>0 && <span style={{ position:'absolute', top:6, right:6, width:7, height:7, background:C.orange, borderRadius:'50%', border:`1.5px solid ${C.surface}` }}/>}
          </button>

          {/* User avatar - desktop only */}
          {!isMobile && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 14px 6px 6px', borderRadius:12, background:C.surface3, border:`1px solid ${C.border}` }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:`linear-gradient(135deg,${C.teal}55,${C.accent}33)`, border:`1px solid ${C.teal}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.teal }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#E8F2F0' }}>{user?.firstName} {user?.lastName}</div>
                <div style={{ fontSize:9, color:C.muted, letterSpacing:1 }}>{user?.role?.toUpperCase()}</div>
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main style={{ padding: isMobile ? 12 : 24, flex:1, overflowX:'hidden' }}>
          <Outlet/>
        </main>
      </div>

      {/* ── NOTIFICATIONS PANEL ── */}
      <div style={{ position:'fixed', right:notifOpen?0:-360, top:58, bottom:0, width: isMobile ? '100vw' : 340, background:`linear-gradient(180deg,${C.surface},${C.surface2})`, borderLeft:`1px solid ${C.border}`, zIndex:80, transition:'right 0.3s', overflowY:'auto', boxShadow:notifOpen?'-8px 0 32px rgba(0,0,0,.4)':'none' }}>
        <div style={{ padding:'16px 18px', borderBottom:`1px solid ${C.border}44`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:C.surface }}>
          <span style={{ fontWeight:700, fontSize:13, letterSpacing:1.5, color:'#E8F2F0' }}>
            OBAVIJESTI {unread>0 && <span style={{color:C.orange}}>({unread})</span>}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            {unread>0 && <button onClick={markAllRead} style={{ fontSize:10, color:C.muted2, background:'none', border:'none', cursor:'pointer' }}>sve pročitano</button>}
            <button onClick={()=>setNotifOpen(false)} style={{ background:'none', border:'none', color:C.muted2, fontSize:16, cursor:'pointer' }}>✕</button>
          </div>
        </div>
        {alerts.length===0 && <div style={{ padding:30, textAlign:'center', color:C.muted, fontSize:12 }}>Nema upozorenja</div>}
        {alerts.map((a,i)=>(
          <div key={a.id||i} onClick={()=>markRead(a.id)}
            style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}33`, display:'flex', gap:11, cursor:'pointer', opacity:a.is_read?.55:1 }}
            onMouseOver={e=>e.currentTarget.style.background=C.surface3}
            onMouseOut={e=>e.currentTarget.style.background='transparent'}>
            <span style={{ fontSize:16, flexShrink:0 }}>{a.type==='critical'?'🔴':a.type==='warning'?'🟠':'🔵'}</span>
            <div>
              <div style={{ fontSize:12, color:C.gray, lineHeight:1.5 }}>{a.message}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>{new Date(a.created_at).toLocaleDateString('hr')}</div>
            </div>
          </div>
        ))}
      </div>
      {notifOpen && <div onClick={()=>setNotifOpen(false)} style={{ position:'fixed', inset:0, zIndex:79 }}/>}
    </div>
  )
}
