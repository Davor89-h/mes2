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
  // ── END MES v2 ROUTES ──────────────────────────────

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
