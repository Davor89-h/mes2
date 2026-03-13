import { useState, useEffect } from 'react'
import { C, useToast, StatCard } from '../components/UI'
import api from '../utils/api'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const Tile = ({label,value,sub,color=C.accent,warn}) => (
  <div style={{background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${warn?color:C.border}`,borderRadius:14,padding:'16px 20px',position:'relative',overflow:'hidden'}}>
    <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${color},${color}88)`}}/>
    <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:6}}>{label}</div>
    <div style={{fontSize:32,fontWeight:700,color:color,lineHeight:1}}>{value??'—'}</div>
    {sub && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
  </div>
)

const Section = ({title,children}) => (
  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
    <div style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:14,textTransform:'uppercase'}}>{title}</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>{children}</div>
  </div>
)

export default function KPIPage() {
  const [kpi, setKpi] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [efficiency, setEfficiency] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, showToast] = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [k, f, e] = await Promise.all([
        api.get('/kpi/overview'),
        api.get('/kpi/sales-funnel').catch(()=>({data:null})),
        api.get('/kpi/production-efficiency').catch(()=>({data:[]})),
      ])
      setKpi(k.data); setFunnel(f.data); setEfficiency(e.data)
    } catch { showToast('Greška učitavanja KPI','error') }
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  if (loading) return <div style={{padding:40,textAlign:'center',color:C.muted,fontFamily:"'Chakra Petch',sans-serif"}}>Učitavanje KPI podataka...</div>
  if (!kpi) return <div style={{padding:40,textAlign:'center',color:C.red,fontFamily:"'Chakra Petch',sans-serif"}}>Greška učitavanja</div>

  const mc = kpi.machines || {}
  const totalMachines = Object.values(mc).reduce((a,b)=>a+b,0)

  return (
    <div style={{padding:24,fontFamily:"'Chakra Petch',sans-serif",color:C.gray}}>
      {toast.visible && <div style={{position:'fixed',top:20,right:20,background:toast.type==='error'?C.red:C.green,color:'#fff',padding:'12px 20px',borderRadius:10,zIndex:9999,fontWeight:700}}>{toast.message}</div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{color:C.accent,margin:0,fontSize:22}}>📊 KPI DASHBOARD</h1>
          <div style={{color:C.muted,fontSize:11,marginTop:2}}>Ažurirano: {kpi.generated_at?new Date(kpi.generated_at).toLocaleString('hr'):''}</div>
        </div>
        <button onClick={load} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',cursor:'pointer',color:C.gray,display:'flex',alignItems:'center',gap:6,fontSize:13}}><RefreshCw size={14}/> Osvježi</button>
      </div>

      <Section title="💰 Sales">
        <Tile label="Aktivne narudžbe" value={kpi.sales?.active} color={C.accent}/>
        <Tile label="Isporučeno (30d)" value={kpi.sales?.delivered_month} color={C.green}/>
        <Tile label="Pipeline (EUR)" value={kpi.sales?.revenue_pipeline?parseFloat(kpi.sales.revenue_pipeline).toLocaleString('hr'):'0'} color={C.teal}/>
        <Tile label="Kasne narudžbe" value={kpi.sales?.overdue} color={C.red} warn={kpi.sales?.overdue>0}/>
      </Section>

      <Section title="📋 Projekti">
        <Tile label="U izradi" value={kpi.projects?.active} color={C.orange}/>
        <Tile label="QS čeka odobrenje" value={kpi.projects?.awaiting_qs} color={C.accent} warn={kpi.projects?.awaiting_qs>0}/>
        <Tile label="Završeno (30d)" value={kpi.projects?.completed_month} color={C.green}/>
        <Tile label="Kasne" value={kpi.projects?.overdue} color={C.red} warn={kpi.projects?.overdue>0}/>
      </Section>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Section title="🏭 Produkcija">
          <Tile label="U tijeku" value={kpi.production?.running} color={C.green}/>
          <Tile label="Čekaju start" value={kpi.production?.waiting} color={C.blue}/>
          <Tile label="Završeno danas" value={kpi.production?.completed_today} color={C.teal}/>
          <Tile label="Škart danas" value={kpi.production?.scrap_today} color={C.red} warn={kpi.production?.scrap_today>0}/>
        </Section>

        <Section title="✅ Kvaliteta (30d)">
          <Tile label="Odobreno" value={kpi.quality?.approved} color={C.green}/>
          <Tile label="Odbijeno" value={kpi.quality?.rejected} color={C.red} warn={kpi.quality?.rejected>0}/>
          <Tile label="Na čekanju" value={kpi.quality?.pending} color={C.orange}/>
          {kpi.quality?.approved>0 && <Tile label="Postotak OK" value={Math.round(kpi.quality.approved/(kpi.quality.approved+(kpi.quality.rejected||0))*100)+'%'} color={C.teal}/>}
        </Section>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <Section title="⚙️ Strojevi">
          <Tile label="Running" value={mc.running||0} color={C.green}/>
          <Tile label="Idle" value={mc.idle||0} color={C.muted}/>
          <Tile label="Kvar!" value={mc.fault||0} color={C.red} warn={mc.fault>0}/>
          <Tile label="Ukupno" value={totalMachines} color={C.teal}/>
        </Section>

        <Section title="🔩 Održavanje">
          <Tile label="Hitno!" value={kpi.maintenance?.urgent} color={C.red} warn={kpi.maintenance?.urgent>0}/>
          <Tile label="Otvoreno" value={kpi.maintenance?.open} color={C.orange}/>
          <Tile label="Korektivni (30d)" value={kpi.maintenance?.corrective_month} color={C.muted}/>
        </Section>

        <Section title="📦 Skladište">
          <Tile label="Niska zaliha" value={kpi.warehouse?.low_stock} color={C.red} warn={kpi.warehouse?.low_stock>0}/>
        </Section>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Section title="📋 Zadaci">
          <Tile label="U tijeku" value={kpi.tasks?.in_progress} color={C.green}/>
          <Tile label="KRITIČNO" value={kpi.tasks?.critical} color={C.red} warn={kpi.tasks?.critical>0}/>
          <Tile label="Kasne" value={kpi.tasks?.overdue} color={C.orange} warn={kpi.tasks?.overdue>0}/>
        </Section>

        <Section title="👥 HR">
          <Tile label="Zaposlenici" value={kpi.hr?.total_employees} color={C.teal}/>
          <Tile label="Prisutni danas" value={kpi.hr?.present_today} color={C.green}/>
          <Tile label="Zahtjevi dopusta" value={kpi.hr?.pending_leaves} color={C.orange} warn={kpi.hr?.pending_leaves>0}/>
        </Section>
      </div>

      {/* Sales funnel */}
      {funnel && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:14,textTransform:'uppercase'}}>💰 PRODAJNI LIJEVAK (90d)</div>
          <div style={{display:'flex',gap:4,alignItems:'flex-end',height:80}}>
            {[['Upiti',funnel.rfqs,C.blue],['Ponude',funnel.offers,C.teal],['Narudžbe',funnel.orders,C.accent],['Fakture',funnel.invoices,C.orange],['Plaćeno',funnel.paid_revenue?'€'+parseFloat(funnel.paid_revenue).toLocaleString('hr'):0,C.green]].map(([label,val,color],i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:13,fontWeight:700,color}}>{val||0}</div>
                <div style={{width:'100%',background:color,borderRadius:'4px 4px 0 0',height:`${Math.max(10,Math.min(70,20+parseInt(val)||10))}px`,opacity:0.8}}/>
                <div style={{fontSize:10,color:C.muted}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production efficiency */}
      {efficiency.length>0 && (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:1.5,marginBottom:14,textTransform:'uppercase'}}>🏭 EFIKASNOST PRODUKCIJE (7d)</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {efficiency.map((d,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 80px 80px 80px',gap:12,alignItems:'center',fontSize:12}}>
                <div style={{color:C.muted}}>{new Date(d.day).toLocaleDateString('hr',{weekday:'short',day:'2-digit',month:'2-digit'})}</div>
                <div style={{height:8,background:C.surface3,borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',background:`linear-gradient(90deg,${C.green},${C.teal})`,width:`${d.quality_rate||0}%`,borderRadius:4,transition:'width .5s'}}/>
                </div>
                <div style={{textAlign:'right',color:C.green}}>{d.good_parts} OK</div>
                <div style={{textAlign:'right',color:C.red}}>{d.scrap_parts} škart</div>
                <div style={{textAlign:'right',color:C.teal}}>{d.quality_rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
