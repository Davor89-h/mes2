const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3000

const db = require('./db')
db.init().then(() => {
  app.use('/api/auth', require('./routes/auth'))
  app.use('/api/dashboard', require('./routes/dashboard'))
  app.use('/api/fixtures', require('./routes/fixtures'))
  app.use('/api/tools', require('./routes/tools'))
  app.use('/api/clamping', require('./routes/clamping'))
  app.use('/api/machines', require('./routes/machines'))
  app.use('/api/locations', require('./routes/locations'))
  app.use('/api/materials', require('./routes/materials'))
  app.use('/api/usage', require('./routes/usage'))
  app.use('/api/sales', require('./routes/sales'))
  app.use('/api/quality', require('./routes/quality'))
  app.use('/api/warehouse', require('./routes/warehouse'))
  app.use('/api/hr', require('./routes/hr'))
  app.use('/api/dms', require('./routes/dms'))
  app.use('/api/forms', require('./routes/forms'))
  app.use('/api/maintenance', require('./routes/maintenance'))
  app.use('/api/kpi', require('./routes/kpi'))
  app.use('/api/ai', require('./routes/ai'))
  app.use('/api/users', require('./routes/users'))
  app.use('/api/kalkulacije', require('./routes/kalkulacije'))

  // ── MES v2 NEW ROUTES ──────────────────────────────
  app.use('/api/work-orders', require('./routes/work_orders'))
  app.use('/api/tool-life',   require('./routes/tool_life'))
  app.use('/api/oee',         require('./routes/oee'))
  app.use('/api/production',  require('./routes/production'))
  app.use('/api/kontroling', require('./routes/kontroling'))
  app.use('/api/tasks', require('./routes/tasks'))
  app.use('/api/digital-twin', require('./routes/digital_twin'))
  // ── END MES v2 ROUTES ──────────────────────────────

  // ── Live telemetry simulator — new readings every 30s ─────────────────────
  const _db = require('./db')
  const _telBase = [
    { temp:42, spindle:8500, feed:1200, vibr:0.8, power:12.5 },
    { temp:28, spindle:0,    feed:0,    vibr:0.1, power:1.2  },
    { temp:55, spindle:6000, feed:800,  vibr:1.2, power:18.0 },
  ]
  setInterval(() => {
    try {
      const _machines = _db.all('SELECT id, status FROM machines')
      const _j = (v, p) => Math.round((v * (1 + (Math.random()-0.5)*p)) * 10) / 10
      const _ts = new Date().toISOString()
      _machines.forEach((m, idx) => {
        const _b = _telBase[idx] || _telBase[0]
        const _on = m.status === 'running'
        _db.run('INSERT INTO machine_telemetry (machine_id,temperature,spindle_speed,feed_rate,vibration,power_kw,status,recorded_at) VALUES (?,?,?,?,?,?,?,?)',
          [m.id, _j(_on?_b.temp:23,0.05), _on?_j(_b.spindle,0.04):0, _on?_j(_b.feed,0.08):0,
           _j(_on?_b.vibr:0.04,0.15), _j(_on?_b.power:0.7,0.05), m.status, _ts])
      })
    } catch(_e) {}
  }, 30000)
  // ────────────────────────────────────────────────────────────────────────────

  // Try multiple possible frontend dist paths
  const possiblePaths = [
    path.join(__dirname, '../../frontend/dist'),
    path.join(process.cwd(), 'frontend/dist'),
    path.join(process.cwd(), '../frontend/dist'),
  ]

  let frontendDist = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      frontendDist = p
      console.log(`✅ Frontend dist found at: ${p}`)
      break
    }
  }

  if (frontendDist) {
    app.use(express.static(frontendDist))
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendDist, 'index.html'))
      }
    })
  } else {
    console.log('⚠️  Frontend dist not found, API-only mode')
    console.log('   Searched:', possiblePaths)
    app.get('/', (req, res) => res.json({ status: '🦌 DEER MES API running' }))
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🦌 DEER MES v6 running on port ${PORT}`)
  })
}).catch(err => {
  console.error('❌ Failed to start:', err)
  process.exit(1)
})
