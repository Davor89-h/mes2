const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const db = require('../db')

router.use(auth)

// ─── BUDŽET ────────────────────────────────────────────────────────────────

router.get('/budzet', (req, res) => {
  try {
    const rows = db.all(`
      SELECT b.*, u.first_name || ' ' || u.last_name as kreirao_ime
      FROM kontroling_budzet b
      LEFT JOIN users u ON b.kreirao_id = u.id
      ORDER BY b.godina DESC, b.mjesec DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/budzet', (req, res) => {
  try {
    const { godina, mjesec, kategorija, opis, iznos_plan, napomena } = req.body
    const result = db.prepare(`
      INSERT INTO kontroling_budzet (godina, mjesec, kategorija, opis, iznos_plan, napomena, kreirao_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(godina, mjesec, kategorija, opis || '', iznos_plan, napomena || '', req.user.id)
    res.json(db.get('SELECT * FROM kontroling_budzet WHERE id = ?', [result.lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/budzet/:id', (req, res) => {
  try {
    const { godina, mjesec, kategorija, opis, iznos_plan, iznos_stvarni, napomena } = req.body
    db.prepare(`
      UPDATE kontroling_budzet SET godina=?, mjesec=?, kategorija=?, opis=?, iznos_plan=?, iznos_stvarni=?, napomena=?, updated_at=datetime('now')
      WHERE id=?
    `).run(godina, mjesec, kategorija, opis || '', iznos_plan, iznos_stvarni || 0, napomena || '', req.params.id)
    res.json(db.get('SELECT * FROM kontroling_budzet WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/budzet/:id', (req, res) => {
  try {
    db.run('DELETE FROM kontroling_budzet WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── TROŠKOVI STROJA/SATA ──────────────────────────────────────────────────

router.get('/strojni-troskovi', (req, res) => {
  try {
    const rows = db.all(`
      SELECT ms.*, m.name as stroj_naziv
      FROM kontroling_masinski_sat ms
      LEFT JOIN machines m ON ms.machine_id = m.id
      ORDER BY ms.vrijedi_od DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/strojni-troskovi', (req, res) => {
  try {
    const { machine_id, trošak_amortizacija, trošak_struja, trošak_odrzavanje, trošak_ostalo, vrijedi_od, napomena } = req.body
    const ukupno = (trošak_amortizacija || 0) + (trošak_struja || 0) + (trošak_odrzavanje || 0) + (trošak_ostalo || 0)
    const result = db.prepare(`
      INSERT INTO kontroling_masinski_sat (machine_id, trosak_amortizacija, trosak_struja, trosak_odrzavanje, trosak_ostalo, trosak_ukupno_sat, vrijedi_od, napomena, kreirao_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(machine_id, trošak_amortizacija || 0, trošak_struja || 0, trošak_odrzavanje || 0, trošak_ostalo || 0, ukupno, vrijedi_od, napomena || '', req.user.id)
    res.json(db.get('SELECT * FROM kontroling_masinski_sat WHERE id = ?', [result.lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/strojni-troskovi/:id', (req, res) => {
  try {
    const { machine_id, trošak_amortizacija, trošak_struja, trošak_odrzavanje, trošak_ostalo, vrijedi_od, napomena } = req.body
    const ukupno = (trošak_amortizacija || 0) + (trošak_struja || 0) + (trošak_odrzavanje || 0) + (trošak_ostalo || 0)
    db.prepare(`
      UPDATE kontroling_masinski_sat SET machine_id=?, trosak_amortizacija=?, trosak_struja=?, trosak_odrzavanje=?, trosak_ostalo=?, trosak_ukupno_sat=?, vrijedi_od=?, napomena=?
      WHERE id=?
    `).run(machine_id, trošak_amortizacija || 0, trošak_struja || 0, trošak_odrzavanje || 0, trošak_ostalo || 0, ukupno, vrijedi_od, napomena || '', req.params.id)
    res.json(db.get('SELECT * FROM kontroling_masinski_sat WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/strojni-troskovi/:id', (req, res) => {
  try {
    db.run('DELETE FROM kontroling_masinski_sat WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── TROŠKOVI PO RADNOM NALOGU ────────────────────────────────────────────

router.get('/nalog-troskovi', (req, res) => {
  try {
    const { work_order_id } = req.query
    let sql = `
      SELECT nt.*, wo.work_order_id as nalog_broj, wo.part_name
      FROM kontroling_nalog_troskovi nt
      LEFT JOIN work_orders wo ON nt.work_order_id = wo.id
    `
    const params = []
    if (work_order_id) { sql += ' WHERE nt.work_order_id = ?'; params.push(work_order_id) }
    sql += ' ORDER BY nt.created_at DESC'
    res.json(db.all(sql, params))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/nalog-troskovi', (req, res) => {
  try {
    const { work_order_id, kategorija, opis, kolicina, jedinicna_cijena, napomena } = req.body
    const ukupno = (kolicina || 1) * (jedinicna_cijena || 0)
    const result = db.prepare(`
      INSERT INTO kontroling_nalog_troskovi (work_order_id, kategorija, opis, kolicina, jedinicna_cijena, ukupno, napomena, kreirao_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(work_order_id, kategorija, opis || '', kolicina || 1, jedinicna_cijena || 0, ukupno, napomena || '', req.user.id)
    res.json(db.get('SELECT * FROM kontroling_nalog_troskovi WHERE id = ?', [result.lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/nalog-troskovi/:id', (req, res) => {
  try {
    const { work_order_id, kategorija, opis, kolicina, jedinicna_cijena, napomena } = req.body
    const ukupno = (kolicina || 1) * (jedinicna_cijena || 0)
    db.prepare(`
      UPDATE kontroling_nalog_troskovi SET work_order_id=?, kategorija=?, opis=?, kolicina=?, jedinicna_cijena=?, ukupno=?, napomena=?
      WHERE id=?
    `).run(work_order_id, kategorija, opis || '', kolicina || 1, jedinicna_cijena || 0, ukupno, napomena || '', req.params.id)
    res.json(db.get('SELECT * FROM kontroling_nalog_troskovi WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/nalog-troskovi/:id', (req, res) => {
  try {
    db.run('DELETE FROM kontroling_nalog_troskovi WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── PROFITABILNOST ────────────────────────────────────────────────────────

router.get('/profitabilnost', (req, res) => {
  try {
    const rows = db.all(`
      SELECT p.*, sp.name as partner_naziv
      FROM kontroling_profitabilnost p
      LEFT JOIN sales_partners sp ON p.partner_id = sp.id
      ORDER BY p.period_god DESC, p.period_mj DESC
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/profitabilnost', (req, res) => {
  try {
    const { partner_id, proizvod, period_god, period_mj, prihod, trošak_materijal, trošak_rad, trošak_rezija, napomena } = req.body
    const ukupni_trošak = (trošak_materijal || 0) + (trošak_rad || 0) + (trošak_rezija || 0)
    const bruto_dobit = (prihod || 0) - ukupni_trošak
    const marza = prihod > 0 ? (bruto_dobit / prihod) * 100 : 0
    const result = db.prepare(`
      INSERT INTO kontroling_profitabilnost (partner_id, proizvod, period_god, period_mj, prihod, trosak_materijal, trosak_rad, trosak_rezija, ukupni_trosak, bruto_dobit, marza_posto, napomena, kreirao_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(partner_id || null, proizvod, period_god, period_mj, prihod || 0, trošak_materijal || 0, trošak_rad || 0, trošak_rezija || 0, ukupni_trošak, bruto_dobit, marza, napomena || '', req.user.id)
    res.json(db.get('SELECT * FROM kontroling_profitabilnost WHERE id = ?', [result.lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/profitabilnost/:id', (req, res) => {
  try {
    const { partner_id, proizvod, period_god, period_mj, prihod, trošak_materijal, trošak_rad, trošak_rezija, napomena } = req.body
    const ukupni_trošak = (trošak_materijal || 0) + (trošak_rad || 0) + (trošak_rezija || 0)
    const bruto_dobit = (prihod || 0) - ukupni_trošak
    const marza = prihod > 0 ? (bruto_dobit / prihod) * 100 : 0
    db.prepare(`
      UPDATE kontroling_profitabilnost SET partner_id=?, proizvod=?, period_god=?, period_mj=?, prihod=?, trosak_materijal=?, trosak_rad=?, trosak_rezija=?, ukupni_trosak=?, bruto_dobit=?, marza_posto=?, napomena=?
      WHERE id=?
    `).run(partner_id || null, proizvod, period_god, period_mj, prihod || 0, trošak_materijal || 0, trošak_rad || 0, trošak_rezija || 0, ukupni_trošak, bruto_dobit, marza, napomena || '', req.params.id)
    res.json(db.get('SELECT * FROM kontroling_profitabilnost WHERE id = ?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/profitabilnost/:id', (req, res) => {
  try {
    db.run('DELETE FROM kontroling_profitabilnost WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── SUMMARY / KPI ────────────────────────────────────────────────────────

router.get('/summary', (req, res) => {
  try {
    const godina = req.query.godina || new Date().getFullYear()

    const budzet = db.all(`SELECT kategorija, SUM(iznos_plan) as plan, SUM(iznos_stvarni) as stvarni FROM kontroling_budzet WHERE godina=? GROUP BY kategorija`, [godina])
    const nalogTroskovi = db.all(`SELECT kategorija, SUM(ukupno) as ukupno FROM kontroling_nalog_troskovi GROUP BY kategorija`)
    const profitabilnost = db.all(`SELECT SUM(prihod) as prihod, SUM(ukupni_trosak) as trosak, SUM(bruto_dobit) as dobit, AVG(marza_posto) as avg_marza FROM kontroling_profitabilnost WHERE period_god=?`, [godina])
    const strojniSat = db.all(`SELECT m.name, ms.trosak_ukupno_sat FROM kontroling_masinski_sat ms LEFT JOIN machines m ON ms.machine_id = m.id ORDER BY ms.vrijedi_od DESC`)

    // Budget variance
    const totalPlan = budzet.reduce((s, r) => s + (r.plan || 0), 0)
    const totalStvarni = budzet.reduce((s, r) => s + (r.stvarni || 0), 0)
    const totalNalogTroskovi = nalogTroskovi.reduce((s, r) => s + (r.ukupno || 0), 0)

    res.json({
      budzet,
      nalogTroskovi,
      profitabilnost: profitabilnost[0] || {},
      strojniSat,
      kpi: {
        totalPlan,
        totalStvarni,
        varijanca: totalPlan - totalStvarni,
        varijancaPosto: totalPlan > 0 ? ((totalPlan - totalStvarni) / totalPlan) * 100 : 0,
        totalNalogTroskovi,
        prihod: profitabilnost[0]?.prihod || 0,
        dobit: profitabilnost[0]?.dobit || 0,
        avgMarza: profitabilnost[0]?.avg_marza || 0,
      }
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── TREND (monthly) ──────────────────────────────────────────────────────
router.get('/trend', (req, res) => {
  try {
    const godina = req.query.godina || new Date().getFullYear()
    const trend = db.all(`
      SELECT period_mj as mj,
             SUM(prihod) as prihod,
             SUM(ukupni_trosak) as trosak,
             SUM(bruto_dobit) as dobit
      FROM kontroling_profitabilnost
      WHERE period_god = ?
      GROUP BY period_mj
      ORDER BY period_mj
    `, [godina])
    res.json(trend)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
