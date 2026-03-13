/**
 * DEER MES — G-code Analysis Engine
 * 100% offline, no external APIs.
 * Supports stream parsing for files up to 100MB+.
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const readline = require('readline')

// ─── Constants ──────────────────────────────────────────────────────────────

const RAPID_SPEED_MM_MIN = 10000  // assumed machine rapid speed

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a single G-code line into tokens.
 * Returns { codes: {G:[], M:[], T, F, S, X, Y, Z, I, J, K, R, comment} }
 */
function parseLine(raw) {
  // Strip inline comments (parentheses)
  let line = raw.replace(/\(.*?\)/g, ' ')
  // Strip semicolon comments
  line = line.replace(/;.*$/, '')
  // Strip block-delete "/"
  line = line.replace(/^\//, '')
  line = line.trim().toUpperCase()

  if (!line) return null

  const result = { G: [], M: [], T: null, F: null, S: null, X: null, Y: null, Z: null, I: null, J: null, K: null, R: null }

  // Match word-address pairs: letter + optional sign + digits/decimal
  const TOKEN_RE = /([A-Z])([+-]?\d*\.?\d+)/g
  let m
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const letter = m[1]
    const value  = parseFloat(m[2])
    switch (letter) {
      case 'G': result.G.push(value); break
      case 'M': result.M.push(value); break
      case 'T': result.T = value;     break
      case 'F': result.F = value;     break
      case 'S': result.S = value;     break
      case 'X': result.X = value;     break
      case 'Y': result.Y = value;     break
      case 'Z': result.Z = value;     break
      case 'I': result.I = value;     break
      case 'J': result.J = value;     break
      case 'K': result.K = value;     break
      case 'R': result.R = value;     break
    }
  }
  return result
}

/**
 * Distance between two 3D points.
 */
function dist3(a, b) {
  const dx = (b.x || 0) - (a.x || 0)
  const dy = (b.y || 0) - (a.y || 0)
  const dz = (b.z || 0) - (a.z || 0)
  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

/**
 * Approximate arc length for G2/G3 using R or I,J.
 */
function arcLength(prev, next, tok) {
  // If R is specified
  let r = tok.R
  if (r == null && (tok.I != null || tok.J != null)) {
    const i = tok.I || 0
    const j = tok.J || 0
    r = Math.sqrt(i*i + j*j)
  }
  if (!r || r === 0) {
    // Fallback: straight-line distance
    return dist3(prev, next)
  }
  // Chord length
  const chord = dist3(prev, next)
  if (chord === 0) return 0
  // Arc angle from chord and radius: chord = 2R sin(theta/2)
  const sinHalf = Math.min(1, chord / (2 * Math.abs(r)))
  const angle   = 2 * Math.asin(sinHalf)
  return Math.abs(r) * angle
}

// ─── Core Analysis ───────────────────────────────────────────────────────────

/**
 * Analyse G-code lines (array of strings) and return full statistics object.
 */
function analyzeLines(lines, filename) {
  // Modal state
  const modal = {
    plane: 17,        // G17/18/19
    unit: 21,         // G20=inch, G21=mm
    positioning: 90,  // G90=absolute, G91=incremental
    motion: 0,        // current motion mode
    feedrate: 0,
    spindle: 0,
    spindleOn: false,
    tool: null,
  }

  // Position tracking
  let pos = { x: 0, y: 0, z: 0 }

  // Accumulators
  const toolsUsed    = []             // ordered list
  const toolChanges  = []
  const feedrates    = []
  const spindleSpeeds = []
  const warnings     = []
  const issues       = []

  let toolChangeCount    = 0
  let rapidMoves         = 0
  let linearMoves        = 0
  let arcMoves           = 0
  let rapidDistance      = 0
  let cuttingDistance    = 0
  let cuttingTime        = 0   // minutes
  let firstMoveBeforeFeed = false
  let lastFeedrateSetLine = -1
  let lineNum            = 0

  // Per-tool stats for tools_analysis
  const toolStats = {}

  for (const raw of lines) {
    lineNum++
    const tok = parseLine(raw)
    if (!tok) continue

    // ── Update modal codes ──────────────────────────────────────────────────
    for (const g of tok.G) {
      if (g === 17 || g === 18 || g === 19) modal.plane       = g
      if (g === 20 || g === 21)             modal.unit        = g
      if (g === 90 || g === 91)             modal.positioning = g
      if ([0, 1, 2, 3].includes(g))        modal.motion      = g
    }

    // ── Tool change ─────────────────────────────────────────────────────────
    if (tok.T !== null) {
      const toolId = `T${Math.round(tok.T)}`
      if (modal.tool !== toolId) {
        // Check spindle not stopped before tool change
        if (modal.spindleOn) {
          warnings.push(`Zmjena alata na liniji ${lineNum} bez zaustavljanja vretena (M5)`)
          issues.push({
            severity: 'warning',
            line_reference: `L${lineNum}`,
            issue: `Promjena alata bez zaustavljanja vretena`,
            recommendation: 'Dodajte M5 prije T/M6 bloka'
          })
        }
        modal.tool = toolId
        if (!toolsUsed.includes(toolId)) toolsUsed.push(toolId)
        toolChanges.push({ line: lineNum, tool: toolId })
        toolChangeCount++

        if (!toolStats[toolId]) {
          toolStats[toolId] = { maxFeed: 0, maxSpindle: 0, moves: 0, cutDistance: 0 }
        }
      }
    }

    // ── Spindle commands ────────────────────────────────────────────────────
    for (const mc of tok.M) {
      if (mc === 3 || mc === 4) {
        modal.spindleOn = true
        if (tok.S !== null) modal.spindle = tok.S
      }
      if (mc === 5) {
        modal.spindleOn = false
      }
    }
    if (tok.S !== null && tok.S > 0) {
      modal.spindle = tok.S
      if (modal.spindleOn) spindleSpeeds.push(tok.S)
    }

    // ── Feedrate ────────────────────────────────────────────────────────────
    if (tok.F !== null && tok.F > 0) {
      modal.feedrate = tok.F
      lastFeedrateSetLine = lineNum
      feedrates.push(tok.F)

      // Extreme feedrate warning
      const threshold = modal.unit === 20 ? 1000 : 30000
      if (tok.F > threshold) {
        warnings.push(`Ekstremno visoka posmak ${tok.F} na liniji ${lineNum}`)
        issues.push({
          severity: 'warning',
          line_reference: `L${lineNum}`,
          issue: `Ekstremno visoka posmak: F${tok.F}`,
          recommendation: `Provjerite je li posmak ispravno postavljen`
        })
      }
    }

    // ── Resolve target position ─────────────────────────────────────────────
    const prevPos = { ...pos }

    const applyCoord = (axis, val) => {
      if (val === null) return
      if (modal.positioning === 90) {
        // Absolute
        if (axis === 'x') pos.x = val
        if (axis === 'y') pos.y = val
        if (axis === 'z') pos.z = val
      } else {
        // Incremental
        if (axis === 'x') pos.x += val
        if (axis === 'y') pos.y += val
        if (axis === 'z') pos.z += val
      }
    }

    applyCoord('x', tok.X)
    applyCoord('y', tok.Y)
    applyCoord('z', tok.Z)

    // Determine effective motion code
    let effectiveMotion = modal.motion
    if (tok.G.includes(0)) effectiveMotion = 0
    if (tok.G.includes(1)) effectiveMotion = 1
    if (tok.G.includes(2)) effectiveMotion = 2
    if (tok.G.includes(3)) effectiveMotion = 3

    const hasMoveCoords = tok.X !== null || tok.Y !== null || tok.Z !== null

    if (!hasMoveCoords) continue

    const d = effectiveMotion === 2 || effectiveMotion === 3
      ? arcLength(prevPos, pos, tok)
      : dist3(prevPos, pos)

    if (d < 0.0001) continue   // no actual movement

    const toolKey = modal.tool || 'T0'
    if (!toolStats[toolKey]) toolStats[toolKey] = { maxFeed: 0, maxSpindle: 0, moves: 0, cutDistance: 0 }

    switch (effectiveMotion) {
      case 0: {
        // Rapid
        rapidMoves++
        rapidDistance += d

        // Unsafe rapid Z move check (rapid down into material)
        if (tok.Z !== null && prevPos.z > 0 && pos.z < 0 && modal.spindleOn) {
          warnings.push(`Brzo spuštanje Z na liniji ${lineNum} dok je vreteno uključeno`)
          issues.push({
            severity: 'critical',
            line_reference: `L${lineNum}`,
            issue: `Nesigurno brzo G0 spuštanje Z osi ispod nulte ravnine`,
            recommendation: 'Koristite G1 s posmačnom brzinom za ulaz u materijal'
          })
        }
        break
      }
      case 1: {
        // Linear cut
        linearMoves++
        cuttingDistance += d
        toolStats[toolKey].moves++
        toolStats[toolKey].cutDistance += d

        // No feedrate check
        if (modal.feedrate === 0) {
          if (!firstMoveBeforeFeed) {
            firstMoveBeforeFeed = true
            warnings.push(`G1 rezanje bez postavljenog posmaka (F) na liniji ${lineNum}`)
            issues.push({
              severity: 'critical',
              line_reference: `L${lineNum}`,
              issue: `G1 linearni rez bez definiranog posmaka (F)`,
              recommendation: 'Dodajte F vrijednost prije prve G1 naredbe'
            })
          }
        } else {
          cuttingTime += d / modal.feedrate
        }

        // No spindle check
        if (!modal.spindleOn) {
          issues.push({
            severity: 'warning',
            line_reference: `L${lineNum}`,
            issue: `Rezanje (G1) bez aktivnog vretena`,
            recommendation: 'Pokrenite vreteno s M3/M4 S<rpm> prije rezanja'
          })
        }

        if (modal.feedrate > toolStats[toolKey].maxFeed) toolStats[toolKey].maxFeed = modal.feedrate
        if (modal.spindle  > toolStats[toolKey].maxSpindle) toolStats[toolKey].maxSpindle = modal.spindle
        break
      }
      case 2:
      case 3: {
        // Arc
        arcMoves++
        cuttingDistance += d
        toolStats[toolKey].moves++
        toolStats[toolKey].cutDistance += d

        // Missing arc parameters
        if (tok.R === null && tok.I === null && tok.J === null) {
          warnings.push(`Luk G${effectiveMotion} na liniji ${lineNum} nema R niti I/J parametre`)
          issues.push({
            severity: 'warning',
            line_reference: `L${lineNum}`,
            issue: `G${effectiveMotion} luk bez R ili I/J parametara`,
            recommendation: 'Dodajte R ili I,J parametre definiciji luka'
          })
        }

        if (modal.feedrate === 0) {
          issues.push({
            severity: 'warning',
            line_reference: `L${lineNum}`,
            issue: `Luk G${effectiveMotion} bez definiranog posmaka (F)`,
            recommendation: 'Postavite F vrijednost prije luka'
          })
        } else {
          cuttingTime += d / modal.feedrate
        }

        if (modal.feedrate > toolStats[toolKey].maxFeed) toolStats[toolKey].maxFeed = modal.feedrate
        if (modal.spindle  > toolStats[toolKey].maxSpindle) toolStats[toolKey].maxSpindle = modal.spindle
        break
      }
    }

    if (modal.spindle > 0 && modal.spindleOn) spindleSpeeds.push(modal.spindle)
  }

  // ── Aggregate stats ─────────────────────────────────────────────────────

  const uniqueFeeds = [...new Set(feedrates)]
  const minFeed     = uniqueFeeds.length ? Math.min(...uniqueFeeds) : 0
  const maxFeed     = uniqueFeeds.length ? Math.max(...uniqueFeeds) : 0
  const avgFeed     = uniqueFeeds.length ? Math.round(feedrates.reduce((s,f)=>s+f,0)/feedrates.length) : 0

  const uniqueSpeeds = [...new Set(spindleSpeeds)]
  const minSpindle   = uniqueSpeeds.length ? Math.min(...uniqueSpeeds) : 0
  const maxSpindle   = uniqueSpeeds.length ? Math.max(...uniqueSpeeds) : 0

  const rapidTime    = rapidDistance / RAPID_SPEED_MM_MIN
  const totalTime    = (rapidTime + cuttingTime)

  // ── Build tools_analysis for frontend ──────────────────────────────────

  const toolsAnalysis = toolsUsed.map(toolId => {
    const ts = toolStats[toolId] || { maxFeed: 0, maxSpindle: 0, moves: 0, cutDistance: 0 }

    // Estimate operation type by feedrate/spindle
    let estimatedOp = 'Glodanje'
    if (ts.maxSpindle > 15000) estimatedOp = 'Visokobrzinsko glodanje'
    else if (ts.maxFeed < 100)  estimatedOp = 'Završna obrada'
    else if (ts.maxFeed > 2000) estimatedOp = 'Grubo glodanje'

    // Breakage risk
    let breakageRisk = 'low'
    if (ts.maxFeed > 3000 || ts.maxSpindle > 20000) breakageRisk = 'high'
    else if (ts.maxFeed > 1500 || ts.maxSpindle > 12000) breakageRisk = 'medium'

    return {
      tool_number: toolId,
      estimated_operation: estimatedOp,
      max_feed_rate: ts.maxFeed,
      max_spindle_speed: ts.maxSpindle,
      breakage_risk: breakageRisk,
    }
  })

  // ── Build risk assessment ────────────────────────────────────────────────

  const criticalIssues = issues.filter(i => i.severity === 'critical').length
  const warningIssues  = issues.filter(i => i.severity === 'warning').length

  let toolpathRisk   = 'low'
  let spindleRisk    = 'low'
  let feedrateRisk   = 'low'
  let collisionRisk  = 'low'
  let overallRisk    = 'low'

  if (criticalIssues >= 3) overallRisk = 'critical'
  else if (criticalIssues >= 1 || warningIssues >= 5) overallRisk = 'high'
  else if (warningIssues >= 2) overallRisk = 'medium'

  if (issues.some(i => i.issue.includes('vreteno'))) spindleRisk = 'high'
  if (issues.some(i => i.issue.includes('posmak')))  feedrateRisk = 'medium'
  if (issues.some(i => i.issue.includes('Z')))       collisionRisk = 'high'
  if (arcMoves > 0 && issues.some(i => i.issue.includes('luk'))) toolpathRisk = 'medium'

  const risks = {
    'Putanja alata':   toolpathRisk,
    'Vreteno':         spindleRisk,
    'Posmak':          feedrateRisk,
    'Kolizija':        collisionRisk,
  }

  // ── Complexity ──────────────────────────────────────────────────────────

  const totalMoves = rapidMoves + linearMoves + arcMoves
  let complexity = 'jednostavan'
  if (totalMoves > 5000 || toolChangeCount > 5 || arcMoves > 200) complexity = 'složen'
  else if (totalMoves > 500 || toolChangeCount > 2 || arcMoves > 20) complexity = 'srednji'

  // ── Summary ─────────────────────────────────────────────────────────────

  const summary = {
    total_lines: lineNum,
    tool_count:  toolsUsed.length,
    complexity,
    overall_risk: overallRisk,
  }

  // ── Optimizations ───────────────────────────────────────────────────────

  const optimizations = []

  // Many short rapids
  const avgRapidDist = rapidMoves > 0 ? rapidDistance / rapidMoves : 0
  if (rapidMoves > 50 && avgRapidDist < 10) {
    optimizations.push({
      category: 'toolpath_efficiency',
      current: `${rapidMoves} brzih premještanja, prosj. ${avgRapidDist.toFixed(1)} mm`,
      suggested: 'Optimizirajte putanje brzih premještanja da smanjite ukupan broj kretnji',
      estimated_time_saving_pct: 8,
    })
  }

  // Conservative feedrate
  if (avgFeed > 0 && avgFeed < 500 && linearMoves > 20) {
    optimizations.push({
      category: 'feedrate_optimization',
      current: `Prosječni posmak: ${avgFeed} mm/min`,
      suggested: `Povećajte posmak na ${Math.round(avgFeed * 1.2)} mm/min tamo gdje to dopušta materijal`,
      estimated_time_saving_pct: 12,
    })
  }

  // High tool changes
  if (toolChangeCount > 6) {
    optimizations.push({
      category: 'tool_changes',
      current: `${toolChangeCount} izmjena alata`,
      suggested: 'Grupirajte operacije istim alatom da smanjite broj izmjena',
      estimated_time_saving_pct: 5,
    })
  }

  // ── AI notes ────────────────────────────────────────────────────────────

  const totalDistMm  = Math.round(rapidDistance + cuttingDistance)
  const totalTimeFmt = totalTime > 60
    ? `${(totalTime/60).toFixed(1)} h`
    : `${totalTime.toFixed(1)} min`

  let aiNotes = `Program ima ${lineNum.toLocaleString('hr')} linija, `
    + `${toolsUsed.length} alat${toolsUsed.length === 1 ? '' : 'a'} i `
    + `${totalMoves.toLocaleString('hr')} poteza. `
    + `Ukupna pređena putanja: ${totalDistMm.toLocaleString('hr')} mm (brzo: ${Math.round(rapidDistance)} mm, rezanje: ${Math.round(cuttingDistance)} mm). `
    + `Procijenjeno trajanje obrade: ${totalTimeFmt}. `

  if (criticalIssues > 0) aiNotes += `Otkriveno ${criticalIssues} kritičnih problema koji zahtijevaju hitnu pažnju. `
  if (warningIssues > 0)  aiNotes += `Pronađeno ${warningIssues} upozorenja. `
  if (criticalIssues === 0 && warningIssues === 0) aiNotes += `Nije pronađeno kritičnih problema. `

  if (optimizations.length > 0) {
    aiNotes += `Identificirane ${optimizations.length} mogućnosti optimizacije.`
  }

  // ── Build ml_suggestions (populated by gcodeML.js later) ────────────────

  return {
    filename: filename || 'program.nc',
    analyzed_at: new Date().toISOString(),
    summary,
    risks,
    issues,
    optimizations,
    tools_analysis: toolsAnalysis,
    ai_notes: aiNotes,

    // Extended data (also returned for completeness)
    tools: toolsUsed,
    tool_changes: Math.max(0, toolChangeCount - 1), // first load is not a "change"
    feedrate: { min: minFeed, max: maxFeed, average: avgFeed },
    spindle:  { min: minSpindle, max: maxSpindle },
    moves: { rapid: rapidMoves, linear: linearMoves, arc: arcMoves },
    distance_mm: {
      rapid:   Math.round(rapidDistance),
      cutting: Math.round(cuttingDistance),
    },
    estimated_time_min: Math.round(totalTime * 100) / 100,
    warnings,
    ml_suggestions: [],  // filled by gcodeML
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyse G-code provided as a string.
 */
function analyzeText(text, filename) {
  const lines = text.split(/\r?\n/)
  return analyzeLines(lines, filename)
}

/**
 * Analyse a G-code file via streaming (supports large files).
 * Returns a Promise<analysisResult>.
 */
function analyzeFile(filePath, filename) {
  return new Promise((resolve, reject) => {
    const lines = []
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })
    rl.on('line', line => lines.push(line))
    rl.on('close', () => {
      try {
        resolve(analyzeLines(lines, filename || path.basename(filePath)))
      } catch (e) {
        reject(e)
      }
    })
    rl.on('error', reject)
  })
}

module.exports = { analyzeText, analyzeFile }
