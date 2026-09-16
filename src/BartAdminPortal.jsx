import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, BarChart3, Boxes, Building2, CalendarDays,
  ChartNoAxesCombined, ChevronRight, CircleGauge, ClipboardCheck, Command, Database,
  Download, FileChartColumn, FileSpreadsheet, Filter, Gauge, GitCompareArrows,
  HeartPulse, History, Layers3, LayoutDashboard, ListFilter, LoaderCircle, MapPinned,
  PackageSearch, RefreshCcw, Search, Settings2, ShieldAlert, Sparkles, Table2,
  Tags, TrendingDown, TrendingUp, UserRoundCog, UsersRound, Warehouse, XCircle,
  Zero
} from "lucide-react";
import "./BartAdminPortal.css";

const GROUPS = [
  { id:"command", label:"COMMAND", tabs:[
    ["command-center","Command Center",LayoutDashboard],["live-operations","Live Operations",Activity],
    ["branch-network","Branch Network",Building2],["attention-center","Attention Center",ShieldAlert],
  ]},
  { id:"inventory", label:"INVENTORY", tabs:[
    ["inventory-matrix","Inventory Matrix",Table2],["daily-inventory","Daily Inventory",ClipboardCheck],
    ["weekly-inventory","Weekly Inventory",CalendarDays],["global-search","Global Item Search",Search],
    ["sku-explorer","SKU Explorer",PackageSearch],["category-explorer","Category Explorer",Tags],
  ]},
  { id:"intelligence", label:"INTELLIGENCE", tabs:[
    ["stock-movement","Stock Movement",ChartNoAxesCombined],["item-history","Item History",History],
    ["branch-trends","Branch Trends",TrendingUp],["fast-movers","Fast Movers",Gauge],
    ["slow-movers","Slow Movers",TrendingDown],["stock-distribution","Stock Distribution",Warehouse],
  ]},
  { id:"analysis", label:"ANALYSIS", tabs:[
    ["branch-comparison","Branch Comparison",GitCompareArrows],["item-comparison","Item Comparison",Layers3],
    ["date-comparison","Date Comparison",CalendarDays],["category-comparison","Category Comparison",BarChart3],
    ["variance-analyzer","Variance Analyzer",CircleGauge],
  ]},
  { id:"exceptions", label:"EXCEPTIONS", tabs:[
    ["exception-center","Exception Center",AlertTriangle],["zero-stock","Zero Stock",XCircle],
    ["missing-submissions","Missing Data",ShieldAlert],["uncategorized","Uncategorized",Tags],
    ["data-anomalies","Data Anomalies",HeartPulse],
  ]},
  { id:"management", label:"MANAGEMENT", tabs:[
    ["area-managers","Area Managers",UserRoundCog],["manager-branches","Manager Branch View",UsersRound],
    ["area-comparison","Area Comparison",MapPinned],
  ]},
  { id:"reports", label:"REPORTS", tabs:[
    ["report-studio","Report Studio",FileSpreadsheet],["date-range-reports","Date Range Reports",FileChartColumn],
    ["executive-report","Executive Report",Download],["custom-export","Custom Export",Filter],
    ["report-history","Report History",History],
  ]},
  { id:"system", label:"SYSTEM", tabs:[
    ["data-health","Data Health",Database],["system-settings","System Settings",Settings2],
  ]},
];
const ALL_TABS = GROUPS.flatMap(g=>g.tabs.map(t=>({id:t[0],label:t[1],Icon:t[2],group:g.id})));

const loaderCopy = [
  ["Synchronizing branch constellation","Reading operational signals"],
  ["Assembling inventory matrix","Aligning branch quantities"],
  ["Tracing stock pathways","Building movement intelligence"],
  ["Inspecting exceptions","Separating signal from noise"],
  ["Calibrating analytics","Preparing comparison layers"],
  ["Mapping branch network","Verifying data availability"],
  ["Preparing command surface","Prioritizing management signals"],
  ["Compiling report intelligence","Structuring export layers"],
];

function TabLoader({ tab }) {
  const i = Math.abs(tab.split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % 8;
  const [title,sub] = loaderCopy[i];
  return <div className={`ba-loader loader-${i}`}>
    <div className="ba-loader-stage">
      <span className="orbit o1"/><span className="orbit o2"/><span className="orbit o3"/>
      <div className="loader-core"><Sparkles size={22}/></div>
      <div className="scan-line"/>
    </div>
    <strong>{title}</strong><span>{sub}</span>
  </div>;
}

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const fmt = v => new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n(v));

function Metric({label,value,detail,Icon=Activity}) { return <motion.div className="ba-metric" whileHover={{y:-4}}><div className="metric-icon"><Icon size={18}/></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></motion.div> }

function AdminTable({rows,branches,compact=false}){
  return <div className="ba-table-wrap"><table className="ba-table"><thead><tr><th>SKU</th><th>ITEM NAME</th><th>UOM</th>{branches.map(b=><th key={b}>{b}</th>)}<th>TOTAL</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${r.SKU}-${r["Item Name"]}-${i}`}><td><b>{r.SKU||"—"}</b></td><td>{r["Item Name"]}</td><td>{r.UOM}</td>{branches.map(b=><td key={b} className={n(r[b])===0?"zero":""}>{fmt(r[b])}</td>)}<td className="total">{fmt(r.total ?? r.Total)}</td></tr>)}</tbody></table></div>
}

function CommandCenter({data,date,setTab}){
  const all=[...(data.daily||[]),...(data.weekly||[])];
  const unc=all.filter(x=>x.category==="UNCATEGORIZED DETECTED").length;
  const zero=all.reduce((a,r)=>a+(data.branches||[]).filter(b=>n(r[b.name])===0).length,0);
  return <div className="ba-stack">
    <section className="ba-hero"><div><span className="eyebrow">BART / OPERATIONS COMMAND</span><h1>Good day, Admin.</h1><p>One surface for the signals that deserve management attention on <b>{date}</b>.</p></div><div className="hero-radar"><div className="radar-ring r1"/><div className="radar-ring r2"/><div className="radar-dot"/><strong>{data.loadedBranchCount||0}</strong><span>BRANCHES ONLINE</span></div></section>
    <div className="ba-metrics"><Metric label="NETWORK" value={`${data.loadedBranchCount||0}/${data.branchCount||0}`} detail="branches responding" Icon={Building2}/><Metric label="DAILY ITEMS" value={(data.daily||[]).length} detail="items detected" Icon={ClipboardCheck}/><Metric label="WEEKLY ITEMS" value={(data.weekly||[]).length} detail="items detected" Icon={CalendarDays}/><Metric label="ATTENTION" value={(data.failedBranches||[]).length+unc} detail="signals to review" Icon={AlertTriangle}/></div>
    <div className="ba-grid-2"><section className="ba-panel"><header><div><span className="eyebrow">NETWORK CONDITION</span><h3>Branch availability</h3></div><button onClick={()=>setTab("data-health")}>Open health <ChevronRight size={15}/></button></header><div className="health-bar"><i style={{width:`${data.branchCount?((data.loadedBranchCount||0)/data.branchCount)*100:0}%`}}/></div><div className="health-numbers"><b>{data.loadedBranchCount||0} healthy</b><span>{(data.failedBranches||[]).length} unavailable</span></div></section>
    <section className="ba-panel"><header><div><span className="eyebrow">DATA SIGNALS</span><h3>Immediate checks</h3></div><button onClick={()=>setTab("exception-center")}>Inspect <ChevronRight size={15}/></button></header><div className="signal-list"><div><AlertTriangle/><span><b>{unc}</b> uncategorized item records</span></div><div><XCircle/><span><b>{fmt(zero)}</b> zero branch/item cells</span></div><div><Database/><span><b>{(data.failedBranches||[]).length}</b> branch fetch failures</span></div></div></section></div>
    <section className="ba-panel quick"><header><div><span className="eyebrow">QUICK INTELLIGENCE</span><h3>Jump directly into analysis</h3></div></header><div className="quick-grid">{[["global-search","Find any SKU",Search],["branch-comparison","Compare branches",GitCompareArrows],["stock-movement","Stock movement",ChartNoAxesCombined],["report-studio","Build report",FileSpreadsheet],["exception-center","Exceptions",ShieldAlert],["inventory-matrix","Inventory matrix",Table2]].map(([id,l,I])=><button key={id} onClick={()=>setTab(id)}><I/><span>{l}</span><ChevronRight/></button>)}</div></section>
  </div>
}

function BranchNetwork({data,onBranch}){return <div className="ba-stack"><PageHead eyebrow="NETWORK" title={`${data.branchCount||0} BART branches`} text="Open a branch workspace or inspect its current data connection."/><div className="branch-grid">{(data.branches||[]).map((b,i)=><motion.button key={b.code} className="branch-card" onClick={()=>onBranch(b)} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:i*.018}} whileHover={{y:-6}}><span>{String(i+1).padStart(2,"0")}</span><div><b>{b.name}</b><small>{b.code}</small></div><i className="online"/><ChevronRight/></motion.button>)}</div></div>}
function PageHead({eyebrow,title,text,children}){return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{children}</div>}

function InventoryView({data,mode="all"}){
 const [q,setQ]=useState(""); const [cat,setCat]=useState("ALL");
 const branches=(data.branches||[]).map(b=>b.name); let rows=mode==="daily"?(data.daily||[]):mode==="weekly"?(data.weekly||[]):[...(data.daily||[]),...(data.weekly||[])];
 rows=rows.filter(r=>(cat==="ALL"||r.category===cat)&&(!q||`${r.SKU} ${r["Item Name"]} ${r.UOM}`.toLowerCase().includes(q.toLowerCase())));
 return <div className="ba-stack"><PageHead eyebrow="INVENTORY" title={mode==="all"?"Inventory Matrix":`${mode[0].toUpperCase()+mode.slice(1)} Inventory`} text={`${rows.length} visible items across ${branches.length} branches.`}/><div className="toolbar"><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search SKU, item or UOM..."/></div><select value={cat} onChange={e=>setCat(e.target.value)}><option>ALL</option><option>FOOD ITEMS</option><option>DRY ITEMS</option><option>MISC ITEMS</option><option>UNCATEGORIZED DETECTED</option></select></div><AdminTable rows={rows} branches={branches}/></div>
}

function SearchView({data}){const [q,setQ]=useState("");const branches=(data.branches||[]).map(b=>b.name);const all=[...(data.daily||[]).map(x=>({...x,schedule:"Daily"})),...(data.weekly||[]).map(x=>({...x,schedule:"Weekly"}))];const rows=q.trim()?all.filter(r=>`${r.SKU} ${r["Item Name"]}`.toLowerCase().includes(q.toLowerCase())):[];return <div className="ba-stack"><PageHead eyebrow="GLOBAL SEARCH" title="Find stock anywhere." text="Search an SKU or item name and inspect its distribution across the BART network."/><div className="hero-search"><Search/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Try K242, milk, cups..."/><kbd>LIVE</kbd></div>{q&&!rows.length?<Empty text="No matching stock item found for this date."/>:rows.length?<><div className="ba-metrics"><Metric label="MATCHES" value={rows.length} detail="daily + weekly records" Icon={Search}/><Metric label="NETWORK TOTAL" value={fmt(rows.reduce((a,r)=>a+n(r.total),0))} detail="selected result quantity" Icon={Boxes}/></div><AdminTable rows={rows} branches={branches}/></>:<Empty text="Start typing to search across every loaded branch."/>}</div>}

function Exceptions({data,type="all"}){const all=[...(data.daily||[]),...(data.weekly||[])];const branches=(data.branches||[]).map(b=>b.name);let rows=all;if(type==="unc")rows=all.filter(r=>r.category==="UNCATEGORIZED DETECTED");if(type==="zero")rows=all.filter(r=>branches.some(b=>n(r[b])===0));return <div className="ba-stack"><PageHead eyebrow="EXCEPTIONS" title={type==="unc"?"Uncategorized Items":type==="zero"?"Zero Stock Signals":"Exception Center"} text="Fact-based exceptions detected from the currently loaded inventory data."/><div className="ba-metrics"><Metric label="FAILED BRANCHES" value={(data.failedBranches||[]).length} detail="Google Sheet fetch failures" Icon={Database}/><Metric label="UNCATEGORIZED" value={all.filter(r=>r.category==="UNCATEGORIZED DETECTED").length} detail="records requiring classification" Icon={Tags}/><Metric label="ZERO-SIGNAL ITEMS" value={all.filter(r=>branches.some(b=>n(r[b])===0)).length} detail="items with ≥1 zero branch" Icon={XCircle}/></div><AdminTable rows={rows.slice(0,250)} branches={branches}/></div>}

function DataHealth({data}){return <div className="ba-stack"><PageHead eyebrow="SYSTEM" title="Data Health" text="Visibility into the Admin data pipeline without exposing credentials."/><div className="ba-metrics"><Metric label="LOADED" value={data.loadedBranchCount||0} detail="branch sheets responding" Icon={Database}/><Metric label="EXPECTED" value={data.branchCount||0} detail="branches from master" Icon={Building2}/><Metric label="SOURCE" value={(data.source||"google").toUpperCase()} detail="current aggregation source" Icon={Activity}/><Metric label="GENERATED" value={data.generatedAt?new Date(data.generatedAt).toLocaleTimeString():"—"} detail="latest response time" Icon={History}/></div><section className="ba-panel"><header><div><span className="eyebrow">FAILED BRANCHES</span><h3>Connection exceptions</h3></div></header>{(data.failedBranches||[]).length?(data.failedBranches||[]).map((x,i)=><div className="failure" key={i}><XCircle/><span>{typeof x==="string"?x:(x.name||x.branch||"Unknown branch")}</span><small>{x.error||"Could not load branch sheet"}</small></div>):<div className="success-state"><ClipboardCheck/><b>All loaded branches are responding.</b></div>}</section></div>}

function GenericIntelligence({tab,data}){const meta=ALL_TABS.find(x=>x.id===tab);const all=[...(data.daily||[]),...(data.weekly||[])];const branches=(data.branches||[]).map(b=>b.name);const top=[...all].sort((a,b)=>n(b.total)-n(a.total)).slice(0,10);return <div className="ba-stack"><PageHead eyebrow={meta?.group?.toUpperCase()} title={meta?.label} text="Management intelligence built from the currently selected inventory snapshot."/><div className="ba-metrics"><Metric label="BRANCHES" value={branches.length} detail="available in this view" Icon={Building2}/><Metric label="ITEM RECORDS" value={all.length} detail="daily + weekly" Icon={Boxes}/><Metric label="NETWORK QUANTITY" value={fmt(all.reduce((a,r)=>a+n(r.total),0))} detail="aggregate snapshot" Icon={Activity}/></div><section className="ba-panel"><header><div><span className="eyebrow">TOP NETWORK TOTALS</span><h3>Largest item quantities</h3></div></header><div className="rank-list">{top.map((r,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><b>{r["Item Name"]}</b><small>{r.SKU||"—"} · {r.UOM}</small><strong>{fmt(r.total)}</strong></div>)}</div></section><div className="notice"><Sparkles/><div><b>{meta?.label} workspace is wired into the Admin shell.</b><span>Advanced historical calculations will activate as its dedicated endpoint is connected; current snapshot metrics remain real.</span></div></div></div>}
function Empty({text}){return <div className="empty"><PackageSearch/><b>{text}</b></div>}

function BranchWorkspace({branch,data,onBack}){const daily=(data.daily||[]).filter(r=>n(r[branch.name])!==0);const weekly=(data.weekly||[]).filter(r=>n(r[branch.name])!==0);return <div className="branch-workspace"><button className="backline" onClick={onBack}><ArrowLeft/> BART / BRANCHES</button><section className="branch-hero"><div><span className="eyebrow">BRANCH WORKSPACE</span><h1>{branch.name}</h1><p>{branch.code} · Selected inventory snapshot</p></div><div className="branch-health"><i/> DATA CONNECTED</div></section><div className="ba-metrics"><Metric label="DAILY ACTIVE" value={daily.length} detail="non-zero items" Icon={ClipboardCheck}/><Metric label="WEEKLY ACTIVE" value={weekly.length} detail="non-zero items" Icon={CalendarDays}/><Metric label="DAILY QTY" value={fmt(daily.reduce((a,r)=>a+n(r[branch.name]),0))} detail="branch snapshot" Icon={Boxes}/><Metric label="WEEKLY QTY" value={fmt(weekly.reduce((a,r)=>a+n(r[branch.name]),0))} detail="branch snapshot" Icon={Warehouse}/></div><section className="ba-panel"><header><div><span className="eyebrow">BRANCH INVENTORY</span><h3>Current non-zero stock</h3></div></header><div className="branch-items">{[...daily,...weekly].slice(0,80).map((r,i)=><div key={i}><b>{r["Item Name"]}</b><span>{r.SKU||"—"} · {r.UOM}</span><strong>{fmt(r[branch.name])}</strong></div>)}</div></section></div>}

export default function BartAdminPortal({onBack}){
 const [tab,setTab]=useState("command-center"),[openGroup,setOpenGroup]=useState("command"),[date,setDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)}),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[branch,setBranch]=useState(null),[navOpen,setNavOpen]=useState(false);
 async function load(force=false){setLoading(true);setError("");try{const r=await fetch(`/api/admin/bart/inventory?date=${date}${force?"&force=1":""}`);const j=await r.json();if(!r.ok||j.success===false)throw new Error(j.error||`HTTP ${r.status}`);setData(j)}catch(e){setError(e.message||"Unable to load Admin inventory") }finally{setTimeout(()=>setLoading(false),520)}}
 useEffect(()=>{load(false)},[date]);
 function choose(id,g){setTab(id);setOpenGroup(g);setBranch(null);setNavOpen(false)}
 const meta=ALL_TABS.find(x=>x.id===tab);
 let body=null;if(data){if(tab==="command-center")body=<CommandCenter data={data} date={date} setTab={setTab}/>;else if(tab==="branch-network")body=<BranchNetwork data={data} onBranch={setBranch}/>;else if(tab==="inventory-matrix")body=<InventoryView data={data}/>;else if(tab==="daily-inventory")body=<InventoryView data={data} mode="daily"/>;else if(tab==="weekly-inventory")body=<InventoryView data={data} mode="weekly"/>;else if(tab==="global-search"||tab==="sku-explorer")body=<SearchView data={data}/>;else if(tab==="exception-center")body=<Exceptions data={data}/>;else if(tab==="zero-stock")body=<Exceptions data={data} type="zero"/>;else if(tab==="uncategorized")body=<Exceptions data={data} type="unc"/>;else if(tab==="data-health")body=<DataHealth data={data}/>;else body=<GenericIntelligence tab={tab} data={data}/>}
 return <div className="bart-admin"><aside className={navOpen?"open":""}><div className="admin-brand"><div className="brand-mark">B</div><div><b>BART</b><span>ADMIN COMMAND</span></div></div><nav>{GROUPS.map(g=><div className="nav-group" key={g.id}><button className="group-title" onClick={()=>setOpenGroup(openGroup===g.id?"":g.id)}><span>{g.label}</span><small>{g.tabs.length}</small></button><AnimatePresence initial={false}>{openGroup===g.id&&<motion.div className="group-tabs" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}>{g.tabs.map(([id,label,Icon])=><button key={id} className={tab===id?"active":""} onClick={()=>choose(id,g.id)}><Icon size={16}/><span>{label}</span></button>)}</motion.div>}</AnimatePresence></div>)}</nav><button className="all-brands" onClick={onBack}><ArrowLeft/> ALL BRANDS</button></aside>
 <main><header className="admin-top"><button className="mobile-nav" onClick={()=>setNavOpen(!navOpen)}><Command/></button><div className="crumb"><span>DAM UNITED / BART</span><b>{meta?.label||"Command Center"}</b></div><div className="top-actions"><label><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={()=>load(true)} disabled={loading}><RefreshCcw className={loading?"spin":""}/> Refresh</button></div></header><div className="admin-content">{branch&&data?<BranchWorkspace branch={branch} data={data} onBack={()=>setBranch(null)}/>:error?<div className="fatal"><AlertTriangle/><h2>Admin data unavailable</h2><p>{error}</p><button onClick={()=>load(true)}>Retry connection</button></div>:<AnimatePresence mode="wait">{loading?<motion.div key={`load-${tab}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><TabLoader tab={tab}/></motion.div>:<motion.div key={tab} initial={{opacity:0,y:18,filter:"blur(8px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,y:-8}} transition={{duration:.35}}>{body}</motion.div>}</AnimatePresence>}</div></main></div>
}
