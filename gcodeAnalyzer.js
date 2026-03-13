const jwt = require('jsonwebtoken')
const SECRET = process.env.JWT_SECRET || 'deer-mes-secret-key-2024'

// ── Basic JWT auth ─────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'No token' })
  const token = header.replace('Bearer ', '')
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ── RBAC: check permission ─────────────────────────────────────────────────
const checkPermission = (permission) => (req, res, next) => {
  if (req.user?.role === 'company_admin') return next()
  try {
    const db = require('../db')
    const hasPermission = db.get(`
      SELECT 1 as ok
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ? AND p.name = ?
      LIMIT 1
    `, [req.user.id, permission])
    if (!hasPermission) {
      return res.status(403).json({ error: `Forbidden — required: ${permission}` })
    }
    next()
  } catch (e) {
    console.warn('RBAC check skipped:', e.message)
    next()
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.user?.role)) return next()
  return res.status(403).json({ error: 'Insufficient role' })
}

module.exports = { auth, checkPermission, requireRole, SECRET }
