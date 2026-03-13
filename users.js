const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')
const { SECRET } = require('../middleware/auth')

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' })
  const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username)
  if (!user) return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka' })
  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka' })
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name, role: user.role, email: user.email } })
})

router.post('/register', (req, res) => {
  const { username, password, firstName, lastName, email, role } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' })
  try {
    const hash = bcrypt.hashSync(password, 10)
    const stmt = db.prepare('INSERT INTO users (username, password_hash, first_name, last_name, email, role) VALUES (?,?,?,?,?,?)')
    const result = stmt.run(username, hash, firstName || username, lastName || '', email || '', role || 'operator')
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid)
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name, role: user.role } })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Korisničko ime već postoji' })
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
