import { useState, useEffect, useCallback, useRef } from 'react'
import { C, Btn } from '../components/UI'
import {
  Cpu, Zap, AlertTriangle, TrendingUp, CheckCircle, Clock,
  Layers, Activity, RefreshCw, X, Wrench,
  BarChart3, Package, AlertCircle, Play, Target
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import api from '../utils/api'

const STATUS_COLOR = { running:'#4ADE80', idle:'#F5BC54', fault:'#F87171', maintenance:'#A78BFA' }
const HEALTH_COLOR = (h) => h >= 80 ? '#4ADE80' : h >= 60 ? '#F5BC54' : h >= 40 ? '#FB923C' : '#F87171'
const UTIL_COLOR   = { optimal:'#4ADE80', normal:'#51FFFF', underutilized:'#F5BC54', idle:'#6B7280', overloaded:'#F87171' }
const SEV_COLOR    = { critical:'#F87171', high:'#FB923C', medium:'#F5BC54', low:'#4ADE80' }

function RadialGauge({ value, color, size=80, label }) {
  const r=size/2-6, circ=2*Math.PI*r, pct=Math.min(1,(value??0)/100)
  const dash=pct*circ*0.75, gap=circ-dash
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={size} height={size} style={{transform:'rotate(-135deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}22`} strokeWidth={6}
          strokeDasharray={`${circ*0.75} ${circ*0.25}`} strokeLinecap="round"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${gap+circ*0.25}`} strokeLinecap="round"
          style={{transition:'stroke-dasharray 0.6s ease'}}/>
        <text x={size/2} y={size/2+2} textAnchor="middle" dominantBaseline="middle"
          style={{transform:'rotate(135deg)',transformOrigin:`${size/2}px ${size/2}px`,
            fontSize:size*0.2,fontWeight:700,fill:color,fontFamily:"'Chakra Petch',sans-serif"}}>
          {value!=null?Math.round(value):'—'}
        </text>
      </svg>
      <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>{label}</div>
    </div>
  )
}

function MachineCard({ machine, onClick }) {
  const sc=STATUS_COLOR[machine.status]||C.muted
  const hc=HEALTH_COLOR(machine.health_score)
  const uc=UTIL_COLOR[machine.utilization_status]||C.muted
  return (
    <div onClick={()=>onClick(machine)} style={{
      background:`linear-gradient(145deg,${C.surface},${C.surface2})`,
      border:`1px solid ${machine.status==='fault'?'#F87171':C.border}`,
      borderRadius:14,padding:'16px 18px',cursor:'pointer',transition:'all .2s',position:'relative',overflow:'hidden'
    }}
      onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=sc}}
      onMouseOut={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=machine.status==='fault'?'#F87171':C.border}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${sc},${sc}66)`,borderRadius:'14px 14px 0 0'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'#e8f0ee',marginBottom:2}}>{machine.name}</div>
          <div style={{fontSize:10,color:C.muted}}>{machine.type} · {machine.machine_id}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
          <span style={{fontSize:9,padding:'3px 8px',borderRadius:10,background:`${sc}20`,color:sc,border:`1px solid ${sc}40`,fontWeight:700}}>
            {machine.status?.toUpperCase()}
          </span>
          {machine.open_maintenance>0&&(
            <span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:'#A78BFA15',color:'#A78BFA',border:'1px solid #A78BFA30'}}>
              {machine.open_maintenance} maint
            </span>
          )}
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-around',marginBottom:12}}>
        <RadialGauge value={machine.health_score} color={hc} size={72} label="HEALTH"/>
        <RadialGauge value={machine.utilization_pct} color={uc} size={72} label="UTIL"/>
        {machine.oee&&<RadialGauge value={Math.round((machine.oee.oee??0)*100)} color="#60A5FA" size={72} label="OEE"/>}
      </div>
      {machine.telemetry&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
          {[['🌡',machine.telemetry.temperature,'°C'],['⚙',machine.telemetry.spindle_speed,'rpm'],['⚡',machine.telemetry.power_kw,'kW']].map(([ic,val,u])=>val!=null&&(
            <div key={u} style={{background:C.surface3,borderRadius:6,padding:'4px 8px',textAlign:'center'}}>
              <div style={{fontSize:9,color:C.muted2}}>{ic} {u}</div>
              <div style={{fontSize:11,fontWeight:700,color:'#e8f0ee'}}>{typeof val==='number'?val.toFixed(1):val}</div>
            </div>
          ))}
        </div>
      )}
      {machine.work_orders?.total>0&&(
        <div style={{marginTop:8,display:'flex',gap:6}}>
          <span style={{fontSize:9,color:C.muted}}>Nalozi:</span>
          <span style={{fontSize:9,color:'#60A5FA'}}>{machine.work_orders.in_progress} aktiv</span>
          {machine.work_orders.urgent>0&&<span style={{fontSize:9,color:'#F87171'}}>{machine.work_orders.urgent} hitnih</span>}
        </div>
      )}
    </div>
  )
}

function MachineDrawer({ machine, detail, onClose }) {
  if(!machine) return null
  const sc=STATUS_COLOR[machine.status]||C.muted
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{flex:1}} onClick={onClose}/>
      <div style={{width:480,background:C.surface,borderLeft:`1px solid ${C.border}`,overflowY:'auto',padding:'28px 24px',boxShadow:'-8px 0 32px rgba(0,0,0,.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#e8f0ee'}}>{machine.name}</div>
            <div style={{fontSize:11,color:C.muted}}>{machine.type} · {machine.machine_id}</div>
            {machine.location&&<div style={{fontSize:10,color:C.muted2}}>📍 {machine.location}</div>}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}}><X size={18}/></button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[['Status',machine.status?.toUpperCase(),sc],['Health',`${machine.health_score}%`,HEALTH_COLOR(machine.health_score)],['Util.',`${machine.utilization_pct}%`,UTIL_COLOR[machine.utilization_status]]].map(([l,v,c])=>(
            <div key={l} style={{background:C.surface2,borderRadius:10,padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>

        {machine.oee&&(
          <div style={{background:C.surface2,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>OEE (7 dana)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {[['OEE',Math.round((machine.oee.oee??0)*100)+'%','#60A5FA'],['Dostup.',Math.round((machine.oee.availability??0)*100)+'%','#4ADE80'],['Učink.',Math.round((machine.oee.performance??0)*100)+'%',C.accent],['Kvalit.',Math.round((machine.oee.quality??0)*100)+'%','#A78BFA']].map(([l,v,c])=>(
                <div key={l} style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:C.muted}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10,display:'flex',gap:16,fontSize:10,color:C.muted}}>
              <span>Stajanje: <b style={{color:'#FB923C'}}>{machine.oee.downtime_min} min</b></span>
              <span>Dijelovi: <b style={{color:'#4ADE80'}}>{machine.oee.parts_produced}</b></span>
              <span>Škart: <b style={{color:'#F87171'}}>{machine.oee.parts_scrap}</b></span>
            </div>
          </div>
        )}

        {machine.telemetry&&(
          <div style={{background:C.surface2,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>ZADNJA TELEMETRIJA</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[['Temp.',machine.telemetry.temperature,'°C','#FB923C'],['Vreteno',machine.telemetry.spindle_speed,'rpm',C.teal],['Posmak',machine.telemetry.feed_rate,'mm/min','#60A5FA'],['Vibr.',machine.telemetry.vibration,'mm/s','#A78BFA'],['Snaga',machine.telemetry.power_kw,'kW','#4ADE80']].map(([l,v,u,c])=>v!=null&&(
                <div key={l} style={{background:C.surface3,borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:9,color:C.muted}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:c}}>{typeof v==='number'?v.toFixed(1):v} <span style={{fontSize:9,color:C.muted2}}>{u}</span></div>
                </div>
              ))}
            </div>
            <div style={{fontSize:9,color:C.muted2,marginTop:8}}>
              Snimljeno: {machine.telemetry.recorded_at?new Date(machine.telemetry.recorded_at).toLocaleString('hr-HR'):'—'}
            </div>
          </div>
        )}

        {detail?.oee_history?.length>0&&(
          <div style={{background:C.surface2,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>OEE TREND</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={detail.oee_history.map(o=>({...o,oee_pct:Math.round((o.oee||0)*100)}))}>
                <XAxis dataKey="record_date" tick={{fontSize:8,fill:C.muted}} tickFormatter={d=>d?.slice(5)}/>
                <YAxis domain={[0,100]} tick={{fontSize:8,fill:C.muted}} width={24}/>
                <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}} formatter={v=>[`${v}%`,'OEE']}/>
                <Line type="monotone" dataKey="oee_pct" stroke="#60A5FA" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {detail?.work_orders?.length>0&&(
          <div style={{background:C.surface2,borderRadius:12,padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>RADNI NALOZI</div>
            {detail.work_orders.map((wo,i)=>{
              const pct=wo.quantity>0?Math.round((wo.quantity_done||0)*100/wo.quantity):0
              const pc=wo.priority==='urgent'?'#F87171':wo.priority==='high'?'#FB923C':C.teal
              return(
                <div key={i} style={{marginBottom:8,padding:'8px 10px',background:C.surface3,borderRadius:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:600,color:'#e8f0ee'}}>{wo.work_order_id}</span>
                    <span style={{fontSize:9,color:pc}}>{wo.priority?.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:6}}>{wo.part_name} — {wo.quantity_done||0}/{wo.quantity} kom</div>
                  <div style={{height:3,background:C.border,borderRadius:2}}>
                    <div style={{width:`${pct}%`,height:'100%',background:pc,borderRadius:2,transition:'width .4s'}}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {detail?.maintenance?.length>0&&(
          <div style={{background:C.surface2,borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>OTVORENO ODRŽAVANJE</div>
            {detail.maintenance.map((m,i)=>(
              <div key={i} style={{display:'flex',gap:10,padding:'8px 10px',background:`${SEV_COLOR[m.priority]||C.muted}10`,borderRadius:8,marginBottom:6,border:`1px solid ${SEV_COLOR[m.priority]||C.muted}25`}}>
                <Wrench size={13} color={SEV_COLOR[m.priority]||C.muted} style={{flexShrink:0,marginTop:1}}/>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:'#e8f0ee'}}>{m.title}</div>
                  <div style={{fontSize:10,color:C.muted}}>{m.type} · {m.priority}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SimulationModal({ onClose }) {
  const [params,setParams]=useState({working_hours_per_day:8,shifts:1,name:''})
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const run=async()=>{
    setLoading(true)
    try{const r=await api.post('/digital-twin/simulate',params);setResult(r.data)}
    catch(e){setResult({error:e.response?.data?.error||'Greška'})}
    finally{setLoading(false)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,18,.88)',backdropFilter:'blur(6px)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:28,width:600,maxWidth:'95%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:'#e8f0ee'}}>Simulacija kapaciteta</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><X size={18}/></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:12,marginBottom:16}}>
          <div>
            <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:5}}>SATI/DAN</label>
            <input type="number" value={params.working_hours_per_day} min={1} max={24}
              onChange={e=>setParams(p=>({...p,working_hours_per_day:parseInt(e.target.value)||8}))}
              style={{width:'100%',boxSizing:'border-box',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#e8f0ee',fontSize:13}}/>
          </div>
          <div>
            <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:5}}>SMJENE</label>
            <select value={params.shifts} onChange={e=>setParams(p=>({...p,shifts:parseInt(e.target.value)}))}
              style={{width:'100%',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#e8f0ee',fontSize:13}}>
              <option value={1}>1 smjena</option><option value={2}>2 smjene</option><option value={3}>3 smjene</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:5}}>NAZIV SCENARIJA</label>
            <input value={params.name} onChange={e=>setParams(p=>({...p,name:e.target.value}))} placeholder="npr. Q2 2025 plan"
              style={{width:'100%',boxSizing:'border-box',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:'#e8f0ee',fontSize:13}}/>
          </div>
        </div>
        <Btn onClick={run} disabled={loading} style={{width:'100%',justifyContent:'center',marginBottom:20}}>
          <Play size={14} style={{marginRight:8}}/>{loading?'Simulacija...':'Pokreni simulaciju'}
        </Btn>
        {result?.error&&<div style={{padding:'10px 14px',background:'#F8717110',border:'1px solid #F8717130',borderRadius:8,color:'#F87171',fontSize:12}}>{result.error}</div>}
        {result&&!result.error&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {[['Ukupno naloga',result.simulation_summary.total_jobs,C.teal],['Iskorištenost',`${result.simulation_summary.overall_utilization_pct}%`,'#60A5FA'],['Uska grla',result.simulation_summary.bottleneck_count,result.simulation_summary.bottleneck_count>0?'#F87171':'#4ADE80']].map(([l,v,c])=>(
                <div key={l} style={{background:C.surface2,borderRadius:10,padding:'12px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{l.toUpperCase()}</div>
                  <div style={{fontSize:20,fontWeight:700,color:c,fontFamily:"'Chakra Petch',sans-serif"}}>{v}</div>
                </div>
              ))}
            </div>
            {result.ai_assessment&&<div style={{padding:'12px 14px',background:`${C.teal}10`,border:`1px solid ${C.teal}25`,borderRadius:10,fontSize:12,color:C.muted2,lineHeight:1.7}}>🤖 {result.ai_assessment}</div>}
            <div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:10}}>OPTEREĆENJE STROJEVA</div>
              {result.machine_states.map((m,i)=>{
                const c=UTIL_COLOR[m.status]||C.muted
                return(<div key={i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:11,color:'#e8f0ee'}}>{m.machine_name}</span>
                    <span style={{fontSize:11,color:c,fontWeight:700}}>{m.utilization_pct}% {m.bottleneck?'⚠️':''}</span>
                  </div>
                  <div style={{height:6,background:C.border,borderRadius:3}}>
                    <div style={{width:`${Math.min(100,m.utilization_pct)}%`,height:'100%',background:c,borderRadius:3,transition:'width .5s'}}/>
                  </div>
                </div>)
              })}
            </div>
            {result.bottlenecks?.length>0&&(
              <div>
                <div style={{fontSize:10,color:'#F5BC54',letterSpacing:1.5,marginBottom:10}}>USKA GRLA</div>
                {result.bottlenecks.map((b,i)=>(
                  <div key={i} style={{padding:'10px 12px',background:'#F5BC5410',border:'1px solid #F5BC5430',borderRadius:8,marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#F5BC54',marginBottom:3}}>{b.location} — {b.utilization_pct}%</div>
                    <div style={{fontSize:11,color:C.muted2}}>{b.impact}</div>
                    <div style={{fontSize:11,color:C.teal,marginTop:4}}>→ {b.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
            {result.optimizations?.length>0&&(
              <div>
                <div style={{fontSize:10,color:'#4ADE80',letterSpacing:1.5,marginBottom:10}}>PRIJEDLOZI</div>
                {result.optimizations.map((o,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'10px 12px',background:'#4ADE8010',border:'1px solid #4ADE8025',borderRadius:8,marginBottom:6}}>
                    <TrendingUp size={13} color="#4ADE80" style={{flexShrink:0,marginTop:1}}/>
                    <span style={{fontSize:11,color:C.muted2,lineHeight:1.6}}>{o.proposed_change}</span>
                    {o.estimated_improvement_pct>0&&<span style={{marginLeft:'auto',fontSize:10,color:'#4ADE80',whiteSpace:'nowrap',fontWeight:700}}>+{o.estimated_improvement_pct}%</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DigitalTwinPage() {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [refreshing,setRefreshing]=useState(false)
  const [selMachine,setSelMachine]=useState(null)
  const [machineDetail,setMachineDetail]=useState(null)
  const [showSim,setShowSim]=useState(false)
  const [bottlenecks,setBottlenecks]=useState(null)
  const [bnLoading,setBnLoading]=useState(false)
  const intRef=useRef(null)

  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true); else setRefreshing(true)
    try{const r=await api.get('/digital-twin');setData(r.data)}
    catch(e){console.error(e)}
    finally{setLoading(false);setRefreshing(false)}
  },[])

  useEffect(()=>{
    load()
    intRef.current=setInterval(()=>load(true),30000)
    return()=>clearInterval(intRef.current)
  },[load])

  const loadDetail=async(machine)=>{
    setSelMachine(machine);setMachineDetail(null)
    try{const r=await api.get(`/digital-twin/machine/${machine.id}`);setMachineDetail(r.data)}catch(e){}
  }

  const runBN=async()=>{
    setBnLoading(true);setBottlenecks(null)
    try{const r=await api.post('/digital-twin/bottlenecks');setBottlenecks(r.data)}
    catch(e){setBottlenecks({error:e.response?.data?.error||'Greška'})}
    finally{setBnLoading(false)}
  }

  if(loading)return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,border:`3px solid ${C.teal}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
        <div style={{fontSize:12,color:C.muted}}>Učitavanje digitalnog dvojnika...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const factory=data?.factory||{}
  const machines=data?.machines||[]
  const oeeTrend=data?.oee_trend||[]
  const alerts=data?.alerts||[]
  const riskColor=factory.machines_fault>0?'#F87171':factory.maintenance?.urgent>0?'#FB923C':'#4ADE80'

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:52,height:52,borderRadius:16,background:`${C.teal}18`,border:`1px solid ${C.teal}35`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Layers size={26} color={C.teal}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>DEER MES · AI MODUL</div>
            <div style={{fontSize:20,fontWeight:700,color:'#e8f0ee',letterSpacing:1.5,fontFamily:"'Chakra Petch',sans-serif"}}>DIGITALNI DVOJNIK</div>
            <div style={{fontSize:11,color:C.muted2}}>
              Snapshot: {data?.snapshot_at?new Date(data.snapshot_at).toLocaleTimeString('hr-HR'):'—'}
              {refreshing&&<span style={{color:C.teal,marginLeft:8}}>↻ osvježava...</span>}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn v="secondary" sm onClick={()=>load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={{marginRight:6}}/> Osvježi
          </Btn>
          <Btn v="teal" sm onClick={runBN} disabled={bnLoading}>
            <Zap size={13} style={{marginRight:6}}/>{bnLoading?'Analiza...':'Analiza uskih grla'}
          </Btn>
          <Btn sm onClick={()=>setShowSim(true)}>
            <Play size={13} style={{marginRight:6}}/> Simulacija
          </Btn>
        </div>
      </div>

      {/* Factory KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:24}}>
        {[
          ['Strojevi',`${factory.machines_running}/${factory.machines_total}`,factory.machines_fault>0?'#F87171':'#4ADE80',Cpu,`${factory.machines_fault||0} u kvaru`],
          ['Avg OEE',factory.avg_oee!=null?`${Math.round(factory.avg_oee*100)}%`:'—','#60A5FA',BarChart3,'7 dana'],
          ['Aktivni',factory.work_orders?.in_progress??0,C.teal,Activity,`${factory.work_orders?.overdue||0} kasnih`],
          ['Hitnih',(factory.work_orders?.urgent??0)+(factory.maintenance?.urgent??0),(factory.work_orders?.urgent??0)>0?'#F87171':C.muted,AlertTriangle,'nalozi+maint'],
          ['Alati',`${factory.tools?.out_of_stock??0}/${factory.tools?.low_stock??0}`,(factory.tools?.out_of_stock??0)>0?'#F87171':'#F5BC54',Package,'0 zal. / nisko'],
          ['Health',`${factory.avg_health??'—'}%`,riskColor,Target,'prosj. strojevi'],
        ].map(([l,v,c,Icon,sub])=>(
          <div key={l} style={{background:`linear-gradient(145deg,${C.surface},${C.surface2})`,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${c},${c}55)`}}/>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
              <Icon size={11} color={c}/><span style={{fontSize:9,color:C.muted,letterSpacing:1}}>{l.toUpperCase()}</span>
            </div>
            <div style={{fontSize:22,fontWeight:700,color:c,fontFamily:"'Chakra Petch',sans-serif",lineHeight:1}}>{v}</div>
            <div style={{fontSize:9,color:C.muted2,marginTop:4}}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20}}>
        <div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:12}}>STROJEVI — KLIKNI ZA DETALJE</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14,marginBottom:24}}>
            {machines.map(m=><MachineCard key={m.id} machine={m} onClick={loadDetail}/>)}
            {machines.length===0&&(
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:C.muted,fontSize:13}}>
                Nema strojeva. Dodajte strojeve u modul Strojevi.
              </div>
            )}
          </div>

          {oeeTrend.length>0&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'18px 20px',marginBottom:20}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:14}}>OEE TREND — ZADNJIH 14 DANA</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={oeeTrend.map(o=>({...o,oee_pct:Math.round((o.oee||0)*100),avail_pct:Math.round((o.availability||0)*100),perf_pct:Math.round((o.performance||0)*100),qual_pct:Math.round((o.quality||0)*100)}))}>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:C.muted}} tickFormatter={d=>d?.slice(5)}/>
                  <YAxis domain={[0,100]} tick={{fontSize:9,fill:C.muted}} width={24} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}} formatter={(v,n)=>[`${v}%`,n]}/>
                  <Line type="monotone" dataKey="oee_pct"   stroke="#60A5FA" strokeWidth={2} dot={false} name="OEE"/>
                  <Line type="monotone" dataKey="avail_pct" stroke="#4ADE80" strokeWidth={1.5} dot={false} name="Dostupnost" strokeDasharray="4 2"/>
                  <Line type="monotone" dataKey="perf_pct"  stroke={C.accent} strokeWidth={1.5} dot={false} name="Učinkovitost" strokeDasharray="4 2"/>
                  <Line type="monotone" dataKey="qual_pct"  stroke="#A78BFA" strokeWidth={1.5} dot={false} name="Kvaliteta" strokeDasharray="4 2"/>
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:16,marginTop:8,fontSize:10}}>
                {[['OEE','#60A5FA'],['Dostupnost','#4ADE80'],['Učinkovitost',C.accent],['Kvaliteta','#A78BFA']].map(([l,c])=>(
                  <span key={l} style={{display:'flex',alignItems:'center',gap:4,color:C.muted}}>
                    <span style={{width:16,height:2,background:c,display:'inline-block',borderRadius:1}}/> {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {machines.length>0&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'18px 20px'}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:14}}>ISKORIŠTENOST STROJEVA</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={machines.map(m=>({name:m.name.split(' ').slice(0,2).join(' '),pct:m.utilization_pct,status:m.utilization_status}))}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:C.muted}}/>
                  <YAxis domain={[0,100]} tick={{fontSize:9,fill:C.muted}} width={24} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}} formatter={v=>[`${v}%`,'Iskorištenost']}/>
                  <Bar dataKey="pct" radius={[4,4,0,0]}>
                    {machines.map((m,i)=><Cell key={i} fill={UTIL_COLOR[m.utilization_status]||C.muted}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {bottlenecks&&!bottlenecks.error&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:10,color:'#F5BC54',letterSpacing:1.5}}>ANALIZA USKIH GRLA</div>
                <button onClick={()=>setBottlenecks(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}><X size={14}/></button>
              </div>
              {bottlenecks.summary&&<div style={{fontSize:11,color:C.muted2,lineHeight:1.6,marginBottom:12,padding:'8px 10px',background:`${C.teal}08`,borderRadius:8}}>{bottlenecks.summary}</div>}
              {bottlenecks.bottlenecks?.map((b,i)=>{
                const c=SEV_COLOR[b.severity]||C.muted
                return(<div key={i} style={{padding:'8px 10px',background:`${c}10`,border:`1px solid ${c}25`,borderRadius:8,marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{fontSize:11,fontWeight:700,color:c}}>{b.resource}</span>
                    <span style={{fontSize:9,color:c}}>{b.severity?.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:10,color:C.muted2,marginBottom:3}}>{b.detail}</div>
                  <div style={{fontSize:10,color:C.teal}}>→ {b.recommendation}</div>
                </div>)
              })}
              {bottlenecks.quick_wins?.length>0&&(
                <div style={{marginTop:10}}>
                  <div style={{fontSize:9,color:'#4ADE80',letterSpacing:1,marginBottom:6}}>BRZE POBJEDE</div>
                  {bottlenecks.quick_wins.map((q,i)=>(
                    <div key={i} style={{display:'flex',gap:6,fontSize:10,color:C.muted2,marginBottom:4}}>
                      <CheckCircle size={11} color="#4ADE80" style={{flexShrink:0,marginTop:1}}/> {q}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {alerts.length>0&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 18px'}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:12}}>UPOZORENJA ({alerts.length})</div>
              {alerts.map((a,i)=>{
                const c=a.type==='error'||a.type==='critical'?'#F87171':a.type==='warning'?'#F5BC54':C.teal
                return(<div key={i} style={{display:'flex',gap:8,padding:'8px 10px',background:`${c}10`,border:`1px solid ${c}25`,borderRadius:8,marginBottom:6}}>
                  <AlertCircle size={12} color={c} style={{flexShrink:0,marginTop:1}}/>
                  <span style={{fontSize:11,color:C.muted2,lineHeight:1.5}}>{a.message}</span>
                </div>)
              })}
            </div>
          )}

          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 18px'}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:12}}>STANJE FABRIKE</div>
            {[
              ['Strojevi u radu',`${factory.machines_running||0} / ${factory.machines_total||0}`,factory.machines_fault>0?'#F87171':'#4ADE80'],
              ['Strojevi u kvaru',factory.machines_fault||0,(factory.machines_fault||0)>0?'#F87171':C.muted],
              ['Aktivni nalozi',factory.work_orders?.in_progress??0,C.teal],
              ['Kasnih naloga',factory.work_orders?.overdue??0,(factory.work_orders?.overdue||0)>0?'#FB923C':C.muted],
              ['Hitnih naloga',factory.work_orders?.urgent??0,(factory.work_orders?.urgent||0)>0?'#F87171':C.muted],
              ['Maint. otvorenih',factory.maintenance?.open??0,(factory.maintenance?.urgent||0)>0?'#F87171':C.muted],
              ['Alati bez zalihe',factory.tools?.out_of_stock??0,(factory.tools?.out_of_stock||0)>0?'#F87171':C.muted],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}33`}}>
                <span style={{fontSize:11,color:C.muted}}>{l}</span>
                <span style={{fontSize:12,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selMachine&&<MachineDrawer machine={selMachine} detail={machineDetail} onClose={()=>{setSelMachine(null);setMachineDetail(null)}}/>}
      {showSim&&<SimulationModal onClose={()=>setShowSim(false)}/>}
    </div>
  )
}
