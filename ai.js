const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')

router.get('/overview', auth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const month30 = new Date(Date.now()-30*86400000).toISOString().split('T')[0]

    const sales_active = db.prepare("SELECT COUNT(*) as c FROM sales_orders WHERE status NOT IN ('isporučena','otkazana')")?.get()?.c || 0
    const sales_delivered = db.prepare("SELECT COUNT(*) as c FROM sales_orders WHERE status='isporučena' AND created_at >= ?")?.get(month30)?.c || 0
    const sales_overdue = db.prepare("SELECT COUNT(*) as c FROM sales_orders WHERE delivery_date < ? AND status NOT IN ('isporučena','otkazana')")?.get(today)?.c || 0

    const q_approved = db.prepare("SELECT COUNT(*) as c FROM quality_checks WHERE status='odobreno' AND checked_at >= ?")?.get(month30)?.c || 0
    const q_rejected = db.prepare("SELECT COUNT(*) as c FROM quality_checks WHERE status='odbijeno' AND checked_at >= ?")?.get(month30)?.c || 0
    const q_pending = db.prepare("SELECT COUNT(*) as c FROM quality_checks WHERE status='na_cekanju'")?.get()?.c || 0

    const machines = db.prepare('SELECT status, COUNT(*) as c FROM machines GROUP BY status').all()
    const mc = {}; machines.forEach(m => { mc[m.status] = m.c })

    const maint_urgent = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE priority='urgent' AND status!='completed'")?.get()?.c || 0
    const maint_open = db.prepare("SELECT COUNT(*) as c FROM maintenance_orders WHERE status='open'")?.get()?.c || 0

    const wh_low = db.prepare('SELECT COUNT(*) as c FROM warehouse_items WHERE current_qty <= min_qty AND min_qty > 0')?.get()?.c || 0

    const hr_total = db.prepare('SELECT COUNT(*) as c FROM employees WHERE active=1')?.get()?.c || 0
    const hr_present = db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date=? AND status="present"')?.get(today)?.c || 0
    const hr_leaves = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'")?.get()?.c || 0

    res.json({
      generated_at: new Date().toISOString(),
      sales: { active: sales_active, delivered_month: sales_delivered, overdue: sales_overdue, revenue_pipeline: 0 },
      projects: { active: 0, awaiting_qs: 0, completed_month: 0, overdue: 0 },
      production: { running: 0, waiting: 0, completed_today: 0, scrap_today: 0 },
      quality: { approved: q_approved, rejected: q_rejected, pending: q_pending },
      machines: mc,
      maintenance: { urgent: maint_urgent, open: maint_open, corrective_month: 0 },
      warehouse: { low_stock: wh_low },
      tasks: { in_progress: 0, critical: 0, overdue: 0 },
      hr: { total_employees: hr_total, present_today: hr_present, pending_leaves: hr_leaves }
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/sales-funnel', auth, (req, res) => {
  const d90 = new Date(Date.now()-90*86400000).toISOString().split('T')[0]
  const rfqs = db.prepare('SELECT COUNT(*) as c FROM sales_rfqs WHERE created_at >= ?').get(d90).c
  const offers = db.prepare("SELECT COUNT(*) as c FROM sales_rfqs WHERE status='ponuda_poslana' AND created_at >= ?").get(d90).c
  const orders = db.prepare('SELECT COUNT(*) as c FROM sales_orders WHERE created_at >= ?').get(d90).c
  const invoices = db.prepare('SELECT COUNT(*) as c FROM sales_invoices WHERE created_at >= ?').get(d90).c
  const paid = db.prepare("SELECT COALESCE(SUM(total_amount),0) as s FROM sales_invoices WHERE status='plaćena' AND created_at >= ?").get(d90).s
  res.json({ rfqs, offers, orders, invoices, paid_revenue: paid })
})

router.get('/production-efficiency', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT date(checked_at) as day,
      SUM(good_qty) as good_parts, SUM(rejected_qty) as scrap_parts,
      CASE WHEN SUM(good_qty)+SUM(rejected_qty)>0 THEN ROUND(SUM(good_qty)*100.0/(SUM(good_qty)+SUM(rejected_qty)),1) ELSE 100 END as quality_rate
    FROM quality_checks WHERE checked_at >= date('now','-7 days')
    GROUP BY date(checked_at) ORDER BY day
  `).all()
  res.json(rows)
})

module.exports = router
