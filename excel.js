import { useState, useRef, useEffect, useCallback } from 'react'
import { C, Btn } from '../components/UI'
import {
  Cpu, Upload, Play, Download, Box, Layers, Clock,
  AlertTriangle, CheckCircle, Wrench, Settings, ChevronDown, RotateCcw
} from 'lucide-react'
import api from '../utils/api'
import * as THREE from 'three'

// ─── Color constants ─────────────────────────────────────────────────────────
const PURPLE  = '#A78BFA'
const CYAN    = '#22D3EE'
const AMBER   = '#F5BC54'
const GREEN   = '#4ADE80'
const RED     = '#F87171'
const ORANGE  = '#FB923C'

const MATERIALS = [
  { value: 'steel',     label: 'Čelik' },
  { value: 'aluminum',  label: 'Aluminij' },
  { value: 'cast_iron', label: 'Sivi lijev' },
  { value: 'plastic',   label: 'Plastika' },
]

// ─── Three.js Toolpath Viewer ────────────────────────────────────────────────
function ToolpathViewer({ result, stlBuffer }) {
  const mountRef  = useRef(null)
  const sceneRef  = useRef(null)
  const rendRef   = useRef(null)
  const camRef    = useRef(null)
  const frameRef  = useRef(null)
  const mouseRef  = useRef({ down: false, x: 0, y: 0, button: 0 })
  const spherical = useRef({ theta: 0.6, phi: 0.8, radius: 200 })

  useEffect(() => {
    if (!mountRef.current || !result) return
    const el = mountRef.current

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setClearColor(0x1a2a28, 1)
    el.appendChild(renderer.domElement)
    rendRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dLight.position.set(100, 200, 150)
    scene.add(dLight)
    sceneRef.current = scene

    // Camera
    const bbox = result.geometry.bbox
    const size = result.geometry.size
    const cx   = (bbox.minX + bbox.maxX) / 2
    const cy   = (bbox.minY + bbox.maxY) / 2
    const cz   = (bbox.minZ + bbox.maxZ) / 2
    const diag = Math.sqrt(size.x**2 + size.y**2 + size.z**2)

    spherical.current.radius = diag * 1.8

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, diag * 20)
    camera.position.set(cx + diag, cy + diag, cz + diag)
    camera.lookAt(cx, cy, cz)
    camRef.current = { camera, cx, cy, cz }

    // Grid
    const grid = new THREE.GridHelper(Math.max(size.x, size.y) * 2, 10, 0x2a4a44, 0x2a3a38)
    grid.position.set(cx, bbox.minZ - 0.5, cy)
    scene.add(grid)

    // Draw toolpath moves
    if (result.simulation?.moves) {
      const moves = result.simulation.moves
      const rapidPoints = []
      const cutPoints   = []

      for (let i = 1; i < moves.length; i++) {
        const a = moves[i - 1]
        const b = moves[i]
        if (b.type === 'rapid') {
          rapidPoints.push(new THREE.Vector3(a.x || 0, a.z || 0, a.y || 0))
          rapidPoints.push(new THREE.Vector3(b.x || 0, b.z || 0, b.y || 0))
        } else {
          cutPoints.push(new THREE.Vector3(a.x || 0, a.z || 0, a.y || 0))
          cutPoints.push(new THREE.Vector3(b.x || 0, b.z || 0, b.y || 0))
        }
      }

      if (rapidPoints.length > 0) {
        const geo = new THREE.BufferGeometry().setFromPoints(rapidPoints)
        const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, opacity: 0.6, transparent: true })
        scene.add(new THREE.LineSegments(geo, mat))
      }
      if (cutPoints.length > 0) {
        const geo = new THREE.BufferGeometry().setFromPoints(cutPoints)
        const mat = new THREE.LineBasicMaterial({ color: 0x22d3ee, opacity: 0.9, transparent: true })
        scene.add(new THREE.LineSegments(geo, mat))
      }
    }

    // Part bounding box wireframe
    const boxGeo  = new THREE.BoxGeometry(size.x, size.z, size.y)
    const boxMat  = new THREE.MeshBasicMaterial({ color: 0x4a6b68, wireframe: true, opacity: 0.3, transparent: true })
    const boxMesh = new THREE.Mesh(boxGeo, boxMat)
    boxMesh.position.set(cx, cz, cy)
    scene.add(boxMesh)

    // Animate
    const target = new THREE.Vector3(cx, cz, cy)
    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      const { theta, phi, radius } = spherical.current
      camera.position.set(
        cx + radius * Math.sin(phi) * Math.cos(theta),
        cz + radius * Math.cos(phi),
        cy + radius * Math.sin(phi) * Math.sin(theta)
      )
      camera.lookAt(target)
      renderer.render(scene, camera)
    }
    animate()

    // Mouse events
    const onDown = (e) => {
      mouseRef.current = { down: true, x: e.clientX, y: e.clientY, button: e.button }
    }
    const onUp   = () => { mouseRef.current.down = false }
    const onMove = (e) => {
      if (!mouseRef.current.down) return
      const dx = e.clientX - mouseRef.current.x
      const dy = e.clientY - mouseRef.current.y
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
      if (mouseRef.current.button === 0) {
        spherical.current.theta -= dx * 0.01
        spherical.current.phi   = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.current.phi + dy * 0.01))
      }
    }
    const onWheel = (e) => {
      spherical.current.radius = Math.max(20, spherical.current.radius + e.deltaY * 0.3)
      e.preventDefault()
    }
    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }

    el.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameRef.current)
      el.removeChild(renderer.domElement)
      renderer.dispose()
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
    }
  }, [result])

  return (
    <div style={{ position: 'relative', width: '100%', height: 420, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 10, color: C.muted, pointerEvents: 'none' }}>
        🖱 Drag to rotate • Scroll to zoom
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: AMBER }}>
          <div style={{ width: 16, height: 2, background: AMBER }} /> Brzo G0
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: CYAN }}>
          <div style={{ width: 16, height: 2, background: CYAN }} /> Rezanje G1
        </div>
      </div>
    </div>
  )
}

// ─── Feature Badge ───────────────────────────────────────────────────────────
function FeatureBadge({ feature }) {
  const colors = { flat_face: CYAN, pocket: PURPLE, contour: AMBER, hole: GREEN }
  const icons  = { flat_face: '▬', pocket: '⬛', contour: '◻', hole: '⊙' }
  const c = colors[feature.type] || C.muted
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: `${c}12`, border: `1px solid ${c}35`, borderRadius: 8 }}>
      <span style={{ fontSize: 14, color: c }}>{icons[feature.type] || '▸'}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{feature.name}</div>
        <div style={{ fontSize: 10, color: C.muted }}>{feature.operation?.replace(/_/g, ' ')}</div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CAMGeneratorPage() {
  const [file, setFile]         = useState(null)
  const [material, setMaterial] = useState('steel')
  const [stepdown, setStepdown] = useState(2)
  const [stepover, setStepover] = useState(0.6)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [tab, setTab]           = useState('viewer') // viewer | gcode | tools | timing
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
  }

  const drop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const generate = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('stl', file)
      fd.append('material', material)
      fd.append('stepdown', stepdown)
      fd.append('stepover', stepover)
      fd.append('filename', file.name.replace(/\.[^.]+$/, ''))

      const r = await api.post('/ai/cam/generate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(r.data)
      setTab('viewer')
    } catch (e) {
      setError(e.response?.data?.error || 'Greška pri generiranju G-koda')
    } finally {
      setLoading(false)
    }
  }

  const downloadGCode = () => {
    if (!result?.gcode) return
    const blob = new Blob([result.gcode], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${result.filename || 'program'}.nc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `${PURPLE}18`, border: `1px solid ${PURPLE}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cpu size={26} color={PURPLE} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>DEER MES · AI MODUL</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e8f0ee', letterSpacing: 1.5, fontFamily: "'Chakra Petch', sans-serif" }}>CAM GENERATOR</div>
          <div style={{ fontSize: 11, color: C.muted2 }}>STL → Feature Detection → Putanje → G-kod (offline)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '360px 1fr' : '400px 1fr', gap: 20 }}>

        {/* LEFT — Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* STL Upload */}
          <div
            onDrop={drop} onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current.click()}
            style={{ border: `2px dashed ${file ? PURPLE : C.border}`, borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: file ? `${PURPLE}08` : C.surface, transition: 'all .2s' }}
          >
            <input ref={fileRef} type="file" accept=".stl,.STL" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
            {file ? (
              <>
                <Box size={32} color={PURPLE} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0ee' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · klikni za zamjenu</div>
              </>
            ) : (
              <>
                <Upload size={32} color={C.muted} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: C.muted }}>Povuci STL datoteku ovdje</div>
                <div style={{ fontSize: 11, color: C.muted2, marginTop: 6 }}>.stl · max 50MB</div>
              </>
            )}
          </div>

          {/* Parameters */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 14 }}>PARAMETRI OBRADE</div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Material</div>
              <select value={material} onChange={e => setMaterial(e.target.value)}
                style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: '#e8f0ee', padding: '8px 12px', fontSize: 12 }}>
                {MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Step-down (mm)</div>
                <input type="number" value={stepdown} min="0.5" max="10" step="0.5"
                  onChange={e => setStepdown(parseFloat(e.target.value))}
                  style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: '#e8f0ee', padding: '8px 12px', fontSize: 12, boxSizing: 'border-box' }} />
              </label>
              <label>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Step-over (×Ø)</div>
                <input type="number" value={stepover} min="0.2" max="0.9" step="0.05"
                  onChange={e => setStepover(parseFloat(e.target.value))}
                  style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: '#e8f0ee', padding: '8px 12px', fontSize: 12, boxSizing: 'border-box' }} />
              </label>
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: `${RED}10`, border: `1px solid ${RED}30`, borderRadius: 8, color: RED, fontSize: 12 }}>{error}</div>
          )}

          <Btn v="teal" onClick={generate} disabled={!file || loading} style={{ width: '100%', justifyContent: 'center' }}>
            <Play size={15} style={{ marginRight: 8 }} />
            {loading ? 'Generiranje...' : 'Generiraj G-kod'}
          </Btn>

          {result && (
            <Btn onClick={downloadGCode} style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={15} style={{ marginRight: 8 }} />
              Preuzmi G-kod (.nc)
            </Btn>
          )}
        </div>

        {/* RIGHT — Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                ['Trokuti', result.geometry.triangle_count?.toLocaleString('hr'), PURPLE, Box],
                ['Features', result.features?.length, CYAN, Layers],
                ['G-kod linija', result.gcode_lines?.toLocaleString('hr'), AMBER, Cpu],
                ['Trajanje', `${result.cycle_time?.estimated_total_min} min`, GREEN, Clock],
              ].map(([label, val, color, Icon]) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <Icon size={11} color={color} />
                    <span style={{ fontSize: 9, color: C.muted }}>{label.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Chakra Petch', sans-serif" }}>{val || '—'}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 1 }}>
              {[['viewer', '3D Putanja'], ['gcode', 'G-kod'], ['tools', 'Alati'], ['timing', 'Vremena']].map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{ padding: '8px 16px', border: 'none', background: 'transparent', color: tab === k ? PURPLE : C.muted, fontSize: 12, cursor: 'pointer', borderBottom: tab === k ? `2px solid ${PURPLE}` : '2px solid transparent', fontWeight: tab === k ? 700 : 400 }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Tab: 3D Viewer */}
            {tab === 'viewer' && (
              <div>
                <ToolpathViewer result={result} />
                {result.features?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 8 }}>DETEKTIRANE FEATURES</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {result.features.map((f, i) => <FeatureBadge key={i} feature={f} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: G-code */}
            {tab === 'gcode' && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5 }}>G-KOD PROGRAM</div>
                  <Btn sm onClick={downloadGCode}>
                    <Download size={12} style={{ marginRight: 4 }} /> Preuzmi
                  </Btn>
                </div>
                <pre style={{ maxHeight: 420, overflowY: 'auto', fontSize: 11, color: '#a0c8b8', fontFamily: 'monospace', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {result.gcode?.slice(0, 8000)}{result.gcode?.length > 8000 ? '\n... [skraćeno]' : ''}
                </pre>
              </div>
            )}

            {/* Tab: Tools */}
            {tab === 'tools' && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 12 }}>PRIJEDLOZI ALATA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.tool_suggestions?.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${PURPLE}18`, border: `1px solid ${PURPLE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wrench size={16} color={PURPLE} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e8f0ee' }}>{t.tool}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{t.feature} — {t.operation?.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: CYAN }}>S{t.rpm} rpm</div>
                        <div style={{ fontSize: 11, color: AMBER }}>F{t.feed} mm/min</div>
                      </div>
                      {t.fromDB && (
                        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}40` }}>DB</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Timing */}
            {tab === 'timing' && result.cycle_time && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 16 }}>PROCJENA CIKLUSA</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {[
                    ['Brzi pomaci', `${result.cycle_time.rapid_distance_mm?.toLocaleString('hr')} mm`, AMBER],
                    ['Putanja rezanja', `${result.cycle_time.cutting_distance_mm?.toLocaleString('hr')} mm`, CYAN],
                    ['Brzo kretanje', `${result.cycle_time.rapid_time_min} min`, AMBER],
                    ['Rezanje', `${result.cycle_time.cutting_time_min} min`, CYAN],
                    ['Izmjena alata', `${result.cycle_time.tool_change_time_min} min`, ORANGE],
                    ['UKUPNO', `${result.cycle_time.estimated_total_min} min`, GREEN],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ padding: '12px 16px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Chakra Petch', sans-serif" }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: '12px 16px', background: `${PURPLE}10`, border: `1px solid ${PURPLE}30`, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Geometrija dijela</div>
                  <div style={{ fontSize: 12, color: '#d0c8e0' }}>
                    Dimenzije: X{result.geometry.size.x.toFixed(1)} × Y{result.geometry.size.y.toFixed(1)} × Z{result.geometry.size.z.toFixed(1)} mm
                    <br />Volumen: ~{result.geometry.volume_mm3?.toLocaleString('hr')} mm³
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Placeholder when no result */}
        {!result && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: `${PURPLE}12`, border: `1px solid ${PURPLE}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Cpu size={36} color={PURPLE} />
            </div>
            <div style={{ fontSize: 15, color: '#e8f0ee', fontWeight: 600, marginBottom: 8 }}>CAM Generator</div>
            <div style={{ fontSize: 12, color: C.muted, maxWidth: 300, lineHeight: 1.7 }}>
              Učitajte STL model. Sustav će automatski detektirati features, generirati putanje alata i izračunati G-kod program.
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260 }}>
              {['Detekcija ravnih površina', 'Džepovi i konture', 'Detektiranje rupa', 'Fanuc G-kod izlaz'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted }}>
                  <CheckCircle size={13} color={GREEN} /> {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
