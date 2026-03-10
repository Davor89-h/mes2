import { useState, useEffect } from 'react'
import { C, Btn, Loading } from '../components/UI'
import { Cpu, Play, Zap, AlertTriangle, TrendingUp, CheckCircle, Clock, Layers } from 'lucide-react'
import api from '../utils/api'

export default function DigitalTwinPage() {
  const [scenarios, setScenarios] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [params, setParams] = useState({ working_hours_per_day: 8, shifts: 1 })
  const [name, setName] = useState('')

  useEffect(() => {
    api.get('/digital-twin').then(r => setScenarios(r.data || [])).catch(() => {}).finally(() => setLoadingList(false))
  }, [])

  const runSimulation = async () => {
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/digital-twin/simulate', {
        name: name || undefined,
        parameters: params
      })
      setResult(r.data)
      // Refresh list
      api.get('/digital-twin').then(r => setScenarios(r.data || [])).catch(() => {})
    } catch (e) {
      setResult({ error: e.response?.data?.error || 'Greška pri simulaciji' })
    }
    setLoading(false)
  }

  const runBottlenecks = async () => {
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/digital-twin/bottlenecks')
      setResult({ bottleneck_mode: true, ...r.data })
    } catch (e) {
      setResult({ error: e.response?.data?.error || 'Greška' })
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:10,color:C.muted,letterSpacing:2 }}>DEER MES · AI MODUL</div>
        <div style={{ fontSize:20,fontWeight:700,color:'#E8F2F0',letterSpacing:2 }}>DIGITALNI DVOJNIK</div>
        <div style={{ fontSize:11,color:C.muted2,marginTop:4 }}>Simulacija produkcijskog okruženja s AI analizom uskih grla</div>
      </div>

      {/* Controls */}
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:20 }}>
        <div style={{ fontSize:11,color:C.teal,letterSpacing:1.5,marginBottom:14 }}>PARAMETRI SIMULACIJE</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:14,marginBottom:16 }}>
          <div>
            <label style={{ fontSize:10,color:C.muted,letterSpacing:1,display:'block',marginBottom:5 }}>SATI/DAN</label>
            <input type='number' value={params.working_hours_per_day} min={1} max={24}
              onChange={e=>setParams(p=>({...p,working_hours_per_day:parseInt(e.target.value)||8}))}
              style={{ width:'100%',boxSizing:'border-box',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#E8F2F0',fontSize:13 }}/>
          </div>
          <div>
            <label style={{ fontSize:10,color:C.muted,letterSpacing:1,display:'block',marginBottom:5 }}>SMJENE</label>
            <select value={params.shifts} onChange={e=>setParams(p=>({...p,shifts:parseInt(e.target.value)}))}
              style={{ width:'100%',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#E8F2F0',fontSize:13 }}>
              <option value={1}>1 smjena</option>
              <option value={2}>2 smjene</option>
              <option value={3}>3 smjene (24h)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:10,color:C.muted,letterSpacing:1,display:'block',marginBottom:5 }}>NAZIV SCENARIJA (opcionalno)</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder='npr. Scenarij Q2 2025'
              style={{ width:'100%',boxSizing:'border-box',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#E8F2F0',fontSize:13 }}/>
          </div>
        </div>
        <div style={{ display:'flex',gap:12 }}>
          <Btn onClick={runSimulation} disabled={loading}>
            {loading ? <><Clock size={13}/> AI simulira...</> : <><Play size={13}/> Pokreni simulaciju</>}
          </Btn>
          <Btn onClick={runBottlenecks} disabled={loading} style={{ background:C.surface3,border:`1px solid ${C.border}`,color:C.muted2 }}>
            <Zap size={13}/> Brza analiza uskih grla
          </Btn>
        </div>
        {loading && (
          <div style={{ marginTop:14,padding:'12px 16px',background:`${C.teal}10`,borderRadius:8,fontSize:12,color:C.teal }}>
            🤖 Claude AI simulira produkcijsko okruženje s vašim strojevima, alatima i nalozima...
          </div>
        )}
      </div>

      {/* Results */}
      {result && !result.error && !result.bottleneck_mode && <SimulationResult data={result}/>}
      {result && !result.error && result.bottleneck_mode && <BottleneckResult data={result}/>}
      {result?.error && (
        <div style={{ background:`#F87171` + '10',border:`1px solid #F8717133`,borderRadius:12,padding:16,color:'#F87171',fontSize:13 }}>
          ⚠️ {result.error}
        </div>
      )}

      {/* Past scenarios */}
      {!loadingList && scenarios.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:2,marginBottom:12 }}>PROŠLI SCENARIJI</div>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {scenarios.slice(0,5).map(s => (
              <div key={s.id} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12,fontWeight:600,color:'#E8F2F0' }}>{s.name}</div>
                  <div style={{ fontSize:10,color:C.muted }}>{new Date(s.created_at).toLocaleDateString('hr-HR',{day:'numeric',month:'long',year:'numeric'})}</div>
                </div>
                <span style={{ fontSize:9,padding:'2px 8px',borderRadius:12,background:`${C.teal}15`,color:C.teal }}>
                  {s.status?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SimulationResult({ data }) {
  const s = data.simulation_summary || {}
  const riskColor = { low:'#4ADE80', medium:'#F5BC54', high:'#FB923C', critical:'#F87171' }[s.risk_level] || C.teal

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
      {/* KPIs */}
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20 }}>
        <div style={{ fontSize:11,color:C.teal,letterSpacing:1.5,marginBottom:14 }}>REZULTATI SIMULACIJE</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16 }}>
          {[
            { label:'Ukupno poslova', value:s.total_jobs, color:C.teal },
            { label:'Prosj. iskorištenost', value:`${s.overall_utilization_pct || 0}%`, color:'#60A5FA' },
            { label:'Uska grla', value:s.bottleneck_count, color:'#F5BC54' },
            { label:'Rizik', value:s.risk_level?.toUpperCase() || 'N/A', color:riskColor },
          ].map(k => (
            <div key={k.label} style={{ background:C.surface2,borderRadius:10,padding:'12px 14px',textAlign:'center' }}>
              <div style={{ fontSize:20,fontWeight:800,color:k.color }}>{k.value ?? '—'}</div>
              <div style={{ fontSize:9,color:C.muted,letterSpacing:1 }}>{k.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* AI Assessment */}
        {data.ai_assessment && (
          <div style={{ padding:'12px 16px',background:`${C.teal}08`,borderRadius:10,border:`1px solid ${C.teal}20`,fontSize:12,color:C.muted2,lineHeight:1.7 }}>
            🤖 {data.ai_assessment}
          </div>
        )}
      </div>

      {/* Bottlenecks */}
      {data.bottlenecks?.length > 0 && (
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20 }}>
          <div style={{ fontSize:11,color:'#F5BC54',letterSpacing:1.5,marginBottom:12 }}>USKA GRLA</div>
          {data.bottlenecks.map((b, i) => (
            <div key={i} style={{ display:'flex',gap:12,padding:'10px 12px',background:`#F5BC5410`,borderRadius:8,border:`1px solid #F5BC5422`,marginBottom:8 }}>
              <AlertTriangle size={14} color='#F5BC54' style={{ flexShrink:0,marginTop:1 }}/>
              <div>
                <div style={{ fontSize:12,fontWeight:600,color:'#F5BC54' }}>{b.location}</div>
                <div style={{ fontSize:11,color:C.muted2 }}>{b.impact}</div>
                <div style={{ fontSize:11,color:C.teal,marginTop:2 }}>→ {b.recommendation}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optimizations */}
      {data.optimizations?.length > 0 && (
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20 }}>
          <div style={{ fontSize:11,color:'#4ADE80',letterSpacing:1.5,marginBottom:12 }}>OPTIMIZACIJE</div>
          {data.optimizations.map((o, i) => (
            <div key={i} style={{ display:'flex',gap:12,padding:'10px 12px',background:`#4ADE8010`,borderRadius:8,border:`1px solid #4ADE8022`,marginBottom:8 }}>
              <TrendingUp size={14} color='#4ADE80' style={{ flexShrink:0,marginTop:1 }}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                  <span style={{ fontSize:12,fontWeight:600,color:'#4ADE80' }}>{o.category?.replace(/_/g,' ').toUpperCase()}</span>
                  {o.estimated_improvement_pct && (
                    <span style={{ fontSize:10,color:'#4ADE80' }}>+{o.estimated_improvement_pct}%</span>
                  )}
                </div>
                <div style={{ fontSize:11,color:C.muted2 }}>{o.proposed_change}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Machine states */}
      {data.machine_states?.length > 0 && (
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20 }}>
          <div style={{ fontSize:11,color:C.muted,letterSpacing:1.5,marginBottom:12 }}>STANJE STROJEVA</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10 }}>
            {data.machine_states.map((m, i) => {
              const c = { optimal:'#4ADE80', overloaded:'#F87171', underutilized:'#6B7280', blocked:'#F5BC54' }[m.status] || C.teal
              return (
                <div key={i} style={{ padding:'12px 14px',background:C.surface2,borderRadius:10,border:`1px solid ${m.bottleneck ? '#F87171' : C.border}` }}>
                  <div style={{ fontSize:11,fontWeight:600,color:'#E8F2F0',marginBottom:4 }}>{m.machine_name}</div>
                  <div style={{ fontSize:10,color:c,marginBottom:8 }}>{m.status?.toUpperCase()}{m.bottleneck ? ' ⚠️' : ''}</div>
                  <div style={{ height:4,background:C.border,borderRadius:2 }}>
                    <div style={{ width:`${m.utilization_pct || 0}%`,height:'100%',background:c,borderRadius:2 }}/>
                  </div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:4 }}>{m.utilization_pct || 0}% iskorištenost</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function BottleneckResult({ data }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20 }}>
        <div style={{ fontSize:11,color:'#F87171',letterSpacing:1.5,marginBottom:12 }}>ANALIZA USKIH GRLA</div>
        {data.summary && (
          <div style={{ padding:'10px 14px',background:`${C.teal}08`,borderRadius:8,fontSize:12,color:C.muted2,marginBottom:14,lineHeight:1.7 }}>
            🤖 {data.summary}
          </div>
        )}
        {(data.bottlenecks || []).map((b, i) => {
          const c = { low:'#4ADE80', medium:'#F5BC54', high:'#FB923C', critical:'#F87171' }[b.severity] || C.teal
          return (
            <div key={i} style={{ padding:'10px 14px',background:`${c}10`,border:`1px solid ${c}30`,borderRadius:8,marginBottom:8 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                <span style={{ fontSize:12,fontWeight:600,color:c }}>{b.resource}</span>
                <span style={{ fontSize:10,color:c }}>-{b.impact_on_throughput_pct || 0}% throughput</span>
              </div>
              <div style={{ fontSize:11,color:C.muted2 }}>{b.recommendation}</div>
            </div>
          )
        })}
        {data.quick_wins?.length > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:10,color:'#4ADE80',letterSpacing:1,marginBottom:8 }}>BRZE POBJEDE:</div>
            {data.quick_wins.map((q, i) => (
              <div key={i} style={{ display:'flex',gap:8,fontSize:12,color:C.muted2,marginBottom:4 }}>
                <CheckCircle size={12} color='#4ADE80' style={{ flexShrink:0,marginTop:1 }}/> {q}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
