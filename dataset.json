/**
 * DEER MES — CAM Generator
 * STL → Feature Detection → Toolpath → G-code
 * 100% offline, no external APIs.
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// ─────────────────────────────────────────────────────────────────────────────
// STL PARSER (ASCII + Binary)
// ─────────────────────────────────────────────────────────────────────────────

function parseSTL(buffer) {
  // Detect binary vs ASCII
  const isBinary = detectBinary(buffer)
  return isBinary ? parseBinarySTL(buffer) : parseASCIISTL(buffer.toString('utf8'))
}

function detectBinary(buffer) {
  if (buffer.length < 84) return false
  // ASCII STL starts with "solid"
  const header = buffer.slice(0, 5).toString('ascii').toLowerCase()
  if (header === 'solid') {
    // Could still be binary with "solid" in header — check triangle count
    const triCount = buffer.readUInt32LE(80)
    const expectedSize = 84 + triCount * 50
    if (Math.abs(expectedSize - buffer.length) < 10) return true
    return false
  }
  return true
}

function parseBinarySTL(buffer) {
  if (buffer.length < 84) throw new Error('STL file too small')
  const triCount = buffer.readUInt32LE(80)
  const triangles = []
  let offset = 84

  for (let i = 0; i < triCount; i++) {
    if (offset + 50 > buffer.length) break
    const nx = buffer.readFloatLE(offset);     offset += 4
    const ny = buffer.readFloatLE(offset);     offset += 4
    const nz = buffer.readFloatLE(offset);     offset += 4

    const v = []
    for (let j = 0; j < 3; j++) {
      const vx = buffer.readFloatLE(offset); offset += 4
      const vy = buffer.readFloatLE(offset); offset += 4
      const vz = buffer.readFloatLE(offset); offset += 4
      v.push({ x: vx, y: vy, z: vz })
    }
    offset += 2 // attribute byte count

    triangles.push({ normal: { x: nx, y: ny, z: nz }, vertices: v })
  }

  return { triangles, format: 'binary', triCount: triangles.length }
}

function parseASCIISTL(text) {
  const triangles = []
  const facetRe   = /facet\s+normal\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)([\s\S]*?)endfacet/gi
  const vertexRe  = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi

  let fm
  while ((fm = facetRe.exec(text)) !== null) {
    const normal = { x: parseFloat(fm[1]), y: parseFloat(fm[2]), z: parseFloat(fm[3]) }
    const block  = fm[4]
    const verts  = []
    let vm
    vertexRe.lastIndex = 0
    while ((vm = vertexRe.exec(block)) !== null) {
      verts.push({ x: parseFloat(vm[1]), y: parseFloat(vm[2]), z: parseFloat(vm[3]) })
    }
    if (verts.length === 3) triangles.push({ normal, vertices: verts })
  }

  return { triangles, format: 'ascii', triCount: triangles.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

function analyzeGeometry(stl) {
  const { triangles } = stl

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y
      if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z
    }
  }

  const sizeX = maxX - minX
  const sizeY = maxY - minY
  const sizeZ = maxZ - minZ

  // Estimate volume using divergence theorem approximation
  let volume = 0
  for (const tri of triangles) {
    const [a, b, c] = tri.vertices
    volume += (a.x * (b.y * c.z - c.y * b.z)) / 6
  }
  volume = Math.abs(volume)

  return {
    bbox: { minX, maxX, minY, maxY, minZ, maxZ },
    size: { x: sizeX, y: sizeY, z: sizeZ },
    volume: Math.round(volume),
    triangleCount: triangles.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectFeatures(stl, geo) {
  const { triangles } = stl
  const { bbox } = geo
  const features = []

  // Group triangles by approximate Z level
  const zTolerance = geo.size.z * 0.02
  const zLevels = {}

  for (const tri of triangles) {
    const avgZ = (tri.vertices[0].z + tri.vertices[1].z + tri.vertices[2].z) / 3
    const level = Math.round(avgZ / zTolerance) * zTolerance
    if (!zLevels[level]) zLevels[level] = []
    zLevels[level].push(tri)
  }

  // Top face detection
  const topZ = bbox.maxZ
  const topFaces = triangles.filter(tri =>
    tri.normal.z > 0.9 &&
    tri.vertices.every(v => Math.abs(v.z - topZ) < zTolerance * 2)
  )
  if (topFaces.length > 0) {
    features.push({
      type: 'flat_face',
      name: 'Gornja ravna površina',
      z: topZ,
      area: estimateArea(topFaces),
      operation: 'facing',
      priority: 1,
    })
  }

  // Bottom face
  const botZ = bbox.minZ
  const botFaces = triangles.filter(tri =>
    tri.normal.z < -0.9 &&
    tri.vertices.every(v => Math.abs(v.z - botZ) < zTolerance * 2)
  )
  if (botFaces.length > 0) {
    features.push({
      type: 'flat_face',
      name: 'Donja ravna površina',
      z: botZ,
      area: estimateArea(botFaces),
      operation: 'facing',
      priority: 1,
    })
  }

  // Pocket detection — look for internal cavities (faces pointing inward/up inside bbox)
  const innerFlats = triangles.filter(tri => {
    const avgZ = (tri.vertices[0].z + tri.vertices[1].z + tri.vertices[2].z) / 3
    const avgX = (tri.vertices[0].x + tri.vertices[1].x + tri.vertices[2].x) / 3
    const avgY = (tri.vertices[0].y + tri.vertices[1].y + tri.vertices[2].y) / 3
    const isInnerZ = avgZ > botZ + zTolerance * 3 && avgZ < topZ - zTolerance * 3
    const isInnerXY = avgX > bbox.minX + geo.size.x * 0.15 && avgX < bbox.maxX - geo.size.x * 0.15
                   && avgY > bbox.minY + geo.size.y * 0.15 && avgY < bbox.maxY - geo.size.y * 0.15
    return tri.normal.z > 0.7 && isInnerZ && isInnerXY
  })

  if (innerFlats.length > 3) {
    const pocketZ = innerFlats.reduce((s, t) =>
      s + (t.vertices[0].z + t.vertices[1].z + t.vertices[2].z) / 3, 0) / innerFlats.length
    features.push({
      type: 'pocket',
      name: 'Džep (pocket)',
      depth: topZ - pocketZ,
      z: pocketZ,
      area: estimateArea(innerFlats),
      operation: 'pocket_milling',
      priority: 2,
    })
  }

  // Contour (always present)
  features.push({
    type: 'contour',
    name: 'Vanjska kontura',
    z: topZ,
    depth: geo.size.z,
    perimeter: estimatePerimeter(geo),
    operation: 'contour_milling',
    priority: 3,
  })

  // Hole detection — near-vertical cylindrical faces
  const vertFaces = triangles.filter(tri => Math.abs(tri.normal.z) < 0.15)
  const holeGroups = clusterByXY(vertFaces, geo.size.x * 0.05)

  for (const group of holeGroups) {
    if (group.length < 4) continue
    const xs = group.flatMap(t => t.vertices.map(v => v.x))
    const ys = group.flatMap(t => t.vertices.map(v => v.y))
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const r  = (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) / 4

    if (r < geo.size.x * 0.4 && r > 1) {
      features.push({
        type: 'hole',
        name: `Rupa Ø${(r * 2).toFixed(1)}mm`,
        cx, cy,
        diameter: r * 2,
        depth: geo.size.z * 0.6,
        operation: 'drilling',
        priority: 4,
      })
    }
  }

  return features
}

function estimateArea(triangles) {
  let area = 0
  for (const tri of triangles) {
    const [a, b, c] = tri.vertices
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    }
    area += Math.sqrt(cross.x**2 + cross.y**2 + cross.z**2) / 2
  }
  return Math.round(area * 100) / 100
}

function estimatePerimeter(geo) {
  // Approximate as rectangle perimeter
  return 2 * (geo.size.x + geo.size.y)
}

function clusterByXY(triangles, eps) {
  const assigned = new Array(triangles.length).fill(-1)
  const groups   = []

  for (let i = 0; i < triangles.length; i++) {
    if (assigned[i] >= 0) continue
    const group = [triangles[i]]
    assigned[i] = groups.length
    const cx0 = triangles[i].vertices[0].x
    const cy0 = triangles[i].vertices[0].y

    for (let j = i + 1; j < triangles.length; j++) {
      if (assigned[j] >= 0) continue
      const cxj = triangles[j].vertices[0].x
      const cyj = triangles[j].vertices[0].y
      if (Math.abs(cxj - cx0) < eps && Math.abs(cyj - cy0) < eps) {
        group.push(triangles[j])
        assigned[j] = groups.length
      }
    }
    groups.push(group)
  }
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL SELECTION
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_LIBRARY = [
  { id: 1, name: 'Glodalo Ø63 čelno',  type: 'face_mill',   diameter: 63, material: 'carbide', operations: ['facing'],         feed_per_tooth: 0.08, teeth: 5 },
  { id: 2, name: 'Glodalo Ø20 čelno',  type: 'end_mill',    diameter: 20, material: 'hss',     operations: ['pocket_milling','contour_milling'], feed_per_tooth: 0.04, teeth: 4 },
  { id: 3, name: 'Glodalo Ø10 čelno',  type: 'end_mill',    diameter: 10, material: 'carbide', operations: ['pocket_milling','contour_milling'], feed_per_tooth: 0.02, teeth: 4 },
  { id: 4, name: 'Svrdlo Ø8',          type: 'drill',       diameter: 8,  material: 'hss',     operations: ['drilling'],        feed_per_rev: 0.12,   teeth: 2 },
  { id: 5, name: 'Svrdlo Ø6',          type: 'drill',       diameter: 6,  material: 'hss',     operations: ['drilling'],        feed_per_rev: 0.08,   teeth: 2 },
  { id: 6, name: 'Svrdlo Ø12',         type: 'drill',       diameter: 12, material: 'hss',     operations: ['drilling'],        feed_per_rev: 0.18,   teeth: 2 },
]

const MATERIAL_PARAMS = {
  steel:     { vc: 80,  feed_factor: 1.0, depth_factor: 1.0 },
  aluminum:  { vc: 250, feed_factor: 1.5, depth_factor: 1.5 },
  cast_iron: { vc: 60,  feed_factor: 0.8, depth_factor: 0.9 },
  plastic:   { vc: 300, feed_factor: 2.0, depth_factor: 2.0 },
  default:   { vc: 100, feed_factor: 1.0, depth_factor: 1.0 },
}

function selectTool(feature, material, availableTools) {
  // Try to match from available tools DB first
  if (availableTools && availableTools.length > 0) {
    const mapped = mapDbToolToOperation(feature.operation, availableTools)
    if (mapped) return mapped
  }

  // Fall back to built-in library
  const candidates = TOOL_LIBRARY.filter(t => t.operations.includes(feature.operation))
  if (!candidates.length) return TOOL_LIBRARY[1] // default end mill

  // For drilling, pick closest diameter to hole
  if (feature.type === 'hole') {
    const holeDia = feature.diameter || 8
    return candidates.reduce((best, t) =>
      Math.abs(t.diameter - holeDia) < Math.abs(best.diameter - holeDia) ? t : best
    )
  }

  // Prefer carbide for steel
  if (material === 'steel') {
    const carbide = candidates.find(t => t.material === 'carbide')
    if (carbide) return carbide
  }

  return candidates[0]
}

function mapDbToolToOperation(operation, tools) {
  const categoryMap = {
    facing:          ['glodala', 'face mill', 'čelno glodalo'],
    pocket_milling:  ['glodala', 'end mill'],
    contour_milling: ['glodala', 'end mill'],
    drilling:        ['svrdla', 'drill', 'svrdlo'],
  }
  const keywords = categoryMap[operation] || []
  const match = tools.find(t =>
    keywords.some(kw => (t.category || t.name || '').toLowerCase().includes(kw))
  )
  if (!match) return null
  return {
    id: match.id,
    name: match.name,
    type: operation.includes('drill') ? 'drill' : 'end_mill',
    diameter: extractDiameter(match.name) || 10,
    material: 'hss',
    operations: [operation],
    feed_per_tooth: 0.04,
    teeth: 4,
    fromDB: true,
  }
}

function extractDiameter(name) {
  const m = name.match(/[ØøD](\d+(?:\.\d+)?)/i)
  return m ? parseFloat(m[1]) : null
}

function calcCuttingParams(tool, material) {
  const mat = MATERIAL_PARAMS[material] || MATERIAL_PARAMS.default
  const vc   = mat.vc   // cutting speed m/min
  const rpm  = Math.round((vc * 1000) / (Math.PI * tool.diameter))
  const fz   = (tool.feed_per_tooth || tool.feed_per_rev || 0.04) * mat.feed_factor
  const feed = Math.round(rpm * fz * (tool.teeth || 2))
  return { rpm, feed, depthFactor: mat.depth_factor }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLPATH GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateToolpaths(features, geo, material, options) {
  const {
    safeZ     = geo.bbox.maxZ + 10,
    stepdown  = 2,
    stepover  = 0.6, // fraction of tool diameter
    finishAllowance = 0.2,
  } = options || {}

  const toolpaths = []

  for (const feature of features.sort((a, b) => a.priority - b.priority)) {
    let tp = null

    switch (feature.operation) {
      case 'facing':
        tp = generateFacing(feature, geo, safeZ, stepdown, stepover)
        break
      case 'pocket_milling':
        tp = generatePocket(feature, geo, safeZ, stepdown, stepover)
        break
      case 'contour_milling':
        tp = generateContour(feature, geo, safeZ, stepdown)
        break
      case 'drilling':
        tp = generateDrilling(feature, geo, safeZ)
        break
    }

    if (tp) toolpaths.push(tp)
  }

  return toolpaths
}

function generateFacing(feature, geo, safeZ, stepdown, stepover) {
  const { bbox } = geo
  const moves = []
  const toolDia = 63 // face mill default
  const step = toolDia * stepover
  const targetZ = feature.z
  const passes = Math.max(1, Math.ceil((geo.bbox.maxZ - targetZ) / stepdown))

  for (let p = 0; p < passes; p++) {
    const z = Math.max(targetZ, geo.bbox.maxZ - (p + 1) * stepdown)
    let dir = 1

    for (let y = bbox.minY; y <= bbox.maxY + step; y += step) {
      const clampY = Math.min(y, bbox.maxY)
      if (dir > 0) {
        moves.push({ type: 'rapid', x: bbox.minX - 5, y: clampY, z: safeZ })
        moves.push({ type: 'rapid', x: bbox.minX - 5, y: clampY, z: z + 2 })
        moves.push({ type: 'cut',   x: bbox.minX - 5, y: clampY, z })
        moves.push({ type: 'cut',   x: bbox.maxX + 5, y: clampY, z })
      } else {
        moves.push({ type: 'cut', x: bbox.minX - 5, y: clampY, z })
      }
      dir *= -1
    }
    moves.push({ type: 'rapid', x: bbox.minX - 5, y: bbox.minY, z: safeZ })
  }

  return { feature, moves, toolDia, operation: 'facing' }
}

function generatePocket(feature, geo, safeZ, stepdown, stepover) {
  const { bbox } = geo
  const moves = []
  const toolDia = 20
  const step = toolDia * stepover
  const pocketZ = feature.z
  const startZ = geo.bbox.maxZ
  const passes = Math.max(1, Math.ceil((startZ - pocketZ) / stepdown))

  // Offset approach from center outward (zig-zag)
  const cx = (bbox.minX + bbox.maxX) / 2
  const cy = (bbox.minY + bbox.maxY) / 2
  const halfW = (geo.size.x * 0.6) / 2  // assume pocket is 60% of part width
  const halfH = (geo.size.y * 0.6) / 2

  for (let p = 0; p < passes; p++) {
    const z = Math.max(pocketZ, startZ - (p + 1) * stepdown)
    moves.push({ type: 'rapid', x: cx, y: cy, z: safeZ })
    moves.push({ type: 'rapid', x: cx, y: cy, z: z + 2 })
    moves.push({ type: 'cut',   x: cx, y: cy, z })

    let offset = step
    while (offset <= Math.min(halfW, halfH)) {
      moves.push({ type: 'cut', x: cx - offset, y: cy - offset, z })
      moves.push({ type: 'cut', x: cx + offset, y: cy - offset, z })
      moves.push({ type: 'cut', x: cx + offset, y: cy + offset, z })
      moves.push({ type: 'cut', x: cx - offset, y: cy + offset, z })
      moves.push({ type: 'cut', x: cx - offset, y: cy - offset, z })
      offset += step
    }
    moves.push({ type: 'rapid', x: cx, y: cy, z: safeZ })
  }

  return { feature, moves, toolDia, operation: 'pocket_milling' }
}

function generateContour(feature, geo, safeZ, stepdown) {
  const { bbox } = geo
  const moves = []
  const offset = 1 // 1mm from edge

  const corners = [
    { x: bbox.minX - offset, y: bbox.minY - offset },
    { x: bbox.maxX + offset, y: bbox.minY - offset },
    { x: bbox.maxX + offset, y: bbox.maxY + offset },
    { x: bbox.minX - offset, y: bbox.maxY + offset },
    { x: bbox.minX - offset, y: bbox.minY - offset },
  ]

  const passes = Math.max(1, Math.ceil(geo.size.z / stepdown))
  for (let p = 0; p < passes; p++) {
    const z = Math.max(bbox.minZ, bbox.maxZ - (p + 1) * stepdown)
    moves.push({ type: 'rapid', x: corners[0].x, y: corners[0].y, z: safeZ })
    moves.push({ type: 'rapid', x: corners[0].x, y: corners[0].y, z: z + 2 })
    moves.push({ type: 'cut',   x: corners[0].x, y: corners[0].y, z })
    for (let i = 1; i < corners.length; i++) {
      moves.push({ type: 'cut', x: corners[i].x, y: corners[i].y, z })
    }
    moves.push({ type: 'rapid', x: corners[0].x, y: corners[0].y, z: safeZ })
  }

  return { feature, moves, toolDia: 20, operation: 'contour_milling' }
}

function generateDrilling(feature, geo, safeZ) {
  const moves = []
  const cx = feature.cx ?? (geo.bbox.minX + geo.bbox.maxX) / 2
  const cy = feature.cy ?? (geo.bbox.minY + geo.bbox.maxY) / 2
  const depth = -(feature.depth || geo.size.z * 0.6)

  moves.push({ type: 'rapid', x: cx, y: cy, z: safeZ })
  moves.push({ type: 'rapid', x: cx, y: cy, z: 2 })
  // Peck drilling
  let currentZ = 2
  const peck = 5
  while (currentZ > depth) {
    const nextZ = Math.max(depth, currentZ - peck)
    moves.push({ type: 'cut', x: cx, y: cy, z: nextZ })
    moves.push({ type: 'rapid', x: cx, y: cy, z: 2 })
    currentZ = nextZ
    if (currentZ <= depth) break
  }
  moves.push({ type: 'rapid', x: cx, y: cy, z: safeZ })

  return { feature, moves, toolDia: feature.diameter || 8, operation: 'drilling' }
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTPROCESSOR — FANUC STYLE G-CODE
// ─────────────────────────────────────────────────────────────────────────────

function postprocess(toolpaths, features, material, geo, options) {
  const { programNumber = 1001, filename = 'PROGRAM' } = options || {}
  const lines = []

  lines.push(`%`)
  lines.push(`O${programNumber} (${filename.toUpperCase().replace(/\s/g, '_')})`)
  lines.push(`(DEER MES CAM GENERATOR)`)
  lines.push(`(MATERIAL: ${material.toUpperCase()})`)
  lines.push(`(PART SIZE: X${geo.size.x.toFixed(2)} Y${geo.size.y.toFixed(2)} Z${geo.size.z.toFixed(2)} MM)`)
  lines.push(`(DATE: ${new Date().toISOString().slice(0,10)})`)
  lines.push(`G21 G90 G94 G17`)
  lines.push(`G49 G40 G80`)
  lines.push('')

  let currentTool = null
  let toolIndex   = 0

  for (const tp of toolpaths) {
    const tool     = TOOL_LIBRARY.find(t => t.operations.includes(tp.operation)) || TOOL_LIBRARY[1]
    const { rpm, feed } = calcCuttingParams(tool, material)
    const toolNum  = ++toolIndex

    lines.push(`(--- ${tp.operation.toUpperCase().replace(/_/g,' ')} ---)`)
    lines.push(`(TOOL: ${tool.name} D${tool.diameter})`)

    // Tool change
    if (currentTool !== toolNum) {
      lines.push(`M05`)
      lines.push(`G91 G28 Z0.`)
      lines.push(`T${String(toolNum).padStart(2,'0')} M06`)
      lines.push(`G90`)
      currentTool = toolNum
    }

    // Spindle start
    lines.push(`M03 S${rpm}`)
    lines.push(`G43 H${String(toolNum).padStart(2,'0')}`)

    let prevType = 'rapid'
    for (const move of tp.moves) {
      const x = move.x !== undefined ? `X${move.x.toFixed(3)}` : ''
      const y = move.y !== undefined ? `Y${move.y.toFixed(3)}` : ''
      const z = move.z !== undefined ? `Z${move.z.toFixed(3)}` : ''
      const coords = [x, y, z].filter(Boolean).join(' ')

      if (move.type === 'rapid') {
        lines.push(`G00 ${coords}`)
      } else {
        // First cut move
        if (prevType === 'rapid') {
          lines.push(`G01 ${coords} F${feed}`)
        } else {
          lines.push(`G01 ${coords}`)
        }
      }
      prevType = move.type
    }

    lines.push(`M05`)
    lines.push('')
  }

  lines.push(`G91 G28 Z0.`)
  lines.push(`G91 G28 X0. Y0.`)
  lines.push(`G90`)
  lines.push(`M30`)
  lines.push(`%`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE TIME & SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

function estimateCycleTime(toolpaths, material) {
  const RAPID_SPEED = 10000 // mm/min
  let rapidDist   = 0
  let cuttingDist = 0
  let cuttingTime = 0

  for (const tp of toolpaths) {
    const tool = TOOL_LIBRARY.find(t => t.operations.includes(tp.operation)) || TOOL_LIBRARY[1]
    const { feed } = calcCuttingParams(tool, material)

    let prev = null
    for (const move of tp.moves) {
      if (!prev) { prev = move; continue }
      const d = Math.sqrt(
        (move.x - prev.x) ** 2 + (move.y - prev.y) ** 2 + (move.z - prev.z) ** 2
      )
      if (move.type === 'rapid') {
        rapidDist += d
      } else {
        cuttingDist += d
        if (feed > 0) cuttingTime += d / feed
      }
      prev = move
    }
  }

  const rapidTime = rapidDist / RAPID_SPEED
  const totalTime = rapidTime + cuttingTime
  const toolChanges = toolpaths.length

  return {
    rapid_distance_mm:   Math.round(rapidDist),
    cutting_distance_mm: Math.round(cuttingDist),
    rapid_time_min:      Math.round(rapidTime * 100) / 100,
    cutting_time_min:    Math.round(cuttingTime * 100) / 100,
    tool_change_time_min: toolChanges * 0.5,
    estimated_total_min: Math.round((totalTime + toolChanges * 0.5) * 100) / 100,
  }
}

function buildSimulationData(toolpaths, geo) {
  const allMoves = []
  let toolIndex = 0

  for (const tp of toolpaths) {
    toolIndex++
    for (const move of tp.moves) {
      allMoves.push({
        ...move,
        tool: toolIndex,
        operation: tp.operation,
        toolDia: tp.toolDia,
      })
    }
  }

  // Sample down to max 2000 points for frontend performance
  const MAX_POINTS = 2000
  const sampled = allMoves.length > MAX_POINTS
    ? allMoves.filter((_, i) => i % Math.ceil(allMoves.length / MAX_POINTS) === 0)
    : allMoves

  return {
    moves: sampled,
    totalMoves: allMoves.length,
    bbox: geo.bbox,
    size: geo.size,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

async function generateFromSTL(stlBuffer, options) {
  const {
    material    = 'steel',
    filename    = 'PART',
    safeZ       = null,
    stepdown    = 2,
    stepover    = 0.6,
    availableTools = [],
  } = options || {}

  // 1. Parse STL
  const stl = parseSTL(stlBuffer)
  if (stl.triCount === 0) throw new Error('STL file contains no triangles')

  // 2. Geometry analysis
  const geo = analyzeGeometry(stl)

  // 3. Feature detection
  const features = detectFeatures(stl, geo)

  // 4. Toolpath generation
  const safeZCalc = safeZ || geo.bbox.maxZ + 15
  const toolpaths = generateToolpaths(features, geo, material, { safeZ: safeZCalc, stepdown, stepover })

  // 5. G-code generation
  const gcode = postprocess(toolpaths, features, material, geo, { filename })

  // 6. Cycle time
  const timing = estimateCycleTime(toolpaths, material)

  // 7. Simulation data
  const simulation = buildSimulationData(toolpaths, geo)

  // 8. Tool suggestions
  const toolSuggestions = features.map(f => {
    const t = selectTool(f, material, availableTools)
    const params = calcCuttingParams(t, material)
    return {
      operation: f.operation,
      feature:   f.name,
      tool:      t.name,
      diameter:  t.diameter,
      rpm:       params.rpm,
      feed:      params.feed,
      fromDB:    !!t.fromDB,
    }
  })

  return {
    success: true,
    filename,
    material,
    geometry: {
      size:          geo.size,
      volume_mm3:    geo.volume,
      triangle_count: stl.triCount,
      bbox:          geo.bbox,
    },
    features: features.map(f => ({
      type:      f.type,
      name:      f.name,
      operation: f.operation,
      depth:     f.depth,
      diameter:  f.diameter,
    })),
    tool_suggestions: toolSuggestions,
    cycle_time:       timing,
    gcode,
    gcode_lines:      gcode.split('\n').length,
    simulation,
    generated_at: new Date().toISOString(),
  }
}

module.exports = { generateFromSTL, parseSTL, analyzeGeometry, detectFeatures, TOOL_LIBRARY, MATERIAL_PARAMS }
