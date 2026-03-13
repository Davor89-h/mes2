import { useState, useEffect, useRef, useCallback } from 'react'
import { C, Loading } from '../components/UI'
import { Cpu, Wifi, WifiOff, AlertTriangle, Activity, Thermometer, Zap, TrendingUp, RefreshCw } from 'lucide-react'

const WS_URL = `ws://${window.location.hostname}:5000/ws/machines`
const STATUS_CONFIG = {
  running: { color: '#4ADE80', label: 'RADI', dot: '#4ADE80' },
  idle:    { color: C?.accent || '#60A5FA', label: 'STOJI', dot: C?.accent || '#60A5FA' },
  alarm:   { color: '#F87171', label: 'ALARM', dot: '#F87171' },
  offline: { color: '#6B7280', label: 'OFFLINE', dot: '#6B7280' },
}

// Colors
const BG = '#0d1f1c'
const SURFACE = '#142820'
const SURFACE2 = '#1a3028'
const SURFACE3 = '#1f3830'
const BORDER = '#2a4038'
const TEAL = '#51FFFF'
const MUTED = '#5A8480'
const MUTED2 = '#7A9A90'
const GRAY = '#C8DDD9'

function GaugeBar({ value, max = 100, color, label, unit = '%' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = pct > 90 ? '#F87171' : pct > 75 ? '#FB923C' : color

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: MUTED, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: 'monospace' }}>
          {typeof value === 'number' ? value.toFixed(unit === '%' ? 0 : 1) : value}{unit}
        </span>
      </div>
      <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.6s ease, background 0.3s' }}/>
      </div>
    </div>
  )
}

function MachineCard({ machine, selected, onClick }) {
  const sc = STATUS_CONFIG[machine.status] || STATUS_CONFIG.offline
  const hasAlerts = machine.alerts?.length > 0

  return (
    <div onClick={onClick} style={{
      background: selected ? `${TEAL}10` : SURFACE,
      border: `1px solid ${hasAlerts ? '#F87171' : selected ? TEAL : BORDER}`,
      borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
      transition: 'all .2s', position: 'relative', overflow: 'hidden',
      animation: hasAlerts ? 'none' : undefined,
    }}>
      {/* Status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: sc.color }}/>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, boxShadow: `0 0 6px ${sc.color}` }}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ee', flex: 1 }}>{machine.machine_name}</span>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 12, background: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}>
          {sc.label}
        </span>
        {hasAlerts && <AlertTriangle size={14} color="#F87171"/>}
      </div>

      {/* Key metrics */}
      <GaugeBar value={machine.spindle_load} label="Spindle" unit="%" color={TEAL}/>
      <GaugeBar value={machine.vibration} max={5} label="Vibracija" unit="g" color="#F5BC54"/>
      <GaugeBar value={machine.temperature} max={80} label="Temp" unit="°C" color="#FB923C"/>

      {/* Bottom row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 10, color: MUTED }}>
          S: <span style={{ color: TEAL, fontFamily: 'monospace' }}>{machine.spindle_speed?.toFixed(0)} rpm</span>
        </div>
        <div style={{ fontSize: 10, color: MUTED }}>
          F: <span style={{ color: TEAL, fontFamily: 'monospace' }}>{machine.feed_rate?.toFixed(0)}</span>
        </div>
        <div style={{ fontSize: 10, color: MUTED }}>
          T: <span style={{ color: TEAL, fontFamily: 'monospace' }}>T{machine.tool_number?.toString().padStart(2,'0')}</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: MUTED }}>
          {machine.part_count} kom
        </div>
      </div>
    </div>
  )
}

function SparkLine({ data, color, height = 30 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 0.01)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120, h = height
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function MachineTelemetryPage() {
  const [machines, setMachines] = useState([])
  const [selected, setSelected] = useState(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState({}) // machineId → [{spindle_load, ...}]
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        console.log('[WS] Connected')
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          setLastUpdate(new Date())

          if (msg.type === 'batch' || msg.type === 'snapshot') {
            const data = msg.data || []
            setMachines(data)

            // Update history
            setHistory(prev => {
              const updated = { ...prev }
              data.forEach(m => {
                const hist = updated[m.machine_id] || []
                updated[m.machine_id] = [...hist.slice(-30), m.spindle_load]
              })
              return updated
            })
          }

          if (msg.type === 'alert') {
            setAlerts(prev => {
              const newAlerts = [{ ...msg.data, timestamp: msg.timestamp }, ...prev].slice(0, 20)
              return newAlerts
            })
          }
        } catch {}
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 3s
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch(e) {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  const selectedMachine = selected ? machines.find(m => m.machine_id === selected) : null
  const machineHistory = selected ? (history[selected] || []) : []

  const runningCount = machines.filter(m => m.status === 'running').length
  const alarmCount = machines.filter(m => m.status === 'alarm').length
  const idleCount = machines.filter(m => m.status === 'idle').length

  return (
    <div style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${TEAL}15`, border: `1px solid ${TEAL}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={24} color={TEAL}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 2 }}>DEER MES v4 · REAL-TIME</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e8f0ee', letterSpacing: 1.5 }}>MACHINE MONITORING</div>
          <div style={{ fontSize: 11, color: MUTED2, display: 'flex', alignItems: 'center', gap: 8 }}>
            {connected ? (
              <><Wifi size={11} color="#4ADE80"/> <span style={{ color: '#4ADE80' }}>WebSocket aktivan</span></>
            ) : (
              <><WifiOff size={11} color="#F87171"/> <span style={{ color: '#F87171' }}>Spajanje...</span></>
            )}
            {lastUpdate && <span style={{ color: MUTED }}>· {lastUpdate.toLocaleTimeString('hr-HR')}</span>}
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            ['RADI', runningCount, '#4ADE80'],
            ['STOJI', idleCount, '#60A5FA'],
            ['ALARM', alarmCount, '#F87171'],
          ].map(([label, count, color]) => (
            <div key={label} style={{ padding: '8px 14px', borderRadius: 10, background: `${color}12`, border: `1px solid ${color}33`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts ticker */}
      {alerts.length > 0 && (
        <div style={{ background: `#F8717115`, border: `1px solid #F8717133`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto' }}>
          <AlertTriangle size={14} color="#F87171" style={{ flexShrink: 0 }}/>
          <span style={{ fontSize: 11, color: '#F87171', fontWeight: 700, flexShrink: 0 }}>ALARMI:</span>
          {alerts.slice(0, 3).map((a, i) => (
            <span key={i} style={{ fontSize: 11, color: GRAY, flexShrink: 0 }}>
              {a.alerts?.[0]?.message || JSON.stringify(a)}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignItems: 'start' }}>
        {/* Machine cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {machines.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: MUTED }}>
              {connected ? (
                <><RefreshCw size={32} color={MUTED} style={{ marginBottom: 12 }}/><div>Čekanje na telemetriju...</div></>
              ) : (
                <><WifiOff size={32} color={MUTED} style={{ marginBottom: 12 }}/><div>Spajanje na WebSocket...</div></>
              )}
            </div>
          ) : machines.map(m => (
            <MachineCard key={m.machine_id} machine={m}
              selected={selected === m.machine_id}
              onClick={() => setSelected(selected === m.machine_id ? null : m.machine_id)}
            />
          ))}
        </div>

        {/* Detail panel */}
        {selectedMachine && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px', position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Cpu size={16} color={TEAL}/>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ee', flex: 1 }}>{selectedMachine.machine_name}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {/* Program */}
            {selectedMachine.current_program && (
              <div style={{ padding: '8px 12px', background: SURFACE2, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: MUTED }}>Program</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: TEAL, fontWeight: 700 }}>{selectedMachine.current_program}</span>
              </div>
            )}

            {/* All gauges */}
            <div style={{ marginBottom: 16 }}>
              <GaugeBar value={selectedMachine.spindle_load} label="Spindle Load" unit="%" color={TEAL}/>
              <GaugeBar value={selectedMachine.spindle_speed} max={8000} label="Spindle Speed" unit=" rpm" color="#F5BC54"/>
              <GaugeBar value={selectedMachine.feed_rate} max={5000} label="Feed Rate" unit=" mm/min" color="#60A5FA"/>
              <GaugeBar value={selectedMachine.x_axis_load} label="X Axis" unit="%" color="#A78BFA"/>
              <GaugeBar value={selectedMachine.y_axis_load} label="Y Axis" unit="%" color="#A78BFA"/>
              <GaugeBar value={selectedMachine.z_axis_load} label="Z Axis" unit="%" color="#A78BFA"/>
              <GaugeBar value={selectedMachine.vibration} max={5} label="Vibration" unit="g" color="#F5BC54"/>
              <GaugeBar value={selectedMachine.temperature} max={80} label="Temperature" unit="°C" color="#FB923C"/>
            </div>

            {/* Sparkline */}
            {machineHistory.length > 3 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>SPINDLE TREND (zadnjih 30 uzoraka)</div>
                <SparkLine data={machineHistory} color={TEAL}/>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Tool No.', `T${selectedMachine.tool_number?.toString().padStart(2,'0')}`, TEAL],
                ['Parts', selectedMachine.part_count, '#4ADE80'],
                ['Cycle', `${selectedMachine.cycle_time_sec}s`, '#60A5FA'],
                ['Status', STATUS_CONFIG[selectedMachine.status]?.label, STATUS_CONFIG[selectedMachine.status]?.color],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: SURFACE2, borderRadius: 8, padding: '10px 12px', border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 9, color: MUTED, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: color || GRAY }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Active alerts for this machine */}
            {selectedMachine.alerts?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: '#F87171', letterSpacing: 1, marginBottom: 8 }}>AKTIVNI ALARMI</div>
                {selectedMachine.alerts.map((a, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: `#F8717112`, border: `1px solid #F8717133`, borderRadius: 8, marginBottom: 6, fontSize: 11, color: '#F87171' }}>
                    {a.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}
