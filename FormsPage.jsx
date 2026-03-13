import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { C, Loading, Btn } from '../components/UI'
import { Brain, RefreshCw, AlertTriangle, CheckCircle, Info, Zap, Wrench, TrendingUp, Shield } from 'lucide-react'
import api from '../utils/api'

const PRIORITY_COLOR = { critical: C.red, high: C.orange, medium: C.accent, low: C.teal }
const PRIORITY_BG    = { critical:`${C.red}12`, high:`${C.orange}10`, medium:`${C.accent}10`, low:`${C.teal}09` }
const PRIORITY_BORDER = { critical:`${C.red}40`, high:`${C.orange}33`, medium:`${C.accent}33`, low:`${C.teal}22` }
const PRIORITY_LABEL = { critical:'KRITIČNO', high:'VISOKO', medium:'SREDNJE', low:'NISKO' }

const CAT_ICON = {
  maintenance: <Wrench size={16}/>,
  inventory: <Shield size={16}/>,
  efficiency: <TrendingUp size={16}/>,
  safety: <AlertTriangle size={16}/>,
  optimization: <Zap size={16}/>,
}

export default function AIInsightsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setError(null)
    try {
      const r = await api.get('/ai/insights')
      setData(r.data)
    } catch(e) {
      setError(e.response?.data?.error || 'Greška pri dohvatu podataka')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])
  const refresh = () => { setRefreshing(true); load() }

  if (loading) return <Loading/>

  const { insights = [], stats = {}, ai_powered, message: infoMsg } = data || {}

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',marginBottom:24,gap:16 }}>
        <div style={{ width:48,height:48,borderRadius:14,background:`${C.teal}15`,border:`1px solid ${C.teal}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Brain size={24} color={C.teal}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:2,marginBottom:2 }}>DEER MES · AI MODUL</div>
          <div style={{ fontSize:19,fontWeight:700,color:'#e8f0ee',letterSpacing:1.5 }}>FIXTURE INTELLIGENCE</div>
          <div style={{ fontSize:11,color:C.muted2,marginTop:3 }}>
            {ai_powered
              ? <span style={{ color:C.green }}>✦ Claude AI aktivna analiza</span>
              : <span style={{ color:C.teal }}>✦ Lokalni AI — live podaci iz vaše baze</span>
            }
          </div>
        </div>
        <Btn v="teal" sm onClick={refresh} disabled={refreshing}>
          <RefreshCw size={14} style={{ marginRight:6, animation:refreshing?'spin 1s linear infinite':undefined }}/>
          {refreshing ? 'Analizira...' : 'Osvježi AI'}
        </Btn>
      </div>

      {/* Info banner ako AI nije konfiguriran */}
      {!ai_powered && !data?.local_ai && infoMsg && (
        <div style={{ padding:'12px 18px',background:`${C.orange}12`,border:`1px solid ${C.orange}33`,borderRadius:12,marginBottom:20,display:'flex',gap:10,alignItems:'flex-start' }}>
          <Info size={16} color={C.orange} style={{ flexShrink:0,marginTop:1 }}/>
          <div>
            <div style={{ fontSize:12,color:C.orange,fontWeight:600,marginBottom:4 }}>AI nije konfiguriran</div>
            <div style={{ fontSize:11,color:C.muted }}>Dodaj <code style={{background:C.surface3,padding:'1px 5px',borderRadius:4}}>ANTHROPIC_API_KEY</code> u <code style={{background:C.surface3,padding:'1px 5px',borderRadius:4}}>backend/.env</code> za pravu Claude AI analizu.</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:26 }}>
          <KpiCard label="Naprave ukupno" value={stats.total_fixtures||0} color={C.teal} Icon={Shield}/>
          <KpiCard label="U produkciji" value={stats.in_production||0} color={C.accent} Icon={Zap}/>
          <KpiCard label="Iskorištenost" value={`${stats.utilization_rate_pct||0}%`} color={stats.utilization_rate_pct>80?C.orange:'#4ADE80'} Icon={TrendingUp}/>
          <KpiCard label="Servis prekoračen" value={stats.overdue_maintenance_count||0} color={stats.overdue_maintenance_count>0?C.red:'#4ADE80'} Icon={Wrench}/>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding:'16px 20px',background:`${C.red}10`,border:`1px solid ${C.red}33`,borderRadius:12,color:C.red,fontSize:13,marginBottom:20 }}>
          ⚠ {error}
        </div>
      )}

      {/* Insights */}
      <div>
        <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,marginBottom:14 }}>
          AI PREPORUKE & UPOZORENJA {insights.length > 0 && <span style={{color:C.teal}}>({insights.length})</span>}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {insights.map((ins, i) => <InsightCard key={i} insight={ins}/>)}
          {!insights.length && !error && (
            <div style={{ textAlign:'center',padding:50,color:C.green,fontSize:13,display:'flex',flexDirection:'column',alignItems:'center',gap:10 }}>
              <CheckCircle size={32} color={C.green}/>
              Sustav je optimalan — nema kritičnih preporuka
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop:24,padding:'12px 18px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:8 }}>
        <Brain size={14} color={C.teal}/>
        {ai_powered
          ? 'AI analiza generirana pomoću Claude — temelji se na stvarnim podacima iz sustava.'
          : 'Lokalni AI — čita live podatke iz vaše baze (strojevi, alati, nalozi, naprave, DMS...). Nema vanjskih poziva.'}
        {data?.generated_at && (
          <span style={{ marginLeft:'auto' }}>
            {new Date(data.generated_at).toLocaleTimeString('hr-HR')}
          </span>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, Icon }) {
  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'18px 20px',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:color }}/>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
        <Icon size={14} color={color}/>
        <span style={{ fontSize:10,color:C.muted,letterSpacing:1.2,textTransform:'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize:32,fontWeight:700,color,lineHeight:1 }}>{value}</div>
    </div>
  )
}

function InsightCard({ insight }) {
  const pc = PRIORITY_COLOR[insight.priority] || C.teal
  const pb = PRIORITY_BG[insight.priority] || `${C.teal}09`
  const pBorder = PRIORITY_BORDER[insight.priority] || `${C.teal}22`
  const CatIcon = CAT_ICON[insight.category]

  return (
    <div style={{ background:pb,border:`1px solid ${pBorder}`,borderRadius:14,padding:'18px 22px',display:'flex',gap:16,alignItems:'flex-start' }}>
      <div style={{ width:44,height:44,borderRadius:12,background:`${pc}20`,border:`1px solid ${pc}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>
        {insight.icon || '💡'}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap' }}>
          <span style={{ fontSize:14,fontWeight:700,color:'#e8f0ee' }}>{insight.title}</span>
          <span style={{ fontSize:9,padding:'3px 8px',borderRadius:20,background:`${pc}20`,color:pc,border:`1px solid ${pc}33`,letterSpacing:1 }}>
            {PRIORITY_LABEL[insight.priority] || insight.priority?.toUpperCase()}
          </span>
          {insight.category && (
            <span style={{ fontSize:9,padding:'3px 8px',borderRadius:20,background:`${C.surface3}`,color:C.muted2,display:'flex',alignItems:'center',gap:4 }}>
              {CatIcon} {insight.category.toUpperCase()}
            </span>
          )}
        </div>
        <p style={{ fontSize:13,color:C.gray,lineHeight:1.7,margin:0 }}>{insight.message}</p>
        {insight.action && (
          <div style={{ marginTop:10,padding:'7px 12px',background:`${pc}15`,border:`1px solid ${pc}30`,borderRadius:8,fontSize:11,color:pc,display:'inline-flex',alignItems:'center',gap:6 }}>
            → {insight.action}
          </div>
        )}
      </div>
    </div>
  )
}
