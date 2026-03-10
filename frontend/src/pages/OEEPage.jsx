import { useState, useEffect } from 'react'
import { C, Loading, Btn } from '../components/UI'
import { BarChart3, TrendingUp, Cpu, RefreshCw, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import api from '../utils/api'

// Simple radial progress component (no external lib needed)
function RadialGauge({ value, color, label, size = 110 }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke={`${color}20`} strokeWidth="10"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:'50% 50%', transition:'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="55" textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="Chakra Petch">
          {value}%
        </text>
      </svg>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginTop: -6 }}>{label}</div>
    </div>
  )
}

function OEECard({ machine, selected, onClick }) {
  const oee = machine.oee
  let color = C.green
  if (oee < 40) color = C.red
  else if (oee < 60) color = C.orange
  else if (oee < 85) color = C.accent

  return (
    <div onClick={onClick} style={{
      background: selected ? `${C.teal}15` : C.surface,
      border: `1px solid ${selected ? C.teal : C.border}`,
      borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
      transition: 'all .2s', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Cpu size={15} color={C.muted}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ee' }}>{machine.machine_name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${color}20`, color, border: `1px solid ${color}40` }}>
          {machine.rating}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[['A', machine.availability, '#4ADE80'], ['P', machine.performance, C.accent], ['Q', machine.quality, C.teal]].map(([k, v, c]) => (
          <div key={k} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}%</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>{k === 'A' ? 'DOSTUPNOST' : k === 'P' ? 'PERFORMANSE' : 'KVALITETA'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: `${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${oee}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .8s ease' }}/>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{oee}%</span>
        <span style={{ fontSize: 9, color: C.muted }}>OEE</span>
      </div>
    </div>
  )
}

export default function OEEPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/ai/oee?days=${days}`)
      setData(r.data)
    } catch(e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [days])

  if (loading) return <Loading/>

  const { company_avg_oee = 0, machines = [], best_machine, worst_machine, period_days } = data || {}

  let avgColor = C.green
  if (company_avg_oee < 40) avgColor = C.red
  else if (company_avg_oee < 60) avgColor = C.orange
  else if (company_avg_oee < 85) avgColor = C.accent

  const selectedMachine = selected ? machines.find(m => m.machine_id === selected) : null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${C.accent}15`, border: `1px solid ${C.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={24} color={C.accent}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>DEER MES · ANALITIKA</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e8f0ee', letterSpacing: 1.5 }}>OEE DASHBOARD</div>
          <div style={{ fontSize: 11, color: C.muted2 }}>Overall Equipment Effectiveness · zadnjih {period_days} dana</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${days === d ? C.teal : C.border}`, background: days === d ? `${C.teal}15` : 'transparent', color: days === d ? C.teal : C.muted, fontSize: 12, cursor: 'pointer' }}>
              {d}d
            </button>
          ))}
          <Btn v="teal" sm onClick={load}><RefreshCw size={13}/></Btn>
        </div>
      </div>

      {/* Company OEE summary */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 40 }}>
        <RadialGauge value={company_avg_oee} color={avgColor} label="PROSJEČNI OEE" size={130}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>TVORNICA — UKUPNI OEE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'STROJEVI', val: machines.length, color: C.teal, Icon: Cpu },
              { label: 'BEST', val: best_machine ? `${best_machine.machine_name}: ${best_machine.oee}%` : '—', color: '#4ADE80', Icon: CheckCircle },
              { label: 'WORST', val: worst_machine ? `${worst_machine.machine_name}: ${worst_machine.oee}%` : '—', color: C.red, Icon: AlertTriangle },
            ].map(({ label, val, color, Icon }) => (
              <div key={label} style={{ padding: '14px 16px', background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={12} color={color}/>
                  <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>{label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* OEE Legend */}
        <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 32, minWidth: 180 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>OEE REFERENCA</div>
          {[
            ['World Class', '≥ 85%', '#4ADE80'],
            ['Good', '60–84%', C.accent],
            ['Average', '40–59%', C.orange],
            ['Poor', '< 40%', C.red],
          ].map(([label, range, c]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c, flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: '#d0e0dc', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Machine cards */}
      {machines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>
          <Cpu size={40} color={C.muted} style={{ marginBottom: 12 }}/>
          <div>Nema podataka o strojevima. Dodaj strojeve i zabilježi upotrebu naprava.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, marginBottom: 14 }}>
            STROJEVI ({machines.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {machines.map(m => (
              <OEECard key={m.machine_id} machine={m}
                selected={selected === m.machine_id}
                onClick={() => setSelected(selected === m.machine_id ? null : m.machine_id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selectedMachine && (
            <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.teal}33`, borderRadius: 16, padding: '22px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Activity size={16} color={C.teal}/>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ee' }}>
                  {selectedMachine.machine_name} — Detaljna analiza
                </span>
                <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  ['OEE', `${selectedMachine.oee}%`, selectedMachine.rating_color],
                  ['Dostupnost', `${selectedMachine.availability}%`, '#4ADE80'],
                  ['Performanse', `${selectedMachine.performance}%`, C.accent],
                  ['Kvaliteta', `${selectedMachine.quality}%`, C.teal],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: C.surface2, borderRadius: 12, padding: '16px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  ['Planirani sati', `${selectedMachine.raw?.planned_hours || 0}h`],
                  ['Operativni sati', `${Math.round(selectedMachine.raw?.operating_hours || 0)}h`],
                  ['Ukupno operacija', selectedMachine.raw?.total_operations || 0],
                ].map(([label, val]) => (
                  <div key={label} style={{ fontSize: 11, color: C.muted }}>
                    {label}: <span style={{ color: C.gray, fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
