const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// GET all kalkulacije
router.get('/', (req, res) => {
  try {
    const rows = db.all(`
      SELECT k.*, u.first_name || ' ' || u.last_name as kreirao_ime
      FROM kalkulacije k
      LEFT JOIN users u ON k.kreirao_id = u.id
      ORDER BY k.created_at DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET single kalkulacija
router.get('/:id', (req, res) => {
  try {
    const k = db.get('SELECT * FROM kalkulacije WHERE id = ?', [req.params.id])
    if (!k) return res.status(404).json({ error: 'Not found' })
    k.data = JSON.parse(k.data || '{}')
    res.json(k)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST create nova kalkulacija
router.post('/', (req, res) => {
  try {
    const { naziv, broj_nacrta, materijal, naziv_dijela, ident_nr, varijanta, data, status, napomena } = req.body
    const result = db.prepare(`
      INSERT INTO kalkulacije (naziv, broj_nacrta, materijal, naziv_dijela, ident_nr, varijanta, data, status, napomena, kreirao_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(naziv, broj_nacrta || '', materijal || '', naziv_dijela || '', ident_nr || '', varijanta || '50', JSON.stringify(data || {}), status || 'draft', napomena || '', req.user.id)
    const created = db.get('SELECT * FROM kalkulacije WHERE id = ?', [result.lastInsertRowid])
    created.data = JSON.parse(created.data || '{}')
    res.json(created)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT update kalkulacija
router.put('/:id', (req, res) => {
  try {
    const { naziv, broj_nacrta, materijal, naziv_dijela, ident_nr, varijanta, data, status, napomena } = req.body
    db.prepare(`
      UPDATE kalkulacije SET naziv=?, broj_nacrta=?, materijal=?, naziv_dijela=?, ident_nr=?, varijanta=?, data=?, status=?, napomena=?, updated_at=datetime('now')
      WHERE id=?
    `).run(naziv, broj_nacrta || '', materijal || '', naziv_dijela || '', ident_nr || '', varijanta || '50', JSON.stringify(data || {}), status || 'draft', napomena || '', req.params.id)
    const updated = db.get('SELECT * FROM kalkulacije WHERE id = ?', [req.params.id])
    updated.data = JSON.parse(updated.data || '{}')
    res.json(updated)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE kalkulacija
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM kalkulacije WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST duplicate kalkulacija
router.post('/:id/duplicate', (req, res) => {
  try {
    const original = db.get('SELECT * FROM kalkulacije WHERE id = ?', [req.params.id])
    if (!original) return res.status(404).json({ error: 'Not found' })
    const result = db.prepare(`
      INSERT INTO kalkulacije (naziv, broj_nacrta, materijal, naziv_dijela, ident_nr, varijanta, data, status, napomena, kreirao_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))
    `).run(
      original.naziv + ' (kopija)', original.broj_nacrta, original.materijal,
      original.naziv_dijela, original.ident_nr, original.varijanta,
      original.data, original.napomena, req.user.id
    )
    const created = db.get('SELECT * FROM kalkulacije WHERE id = ?', [result.lastInsertRowid])
    created.data = JSON.parse(created.data || '{}')
    res.json(created)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
