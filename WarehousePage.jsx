import { useState, useRef } from 'react'
import { C, Btn } from '../components/UI'
import { Code2, Upload, Brain, AlertTriangle, CheckCircle, Zap, Clock, Wrench, TrendingUp } from 'lucide-react'
import api from '../utils/api'

const SEVERITY_CONFIG = {
  critical: { color: C.red, icon: '🔴' },
  warning:  { color: C.orange, icon: '🟡' },
  info:     { color: C.teal, icon: '🔵' },
}

const RISK_COLOR = { low: '#4ADE80', medium: C.accent, high: C.orange, critical: C.red }

export default function GCodePage() {
  const [file, setFile] = useState(null)
  const [gcodeText, setGcodeText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('upload') // 'upload' | 'paste'
  const fileRef = useRef()

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    // Preview text
    const reader = new FileReader()
    reader.onload = (ev) => setGcodeText(ev.target.result)
    reader.readAsText(f)
  }

  const analyze = async () => {
    if (!file && !gcodeText.trim()) {
      setError('Učitaj datoteku ili upiši G-kod')
      return
    }
    setLoading(true)
    setError(null)
    try {
      let r
      if (file) {
        const fd = new FormData()
        fd.append('gcode', file)
        r = await api.post('/ai/gcode', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        r = await api.post('/ai/gcode', { gcode_text: gcodeText })
      }
      setResult(r.data)
    } catch(e) {
      setError(e.response?.data?.error || 'Greška pri analizi')
    } finally { setLoading(false) }
  }

  const drop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); fileRef.current.files = e.dataTransfer.files }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${'#A78BFA'}15`, border: `1px solid ${'#A78BFA'}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Code2 size={24} color="#A78BFA"/>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>DEER MES · AI MODUL</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#e8f0ee', letterSpacing: 1.5 }}>G-KOD ANALIZA</div>
          <div style={{ fontSize: 11, color: C.muted2 }}>AI analiza CNC programa — rizici, optimizacije, opterećenje alata</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '400px 1fr' : '1fr', gap: 20 }}>
        {/* Upload panel */}
        <div>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['upload', 'Učitaj datoteku'], ['paste', 'Upiši G-kod']].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)}
                style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${mode === k ? '#A78BFA' : C.border}`, background: mode === k ? '#A78BFA15' : 'transparent', color: mode === k ? '#A78BFA' : C.muted, fontSize: 12, cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {mode === 'upload' ? (
            <div onDrop={drop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              style={{ border: `2px dashed ${file ? '#A78BFA' : C.border}`, borderRadius: 14, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#A78BFA08' : C.surface, transition: 'all .2s', marginBottom: 16 }}>
              <input ref={fileRef} type="file" accept=".nc,.cnc,.gcode,.g,.ngc,.txt" onChange={handleFile} style={{ display: 'none' }}/>
              {file ? (
                <div>
                  <Code2 size={32} color="#A78BFA" style={{ marginBottom: 10 }}/>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f0ee' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · klikni za zamjenu</div>
                </div>
              ) : (
                <div>
                  <Upload size={32} color={C.muted} style={{ marginBottom: 10 }}/>
                  <div style={{ fontSize: 13, color: C.muted }}>Povuci G-kod datoteku ovdje ili klikni</div>
                  <div style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>.nc · .cnc · .gcode · .g · .ngc · .txt (max 2MB)</div>
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={gcodeText}
              onChange={e => setGcodeText(e.target.value)}
              placeholder="Upiši ili zalijepi G-kod program...&#10;&#10;Primjer:&#10;G21 G90 G94&#10;T01 M06&#10;G0 X0 Y0 Z10&#10;M03 S3500&#10;G1 Z-1 F200&#10;..."
              style={{ width: '100%', height: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', color: '#c8e0d8', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
            />
          )}

          {/* G-code preview */}
          {gcodeText && mode === 'upload' && (
            <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>PREVIEW</div>
              <pre style={{ fontSize: 11, color: '#a0c8b8', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
                {gcodeText.slice(0, 600)}{gcodeText.length > 600 ? '\n... [skraćeno]' : ''}
              </pre>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8, color: C.red, fontSize: 12, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <Btn v="teal" onClick={analyze} disabled={loading || (!file && !gcodeText.trim())}
            style={{ width: '100%', justifyContent: 'center' }}>
            <Brain size={15} style={{ marginRight: 8 }}/>
            {loading ? 'Claude AI analizira...' : 'Analiziraj G-kod'}
          </Btn>
        </div>

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Code2 size={16} color="#A78BFA"/>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ee' }}>{result.filename}</span>
                <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{new Date(result.analyzed_at).toLocaleTimeString('hr-HR')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  ['Linije koda', result.summary?.total_lines, C.teal, Clock],
                  ['Alati', result.summary?.tool_count, '#A78BFA', Wrench],
                  ['Kompleksnost', result.summary?.complexity, C.accent, TrendingUp],
                  ['Rizik', result.summary?.overall_risk, RISK_COLOR[result.summary?.overall_risk] || C.muted, AlertTriangle],
                ].map(([label, val, color, Icon]) => (
                  <div key={label} style={{ background: C.surface2, borderRadius: 10, padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <Icon size={11} color={color}/>
                      <span style={{ fontSize: 9, color: C.muted }}>{label.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Notes */}
            {result.ai_notes && (
              <div style={{ background: `#A78BFA10`, border: `1px solid #A78BFA33`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 10 }}>
                <Brain size={16} color="#A78BFA" style={{ flexShrink: 0, marginTop: 1 }}/>
                <p style={{ margin: 0, fontSize: 13, color: '#d0c8e0', lineHeight: 1.6 }}>{result.ai_notes}</p>
              </div>
            )}

            {/* Risks */}
            {result.risks && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>PROCJENA RIZIKA</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Object.entries(result.risks).map(([key, val]) => {
                    const color = RISK_COLOR[val] || C.muted
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: `${color}12`, borderRadius: 8, border: `1px solid ${color}33` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 11, color: C.gray }}>{key.replace(/_/g, ' ')}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color }}>{val}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Issues */}
            {result.issues?.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>PRONAĐENI PROBLEMI ({result.issues.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.issues.map((issue, i) => {
                    const sc = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info
                    return (
                      <div key={i} style={{ padding: '12px 14px', background: `${sc.color}10`, border: `1px solid ${sc.color}33`, borderRadius: 10 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span>{sc.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sc.color }}>{issue.severity?.toUpperCase()}</span>
                          {issue.line_reference && <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{issue.line_reference}</span>}
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#d0e0da' }}>{issue.issue}</p>
                        {issue.recommendation && <p style={{ margin: 0, fontSize: 11, color: C.muted2, fontStyle: 'italic' }}>→ {issue.recommendation}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Optimizations */}
            {result.optimizations?.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>OPTIMIZACIJSKE PRILIKE ({result.optimizations.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.optimizations.map((opt, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: `${'#4ADE80'}08`, border: `1px solid ${'#4ADE80'}25`, borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Zap size={12} color="#4ADE80"/>
                        <span style={{ fontSize: 10, color: C.muted }}>{opt.category?.replace(/_/g, ' ').toUpperCase()}</span>
                        {opt.estimated_time_saving_pct > 0 && (
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ADE80', fontWeight: 700 }}>-{opt.estimated_time_saving_pct}% vremena</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#d0e0da' }}>Trenutno: {opt.current}</div>
                      <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 4 }}>Prijedlog: {opt.suggested}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools analysis */}
            {result.tools_analysis?.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>ANALIZA ALATA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.tools_analysis.map((t, i) => {
                    const rc = RISK_COLOR[t.breakage_risk] || C.muted
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surface2, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <Wrench size={13} color={rc}/>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#e8f0ee' }}>{t.tool_number}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{t.estimated_operation}</div>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          F{t.max_feed_rate} · S{t.max_spindle_speed}
                        </div>
                        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: `${rc}20`, color: rc, border: `1px solid ${rc}40` }}>
                          lom: {t.breakage_risk}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Extended stats: feedrate + spindle + moves + distance */}
            {(result.feedrate || result.moves || result.distance_mm) && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>STATISTIKA PROGRAMA</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {result.feedrate && [
                    ['Posmak min', `${result.feedrate.min} mm/min`, C.teal],
                    ['Posmak max', `${result.feedrate.max} mm/min`, C.teal],
                    ['Posmak avg', `${result.feedrate.average} mm/min`, C.teal],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ padding: '10px 12px', background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                  {result.spindle && [
                    ['Vreteno min', `${result.spindle.min} rpm`, '#A78BFA'],
                    ['Vreteno max', `${result.spindle.max} rpm`, '#A78BFA'],
                    ['Trajanje', `${result.estimated_time_min} min`, '#4ADE80'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ padding: '10px 12px', background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                  {result.moves && [
                    ['Brzo G0', result.moves.rapid, C.accent],
                    ['Linearno G1', result.moves.linear, C.orange],
                    ['Luk G2/G3', result.moves.arc, '#60A5FA'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ padding: '10px 12px', background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v ?? '—'}</div>
                    </div>
                  ))}
                  {result.distance_mm && [
                    ['Brza putanja', `${result.distance_mm.rapid} mm`, C.accent],
                    ['Put. rezanja', `${result.distance_mm.cutting} mm`, C.teal],
                    ['Ukupno', `${(result.distance_mm.rapid + result.distance_mm.cutting).toLocaleString()} mm`, '#4ADE80'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ padding: '10px 12px', background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ML Suggestions */}
            {result.ml_suggestions?.length > 0 && (
              <div style={{ background: '#A78BFA10', border: '1px solid #A78BFA35', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: '#A78BFA', letterSpacing: 1.5, marginBottom: 12 }}>🧠 ML PRIJEDLOZI ({result.ml_suggestions.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.ml_suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#A78BFA08', borderRadius: 8, border: '1px solid #A78BFA25' }}>
                      <Zap size={13} color="#A78BFA" style={{ flexShrink: 0, marginTop: 1 }}/>
                      <span style={{ fontSize: 12, color: '#d0c8e0', lineHeight: 1.6 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
