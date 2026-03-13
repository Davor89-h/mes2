/**
 * DEER MES - Database module
 * Uses sql.js (pure JavaScript SQLite) - no compilation required
 * Works on Windows, Mac, Linux without Python/Visual C++
 */
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '../../data/deer.db')
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// Global sqljs instance and database
let sqlDb = null
let SQL = null

function saveToFile() {
  if (!sqlDb) return
  const data = sqlDb.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

// Convert sql.js result to array of objects
function toObjects(result) {
  if (!result || !result.length) return []
  const { columns, values } = result[0]
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])))
}

function toObject(result) {
  const rows = toObjects(result)
  return rows[0]
}

// Simple prepared statement wrapper
function makeStmt(sql) {
  return {
    run(...args) {
      // Flatten if called with array
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      sqlDb.run(sql, params)
      const res = sqlDb.exec('SELECT last_insert_rowid() as id')
      const lastId = res[0]?.values[0][0]
      saveToFile()
      return { lastInsertRowid: lastId, changes: 1 }
    },
    get(...args) {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      const res = sqlDb.exec(sql, params)
      return toObject(res)
    },
    all(...args) {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      const res = sqlDb.exec(sql, params)
      return toObjects(res)
    }
  }
}

// Public DB interface (mirrors better-sqlite3 API)
const db = {
  prepare: (sql) => makeStmt(sql),
  run(sql, params = []) {
    sqlDb.run(sql, params)
    saveToFile()
  },
  get(sql, params = []) {
    const res = sqlDb.exec(sql, params)
    return toObject(res)
  },
  all(sql, params = []) {
    const res = sqlDb.exec(sql, params)
    return toObjects(res)
  },
  exec(sql) {
    sqlDb.run(sql)
    saveToFile()
  }
}

async function init() {
  const initSqlJs = require('sql.js')
  SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    sqlDb = new SQL.Database(buf)
  } else {
    sqlDb = new SQL.Database()
  }

  // Create all tables
  sqlDb.run(`PRAGMA journal_mode = WAL`)
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, first_name TEXT DEFAULT 'Admin',
      last_name TEXT DEFAULT '', email TEXT, role TEXT DEFAULT 'operator',
      active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, hall TEXT, rack TEXT, side TEXT,
      shelf TEXT, row_num TEXT, full_label TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id TEXT UNIQUE, name TEXT NOT NULL,
      manufacturer TEXT, type TEXT, table_size TEXT, max_load TEXT,
      location_id INTEGER, status TEXT DEFAULT 'idle', notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, internal_id TEXT UNIQUE, name TEXT NOT NULL,
      description TEXT, type TEXT DEFAULT 'manual', status TEXT DEFAULT 'active',
      material TEXT, weight REAL, dimensions TEXT, clamping_points INTEGER,
      max_force REAL, estimated_value REAL, location_id INTEGER,
      last_maintenance TEXT, next_maintenance TEXT, notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS fixture_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fixture_id INTEGER NOT NULL,
      machine_id INTEGER, operator_id INTEGER, work_order TEXT,
      status TEXT DEFAULT 'in_machine', checked_out_at TEXT DEFAULT (datetime('now')),
      returned_at TEXT, notes TEXT
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT, internal_id TEXT, name TEXT NOT NULL,
      category TEXT, subcategory TEXT, current_quantity INTEGER DEFAULT 0,
      min_quantity INTEGER DEFAULT 0, unit TEXT DEFAULT 'kom',
      location TEXT, supplier TEXT, price REAL, status TEXT DEFAULT 'Dostupan',
      notes TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS tool_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tool_id INTEGER NOT NULL, action TEXT,
      quantity_before INTEGER, quantity_after INTEGER, quantity_change INTEGER,
      note TEXT, user_id INTEGER, user_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS clamping_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, internal_id TEXT, name TEXT NOT NULL,
      type TEXT, current_quantity INTEGER DEFAULT 0, min_quantity INTEGER DEFAULT 0,
      location TEXT, status TEXT DEFAULT 'Dostupan', notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL,
      category TEXT, current_quantity REAL DEFAULT 0, min_quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'kg', location TEXT, supplier TEXT, price REAL,
      status TEXT DEFAULT 'Dostupan', notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT DEFAULT 'warning',
      message TEXT NOT NULL, is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT,
      action TEXT, entity_type TEXT, entity_id INTEGER, entity_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS sales_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      type TEXT DEFAULT 'customer', oib TEXT, country TEXT DEFAULT 'Hrvatska',
      address TEXT, payment_terms INTEGER DEFAULT 30,
      contact_name TEXT, contact_email TEXT, contact_phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS sales_rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, internal_id TEXT, partner_id INTEGER,
      customer_rfq_id TEXT, status TEXT DEFAULT 'novo', deadline TEXT,
      notes TEXT, created_by INTEGER, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, internal_id TEXT, partner_id INTEGER,
      rfq_id INTEGER, customer_order_id TEXT, status TEXT DEFAULT 'nova',
      delivery_date TEXT, total_value REAL, notes TEXT, created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT, order_id INTEGER,
      partner_id INTEGER, amount REAL, vat_rate REAL DEFAULT 25, total_amount REAL,
      currency TEXT DEFAULT 'EUR', status TEXT DEFAULT 'nacrt',
      due_date TEXT, paid_at TEXT, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, part_name TEXT,
      quantity INTEGER DEFAULT 0, good_qty INTEGER DEFAULT 0,
      rejected_qty INTEGER DEFAULT 0, inspector_id INTEGER,
      status TEXT DEFAULT 'na_cekanju', notes TEXT,
      checked_at TEXT DEFAULT (datetime('now'))
    )`)
  // ── Quality Management System tables ─────────────────────────────────────
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT DEFAULT '1.0',
      project_name TEXT,
      drawing_number TEXT,
      material TEXT,
      status TEXT DEFAULT 'aktivan',
      description TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_measures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      protocol_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      nominal REAL,
      tolerance_min REAL,
      tolerance_max REAL,
      unit TEXT DEFAULT 'mm',
      measurement_method TEXT,
      instrument_type TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_ref TEXT,
      part_name TEXT,
      drawing_number TEXT,
      quantity INTEGER DEFAULT 1,
      quantity_measured INTEGER DEFAULT 0,
      type TEXT DEFAULT 'završna',
      protocol_id INTEGER,
      inspector_id INTEGER,
      machine_id INTEGER,
      result TEXT DEFAULT 'na_čekanju',
      verdict_notes TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_measure_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      measure_id INTEGER,
      measure_name TEXT NOT NULL,
      nominal REAL,
      tolerance_min REAL,
      tolerance_max REAL,
      unit TEXT DEFAULT 'mm',
      measured_value REAL,
      deviation REAL,
      status TEXT DEFAULT 'ok',
      sample_number INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      serial_number TEXT,
      manufacturer TEXT,
      storage_location TEXT,
      status TEXT DEFAULT 'aktivan',
      last_calibration TEXT,
      next_calibration TEXT,
      calibration_interval_days INTEGER DEFAULT 365,
      accuracy TEXT,
      range_min REAL,
      range_max REAL,
      unit TEXT DEFAULT 'mm',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS quality_nok_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER,
      work_order_ref TEXT,
      part_name TEXT,
      measure_name TEXT,
      nominal REAL,
      measured_value REAL,
      deviation REAL,
      nok_type TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS warehouse_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL,
      category TEXT, current_qty REAL DEFAULT 0, min_qty REAL DEFAULT 0,
      unit TEXT DEFAULT 'kom', location TEXT, supplier TEXT, unit_price REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS warehouse_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL,
      movement_type TEXT, quantity REAL, reference TEXT, user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, employee_code TEXT,
      first_name TEXT, last_name TEXT, department TEXT, position TEXT,
      employment_type TEXT DEFAULT 'full_time', start_date TEXT, end_date TEXT,
      active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER, date TEXT,
      check_in TEXT, check_out TEXT, status TEXT DEFAULT 'present', notes TEXT
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER,
      leave_type TEXT DEFAULT 'annual', start_date TEXT, end_date TEXT,
      status TEXT DEFAULT 'pending', notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT,
      version TEXT DEFAULT '1.0', status TEXT DEFAULT 'draft',
      file_path TEXT, file_type TEXT, file_size INTEGER,
      description TEXT, tags TEXT, uploaded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS form_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'submitted',
      priority TEXT DEFAULT 'normal',
      requested_by INTEGER,
      assigned_to INTEGER,
      review_notes TEXT,
      data TEXT,
      notes TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      title TEXT NOT NULL,
      date TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)

  try { sqlDb.run('ALTER TABLE documents ADD COLUMN expiry_date TEXT') } catch(e) {}

  // Migrate existing form_requests table (add missing columns if needed)
  try { sqlDb.run(`ALTER TABLE form_requests ADD COLUMN description TEXT`) } catch(e) {}
  try { sqlDb.run(`ALTER TABLE form_requests ADD COLUMN review_notes TEXT`) } catch(e) {}
  try { sqlDb.run(`ALTER TABLE form_requests ADD COLUMN submitted_at TEXT`) } catch(e) {}
  sqlDb.run(`CREATE TABLE IF NOT EXISTS maintenance_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER,
      type TEXT DEFAULT 'preventive', priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'open', title TEXT, description TEXT,
      assigned_to INTEGER, scheduled_date TEXT, completed_at TEXT,
      downtime_minutes INTEGER, notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS machine_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER,
      temperature REAL, spindle_speed REAL, feed_rate REAL,
      vibration REAL, power_kw REAL, status TEXT DEFAULT 'running',
      recorded_at TEXT DEFAULT (datetime('now'))
    )`)

  // ── MES v2 NEW TABLES ──────────────────────────────

  // Work Orders — production manufacturing orders
  sqlDb.run(`CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      drawing_number TEXT,
      quantity INTEGER DEFAULT 1,
      quantity_done INTEGER DEFAULT 0,
      quantity_scrap INTEGER DEFAULT 0,
      machine_id INTEGER,
      operator_id INTEGER,
      sales_order_id INTEGER,
      kalkulacija_id INTEGER,
      status TEXT DEFAULT 'draft',
      priority TEXT DEFAULT 'normal',
      material TEXT,
      estimated_time_min INTEGER DEFAULT 0,
      actual_time_min INTEGER DEFAULT 0,
      setup_time_min INTEGER DEFAULT 0,
      cycle_time_sec REAL DEFAULT 0,
      planned_start TEXT,
      planned_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)

  // Production Logs — time tracking per work order
  sqlDb.run(`CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      machine_id INTEGER,
      operator_id INTEGER,
      event_type TEXT NOT NULL,
      event_time TEXT DEFAULT (datetime('now')),
      duration_min REAL DEFAULT 0,
      quantity_produced INTEGER DEFAULT 0,
      quantity_scrap INTEGER DEFAULT 0,
      notes TEXT
    )`)

  // Work Order Tool List — which tools are assigned to a work order
  sqlDb.run(`CREATE TABLE IF NOT EXISTS work_order_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      tool_id INTEGER NOT NULL,
      tool_position INTEGER DEFAULT 1,
      notes TEXT
    )`)

  // Tool Life Tracking — per-tool usage counter
  sqlDb.run(`CREATE TABLE IF NOT EXISTS tool_life (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      work_order_id INTEGER,
      machine_id INTEGER,
      operator_id INTEGER,
      strokes_used INTEGER DEFAULT 0,
      minutes_used REAL DEFAULT 0,
      life_limit_strokes INTEGER DEFAULT 0,
      life_limit_minutes REAL DEFAULT 0,
      status TEXT DEFAULT 'ok',
      last_sharpened TEXT,
      next_service TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)

  // Production Costs — per work order cost breakdown
  sqlDb.run(`CREATE TABLE IF NOT EXISTS production_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      cost_type TEXT NOT NULL,
      description TEXT,
      quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      calculated_at TEXT DEFAULT (datetime('now'))
    )`)

  // OEE Records — daily machine efficiency snapshots
  sqlDb.run(`CREATE TABLE IF NOT EXISTS oee_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      shift TEXT DEFAULT 'A',
      planned_time_min INTEGER DEFAULT 480,
      downtime_min INTEGER DEFAULT 0,
      downtime_reason TEXT,
      parts_produced INTEGER DEFAULT 0,
      parts_target INTEGER DEFAULT 0,
      parts_good INTEGER DEFAULT 0,
      parts_scrap INTEGER DEFAULT 0,
      availability REAL DEFAULT 0,
      performance REAL DEFAULT 0,
      quality REAL DEFAULT 0,
      oee REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)

  // Production Schedule — planning board
  sqlDb.run(`CREATE TABLE IF NOT EXISTS production_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      scheduled_start TEXT NOT NULL,
      scheduled_end TEXT NOT NULL,
      actual_start TEXT,
      actual_end TEXT,
      status TEXT DEFAULT 'planned',
      priority INTEGER DEFAULT 50,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)

  // ── END MES v2 TABLES ───────────────────────────────

  sqlDb.run(`CREATE TABLE IF NOT EXISTS kalkulacije (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naziv TEXT NOT NULL,
      broj_nacrta TEXT,
      materijal TEXT,
      naziv_dijela TEXT,
      ident_nr TEXT,
      varijanta TEXT DEFAULT '50',
      data TEXT DEFAULT '{}',
      status TEXT DEFAULT 'draft',
      napomena TEXT,
      kreirao_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)

  // ── RBAC TABLES ─────────────────────────────────────────
  sqlDb.run(`CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      label TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      module TEXT,
      description TEXT
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      UNIQUE(role_id, permission_id)
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      granted_by INTEGER,
      granted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, role_id)
    )`)
  // ── END RBAC TABLES ──────────────────────────────────────

  // ── TASK MANAGEMENT TABLES ───────────────────────────────
  sqlDb.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to INTEGER,
      assigned_by INTEGER,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'open',
      module TEXT,
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS task_checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      completed_by INTEGER,
      sort_order INTEGER DEFAULT 0
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  // ── END TASK MANAGEMENT TABLES ───────────────────────────

  // ── KONTROLING TABLES ────────────────────────────────
  sqlDb.run(`CREATE TABLE IF NOT EXISTS kontroling_budzet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      godina INTEGER NOT NULL,
      mjesec INTEGER NOT NULL,
      kategorija TEXT NOT NULL,
      opis TEXT,
      iznos_plan REAL DEFAULT 0,
      iznos_stvarni REAL DEFAULT 0,
      napomena TEXT,
      kreirao_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS kontroling_masinski_sat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      trosak_amortizacija REAL DEFAULT 0,
      trosak_struja REAL DEFAULT 0,
      trosak_odrzavanje REAL DEFAULT 0,
      trosak_ostalo REAL DEFAULT 0,
      trosak_ukupno_sat REAL DEFAULT 0,
      vrijedi_od TEXT NOT NULL,
      napomena TEXT,
      kreirao_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS kontroling_nalog_troskovi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      kategorija TEXT NOT NULL,
      opis TEXT,
      kolicina REAL DEFAULT 1,
      jedinicna_cijena REAL DEFAULT 0,
      ukupno REAL DEFAULT 0,
      napomena TEXT,
      kreirao_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS kontroling_profitabilnost (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER,
      proizvod TEXT NOT NULL,
      period_god INTEGER NOT NULL,
      period_mj INTEGER NOT NULL,
      prihod REAL DEFAULT 0,
      trosak_materijal REAL DEFAULT 0,
      trosak_rad REAL DEFAULT 0,
      trosak_rezija REAL DEFAULT 0,
      ukupni_trosak REAL DEFAULT 0,
      bruto_dobit REAL DEFAULT 0,
      marza_posto REAL DEFAULT 0,
      napomena TEXT,
      kreirao_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
  // ── END KONTROLING TABLES ────────────────────────────

  // Seed if empty
  const userCount = toObject(sqlDb.exec('SELECT COUNT(*) as c FROM users'))?.c || 0
  if (userCount === 0) {
    const bcrypt = require('bcryptjs')
    const adminHash = bcrypt.hashSync('admin123', 10)
    const opHash = bcrypt.hashSync('operator123', 10)
    sqlDb.run(`INSERT INTO users (username,password_hash,first_name,last_name,role) VALUES (?,?,?,?,?)`,
      ['admin', adminHash, 'Admin', 'Korisnik', 'company_admin'])
    sqlDb.run(`INSERT INTO users (username,password_hash,first_name,last_name,role) VALUES (?,?,?,?,?)`,
      ['operator', opHash, 'Ivan', 'Kovač', 'operator'])
    sqlDb.run(`INSERT INTO locations (hall,rack,full_label) VALUES (?,?,?)`, ['H1','R01','H1-R01'])
    sqlDb.run(`INSERT INTO locations (hall,rack,full_label) VALUES (?,?,?)`, ['H1','R02','H1-R02'])
    sqlDb.run(`INSERT INTO locations (hall,rack,full_label) VALUES (?,?,?)`, ['H2','R01','H2-R01'])
    sqlDb.run(`INSERT INTO machines (machine_id,name,manufacturer,type,status) VALUES (?,?,?,?,?)`,
      ['STR-001','DMU 50','DMG MORI','CNC 5-osni','running'])
    sqlDb.run(`INSERT INTO machines (machine_id,name,manufacturer,type,status) VALUES (?,?,?,?,?)`,
      ['STR-002','CTX beta 800','DMG MORI','CNC Tokarilica','idle'])
    sqlDb.run(`INSERT INTO machines (machine_id,name,manufacturer,type,status) VALUES (?,?,?,?,?)`,
      ['STR-003','Mazak INTEGREX','Mazak','CNC Multitasking','running'])
    sqlDb.run(`INSERT INTO fixtures (internal_id,name,type,status,estimated_value) VALUES (?,?,?,?,?)`,
      ['NP-001','Stezna naprava A1','hydraulic','active',2500])
    sqlDb.run(`INSERT INTO fixtures (internal_id,name,type,status,estimated_value) VALUES (?,?,?,?,?)`,
      ['NP-002','Naprava za tokarenje B2','pneumatic','in_production',1800])
    sqlDb.run(`INSERT INTO fixtures (internal_id,name,type,status,estimated_value) VALUES (?,?,?,?,?)`,
      ['NP-003','Modularna naprava C1','manual','active',900])
    sqlDb.run(`INSERT INTO tools (name,category,current_quantity,min_quantity,unit) VALUES (?,?,?,?,?)`,
      ['Glodalo Ø20 HSS','Glodala',4,4,'kom'])
    sqlDb.run(`INSERT INTO tools (name,category,current_quantity,min_quantity,unit,status) VALUES (?,?,?,?,?,?)`,
      ['Svrdlo Ø8 HSS-Co','Svrdla',6,8,'kom','Niske zalihe'])
    sqlDb.run(`INSERT INTO tools (name,category,current_quantity,min_quantity,unit) VALUES (?,?,?,?,?)`,
      ['Tokarni nož CNMG','Tokarni noževi',12,5,'kom'])
    sqlDb.run(`INSERT INTO sales_partners (name,type,country) VALUES (?,?,?)`,
      ['Livar d.o.o.','customer','Hrvatska'])
    sqlDb.run(`INSERT INTO sales_partners (name,type,country) VALUES (?,?,?)`,
      ['Đuro Đaković','customer','Hrvatska'])
    sqlDb.run(`INSERT INTO sales_partners (name,type,country) VALUES (?,?,?)`,
      ['Sandvik Coromant','supplier','Švedska'])
    sqlDb.run(`INSERT INTO alerts (type,message) VALUES (?,?)`,
      ['warning','Svrdlo Ø8 — niske zalihe: 6/8'])
    sqlDb.run(`INSERT INTO alerts (type,message) VALUES (?,?)`,
      ['info','Planirani preventivni servis za STR-001 za 3 dana'])
    sqlDb.run(`INSERT INTO employees (employee_code,first_name,last_name,department,position) VALUES (?,?,?,?,?)`,
      ['EMP-001','Ivan','Kovač','Produkcija','CNC operater'])
    sqlDb.run(`INSERT INTO employees (employee_code,first_name,last_name,department,position) VALUES (?,?,?,?,?)`,
      ['EMP-002','Marija','Horvat','Kvaliteta','QS inženjer'])
    sqlDb.run(`INSERT INTO warehouse_items (code,name,category,current_qty,min_qty,unit) VALUES (?,?,?,?,?,?)`,
      ['MAT-001','Aluminij EN AW-2024','Sirovine',150,50,'kg'])
    sqlDb.run(`INSERT INTO warehouse_items (code,name,category,current_qty,min_qty,unit) VALUES (?,?,?,?,?,?)`,
      ['MAT-002','Čelik 42CrMo4','Sirovine',80,100,'kg'])


    // ── RBAC SEED ─────────────────────────────────────────────
    const ROLES = [
      ['admin',       'Administrator',  'Puni pristup svemu'],
      ['manager',     'Manager',        'Pregled i upravljanje'],
      ['operator',    'Operater',       'Radni nalozi, produkcija'],
      ['maintenance', 'Održavanje',     'Strojevi, održavanje'],
      ['quality',     'Kvaliteta',      'Kontrola kvalitete'],
      ['warehouse',   'Skladištar',     'Skladište, materijali'],
    ]
    ROLES.forEach(([name, label, desc]) =>
      sqlDb.run('INSERT OR IGNORE INTO roles (name,label,description) VALUES (?,?,?)', [name,label,desc])
    )

    const PERMISSIONS = [
      ['machines.read',       'machines',    'Pregled strojeva'],
      ['machines.write',      'machines',    'Upravljanje strojevima'],
      ['production.read',     'production',  'Pregled produkcije'],
      ['production.start',    'production',  'Pokretanje produkcije'],
      ['production.stop',     'production',  'Zaustavljanje produkcije'],
      ['work_orders.read',    'work_orders', 'Pregled radnih naloga'],
      ['work_orders.write',   'work_orders', 'Kreiranje/uređivanje RN'],
      ['warehouse.read',      'warehouse',   'Pregled skladišta'],
      ['warehouse.manage',    'warehouse',   'Upravljanje skladištem'],
      ['tools.read',          'tools',       'Pregled alata'],
      ['tools.write',         'tools',       'Upravljanje alatima'],
      ['maintenance.read',    'maintenance', 'Pregled održavanja'],
      ['maintenance.write',   'maintenance', 'Kreiranje radnih naloga održavanja'],
      ['quality.read',        'quality',     'Pregled kvalitete'],
      ['quality.write',       'quality',     'Unos kontrole kvalitete'],
      ['oee.read',            'oee',         'Pregled OEE'],
      ['oee.write',           'oee',         'Unos OEE podataka'],
      ['tasks.read',          'tasks',       'Pregled zadataka'],
      ['tasks.write',         'tasks',       'Kreiranje zadataka'],
      ['tasks.assign',        'tasks',       'Dodjela zadataka'],
      ['tasks.complete',      'tasks',       'Zatvaranje zadataka'],
      ['users.read',          'users',       'Pregled korisnika'],
      ['users.manage',        'users',       'Upravljanje korisnicima'],
      ['sales.read',          'sales',       'Pregled prodaje'],
      ['sales.write',         'sales',       'Upravljanje prodajom'],
      ['kontroling.read',     'kontroling',  'Pregled kontrolinga'],
      ['kontroling.write',    'kontroling',  'Upravljanje kontrolingom'],
    ]
    PERMISSIONS.forEach(([name, module, desc]) =>
      sqlDb.run('INSERT OR IGNORE INTO permissions (name,module,description) VALUES (?,?,?)', [name,module,desc])
    )

    // Assign all permissions to admin role
    const adminRole = sqlDb.exec("SELECT id FROM roles WHERE name='admin'")[0]?.values[0]?.[0]
    const allPerms = sqlDb.exec('SELECT id FROM permissions')[0]?.values || []
    allPerms.forEach(([pid]) => {
      if (adminRole) sqlDb.run('INSERT OR IGNORE INTO role_permissions (role_id,permission_id) VALUES (?,?)', [adminRole, pid])
    })

    // Manager: all read + some write
    const managerRole = sqlDb.exec("SELECT id FROM roles WHERE name='manager'")[0]?.values[0]?.[0]
    const managerPerms = ['machines.read','production.read','production.start','work_orders.read','work_orders.write','warehouse.read','tools.read','maintenance.read','quality.read','oee.read','tasks.read','tasks.write','tasks.assign','users.read','sales.read','kontroling.read']
    managerPerms.forEach(p => {
      const pid = sqlDb.exec(`SELECT id FROM permissions WHERE name='${p}'`)[0]?.values[0]?.[0]
      if (managerRole && pid) sqlDb.run('INSERT OR IGNORE INTO role_permissions (role_id,permission_id) VALUES (?,?)', [managerRole, pid])
    })

    // Operator perms
    const opRole = sqlDb.exec("SELECT id FROM roles WHERE name='operator'")[0]?.values[0]?.[0]
    const opPerms = ['machines.read','production.read','production.start','production.stop','work_orders.read','tools.read','tasks.read','tasks.complete']
    opPerms.forEach(p => {
      const pid = sqlDb.exec(`SELECT id FROM permissions WHERE name='${p}'`)[0]?.values[0]?.[0]
      if (opRole && pid) sqlDb.run('INSERT OR IGNORE INTO role_permissions (role_id,permission_id) VALUES (?,?)', [opRole, pid])
    })

    // Assign admin user to admin role, operator to operator role
    const adminUser = sqlDb.exec("SELECT id FROM users WHERE username='admin'")[0]?.values[0]?.[0]
    const opUser = sqlDb.exec("SELECT id FROM users WHERE username='operator'")[0]?.values[0]?.[0]
    if (adminUser && adminRole) sqlDb.run('INSERT OR IGNORE INTO user_roles (user_id,role_id) VALUES (?,?)', [adminUser, adminRole])
    if (opUser && opRole) sqlDb.run('INSERT OR IGNORE INTO user_roles (user_id,role_id) VALUES (?,?)', [opUser, opRole])

    // Sample tasks seed
    if (adminUser) {
      sqlDb.run(`INSERT INTO tasks (title,description,assigned_to,assigned_by,priority,status,module,due_date) VALUES (?,?,?,?,?,?,?,?)`,
        ['Preventivni servis STR-001','Provjeriti ulje, filtre i sva podmazivanja na DMU 50',opUser||1,adminUser,'high','open','maintenance',new Date(Date.now()+2*86400000).toISOString().split('T')[0]])
      sqlDb.run(`INSERT INTO tasks (title,description,assigned_to,assigned_by,priority,status,module,due_date) VALUES (?,?,?,?,?,?,?,?)`,
        ['Kontrola kvalitete WO-2025-001','Izmjeriti sve dimenzije na prvih 5 komada nosača osi X',opUser||1,adminUser,'high','in_progress','quality',new Date(Date.now()+1*86400000).toISOString().split('T')[0]])
      sqlDb.run(`INSERT INTO tasks (title,description,assigned_to,assigned_by,priority,status,module) VALUES (?,?,?,?,?,?,?)`,
        ['Naručiti svrdla Ø8 HSS-Co','Zalihe ispod minimuma, naručiti min 20 kom',adminUser,adminUser,'normal','open','warehouse'])

      // Checklist items for first task
      const t1 = sqlDb.exec('SELECT id FROM tasks LIMIT 1')[0]?.values[0]?.[0]
      if (t1) {
        ['Provjera razine ulja','Zamjena filtera ulja','Podmazivanje vodilica','Test okretaja na prazno','Dokumentirati servis'].forEach((label, i) => {
          sqlDb.run('INSERT INTO task_checklist_items (task_id,label,sort_order) VALUES (?,?,?)', [t1, label, i])
        })
      }
    }
    // ── END RBAC SEED ─────────────────────────────────────────

    // MES v2 — Work Orders seed
    sqlDb.run(`INSERT INTO work_orders (work_order_id,part_name,drawing_number,quantity,machine_id,operator_id,status,priority,material,estimated_time_min,cycle_time_sec,planned_start,planned_end,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['WO-2025-001','Nosač osi X','DWG-100016',20,1,2,'in_progress','high','Nehrđajući čelik 1.4404',480,45.0,new Date().toISOString().split('T')[0],new Date(Date.now()+3*86400000).toISOString().split('T')[0],1])
    sqlDb.run(`INSERT INTO work_orders (work_order_id,part_name,drawing_number,quantity,machine_id,operator_id,status,priority,material,estimated_time_min,cycle_time_sec,planned_start,planned_end,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['WO-2025-002','Kućište pumpe','DWG-200048',5,2,2,'planned','normal','Aluminij EN AW-2024',720,360.0,new Date(Date.now()+2*86400000).toISOString().split('T')[0],new Date(Date.now()+7*86400000).toISOString().split('T')[0],1])
    sqlDb.run(`INSERT INTO work_orders (work_order_id,part_name,drawing_number,quantity,machine_id,operator_id,status,priority,material,estimated_time_min,cycle_time_sec,planned_start,planned_end,quantity_done,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['WO-2025-003','Osovina B14','DWG-300012',50,3,2,'completed','normal','Čelik 42CrMo4',240,18.0,new Date(Date.now()-5*86400000).toISOString().split('T')[0],new Date(Date.now()-1*86400000).toISOString().split('T')[0],50,1])

    // MES v2 — Tool Life seed
    const toolIds = sqlDb.exec('SELECT id FROM tools LIMIT 3')
    if (toolIds[0]?.values?.length) {
      const [t1,t2,t3] = toolIds[0].values
      sqlDb.run(`INSERT INTO tool_life (tool_id,strokes_used,minutes_used,life_limit_strokes,life_limit_minutes,status) VALUES (?,?,?,?,?,?)`,
        [t1[0], 1240, 62, 2000, 100, 'ok'])
      sqlDb.run(`INSERT INTO tool_life (tool_id,strokes_used,minutes_used,life_limit_strokes,life_limit_minutes,status) VALUES (?,?,?,?,?,?)`,
        [t2[0], 1850, 92, 2000, 100, 'warning'])
      if (t3) sqlDb.run(`INSERT INTO tool_life (tool_id,strokes_used,minutes_used,life_limit_strokes,life_limit_minutes,status) VALUES (?,?,?,?,?,?)`,
        [t3[0], 320, 16, 2000, 100, 'ok'])
    }

    // MES v2 — OEE records seed (last 7 days)
    const machineIds = sqlDb.exec('SELECT id FROM machines LIMIT 3')
    if (machineIds[0]?.values?.length) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i*86400000).toISOString().split('T')[0]
        machineIds[0].values.forEach(([mid]) => {
          const avail = 0.82 + Math.random()*0.15
          const perf  = 0.75 + Math.random()*0.20
          const qual  = 0.93 + Math.random()*0.06
          const oee   = avail*perf*qual
          const pp    = Math.round(480 * perf * (avail))
          sqlDb.run(`INSERT INTO oee_records (machine_id,record_date,shift,planned_time_min,downtime_min,parts_produced,parts_target,parts_good,parts_scrap,availability,performance,quality,oee) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [mid,d,'A',480,Math.round((1-avail)*480),pp,Math.round(480*perf),Math.round(pp*qual),Math.round(pp*(1-qual)),
             Math.round(avail*100)/100,Math.round(perf*100)/100,Math.round(qual*100)/100,Math.round(oee*100)/100])
        })
      }
    }


    // ── Quality Management seed ──────────────────────────────────────────────
    const _qmIds = sqlDb.exec('SELECT id,name FROM machines LIMIT 3')
    const _qwIds = sqlDb.exec("SELECT id,work_order_id,part_name,drawing_number,quantity FROM work_orders LIMIT 3")
    const _quIds = sqlDb.exec("SELECT id FROM users LIMIT 1")
    const _qInspectorId = _quIds[0]?.values[0]?.[0] || 1

    // Instruments
    const _instrData = [
      ['Pomično mjerilo 0-150mm', 'pomično', 'PM-001-2024', 'Mitutoyo', 'Polica A3', 'aktivan',
       new Date(Date.now()-90*864e5).toISOString().slice(0,10), new Date(Date.now()+275*864e5).toISOString().slice(0,10), 365, '±0.02mm', 0, 150, 'mm'],
      ['Mikrometar 0-25mm', 'mikrometar', 'MK-015-2023', 'Mitutoyo', 'Polica A3', 'aktivan',
       new Date(Date.now()-180*864e5).toISOString().slice(0,10), new Date(Date.now()+20*864e5).toISOString().slice(0,10), 365, '±0.001mm', 0, 25, 'mm'],
      ['Mjerač hrapavosti Ra', 'hrapavost', 'HR-008-2024', 'Surftest', 'Polica B1', 'aktivan',
       new Date(Date.now()-45*864e5).toISOString().slice(0,10), new Date(Date.now()+320*864e5).toISOString().slice(0,10), 365, '±0.01μm', 0, 100, 'μm'],
      ['Tvrdomjer HRC', 'tvrdomjer', 'TV-002-2022', 'Wilson', 'Polica C2', 'na_kalibraciji',
       new Date(Date.now()-400*864e5).toISOString().slice(0,10), new Date(Date.now()-35*864e5).toISOString().slice(0,10), 365, '±0.5 HRC', 20, 70, 'HRC'],
    ]
    _instrData.forEach(([name,type,sn,manuf,loc,status,lastCal,nextCal,intv,acc,rmin,rmax,unit]) => {
      sqlDb.run('INSERT INTO quality_instruments (name,type,serial_number,manufacturer,storage_location,status,last_calibration,next_calibration,calibration_interval_days,accuracy,range_min,range_max,unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [name,type,sn,manuf,loc,status,lastCal,nextCal,intv,acc,rmin,rmax,unit])
    })

    // Protocols + measures
    const _proto1 = sqlDb.exec("INSERT INTO quality_protocols (name,version,project_name,drawing_number,material,status,created_by) VALUES ('Nosač osi X — kontrolni plan','1.2','Projekt A','DWG-100016','Nehrđajući čelik 1.4404','aktivan',1)")
    const _p1id = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0]
    const _proto2 = sqlDb.exec("INSERT INTO quality_protocols (name,version,project_name,drawing_number,material,status,created_by) VALUES ('Kućište pumpe — kontrolni plan','2.0','Projekt B','DWG-200048','Aluminij EN AW-2024','aktivan',1)")
    const _p2id = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0]

    const _measures1 = [
      [_p1id, 'Promjer Ø42h7', 42.0, -0.025, 0.0, 'mm', 'pomično mjerilo', 1],
      [_p1id, 'Duljina 120±0.1', 120.0, -0.1, 0.1, 'mm', 'pomično mjerilo', 2],
      [_p1id, 'Hrapavost Ra ≤ 1.6', 1.6, 0, 1.6, 'μm', 'mjerač hrapavosti', 3],
      [_p1id, 'Paralelnost 0.02', 0, 0, 0.02, 'mm', 'mjerač', 4],
      [_p1id, 'Tvrdoća 58-62 HRC', 60, -2, 2, 'HRC', 'tvrdomjer', 5],
    ]
    _measures1.forEach(([pid,name,nom,tmin,tmax,unit,method,sort]) => {
      sqlDb.run('INSERT INTO quality_measures (protocol_id,name,nominal,tolerance_min,tolerance_max,unit,measurement_method,sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [pid,name,nom,tmin,tmax,unit,method,sort])
    })
    const _measures2 = [
      [_p2id, 'Vanjski Ø 85±0.05', 85.0, -0.05, 0.05, 'mm', 'mikrometar', 1],
      [_p2id, 'Dubina džepa 12+0.1/-0', 12.0, 0, 0.1, 'mm', 'pomično mjerilo', 2],
      [_p2id, 'Hrapavost unutarnja Ra ≤ 3.2', 3.2, 0, 3.2, 'μm', 'mjerač hrapavosti', 3],
    ]
    _measures2.forEach(([pid,name,nom,tmin,tmax,unit,method,sort]) => {
      sqlDb.run('INSERT INTO quality_measures (protocol_id,name,nominal,tolerance_min,tolerance_max,unit,measurement_method,sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [pid,name,nom,tmin,tmax,unit,method,sort])
    })

    // Inspections with results
    const _insp1 = sqlDb.exec(`INSERT INTO quality_inspections (work_order_ref,part_name,drawing_number,quantity,quantity_measured,type,protocol_id,inspector_id,result,completed_at) VALUES ('WO-2025-001','Nosač osi X','DWG-100016',20,5,'završna',${_p1id},${_qInspectorId},'odobreno','${new Date(Date.now()-2*864e5).toISOString()}')`)
    const _i1id = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0]
    const _insp2 = sqlDb.exec(`INSERT INTO quality_inspections (work_order_ref,part_name,drawing_number,quantity,quantity_measured,type,protocol_id,inspector_id,result,verdict_notes) VALUES ('WO-2025-002','Kućište pumpe','DWG-200048',5,0,'završna',${_p2id},${_qInspectorId},'na_čekanju',NULL)`)
    const _i2id = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0]
    const _insp3 = sqlDb.exec(`INSERT INTO quality_inspections (work_order_ref,part_name,drawing_number,quantity,quantity_measured,type,protocol_id,inspector_id,result,verdict_notes,completed_at) VALUES ('WO-2025-003','Osovina B14','DWG-300012',50,10,'međufazna',${_p1id},${_qInspectorId},'odbijeno','Promjer van tolerancije na 3 komada — vraćeno na doradu','${new Date(Date.now()-5*864e5).toISOString()}')`)
    const _i3id = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0]

    // Measure results for inspection 1 (all OK)
    const _res1 = [
      [_i1id, 'Promjer Ø42h7', 42.0, -0.025, 0.0, 'mm', 41.988, 'ok', 1],
      [_i1id, 'Duljina 120±0.1', 120.0, -0.1, 0.1, 'mm', 120.042, 'ok', 1],
      [_i1id, 'Hrapavost Ra ≤ 1.6', 1.6, 0, 1.6, 'μm', 1.28, 'ok', 1],
      [_i1id, 'Paralelnost 0.02', 0, 0, 0.02, 'mm', 0.011, 'ok', 1],
      [_i1id, 'Tvrdoća 58-62 HRC', 60, -2, 2, 'HRC', 59.5, 'ok', 1],
    ]
    _res1.forEach(([iid,name,nom,tmin,tmax,unit,val,status,sn]) => {
      const dev = val - nom
      sqlDb.run('INSERT INTO quality_measure_results (inspection_id,measure_name,nominal,tolerance_min,tolerance_max,unit,measured_value,deviation,status,sample_number) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [iid,name,nom,tmin,tmax,unit,val,Math.round(dev*1000)/1000,status,sn])
    })

    // Measure results for inspection 3 (some NOK)
    const _res3 = [
      [_i3id, 'Promjer Ø42h7', 42.0, -0.025, 0.0, 'mm', 42.031, 'nok', 1],
      [_i3id, 'Duljina 120±0.1', 120.0, -0.1, 0.1, 'mm', 120.088, 'ok', 1],
      [_i3id, 'Promjer Ø42h7', 42.0, -0.025, 0.0, 'mm', 42.028, 'nok', 2],
      [_i3id, 'Paralelnost 0.02', 0, 0, 0.02, 'mm', 0.031, 'nok', 1],
    ]
    _res3.forEach(([iid,name,nom,tmin,tmax,unit,val,status,sn]) => {
      const dev = val - nom
      sqlDb.run('INSERT INTO quality_measure_results (inspection_id,measure_name,nominal,tolerance_min,tolerance_max,unit,measured_value,deviation,status,sample_number) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [iid,name,nom,tmin,tmax,unit,val,Math.round(dev*1000)/1000,status,sn])
      if (status === 'nok') {
        sqlDb.run('INSERT INTO quality_nok_log (inspection_id,work_order_ref,part_name,measure_name,nominal,measured_value,deviation,nok_type) VALUES (?,?,?,?,?,?,?,?)',
          [iid,'WO-2025-003','Osovina B14',name,nom,val,Math.round(dev*1000)/1000,'over_tolerance'])
      }
    })


    // ── Machine Telemetry seed ─────────────────────────────────────────────
    const _telMachIds = sqlDb.exec('SELECT id FROM machines LIMIT 3')
    if (_telMachIds[0]?.values?.length) {
      const _telBase = [
        { temp:42, spindle:8500, feed:1200, vibr:0.8, power:12.5, status:'running' },
        { temp:28, spindle:0,    feed:0,    vibr:0.1, power:1.2,  status:'idle'    },
        { temp:55, spindle:6000, feed:800,  vibr:1.2, power:18.0, status:'running' },
      ]
      _telMachIds[0].values.forEach(([mid], idx) => {
        const base = _telBase[idx] || _telBase[0]
        for (let i = 19; i >= 0; i--) {
          const ts = new Date(Date.now() - i * 90000).toISOString()
          const j = (v, p) => Math.round((v * (1 + (Math.random()-0.5)*p)) * 10) / 10
          sqlDb.run(`INSERT INTO machine_telemetry (machine_id,temperature,spindle_speed,feed_rate,vibration,power_kw,status,recorded_at) VALUES (?,?,?,?,?,?,?,?)`,
            [mid, j(base.temp,0.08), j(base.spindle,0.05)||0, j(base.feed,0.1)||0, j(base.vibr,0.2), j(base.power,0.06), base.status, ts])
        }
      })
    }

    // ── Maintenance orders seed ──────────────────────────────────────────
    const _mIds = sqlDb.exec('SELECT id FROM machines LIMIT 3')
    if (_mIds[0]?.values?.length && _mIds[0].values.length >= 1) {
      const _mVals = _mIds[0].values
      const _maintData = [
        [_mVals[0][0],'preventive','normal','open','Preventivni servis Q2','Zamjena filtera ulja i kontrola remena'],
        [_mVals[1]?.[0]||_mVals[0][0],'corrective','high','open','Zamjena ležaja vretena','Povećan šum pri visokim okretajima'],
        [_mVals[2]?.[0]||_mVals[0][0],'preventive','normal','open','Kalibracija osi X/Y/Z','Godišnja kalibracija linearnih osi'],
      ]
      _maintData.forEach(([mid,type,prio,status,title,desc]) => {
        sqlDb.run(`INSERT INTO maintenance_orders (machine_id,type,priority,status,title,description) VALUES (?,?,?,?,?,?)`,
          [mid,type,prio,status,title,desc])
      })
    }

    saveToFile()
    console.log('✅ Demo data seeded — admin/admin123, operator/operator123')
  } else {
    console.log('✅ Database loaded')
  }

  return db
}

db.init = init
module.exports = db
