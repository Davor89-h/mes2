/**
 * DEER MES — Lokalni AI / Strojno učenje
 * 
 * Radi 100% offline bez ikakvog vanjskog API-ja.
 * Pri svakom upitu čita ŽIVU bazu i daje inteligentne odgovore
 * bazirane na vašim stvarnim podacima.
 * 
 * Ako je ANTHROPIC_API_KEY postavljen, koristit će Claude AI
 * s vašim podacima kao kontekstom (hybrid mode).
 */

const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

// Opcionalni Claude kao "mozak" — baza je uvijek lokalna
let anthropic = null
try {
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk')
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
} catch (e) {}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — čita sve relevantne podatke iz baze
// ═══════════════════════════════════════════════════════════════════════════
function buildKnowledgeBase() {
  const kb = {}

  // Strojevi
  kb.machines = db.all(`
    SELECT m.*, l.full_label as location_label,
      (SELECT COUNT(*) FROM maintenance_orders WHERE machine_id=m.id AND status!='completed') as open_maintenance,
      (SELECT MAX(recorded_at) FROM machine_telemetry WHERE machine_id=m.id) as last_telemetry
    FROM machines m LEFT JOIN locations l ON m.location_id=l.id
  `)

  // Alati — stanje zaliha
  kb.tools = db.all(`SELECT *, 
    CASE WHEN current_quantity=0 THEN 'nema_zalihe'
         WHEN current_quantity<=min_quantity THEN 'niska_zaliha'
         ELSE 'ok' END as stock_status
    FROM tools ORDER BY current_quantity ASC`)
  kb.tools_critical = kb.tools.filter(t => t.stock_status !== 'ok')

  // Radni nalozi
  kb.work_orders = db.all(`
    SELECT w.*, m.name as machine_name, u.first_name||' '||u.last_name as operator_name
    FROM work_orders w
    LEFT JOIN machines m ON w.machine_id=m.id
    LEFT JOIN users u ON w.operator_id=u.id
    WHERE w.status NOT IN ('completed','closed','cancelled')
    ORDER BY CASE w.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, w.planned_end
  `)
  kb.work_orders_all = db.all(`SELECT status, COUNT(*) as cnt FROM work_orders GROUP BY status`)
  kb.wo_overdue = db.all(`
    SELECT w.*, m.name as machine_name FROM work_orders w LEFT JOIN machines m ON w.machine_id=m.id
    WHERE w.planned_end < date('now') AND w.status NOT IN ('completed','closed','cancelled')
  `)

  // OEE — zadnjih 30 dana po stroju
  kb.oee = db.all(`
    SELECT machine_id, COUNT(*) as records,
      ROUND(AVG(oee),1) as avg_oee, ROUND(AVG(availability),1) as avg_avail,
      ROUND(AVG(performance),1) as avg_perf, ROUND(AVG(quality),1) as avg_qual,
      SUM(parts_produced) as total_parts, SUM(parts_scrap) as total_scrap,
      SUM(downtime_min) as total_downtime,
      (SELECT name FROM machines WHERE id=oee_records.machine_id) as machine_name
    FROM oee_records
    WHERE record_date >= date('now','-30 days')
    GROUP BY machine_id
  `)

  // Naprave (fixtures)
  kb.fixtures = db.all(`
    SELECT f.*, l.full_label as location_label,
      (SELECT COUNT(*) FROM fixture_usage WHERE fixture_id=f.id AND status='checked_out') as in_use_count
    FROM fixtures f LEFT JOIN locations l ON f.location_id=l.id
  `)
  kb.fixtures_overdue = kb.fixtures.filter(f => f.next_maintenance && f.next_maintenance < new Date().toISOString().slice(0,10))

  // Održavanje strojeva
  kb.maintenance = db.all(`
    SELECT mo.*, m.name as machine_name, u.first_name||' '||u.last_name as assigned_name
    FROM maintenance_orders mo
    LEFT JOIN machines m ON mo.machine_id=m.id
    LEFT JOIN users u ON mo.assigned_to=u.id
    WHERE mo.status != 'completed'
    ORDER BY CASE mo.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END
  `)

  // Zadaci
  kb.tasks = db.all(`
    SELECT t.*, u.first_name||' '||u.last_name as assigned_to_name,
      (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id AND completed=1) as done_items,
      (SELECT COUNT(*) FROM task_checklist_items WHERE task_id=t.id) as total_items
    FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id
    WHERE t.status NOT IN ('completed','cancelled')
    ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END
  `)

  // Dokumenti (DMS)
  kb.documents = db.all(`SELECT id, title, category, version, status, tags, description, created_at, expiry_date FROM documents`)
  kb.docs_expiring = db.all(`SELECT title, category, expiry_date FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days') AND expiry_date >= date('now')`)

  // Prodaja
  kb.sales_partners = db.all(`SELECT id, name, type, country, payment_terms FROM sales_partners`)
  kb.sales_rfqs = db.all(`SELECT r.*, p.name as partner_name FROM sales_rfqs r LEFT JOIN sales_partners p ON r.partner_id=p.id WHERE r.status NOT IN ('otkazana') ORDER BY r.created_at DESC LIMIT 20`)
  kb.sales_orders = db.all(`SELECT o.*, p.name as partner_name FROM sales_orders o LEFT JOIN sales_partners p ON o.partner_id=p.id WHERE o.status NOT IN ('isporučena','otkazana') ORDER BY o.delivery_date LIMIT 20`)

  // HR
  kb.employees = db.all(`SELECT id, first_name, last_name, department, position, active FROM employees WHERE active=1`)
  
  // Kontroling — financije
  kb.kontroling = {
    budzet: db.all(`SELECT * FROM kontroling_budzet ORDER BY godina DESC, mjesec DESC LIMIT 24`),
    profitabilnost: db.all(`SELECT * FROM kontroling_profitabilnost ORDER BY period_god DESC, period_mj DESC LIMIT 24`),
  }

  // Materijali / Skladište
  kb.materials = db.all(`SELECT * FROM materials WHERE status='aktivan' OR status IS NULL`)
  kb.warehouse = db.all(`SELECT * FROM warehouse_items`)
  kb.warehouse_low = kb.warehouse.filter(w => parseFloat(w.current_qty) <= parseFloat(w.min_qty))

  // Kalkulacije
  kb.kalkulacije = db.all(`SELECT id, naziv, broj_nacrta, materijal, naziv_dijela, status, created_at FROM kalkulacije ORDER BY created_at DESC LIMIT 20`)

  // Tool life
  kb.tool_life = db.all(`SELECT tl.*, t.name as tool_name, m.name as machine_name FROM tool_life tl LEFT JOIN tools t ON tl.tool_id=t.id LEFT JOIN machines m ON tl.machine_id=m.id`)

  // Forme / Zahtjevi
  kb.forms = db.all(`SELECT f.*, u.first_name||' '||u.last_name as requester_name FROM form_requests f LEFT JOIN users u ON f.requested_by=u.id WHERE f.status IN ('submitted','in_review','draft') ORDER BY CASE f.priority WHEN 'urgent' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 20`)

  return kb
}

// ═══════════════════════════════════════════════════════════════════════════
// LOKALNI AI MOTOR — razumije upite i odgovara iz KB
// ═══════════════════════════════════════════════════════════════════════════
function localAI(message, history, kb) {
  const m = message.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // ukloni dijakritike za matching
    .replace(/[?!.,;]/g, ' ')

  const tokens = new Set(m.split(/\s+/).filter(t => t.length > 2))

  // ── Detekcija teme ────────────────────────────────────────────────────────
  const TOPICS = {
    alati:      ['alat', 'alata', 'alatnica', 'zaliha', 'zalihe', 'kalibracija', 'nabav', 'naruci', 'narudzba'],
    strojevi:   ['stroj', 'stroja', 'strojevi', 'masina', 'cnc', 'status', 'oee', 'efikasnost'],
    oee:        ['oee', 'efikasnost', 'dostupnost', 'ucinkovitost', 'skart', 'srap', 'dobar'],
    nalozi:     ['nalog', 'naloga', 'nalozi', 'radni', 'produkcija', 'produkcij', 'kasni', 'zakasnio', 'hitno'],
    naprave:    ['naprava', 'naprave', 'fixture', 'stege', 'stega', 'servis'],
    odrzavanje: ['odrzavanje', 'kvar', 'popravak', 'servis', 'tehnicar', 'greska'],
    zadaci:     ['zadatak', 'zadatci', 'zadaci', 'task', 'posao', 'dovrseno', 'otvoreno'],
    dokumenti:  ['dokument', 'dms', 'certifikat', 'uputa', 'nacrt', 'istice', 'isteca', 'iso'],
    prodaja:    ['kupac', 'kupci', 'partner', 'upit', 'rfq', 'ponuda', 'narudzba', 'dostava', 'rok'],
    hr:         ['radnik', 'zaposlenik', 'odjel', 'hr', 'osoblje', 'tim'],
    kontroling: ['budzet', 'troskovi', 'profit', 'financij', 'prihod', 'marza', 'dobit'],
    materijali: ['materijal', 'sirovina', 'skladiste', 'zaliha', 'stock'],
    kalkulacije:['kalkulacij', 'kalkul', 'cijena', 'nacrt', 'dio'],
    forme:      ['zahtjev', 'forma', 'odobr', 'molb', 'godisnji', 'dopust'],
    summary:    ['status', 'pregled', 'summary', 'sumarno', 'sve', 'sve', 'izvjestaj', 'analiz', 'anali'],
  }

  const scores = {}
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    scores[topic] = keywords.filter(kw => m.includes(kw)).length
  }
  const topTopic = Object.entries(scores).sort((a,b) => b[1]-a[1])[0]
  const topic = topTopic[1] > 0 ? topTopic[0] : 'summary'

  // ── Generiranje odgovora ──────────────────────────────────────────────────
  switch (topic) {
    case 'alati': return answerAlati(kb, m)
    case 'strojevi': return answerStrojevi(kb, m)
    case 'oee': return answerOEE(kb, m)
    case 'nalozi': return answerNalozi(kb, m)
    case 'naprave': return answerNaprave(kb, m)
    case 'odrzavanje': return answerOdrzavanje(kb, m)
    case 'zadaci': return answerZadaci(kb, m)
    case 'dokumenti': return answerDokumenti(kb, m)
    case 'prodaja': return answerProdaja(kb, m)
    case 'hr': return answerHR(kb, m)
    case 'kontroling': return answerKontroling(kb, m)
    case 'materijali': return answerMaterijali(kb, m)
    case 'kalkulacije': return answerKalkulacije(kb, m)
    case 'forme': return answerForme(kb, m)
    default: return answerSummary(kb)
  }
}

// ── Alati ─────────────────────────────────────────────────────────────────
function answerAlati(kb, m) {
  const zero = kb.tools.filter(t => t.current_quantity === 0)
  const low  = kb.tools.filter(t => t.current_quantity > 0 && t.current_quantity <= t.min_quantity)
  const ok   = kb.tools.filter(t => t.current_quantity > t.min_quantity)

  if (m.includes('kalibraci')) {
    return `**Kalibracije alata** nisu još evidentirane. Koristite Alatnicu → klikni na alat → tab Kalibracija za unos.`
  }

  let r = `## 🔧 Stanje Alatnice\n\n`
  r += `**Ukupno alata:** ${kb.tools.length} | ✅ OK: ${ok.length} | ⚠️ Niska zaliha: ${low.length} | 🔴 Bez zalihe: ${zero.length}\n\n`

  if (zero.length > 0) {
    r += `### 🔴 HITNA NABAVA (nulta zaliha)\n`
    zero.forEach(t => r += `- **${t.name}** [${t.category||'—'}] — trenutna: **0** ${t.unit}, minimum: ${t.min_quantity} ${t.unit}\n`)
    r += `\n`
  }
  if (low.length > 0) {
    r += `### ⚠️ Niska zaliha (ispod minimuma)\n`
    low.forEach(t => r += `- **${t.name}** — ${t.current_quantity}/${t.min_quantity} ${t.unit} [${t.supplier||'bez dobavljača'}]\n`)
    r += `\n`
  }
  if (zero.length === 0 && low.length === 0) {
    r += `✅ Sve zalihe alata su iznad minimalnog praga. Nema potrebe za hitnom nabavom.\n`
  }
  return r
}

// ── Strojevi ──────────────────────────────────────────────────────────────
function answerStrojevi(kb, m) {
  const running = kb.machines.filter(x => x.status === 'running')
  const idle    = kb.machines.filter(x => x.status === 'idle')
  const fault   = kb.machines.filter(x => x.status === 'fault')

  let r = `## ⚙️ Status Strojeva\n\n`
  r += `**Ukupno:** ${kb.machines.length} strojeva | 🟢 Rade: ${running.length} | 🟡 Slobodni: ${idle.length} | 🔴 Kvar: ${fault.length}\n\n`

  kb.machines.forEach(m => {
    const ico = m.status==='running'?'🟢':m.status==='fault'?'🔴':'🟡'
    const pending_maint = kb.maintenance.filter(x => x.machine_id === m.id)
    r += `${ico} **${m.name}** [${m.machine_id}] — ${m.status?.toUpperCase()}${m.location_label?` @ ${m.location_label}`:''}`
    if (pending_maint.length > 0) r += ` ⚠️ ${pending_maint.length} nalog(a) održavanja`
    r += `\n`
  })

  const wo_per_machine = {}
  kb.work_orders.forEach(wo => {
    if (wo.machine_id) wo_per_machine[wo.machine_id] = (wo_per_machine[wo.machine_id]||0)+1
  })
  if (Object.keys(wo_per_machine).length > 0) {
    r += `\n### Opterećenost strojeva (otvoreni nalozi)\n`
    Object.entries(wo_per_machine).sort((a,b)=>b[1]-a[1]).forEach(([id, cnt]) => {
      const mac = kb.machines.find(x=>x.id==id)
      r += `- **${mac?.name||'Stroj '+id}**: ${cnt} nalog(a)\n`
    })
  }
  return r
}

// ── OEE ───────────────────────────────────────────────────────────────────
function answerOEE(kb, m) {
  if (kb.oee.length === 0) return `📊 **OEE podaci** nisu još zabilježeni za zadnjih 30 dana. Koristite OEE Monitoring za unos podataka smjena.`

  let r = `## 📊 OEE Analiza — zadnjih 30 dana\n\n`
  kb.oee.sort((a,b) => b.avg_oee-a.avg_oee).forEach(o => {
    const health = o.avg_oee >= 85 ? '🟢' : o.avg_oee >= 65 ? '🟡' : '🔴'
    r += `${health} **${o.machine_name}**: OEE **${o.avg_oee}%** (Dostupnost: ${o.avg_avail}%, Učinkovitost: ${o.avg_perf}%, Kvaliteta: ${o.avg_qual}%)\n`
    r += `   Proizvedeno: ${o.total_parts} kom | Škart: ${o.total_scrap} kom | Stajanje: ${o.total_downtime} min\n\n`
  })

  const avg_fleet = Math.round(kb.oee.reduce((s,o)=>s+o.avg_oee,0)/kb.oee.length)
  r += `**Prosječni OEE flote: ${avg_fleet}%** ${avg_fleet>=85?'🟢 Odlično':avg_fleet>=65?'🟡 Prihvatljivo':'🔴 Potrebna poboljšanja'}\n`

  const worst = kb.oee.sort((a,b)=>a.avg_oee-b.avg_oee)[0]
  if (worst && worst.avg_oee < 70) {
    r += `\n⚠️ **Prioritet poboljšanja:** ${worst.machine_name} ima najniži OEE (${worst.avg_oee}%). Preporučujem analizu uzroka zastoja.`
  }
  return r
}

// ── Radni nalozi ──────────────────────────────────────────────────────────
function answerNalozi(kb, m) {
  let r = `## 📋 Radni Nalozi\n\n`

  const by_status = {}
  kb.work_orders_all.forEach(row => by_status[row.status] = row.cnt)
  r += `**Ukupno:** ${Object.values(by_status).reduce((a,b)=>a+b,0)} naloga | Otvoreni: ${kb.work_orders.length} | U radu: ${by_status['in_progress']||0} | Završeni: ${by_status['completed']||0}\n\n`

  if (kb.wo_overdue.length > 0) {
    r += `### 🔴 KASNI NALOZI (${kb.wo_overdue.length})\n`
    kb.wo_overdue.forEach(wo => {
      r += `- **${wo.work_order_id}** — ${wo.part_name} (${wo.quantity} kom) @ ${wo.machine_name||'—'} | Rok: ${wo.planned_end}\n`
    })
    r += `\n`
  }

  const urgent = kb.work_orders.filter(wo => wo.priority==='urgent' || wo.priority==='high')
  if (urgent.length > 0) {
    r += `### ⚡ Prioritetni nalozi\n`
    urgent.slice(0,5).forEach(wo => {
      const icon = wo.priority==='urgent'?'🔴':'🟠'
      r += `${icon} **${wo.work_order_id}** — ${wo.part_name} (${wo.quantity_done||0}/${wo.quantity} kom) @ ${wo.machine_name||'—'}\n`
    })
    r += `\n`
  }

  if (kb.work_orders.length === 0) {
    r += `✅ Nema otvorenih radnih naloga.\n`
  } else if (kb.work_orders.length > 0) {
    r += `### Aktivni nalozi\n`
    kb.work_orders.slice(0,8).forEach(wo => {
      const pct = wo.quantity > 0 ? Math.round((wo.quantity_done||0)*100/wo.quantity) : 0
      r += `- **${wo.work_order_id}** ${wo.part_name} — ${pct}% završeno @ ${wo.machine_name||'—'}\n`
    })
  }
  return r
}

// ── Naprave ───────────────────────────────────────────────────────────────
function answerNaprave(kb, m) {
  const in_prod = kb.fixtures.filter(f => f.status==='in_production')
  const util = kb.fixtures.length > 0 ? Math.round(in_prod.length*100/kb.fixtures.length) : 0

  let r = `## 🏭 Naprave (Fixtures)\n\n`
  r += `**Ukupno:** ${kb.fixtures.length} | U produkciji: ${in_prod.length} (${util}%) | Servis prekoračen: ${kb.fixtures_overdue.length}\n\n`

  if (kb.fixtures_overdue.length > 0) {
    r += `### ⚠️ Prekoračen servisni rok\n`
    kb.fixtures_overdue.forEach(f => r += `- **${f.name}** [${f.internal_id}] — zadnji servis: ${f.last_maintenance||'nepoznato'} | sljedeći: ${f.next_maintenance}\n`)
    r += `\n`
  }

  r += `### Pregled naprava\n`
  kb.fixtures.forEach(f => {
    const ico = f.status==='in_production'?'🟢':f.status==='in_maintenance'?'🔧':'⚪'
    r += `${ico} **${f.name}** [${f.internal_id}] — ${f.status?.toUpperCase()} | ${f.location_label||f.type||'—'}\n`
  })
  return r
}

// ── Održavanje ────────────────────────────────────────────────────────────
function answerOdrzavanje(kb, m) {
  if (kb.maintenance.length === 0) return `✅ **Nema otvorenih naloga za održavanje.** Svi strojevi su servisno uredni.`

  let r = `## 🔩 Održavanje Strojeva\n\n`
  r += `**Otvoreni nalozi:** ${kb.maintenance.length}\n\n`

  const urgent = kb.maintenance.filter(x => x.priority==='urgent')
  const high   = kb.maintenance.filter(x => x.priority==='high')

  if (urgent.length > 0) {
    r += `### 🔴 HITNI nalozi\n`
    urgent.forEach(x => r += `- **${x.title}** @ ${x.machine_name||'—'} | Dodijeljen: ${x.assigned_name||'nije dodijeljen'}\n`)
    r += `\n`
  }
  if (high.length > 0) {
    r += `### 🟠 Visoki prioritet\n`
    high.forEach(x => r += `- **${x.title}** @ ${x.machine_name||'—'}\n`)
    r += `\n`
  }
  const rest = kb.maintenance.filter(x => x.priority!=='urgent' && x.priority!=='high')
  if (rest.length > 0) {
    r += `### 📋 Ostali nalozi\n`
    rest.forEach(x => r += `- ${x.title} @ ${x.machine_name||'—'} | ${x.type}\n`)
  }
  return r
}

// ── Zadaci ────────────────────────────────────────────────────────────────
function answerZadaci(kb, m) {
  if (kb.tasks.length === 0) return `✅ **Nema otvorenih zadataka.** Sve je riješeno!`

  let r = `## ✅ Zadaci\n\n`
  r += `**Otvorenih:** ${kb.tasks.length} zadataka\n\n`

  const urgent = kb.tasks.filter(t => t.priority==='urgent')
  if (urgent.length > 0) {
    r += `### 🔴 Hitni zadaci\n`
    urgent.forEach(t => r += `- **${t.title}** → ${t.assigned_to_name||'nije dodijeljen'} | ${t.total_items>0?`${t.done_items}/${t.total_items} stavki`:''}\n`)
    r += `\n`
  }

  r += `### Pregled\n`
  kb.tasks.slice(0,10).forEach(t => {
    const ico = t.priority==='urgent'?'🔴':t.priority==='high'?'🟠':'🔵'
    const prog = t.total_items > 0 ? ` [${t.done_items}/${t.total_items}]` : ''
    r += `${ico} **${t.title}**${prog} → ${t.assigned_to_name||'—'} [${t.module||'općenito'}]\n`
  })
  return r
}

// ── Dokumenti (DMS) ───────────────────────────────────────────────────────
function answerDokumenti(kb, m) {
  let r = `## 📄 DMS — Dokumenti\n\n`
  r += `**Ukupno:** ${kb.documents.length} dokumenata | Ističu uskoro (30d): ${kb.docs_expiring.length}\n\n`

  if (kb.docs_expiring.length > 0) {
    r += `### ⚠️ Dokumenti koji uskoro ističu\n`
    kb.docs_expiring.forEach(d => r += `- **${d.title}** [${d.category||'—'}] — ističe: **${d.expiry_date}**\n`)
    r += `\n`
  }

  // Kategorije
  const cats = {}
  kb.documents.forEach(d => { const c = d.category||'Ostalo'; cats[c]=(cats[c]||0)+1 })
  if (Object.keys(cats).length > 0) {
    r += `### Po kategorijama\n`
    Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => r += `- ${c}: ${n} dok.\n`)
  }

  // Pretraži po ključnoj riječi
  const search_terms = m.replace(/dokument|dms|certifikat|uputa|iso/g,'').trim()
  if (search_terms.length > 3) {
    const found = kb.documents.filter(d =>
      d.title?.toLowerCase().includes(search_terms) ||
      d.tags?.toLowerCase().includes(search_terms) ||
      d.description?.toLowerCase().includes(search_terms)
    )
    if (found.length > 0) {
      r += `\n### Pronađeni dokumenti za "${search_terms}"\n`
      found.slice(0,10).forEach(d => r += `- **${d.title}** v${d.version} [${d.category}] — ${d.status}\n`)
    }
  }
  return r
}

// ── Prodaja ───────────────────────────────────────────────────────────────
function answerProdaja(kb, m) {
  let r = `## 💼 Prodaja\n\n`
  r += `**Kupci/Partneri:** ${kb.sales_partners.length} | Otvorene narudžbe: ${kb.sales_orders.length} | Upiti (RFQ): ${kb.sales_rfqs.length}\n\n`

  if (kb.sales_orders.length > 0) {
    r += `### Otvorene narudžbe\n`
    kb.sales_orders.slice(0,8).forEach(o => {
      r += `- **${o.partner_name||'—'}** [${o.internal_id}] — rok: ${o.delivery_date||'—'} | ${o.status}\n`
    })
    r += `\n`
  }
  if (kb.sales_rfqs.length > 0) {
    r += `### Otvoreni upiti (RFQ)\n`
    kb.sales_rfqs.slice(0,5).forEach(r2 => {
      r += `- **${r2.partner_name||'—'}** [${r2.internal_id}] — rok: ${r2.deadline||'—'} | ${r2.status}\n`
    })
  }

  if (kb.sales_orders.length === 0 && kb.sales_rfqs.length === 0) {
    r += `Nema otvorenih narudžbi ni upita.\n`
  }
  return r
}

// ── HR ────────────────────────────────────────────────────────────────────
function answerHR(kb, m) {
  if (kb.employees.length === 0) return `👥 **Zaposlenici** nisu još uneseni u sustav. Koristite HR modul za unos.`
  const depts = {}
  kb.employees.forEach(e => { depts[e.department||'N/A']=(depts[e.department||'N/A']||0)+1 })
  let r = `## 👥 HR — Zaposlenici\n\n**Aktivnih:** ${kb.employees.length}\n\n`
  r += `### Po odjelima\n`
  Object.entries(depts).sort((a,b)=>b[1]-a[1]).forEach(([d,n]) => r += `- **${d}:** ${n} zaposlenih\n`)
  return r
}

// ── Kontroling ────────────────────────────────────────────────────────────
function answerKontroling(kb, m) {
  const prof = kb.kontroling.profitabilnost
  const budz = kb.kontroling.budzet
  if (prof.length === 0 && budz.length === 0) return `📊 **Kontroling podaci** nisu još uneseni. Koristite Kontroling modul za unos budžeta i profitabilnosti.`
  let r = `## 📊 Kontroling\n\n`
  if (prof.length > 0) {
    const ukupno_prihod = prof.reduce((s,p) => s+(p.prihod||0), 0)
    const ukupno_dobit  = prof.reduce((s,p) => s+(p.bruto_dobit||0), 0)
    const avg_marza = prof.reduce((s,p)=>s+(p.marza_posto||0),0)/prof.length
    r += `### Profitabilnost\n`
    r += `Ukupni prihod: **${ukupno_prihod.toLocaleString('hr')} €** | Bruto dobit: **${ukupno_dobit.toLocaleString('hr')} €** | Prosj. marža: **${avg_marza.toFixed(1)}%**\n\n`
  }
  if (budz.length > 0) {
    r += `### Budžet — zadnji unosi\n`
    budz.slice(0,5).forEach(b => r += `- ${b.kategorija} (${b.godina}/${b.mjesec}): Plan ${b.iznos_plan||0} € / Stvarno ${b.iznos_stvarni||0} €\n`)
  }
  return r
}

// ── Materijali / Skladište ─────────────────────────────────────────────────
function answerMaterijali(kb, m) {
  let r = `## 📦 Materijali i Skladište\n\n`
  r += `**Skladišnih stavki:** ${kb.warehouse.length} | Niska zaliha: ${kb.warehouse_low.length} | Materijali: ${kb.materials.length}\n\n`
  if (kb.warehouse_low.length > 0) {
    r += `### ⚠️ Niska zaliha u skladištu\n`
    kb.warehouse_low.forEach(w => r += `- **${w.name}** — ${w.current_qty} / min ${w.min_qty} ${w.unit}\n`)
    r += `\n`
  }
  if (kb.warehouse.length > 0) {
    r += `### Stanje skladišta\n`
    kb.warehouse.slice(0,8).forEach(w => {
      const ico = parseFloat(w.current_qty) <= parseFloat(w.min_qty) ? '🔴' : '✅'
      r += `${ico} **${w.name}** — ${w.current_qty} ${w.unit} @ ${w.location||'—'}\n`
    })
  }
  return r
}

// ── Kalkulacije ────────────────────────────────────────────────────────────
function answerKalkulacije(kb, m) {
  if (kb.kalkulacije.length === 0) return `🔢 **Kalkulacije** nisu još unesene. Koristite Kalkulacije modul.`
  let r = `## 🔢 Kalkulacije\n\n**Ukupno:** ${kb.kalkulacije.length}\n\n`
  kb.kalkulacije.slice(0,10).forEach(k => r += `- **${k.naziv||k.naziv_dijela||'—'}** [${k.broj_nacrta||'—'}] — ${k.materijal||'—'} | ${k.status}\n`)
  return r
}

// ── Forme / Zahtjevi ───────────────────────────────────────────────────────
function answerForme(kb, m) {
  if (kb.forms.length === 0) return `📝 **Nema otvorenih zahtjeva.** Sve je obrađeno!`
  let r = `## 📝 Zahtjevi na čekanju\n\n**Na čekanju:** ${kb.forms.length}\n\n`
  const urgent = kb.forms.filter(f => f.priority==='urgent')
  if (urgent.length > 0) {
    r += `### 🔴 Hitni zahtjevi\n`
    urgent.forEach(f => r += `- **${f.title}** [${f.form_type}] — ${f.requester_name||'—'}\n`)
    r += `\n`
  }
  kb.forms.slice(0,8).forEach(f => r += `- **${f.title}** [${f.form_type}] od ${f.requester_name||'—'} — ${f.status}\n`)
  return r
}

// ── Sažetak sustava ────────────────────────────────────────────────────────
function answerSummary(kb) {
  const running_machines = kb.machines.filter(m => m.status==='running').length
  const fault_machines   = kb.machines.filter(m => m.status==='fault').length
  const tools_critical   = kb.tools_critical.length
  const wo_urgent        = kb.work_orders.filter(w => w.priority==='urgent').length
  const maint_urgent     = kb.maintenance.filter(x => x.priority==='urgent').length
  const tasks_urgent     = kb.tasks.filter(t => t.priority==='urgent').length
  const avg_oee          = kb.oee.length > 0 ? Math.round(kb.oee.reduce((s,o)=>s+o.avg_oee,0)/kb.oee.length) : null

  let r = `## 🦌 DEER MES — Status Sustava\n\n`

  // Kritične točke
  const alerts = []
  if (fault_machines > 0)  alerts.push(`🔴 **${fault_machines} stroj(a) u kvaru**`)
  if (maint_urgent > 0)    alerts.push(`🔴 **${maint_urgent} hitnih naloga za održavanje**`)
  if (wo_urgent > 0)       alerts.push(`⚡ **${wo_urgent} hitnih radnih naloga**`)
  if (kb.wo_overdue.length > 0) alerts.push(`⏰ **${kb.wo_overdue.length} kasnih radnih naloga**`)
  if (tools_critical > 0)  alerts.push(`⚠️ **${tools_critical} alata s kritičnom zalihom**`)
  if (kb.fixtures_overdue.length > 0) alerts.push(`🔧 **${kb.fixtures_overdue.length} naprava s prekoračenim servisom**`)
  if (kb.docs_expiring.length > 0) alerts.push(`📄 **${kb.docs_expiring.length} dokumenata uskoro istječe**`)
  if (tasks_urgent > 0)    alerts.push(`✅ **${tasks_urgent} hitnih zadataka**`)

  if (alerts.length > 0) {
    r += `### ⚠️ Zahtijeva pažnju\n`
    alerts.forEach(a => r += `${a}\n`)
    r += `\n`
  }

  r += `### Pregled\n`
  r += `| Oblast | Status |\n|---|---|\n`
  r += `| Strojevi | ${running_machines}/${kb.machines.length} rade${fault_machines>0?` ⚠️ ${fault_machines} kvar`:''}  |\n`
  if (avg_oee) r += `| OEE (30d) | ${avg_oee}% flota ${avg_oee>=85?'🟢':avg_oee>=65?'🟡':'🔴'} |\n`
  r += `| Radni nalozi | ${kb.work_orders.length} otvorenih${kb.wo_overdue.length>0?` / ${kb.wo_overdue.length} kasni 🔴`:''}  |\n`
  r += `| Alati | ${kb.tools_critical.length} kritičnih od ${kb.tools.length} |\n`
  r += `| Naprave | ${kb.fixtures.filter(f=>f.status==='in_production').length}/${kb.fixtures.length} u produkciji |\n`
  r += `| Zadaci | ${kb.tasks.length} otvorenih |\n`
  r += `| Dokumenti | ${kb.documents.length} ukupno${kb.docs_expiring.length>0?` / ${kb.docs_expiring.length} istječe`:''}  |\n`

  if (alerts.length === 0) r += `\n✅ **Sustav radi normalno.** Nema kritičnih upozorenja.\n`

  r += `\n*Pitajte me o specifičnim temama: alati, strojevi, OEE, nalozi, naprave, dokumenti, prodaja, HR, kontroling...*`
  return r
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE-BASED INSIGHTS (za /insights page)
// ═══════════════════════════════════════════════════════════════════════════
function buildInsights(kb) {
  const insights = []

  kb.tools.filter(t=>t.current_quantity===0).forEach(t => {
    insights.push({ priority:'critical', title:`Nulta zaliha: ${t.name}`, message:`Alat "${t.name}" (${t.category||'—'}) ima 0 ${t.unit} na zalihi. Minimum je ${t.min_quantity} ${t.unit}.`, category:'inventory', icon:'🔴', action:'Otvori Alatnicu i naruči odmah' })
  })

  const low_tools = kb.tools.filter(t=>t.current_quantity>0&&t.current_quantity<=t.min_quantity)
  if (low_tools.length > 0) {
    insights.push({ priority:'high', title:`Niska zaliha (${low_tools.length} alata)`, message:`Alati ispod minimuma: ${low_tools.map(t=>t.name).join(', ')}.`, category:'inventory', icon:'⚠️', action:'Provjeri narudžbe alata' })
  }

  kb.fixtures_overdue.forEach(f => {
    insights.push({ priority:'high', title:`Prekoračen servis: ${f.name}`, message:`Naprava "${f.name}" ima prekoračen servisni rok (trebalo je: ${f.next_maintenance}). Produkcijski rizik raste.`, category:'maintenance', icon:'🔧', action:'Planiraj servisni nalog' })
  })

  kb.maintenance.filter(x=>x.priority==='urgent').forEach(x => {
    insights.push({ priority:'critical', title:`Hitno održavanje: ${x.machine_name||'stroj'}`, message:`"${x.title}" — hitni nalog za ${x.machine_name||'stroj'} čeka izvršenje.`, category:'maintenance', icon:'🚨', action:'Otvori Održavanje strojeva' })
  })

  kb.wo_overdue.forEach(wo => {
    insights.push({ priority:'high', title:`Kasni nalog: ${wo.work_order_id}`, message:`Radni nalog ${wo.work_order_id} (${wo.part_name}) je kasnio od ${wo.planned_end}. Stroj: ${wo.machine_name||'—'}.`, category:'efficiency', icon:'⏰', action:'Otvori Radne naloge' })
  })

  const fault = kb.machines.filter(m=>m.status==='fault')
  fault.forEach(m => {
    insights.push({ priority:'critical', title:`Kvar stroja: ${m.name}`, message:`Stroj "${m.name}" je u kvaru${m.location_label?` (lokacija: ${m.location_label})`:''}. Odmah kontaktiraj servis.`, category:'maintenance', icon:'🔴', action:'Prijavi kvar' })
  })

  kb.docs_expiring.forEach(d => {
    insights.push({ priority:'medium', title:`Dokument istječe: ${d.title}`, message:`Dokument "${d.title}" [${d.category||'—'}] istječe ${d.expiry_date}. Obnovi na vrijeme.`, category:'safety', icon:'📄', action:'Otvori DMS' })
  })

  kb.warehouse_low.forEach(w => {
    insights.push({ priority:'medium', title:`Niska zaliha: ${w.name}`, message:`Stavka "${w.name}" u skladištu ima ${w.current_qty} ${w.unit} (min: ${w.min_qty} ${w.unit}).`, category:'inventory', icon:'📦', action:'Provjeri skladište' })
  })

  if (insights.length === 0) {
    insights.push({ priority:'low', title:'Sustav optimalan', message:'Nema kritičnih upozorenja. Sve zalihe, naprave, strojevi i nalozi su uredni.', category:'efficiency', icon:'✅', action:null })
  }

  // Sortiraj po prioritetu
  const ORDER = { critical:0, high:1, medium:2, low:3 }
  return insights.sort((a,b) => ORDER[a.priority]-ORDER[b.priority])
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /ai/insights — KPI kartice + uvidi
router.get('/insights', auth, (req, res) => {
  try {
    const kb = buildKnowledgeBase()
    const util = kb.fixtures.length > 0 ? Math.round(kb.fixtures.filter(f=>f.status==='in_production').length*100/kb.fixtures.length) : 0
    const stats = {
      total_fixtures: kb.fixtures.length,
      in_production: kb.fixtures.filter(f=>f.status==='in_production').length,
      utilization_rate_pct: util,
      overdue_maintenance_count: kb.fixtures_overdue.length,
    }
    res.json({ insights: buildInsights(kb), stats, ai_powered: false, local_ai: true, generated_at: new Date().toISOString() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /ai/chat — lokalni AI chat
router.post('/chat', auth, (req, res) => {
  try {
    const { message, history = [] } = req.body
    if (!message) return res.status(400).json({ error: 'Poruka je obavezna' })

    const kb = buildKnowledgeBase()
    const reply = localAI(message, history, kb)

    res.json({ reply, ai_powered: false, local_ai: true, timestamp: new Date().toISOString() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /ai/schedule — optimizirani raspored iz baze
router.post('/schedule', auth, (req, res) => {
  try {
    const orders   = db.all("SELECT o.*, p.name as partner_name FROM sales_orders o LEFT JOIN sales_partners p ON o.partner_id=p.id WHERE o.status NOT IN ('isporučena','otkazana') ORDER BY o.delivery_date")
    const machines = db.all("SELECT * FROM machines WHERE status != 'fault'")
    const tools    = db.all("SELECT name FROM tools WHERE current_quantity > 0 LIMIT 8")
    const wo_open  = db.all("SELECT * FROM work_orders WHERE status NOT IN ('completed','closed','cancelled') ORDER BY planned_end")

    if (orders.length === 0 && wo_open.length === 0) {
      return res.json({ summary:'Nema otvorenih narudžbi ni radnih naloga za planiranje.', optimized_schedule:[], warnings:[], bottlenecks:[], efficiency_gain_pct:null, generated_at:new Date().toISOString() })
    }

    const today = new Date()
    const bottlenecks = []
    const warnings = []

    if (machines.length === 0) bottlenecks.push('Nema dostupnih strojeva za produkciju')
    if (machines.length < (orders.length + wo_open.length) / 3) bottlenecks.push(`Samo ${machines.length} strojeva za ${orders.length + wo_open.length} zadataka — potencijalno usko grlo`)

    const fault_machines = db.all("SELECT name FROM machines WHERE status='fault'")
    fault_machines.forEach(m => warnings.push(`Stroj "${m.name}" je u kvaru — isključen iz plana`))

    // Kombinirani popis zadataka za planiranje
    const all_items = [
      ...wo_open.map(wo => ({
        id: wo.id, type: 'work_order',
        order_name: `${wo.work_order_id}: ${wo.part_name}`,
        quantity: wo.quantity, done: wo.quantity_done||0,
        deadline: wo.planned_end, priority: wo.priority, machine_id: wo.machine_id
      })),
      ...orders.map(o => ({
        id: o.id, type: 'sales_order',
        order_name: `${o.internal_id}: ${o.partner_name||'—'}`,
        quantity: 1, done: 0,
        deadline: o.delivery_date, priority: 'normal', machine_id: null
      }))
    ]

    // Sortiraj: urgentni → rok → ostalo
    all_items.sort((a,b) => {
      const pOrder = {urgent:0, high:1, normal:2, low:3}
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority]-pOrder[b.priority]
      if (a.deadline && b.deadline) return new Date(a.deadline)-new Date(b.deadline)
      return 0
    })

    const optimized_schedule = all_items.map((item, i) => {
      // Odaberi optimalni stroj: preferiraj asigniran stroj, pa slobodni
      let machine = machines[0]
      if (item.machine_id) {
        const pref = machines.find(m => m.id === item.machine_id)
        if (pref) machine = pref
      } else {
        machine = machines[i % Math.max(machines.length, 1)]
      }

      const startDate = new Date(today.getTime() + i * 1.5 * 86400000)
      const pct = item.quantity > 0 ? Math.round(item.done*100/item.quantity) : 0
      const remaining_h = Math.max(1, Math.round((item.quantity - item.done) * 0.25))

      const days_to_deadline = item.deadline
        ? Math.ceil((new Date(item.deadline) - today) / 86400000)
        : 999
      const priority_score = Math.min(10, Math.max(1,
        (item.priority==='urgent' ? 9 : item.priority==='high' ? 7 : 5)
        - Math.floor(days_to_deadline / 5)
      ))

      return {
        order_name: item.order_name,
        recommended_machine: machine?.name || 'Nedodjeljeno',
        recommended_tools: tools.slice(0, 2).map(t => t.name),
        start_time: startDate.toISOString().split('T')[0],
        estimated_duration_hours: remaining_h,
        priority_score,
        notes: [
          item.deadline ? `Rok: ${item.deadline}` : null,
          pct > 0 ? `${pct}% završeno` : null,
          days_to_deadline < 0 ? '⚠️ KASNI' : days_to_deadline < 3 ? '⏰ Hitno' : null,
        ].filter(Boolean).join(' | ')
      }
    })

    const overdue_count = all_items.filter(i => i.deadline && new Date(i.deadline) < today).length

    const summary = [
      `Plan generiran za ${all_items.length} stavki (${wo_open.length} radnih naloga + ${orders.length} narudžbi) na ${machines.length} dostupnih strojeva.`,
      overdue_count > 0 ? `⚠️ ${overdue_count} stavki već kasni!` : null,
      bottlenecks.length === 0 ? `Kapacitet strojeva je dovoljan za plan.` : null,
    ].filter(Boolean).join(' ')

    res.json({ summary, bottlenecks, warnings, optimized_schedule, efficiency_gain_pct: null, generated_at: new Date().toISOString() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/schedule', auth, (req, res) => res.json({ message: 'Koristi POST /ai/schedule za generiranje.' }))

router.get('/oee', auth, (req, res) => {
  try {
    const machines = db.all('SELECT * FROM machines')
    const data = machines.map(m => {
      const rec = db.get("SELECT ROUND(AVG(oee),1) as avg_oee, ROUND(AVG(availability),1) as avail, ROUND(AVG(performance),1) as perf, ROUND(AVG(quality),1) as qual FROM oee_records WHERE machine_id=? AND record_date >= date('now','-30 days')", [m.id])
      return { machine_id:m.id, machine_name:m.name, status:m.status||'idle', availability:rec?.avail||0, performance:rec?.perf||0, quality:rec?.qual||0, oee:rec?.avg_oee||0 }
    })
    res.json({ machines: data, generated_at: new Date().toISOString() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})


// ═══════════════════════════════════════════════════════════════════════════
// G-CODE ANALYSIS — POST /ai/gcode
// Supports: multipart/form-data (field: gcode) OR JSON { gcode_text: "..." }
// ═══════════════════════════════════════════════════════════════════════════
const _gcodeAnalyzer = require('../services/gcodeAnalyzer')
const _gcodeML       = require('../services/gcodeML')
const _multer        = require('multer')
const _osGcode       = require('os')
const _fsGcode       = require('fs')

const _gcodeUpload = _multer({
  dest: _osGcode.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

router.post('/gcode', auth, _gcodeUpload.single('gcode'), async (req, res) => {
  try {
    let result

    if (req.file) {
      result = await _gcodeAnalyzer.analyzeFile(req.file.path, req.file.originalname)
      try { _fsGcode.unlinkSync(req.file.path) } catch (_) {}
    } else if (req.body && req.body.gcode_text) {
      result = _gcodeAnalyzer.analyzeText(req.body.gcode_text, 'program.nc')
    } else {
      return res.status(400).json({ error: 'Nema G-koda. Pošaljite datoteku (field: gcode) ili JSON { gcode_text }' })
    }

    result.ml_suggestions = _gcodeML.learn(result)
    res.json(result)
  } catch (e) {
    console.error('[/ai/gcode]', e)
    res.status(500).json({ error: e.message })
  }
})

// Alias for new API contract
router.post('/gcode/analyze', auth, _gcodeUpload.single('gcode'), async (req, res) => {
  try {
    let result
    if (req.file) {
      result = await _gcodeAnalyzer.analyzeFile(req.file.path, req.file.originalname)
      try { _fsGcode.unlinkSync(req.file.path) } catch (_) {}
    } else if (req.body && req.body.gcode_text) {
      result = _gcodeAnalyzer.analyzeText(req.body.gcode_text, 'program.nc')
    } else {
      return res.status(400).json({ error: 'Nema G-koda.' })
    }
    result.ml_suggestions = _gcodeML.learn(result)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CAM GENERATOR — POST /ai/cam/generate
// ═══════════════════════════════════════════════════════════════════════════
const _camGenerator = require('../services/camGenerator')

const _stlUpload = _multer({
  dest: _osGcode.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

router.post('/cam/generate', auth, _stlUpload.single('stl'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pošaljite STL datoteku (field: stl)' })

    const opts = {
      material:    req.body.material    || 'steel',
      filename:    req.body.filename    || req.file.originalname.replace(/\.[^.]+$/, ''),
      stepdown:    parseFloat(req.body.stepdown)  || 2,
      stepover:    parseFloat(req.body.stepover)  || 0.6,
    }

    // Load tools from DB for suggestions
    let availableTools = []
    try { availableTools = db.all('SELECT id, name, category FROM tools WHERE current_quantity > 0') } catch (_) {}

    const stlBuffer = _fsGcode.readFileSync(req.file.path)
    try { _fsGcode.unlinkSync(req.file.path) } catch (_) {}

    const result = await _camGenerator.generateFromSTL(stlBuffer, { ...opts, availableTools })
    res.json(result)
  } catch (e) {
    console.error('[/ai/cam/generate]', e)
    res.status(500).json({ error: e.message })
  }
})

// POST /ai/cam/simulate — returns simulation path data from already-generated G-code
router.post('/cam/simulate', auth, async (req, res) => {
  try {
    const { gcode_text } = req.body
    if (!gcode_text) return res.status(400).json({ error: 'Nema G-koda za simulaciju' })

    // Re-analyze using the gcode analyzer to extract moves
    const analysis = _gcodeAnalyzer.analyzeText(gcode_text, 'simulation.nc')
    res.json({
      success: true,
      moves:   analysis.moves,
      distance_mm: analysis.distance_mm,
      estimated_time_min: analysis.estimated_time_min,
      tools: analysis.tools,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
