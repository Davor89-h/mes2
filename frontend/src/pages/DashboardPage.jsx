import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { C, StatCard, Loading } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const ago = (d) => { const diff=Math.round((Date.now()-new Date(d))/60000); return diff<1?'upravo':diff<60?`${diff}m`:diff<1440?`${Math.round(diff/60)}h`:`${Math.round(diff/1440)}d` }

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [fixtures, setFixtures] = useState(null)
  const [woStats, setWoStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats').catch(()=>null),
      api.get('/fixtures/stats').catch(()=>null),
      api.get('/work-orders/stats/overview').catch(()=>null),
    ]).then(([dash, fix, wo]) => {
      setData(dash?.data || getMockDash())
      setFixtures(fix?.data || { total:0, active:0, in_production:0, maintenance:0, overdue_maintenance:0 })
      setWoStats(wo?.data || null)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading/>
  const { tools, orders, alerts, activity } = data

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom:24,display:'flex',alignItems:'flex-end',justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:11,color:C.muted,letterSpacing:2,marginBottom:4 }}>DOBRODOŠAO NATRAG,</div>
          <div style={{ fontSize:24,fontWeight:700,color:'#E8F2F0',letterSpacing:2 }}>{user?.firstName} {user?.lastName}</div>
        </div>
        <div style={{ fontSize:11,color:C.muted2,textAlign:'right' }}>
          <div style={{ color:C.teal,fontSize:10,letterSpacing:1 }}>SUSTAV AKTIVAN</div>
          <div>{new Date().toLocaleDateString('hr-HR',{weekday:'long',day:'numeric',month:'long'})}</div>
        </div>
      </div>

      {/* Section: Naprave */}
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
        <div style={{ width:3,height:16,background:`linear-gradient(${C.teal},${C.teal}44)`,borderRadius:2 }}/>
        <div style={{ fontSize:10,color:C.teal,letterSpacing:2 }}>STEZNE NAPRAVE</div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
        <StatCard label={t('dashboard.total_fixtures')} value={fixtures?.total} color="yellow" onClick={()=>navigate('/fixtures')}/>
        <StatCard label={t('dashboard.active_fixtures')} value={fixtures?.active} color="green" onClick={()=>navigate('/fixtures')}/>
        <StatCard label={t('dashboard.in_production')} value={fixtures?.in_production} color="teal" onClick={()=>navigate('/usage')}/>
        <StatCard label={t('dashboard.overdue_maintenance')} value={fixtures?.overdue_maintenance} color="red" onClick={()=>navigate('/fixtures')}/>
      </div>

      {/* Section: MES KLASIKA */}
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
        <div style={{ width:3,height:16,background:`linear-gradient(${C.accent},${C.accent}44)`,borderRadius:2 }}/>
        <div style={{ fontSize:10,color:C.accent,letterSpacing:2 }}>MES KLASIKA</div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
        <StatCard label={t('dashboard.active_orders')} value={orders?.active} sub={`${orders?.late||0} kasne`} color="yellow" onClick={()=>navigate('/nalozi')}/>
        <StatCard label={t('dashboard.tools_available')} value={tools?.available} sub={`od ${tools?.total} ukupno`} color="green" onClick={()=>navigate('/alatnica')}/>
        <StatCard label={t('dashboard.low_stock')} value={parseInt(tools?.low||0)+parseInt(data.clamping?.critical||0)} color="orange"/>
        <StatCard label={t('dashboard.critical')} value={tools?.critical} color="red" onClick={()=>navigate('/alatnica')}/>
      </div>

      {/* Section: MES v2 */}
      {woStats && (
        <>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ width:3,height:16,background:`linear-gradient(${C.teal},${C.teal}44)`,borderRadius:2 }}/>
            <div style={{ fontSize:10,color:C.teal,letterSpacing:2 }}>MES v2 — PRODUKCIJA</div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
            <StatCard label="U tijeku" value={woStats.in_progress||0} sub={woStats.in_progress_list?.[0]?.part_name||''} color="teal" onClick={()=>navigate('/work-orders')}/>
            <StatCard label="Planirano" value={woStats.planned||0} color="yellow" onClick={()=>navigate('/production-planning')}/>
            <StatCard label="Završeno danas" value={woStats.completed_today||0} color="green" onClick={()=>navigate('/work-orders')}/>
            <StatCard label="Kasni" value={woStats.overdue||0} color="red" onClick={()=>navigate('/work-orders')}/>
          </div>
        </>
      )}


      {/* Section: ZADACI */}
      {data.taskStats && (
        <>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ width:3,height:16,background:`linear-gradient(${C.accent},${C.accent}44)`,borderRadius:2 }}/>
            <div style={{ fontSize:10,color:C.accent,letterSpacing:2 }}>ZADACI</div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
            <StatCard label="Otvoreni zadaci" value={(data.taskStats.open||0)+(data.taskStats.in_progress||0)} color="yellow" onClick={()=>navigate('/tasks')}/>
            <StatCard label="Moji zadaci" value={data.taskStats.my_tasks||0} color="teal" onClick={()=>navigate('/tasks')}/>
            <StatCard label="Hitni" value={data.taskStats.urgent_tasks||0} color="red" onClick={()=>navigate('/tasks')}/>
            <StatCard label="Kasni" value={data.taskStats.overdue_tasks||0} color="orange" onClick={()=>navigate('/tasks')}/>
          </div>
        </>
      )}

      {/* Section: STROJEVI */}
      {data.machines && (
        <>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ width:3,height:16,background:`linear-gradient(${C.teal},${C.teal}44)`,borderRadius:2 }}/>
            <div style={{ fontSize:10,color:C.teal,letterSpacing:2 }}>STATUS STROJEVA</div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
            <StatCard label="Ukupno strojeva" value={data.machines.total||0} color="yellow" onClick={()=>navigate('/machines')}/>
            <StatCard label="U radu" value={data.machines.running||0} color="green" onClick={()=>navigate('/machines')}/>
            <StatCard label="U stanju mirovanja" value={data.machines.idle||0} color="teal" onClick={()=>navigate('/machines')}/>
            <StatCard label="U održavanju" value={data.machines.maintenance||0} color="orange" onClick={()=>navigate('/machine-maintenance')}/>
          </div>
        </>
      )}

      {/* Bottom panels */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
        {/* Alerts */}
        <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:16,padding:22,boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}>
            <div style={{ width:3,height:14,background:C.orange,borderRadius:2 }}/>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5 }}>AKTIVNA UPOZORENJA</div>
          </div>
          {alerts?.filter(a=>!a.is_read).slice(0,5).map((a,i)=>(
            <div key={a.id||i} style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',borderRadius:10,marginBottom:8,background:a.type==='critical'?`${C.red}10`:`${C.orange}10`,border:`1px solid ${a.type==='critical'?C.red+'33':C.orange+'33'}` }}>
              <span style={{ fontSize:14,flexShrink:0 }}>{a.type==='critical'?'🔴':'🟠'}</span>
              <div>
                <div style={{ fontSize:12,color:C.gray }}>{a.message}</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{ago(a.created_at)}</div>
              </div>
            </div>
          ))}
          {!alerts?.filter(a=>!a.is_read).length&&(
            <div style={{ textAlign:'center',padding:20,color:C.green,fontSize:12 }}>✓ Nema aktivnih upozorenja</div>
          )}
          <button onClick={()=>navigate('/ai-insights')}
            style={{ marginTop:8,width:'100%',background:`${C.teal}0e`,border:`1px solid ${C.teal}33`,borderRadius:10,padding:'10px',color:C.teal,fontSize:11,cursor:'pointer',transition:'all .2s',letterSpacing:1,fontFamily:"'Chakra Petch',sans-serif" }}
            onMouseOver={e=>e.currentTarget.style.background=`${C.teal}1e`}
            onMouseOut={e=>e.currentTarget.style.background=`${C.teal}0e`}
          >◆ AI INSIGHTS →</button>
        </div>

        {/* Activity */}
        <div style={{ background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:16,padding:22,boxShadow:'0 4px 20px rgba(0,0,0,.2)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}>
            <div style={{ width:3,height:14,background:C.teal,borderRadius:2 }}/>
            <div style={{ fontSize:10,color:C.muted,letterSpacing:1.5 }}>ZADNJA AKTIVNOST</div>
          </div>
          {activity?.slice(0,6).map((a,i)=>{
            const dc={add:C.green,remove:C.red,create:C.teal,update:C.accent}[a.action]||C.muted
            return (
              <div key={i} style={{ display:'flex',gap:12,padding:'9px 0',borderBottom:`1px solid ${C.border}33` }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:dc,marginTop:5,flexShrink:0,boxShadow:`0 0 6px ${dc}` }}/>
                <div>
                  <div style={{ fontSize:12,color:C.gray }}><strong style={{color:'#E8F2F0'}}>{a.user_name}</strong> — {a.entity_name||a.tool_name}</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{ago(a.created_at)}</div>
                </div>
              </div>
            )
          })}
          {!activity?.length&&<div style={{ textAlign:'center',padding:20,color:C.muted,fontSize:12 }}>Nema nedavne aktivnosti</div>}
        </div>
      </div>
    </div>
  )
}

function getMockDash() {
  return {
    tools:{ total:15,available:10,low:3,critical:2 },
    clamping:{ total:5,critical:0 },
    materials:{ total:7,critical:1 },
    orders:{ active:6,completed_month:38,waiting:4,late:3 },
    alerts:[
      {id:1,type:'critical',message:'Glodalo Ø20 radius — KRITIČNO: 2/4 kom',created_at:new Date(),is_read:false},
      {id:2,type:'warning',message:'Svrdlo Ø8 HSS-Co — Niske zalihe: 6/8',created_at:new Date(),is_read:false},
    ],
    activity:[
      {action:'add',tool_name:'Svrdlo Ø6',user_name:'Ivan Kovač',created_at:new Date(Date.now()-12*60000)},
    ]
  }
}
