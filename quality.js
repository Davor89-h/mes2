const router = require('express').Router()
const db = require('../db')
const { auth, checkPermission } = require('../middleware/auth')
const bcrypt = require('bcryptjs')

router.use(auth)

// ── SPECIFIC routes FIRST (before /:id) ────────────────────────────────────
router.get('/roles/all', (req, res) => {
  try {
    const roles = db.all('SELECT * FROM roles ORDER BY name')
    const perms = db.all('SELECT rp.role_id, p.name FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id')
    const result = roles.map(r => ({
      ...r,
      permissions: perms.filter(p => p.role_id === r.id).map(p => p.name)
    }))
    res.json(result)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/permissions/all', (req, res) => {
  try { res.json(db.all('SELECT * FROM permissions ORDER BY module, name')) }
  catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/permissions/my', (req, res) => {
  try {
    if (req.user.role === 'company_admin') {
      return res.json(db.all('SELECT name FROM permissions').map(p => p.name))
    }
    const perms = db.all(`
      SELECT DISTINCT p.name FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?
    `, [req.user.id])
    res.json(perms.map(p => p.name))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── List all users ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const users = db.all(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.role, u.active,
        u.created_at, GROUP_CONCAT(r.label, ', ') as roles_label,
        GROUP_CONCAT(r.id, ',') as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id ORDER BY u.first_name, u.last_name
    `)
    res.json(users)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Create user ─────────────────────────────────────────────────────────────
router.post('/', checkPermission('users.manage'), async (req, res) => {
  try {
    const { username, password, first_name, last_name, email, role } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username i password su obavezni' })
    const existing = db.get('SELECT id FROM users WHERE username=?', [username])
    if (existing) return res.status(400).json({ error: 'Korisnik već postoji' })
    const hash = await bcrypt.hash(password, 10)
    const r = db.prepare('INSERT INTO users (username,password_hash,first_name,last_name,email,role) VALUES (?,?,?,?,?,?)').run(
      username, hash, first_name||username, last_name||'', email||null, role||'operator')
    res.json({ id: r.lastInsertRowid, username, first_name, last_name, role })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Single user ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const user = db.get('SELECT id,username,first_name,last_name,email,role,active,created_at FROM users WHERE id=?', [req.params.id])
    if (!user) return res.status(404).json({ error: 'Not found' })
    const roles = db.all('SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=?', [req.params.id])
    const perms = db.all(`
      SELECT DISTINCT p.name FROM permissions p
      JOIN role_permissions rp ON rp.permission_id=p.id
      JOIN user_roles ur ON ur.role_id=rp.role_id
      WHERE ur.user_id=?
    `, [req.params.id])
    res.json({ ...user, roles, permissions: perms.map(p=>p.name) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Update user ─────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { first_name, last_name, email, role, active } = req.body
    db.prepare('UPDATE users SET first_name=?,last_name=?,email=?,role=?,active=? WHERE id=?').run(
      first_name, last_name, email, role, active!==undefined?active:1, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Change password ─────────────────────────────────────────────────────────
router.patch('/:id/password', async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 4) return res.status(400).json({ error: 'Lozinka mora imati min 4 znaka' })
    const hash = await bcrypt.hash(password, 10)
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Deactivate user ─────────────────────────────────────────────────────────
router.delete('/:id', checkPermission('users.manage'), (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Ne možete deaktivirati sami sebe' })
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(req.params.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Roles assignment ────────────────────────────────────────────────────────
router.post('/:id/roles', checkPermission('users.manage'), (req, res) => {
  try {
    const { role_id } = req.body
    const exists = db.get('SELECT 1 FROM user_roles WHERE user_id=? AND role_id=?', [req.params.id, role_id])
    if (!exists) db.prepare('INSERT INTO user_roles (user_id,role_id,granted_by) VALUES (?,?,?)').run(req.params.id, role_id, req.user.id)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/roles/:roleId', checkPermission('users.manage'), (req, res) => {
  try {
    db.prepare('DELETE FROM user_roles WHERE user_id=? AND role_id=?').run(req.params.id, req.params.roleId)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
