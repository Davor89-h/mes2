import { useState } from 'react'
import { C, Btn, Loading } from '../components/UI'
import { Calendar, Brain, RefreshCw, AlertTriangle, TrendingUp, Cpu } from 'lucide-react'
import api from '../utils/api'

export default function AISchedulePage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.post('/ai/schedule')
      setResult(r.data)
    } catch(e) {
      setError(e.response?.data?.error || 'Greška pri generiranju rasporeda')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calendar size={24} color={C.accent}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>DEER MES · AI MODUL</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e8f0ee', letterSpacing: 1.5 }}>AI RASPORED</div>
          <div style={{ fontSize: 11, color: C.muted2 }}>Optimizirani produkcijski raspored generiran od Claude AI</div>
        </div>
        <Btn v="teal" onClick={generate} disabled={loading}>
          <Brain size={15} style={{ marginRight: 8 }}/>
          {loading ? 'AI generira...' : 'Generiraj raspored'}
        </Btn>
      </div>

      {!result && !loading && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <Calendar size={48} color={C.muted} style={{ marginBottom: 16 }}/>
          <div style={{ fontSize: 16, color: '#e8f0ee', marginBottom: 8 }}>Nema generiranog rasporeda</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>
            Klikni "Generiraj raspored" — AI će analizirati otvorene naloge, dostupne strojeve i alate, te predložiti optimalni plan.
          </div>
          <Btn v="teal" onClick={generate}><Brain size={14} style={{ marginRight: 8 }}/> Pokreni AI planiranje</Btn>
        </div>
      )}

      {loading && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <Brain size={40} color={C.teal} style={{ marginBottom: 16, animation: 'pulse 2s infinite' }}/>
          <div style={{ fontSize: 14, color: C.teal }}>Claude AI analizira narudžbe, strojeve i alate...</div>
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 12, color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <div style={{ background: C.surface, border: `1px solid ${C.teal}33`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 8 }}>AI SAŽETAK</div>
                <p style={{ margin: 0, fontSize: 13, color: '#d0e0da', lineHeight: 1.7 }}>{result.summary}</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {result.efficiency_gain_pct && (
                  <div style={{ background: `${'#4ADE80'}10`, border: `1px solid ${'#4ADE80'}30`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                    <TrendingUp size={16} color="#4ADE80" style={{ marginBottom: 4 }}/>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#4ADE80' }}>+{result.efficiency_gain_pct}%</div>
                    <div style={{ fontSize: 9, color: C.muted }}>DOBIT EFIKASNOSTI</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warnings & bottlenecks */}
          {(result.warnings?.length > 0 || result.bottlenecks?.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {result.bottlenecks?.length > 0 && (
                <div style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}33`, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <AlertTriangle size={14} color={C.orange}/>
                    <span style={{ fontSize: 10, color: C.orange, letterSpacing: 1, fontWeight: 700 }}>USKA GRLA</span>
                  </div>
                  {result.bottlenecks.map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#d0c0a0', marginBottom: 6 }}>• {b}</div>
                  ))}
                </div>
              )}
              {result.warnings?.length > 0 && (
                <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <AlertTriangle size={14} color={C.accent}/>
                    <span style={{ fontSize: 10, color: C.accent, letterSpacing: 1, fontWeight: 700 }}>UPOZORENJA</span>
                  </div>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#c8d8f0', marginBottom: 6 }}>• {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedule table */}
          {result.optimized_schedule?.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} color={C.teal}/>
                <span style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5 }}>OPTIMIZIRANI RASPORED ({result.optimized_schedule.length} narudžbi)</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.surface2 }}>
                      {['#', 'Narudžba', 'Stroj', 'Alati', 'Početak', 'Trajanje', 'Prioritet', 'Napomene'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, color: C.muted, letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.optimized_schedule.map((item, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}44` }}
                        onMouseOver={e => e.currentTarget.style.background = C.surface2}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted }}>{i+1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#e8f0ee' }}>{item.order_name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Cpu size={11} color={C.accent}/>
                            <span style={{ fontSize: 12, color: C.gray }}>{item.recommended_machine}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted }}>
                          {item.recommended_tools?.slice(0, 2).join(', ')}{item.recommended_tools?.length > 2 ? '...' : ''}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.teal, fontFamily: 'monospace' }}>{item.start_time}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: C.gray }}>{item.estimated_duration_hours}h</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: item.priority_score >= 8 ? C.red : item.priority_score >= 5 ? C.orange : '#4ADE80' }}>
                            {item.priority_score}/10
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted, maxWidth: 200 }}>{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, color: C.muted, textAlign: 'right' }}>
            Generirano: {result.generated_at ? new Date(result.generated_at).toLocaleString('hr-HR') : '—'}
          </div>
        </div>
      )}
    </div>
  )
}
