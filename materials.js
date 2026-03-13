/**
 * DEER MES — G-code Local ML Module
 * 100% offline. Uses a rolling statistical model stored in a JSON file.
 * No TensorFlow dependency — pure statistics (percentile comparisons).
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// Storage path — next to the backend db folder
const DATA_DIR  = path.join(__dirname, '..', 'db', 'gcode_ml')
const DATA_FILE = path.join(DATA_DIR, 'dataset.json')
const MIN_SAMPLES_FOR_TRAINING = 3

// ─── Dataset helpers ─────────────────────────────────────────────────────────

function loadDataset() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(DATA_FILE)) return []
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveDataset(dataset) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    // Keep last 1000 samples to avoid unbounded growth
    const trimmed = dataset.slice(-1000)
    fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf8')
  } catch (e) {
    console.error('[gcodeML] Failed to save dataset:', e.message)
  }
}

// ─── Feature extraction ──────────────────────────────────────────────────────

function extractFeatures(analysis) {
  return {
    tool_changes:      analysis.tool_changes || 0,
    feedrate_avg:      analysis.feedrate?.average || 0,
    rapid_moves:       analysis.moves?.rapid || 0,
    cut_moves:         (analysis.moves?.linear || 0) + (analysis.moves?.arc || 0),
    arc_ratio:         analysis.moves?.arc
                         ? analysis.moves.arc / Math.max(1, (analysis.moves.linear || 0) + (analysis.moves.arc || 0))
                         : 0,
    rapid_distance:    analysis.distance_mm?.rapid || 0,
    cutting_distance:  analysis.distance_mm?.cutting || 0,
    cycle_time:        analysis.estimated_time_min || 0,
    total_lines:       analysis.summary?.total_lines || 0,
    tool_count:        analysis.tools?.length || 0,
    warnings:          analysis.warnings?.length || 0,
  }
}

// ─── Statistical helpers ─────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.floor(sorted.length * p / 100)
  return sorted[Math.min(idx, sorted.length - 1)]
}

// ─── ML predictions ──────────────────────────────────────────────────────────

/**
 * Generate ML-based suggestions by comparing this program to the historical dataset.
 * Returns array of suggestion strings.
 */
function predict(features, dataset) {
  if (dataset.length < MIN_SAMPLES_FOR_TRAINING) {
    return []  // not enough data yet
  }

  const suggestions = []

  // Helper: compute array of a feature across dataset
  const col = (key) => dataset.map(d => d[key] || 0).sort((a, b) => a - b)

  // ── Cycle time improvement ───────────────────────────────────────────────
  const cycleTimes = col('cycle_time')
  const medianTime = percentile(cycleTimes, 50)
  if (features.cycle_time > 0 && medianTime > 0) {
    const ratio = features.cycle_time / medianTime
    if (ratio > 1.4) {
      const potentialPct = Math.round((1 - 1 / ratio) * 100 * 0.6)  // achievable 60%
      suggestions.push(`Moguća ušteda vremena ciklusa: ~${potentialPct}% (program je ${Math.round(ratio * 100 - 100)}% sporiji od medijana)`)
    }
  }

  // ── Rapid moves efficiency ───────────────────────────────────────────────
  const rapidCols = col('rapid_moves')
  const p75Rapids = percentile(rapidCols, 75)
  if (features.rapid_moves > p75Rapids * 1.5 && p75Rapids > 0) {
    suggestions.push(`Previše kratkih brzih premještanja (${features.rapid_moves} vs medijan ${percentile(rapidCols, 50)}) — optimizirajte putanju`)
  }

  // ── Feedrate optimization ────────────────────────────────────────────────
  const feedCols = col('feedrate_avg')
  const p75Feed  = percentile(feedCols, 75)
  if (features.feedrate_avg > 0 && p75Feed > 0 && features.feedrate_avg < percentile(feedCols, 25) * 0.8) {
    const suggested = Math.round(mean(feedCols.filter(f => f > 0)))
    if (suggested > features.feedrate_avg) {
      const gain = Math.round((suggested / features.feedrate_avg - 1) * 100)
      suggestions.push(`Posmak ispod prosjeka — povećanje na ~${suggested} mm/min moglo bi ubrzati program za ${Math.min(gain, 20)}%`)
    }
  }

  // ── Tool change count ────────────────────────────────────────────────────
  const tcCols  = col('tool_changes')
  const medianTC = percentile(tcCols, 50)
  if (features.tool_count > 1 && features.tool_changes > medianTC * 1.5 && medianTC > 0) {
    suggestions.push(`Visok broj izmjena alata (${features.tool_changes}) — grupiranje operacija može smanjiti gubitke vremena`)
  }

  // ── Arc ratio hint ───────────────────────────────────────────────────────
  const arcRatioCols = col('arc_ratio')
  const medArcRatio  = percentile(arcRatioCols, 50)
  if (features.arc_ratio > 0.5 && medArcRatio < 0.2) {
    suggestions.push(`Visok udio lučnih poteza — provjerite tolerance rezanja za veće posmake`)
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnCols  = col('warnings')
  const medWarns  = percentile(warnCols, 50)
  if (features.warnings > medWarns + 2 && medWarns >= 0) {
    suggestions.push(`Više upozorenja od uobičajenog (${features.warnings} vs medijan ${Math.round(medWarns)}) — pregledajte kod`)
  }

  return suggestions
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Record analysis result in local dataset and return ML suggestions.
 */
function learn(analysis) {
  const dataset  = loadDataset()
  const features = extractFeatures(analysis)

  // Add to dataset with timestamp
  dataset.push({ ...features, ts: Date.now() })
  saveDataset(dataset)

  // Generate predictions
  const suggestions = predict(features, dataset)
  return suggestions
}

/**
 * Just predict without adding to dataset (e.g. for preview).
 */
function suggest(analysis) {
  const dataset  = loadDataset()
  const features = extractFeatures(analysis)
  return predict(features, dataset)
}

module.exports = { learn, suggest }
