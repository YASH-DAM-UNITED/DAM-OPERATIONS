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
import * as XLSX from "xlsx-js-style";
import "./BartAdminPortal.css";

const GROUPS = [
  { id:"reports", label:"REPORTS / DOWNLOADS", tabs:[
    ["report-studio","Download Center",FileSpreadsheet],["date-range-reports","Date Range Reports",FileChartColumn],
    ["executive-report","Executive Report",Download],["custom-export","Custom Export",Filter],
    ["report-history","Report History",History],
  ]},
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

function SnapshotSpecial({tab,data,setTab}){
 const all=[...(data.daily||[]).map(x=>({...x,mode:"Daily"})),...(data.weekly||[]).map(x=>({...x,mode:"Weekly"}))];
 const branches=(data.branches||[]).map(b=>b.name);
 const byCat=["FOOD ITEMS","DRY ITEMS","MISC ITEMS","UNCATEGORIZED DETECTED"].map(category=>({category,items:all.filter(x=>x.category===category).length,qty:all.filter(x=>x.category===category).reduce((a,r)=>a+n(r.total),0)}));
 if(tab==="live-operations") return <div className="ba-stack"><PageHead eyebrow="COMMAND" title="Live Operations" text="Current selected-date branch response and inventory activity — not a duplicate inventory table."/><div className="ba-metrics"><Metric label="RESPONDING" value={data.loadedBranchCount||0} detail="branch sheets loaded" Icon={Activity}/><Metric label="FAILED" value={(data.failedBranches||[]).length} detail="fetch failures" Icon={XCircle}/><Metric label="ACTIVE ITEMS" value={all.filter(r=>n(r.total)>0).length} detail="network quantity > 0" Icon={Boxes}/></div><section className="ba-panel"><header><div><span className="eyebrow">BRANCH RESPONSE</span><h3>Operational connectivity</h3></div></header><div className="rank-list">{(data.branches||[]).map((b,i)=>{const fail=(data.failedBranches||[]).find(x=>(x.name||x.branch)===b.name||x.code===b.code);return <div key={b.code}><span>{String(i+1).padStart(2,"0")}</span><b>{b.name}</b><small>{b.code}</small><strong>{fail?"FETCH FAILED":"CONNECTED"}</strong></div>})}</div></section></div>;
 if(tab==="attention-center") {const unc=all.filter(r=>r.category==="UNCATEGORIZED DETECTED");const zero=all.filter(r=>branches.some(b=>n(r[b])===0));return <div className="ba-stack"><PageHead eyebrow="COMMAND" title="Attention Center" text="Only factual signals: fetch failures, uncategorized records and confirmed zero-value cells."/><div className="ba-metrics"><Metric label="FETCH FAILURES" value={(data.failedBranches||[]).length} detail="branches requiring retry" Icon={Database}/><Metric label="UNCATEGORIZED" value={unc.length} detail="classification required" Icon={Tags}/><Metric label="ZERO-SIGNAL ITEMS" value={zero.length} detail="at least one zero cell" Icon={XCircle}/></div><div className="quick-grid">{[["missing-submissions","Inspect missing data",ShieldAlert],["uncategorized","Review categories",Tags],["zero-stock","Review zero stock",XCircle],["data-health","Open data health",Database]].map(([id,l,I])=><button key={id} onClick={()=>setTab(id)}><I/><span>{l}</span><ChevronRight/></button>)}</div></div>}
 if(tab==="category-explorer") return <div className="ba-stack"><PageHead eyebrow="INVENTORY" title="Category Explorer" text="Category-level item counts and selected-date network quantities."/><div className="category-cards">{byCat.map(x=><section className="ba-panel" key={x.category}><span className="eyebrow">{x.category}</span><h2>{fmt(x.qty)}</h2><p>{x.items} item records</p></section>)}</div></div>;
 if(tab==="stock-distribution") {const top=[...all].sort((a,b)=>n(b.total)-n(a.total)).slice(0,30);return <div className="ba-stack"><PageHead eyebrow="INTELLIGENCE" title="Stock Distribution" text="Where the largest selected-date inventory quantities are distributed across branches."/><section className="ba-panel"><div className="rank-list">{top.map((r,i)=>{const leader=branches.reduce((best,b)=>n(r[b])>n(r[best])?b:best,branches[0]||"");return <div key={`${r.SKU}-${i}`}><span>{String(i+1).padStart(2,"0")}</span><b>{r["Item Name"]}</b><small>{leader||"—"} has largest quantity</small><strong>{fmt(r[leader])} / {fmt(r.total)}</strong></div>})}</div></section></div>}
 if(tab==="missing-submissions") return <div className="ba-stack"><PageHead eyebrow="EXCEPTIONS" title="Missing Data" text="Branches the Admin API could not load for this selected date snapshot."/><div className="ba-metrics"><Metric label="EXPECTED" value={data.branchCount||0} detail="master branches" Icon={Building2}/><Metric label="LOADED" value={data.loadedBranchCount||0} detail="successful reads" Icon={Database}/><Metric label="MISSING" value={(data.failedBranches||[]).length} detail="failed reads" Icon={ShieldAlert}/></div><section className="ba-panel">{(data.failedBranches||[]).length?(data.failedBranches||[]).map((x,i)=><div className="failure" key={i}><XCircle/><span>{x.name||x.branch||"Unknown"}</span><small>{x.error||"Load failed"}</small></div>):<div className="success-state"><ClipboardCheck/><b>No branch fetch failures in this response.</b></div>}</section></div>;
 if(tab==="data-anomalies") {const anomalies=[];const seen=new Map();all.forEach(r=>{const key=String(r.SKU||"").trim().toUpperCase();if(!key)return;const sig=`${r["Item Name"]}|${r.UOM}`;if(seen.has(key)&&seen.get(key)!==sig) anomalies.push({sku:key,a:seen.get(key),b:sig});else seen.set(key,sig)});return <div className="ba-stack"><PageHead eyebrow="EXCEPTIONS" title="Data Anomalies" text="SKU identity conflicts detected inside the loaded snapshot."/><Metric label="IDENTITY CONFLICTS" value={anomalies.length} detail="same SKU with different item/UOM signature" Icon={HeartPulse}/><section className="ba-panel"><div className="rank-list">{anomalies.length?anomalies.map((x,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><b>{x.sku}</b><small>{x.a} → {x.b}</small><strong>CHECK</strong></div>):<div className="success-state"><ClipboardCheck/><b>No duplicate SKU identity conflicts detected.</b></div>}</div></section></div>}
 if(tab==="system-settings") return <div className="ba-stack"><PageHead eyebrow="SYSTEM" title="System Settings" text="Read-only Admin runtime configuration. Credentials are never exposed here."/><div className="ba-metrics"><Metric label="ADMIN POOL" value={data.adminPool?.accountsConfigured||1} detail={data.adminPool?.mode||"Admin Google pool"} Icon={Database}/><Metric label="CONCURRENCY" value={data.adminPool?.concurrency||"—"} detail="controlled branch jobs" Icon={Activity}/><Metric label="DATE" value={data.date||"—"} detail="selected inventory date" Icon={CalendarDays}/></div><div className="notice"><ShieldAlert/><div><b>Admin Google credentials remain Worker secrets.</b><span>This screen intentionally exposes status only, never email addresses or private keys.</span></div></div></div>;
 return null;
}

function SkuExplorer({data}){const [sku,setSku]=useState("");const branches=(data.branches||[]).map(b=>b.name);const all=[...(data.daily||[]),...(data.weekly||[])];const options=[...new Set(all.map(x=>x.SKU).filter(Boolean))].sort();const row=all.find(x=>x.SKU===sku);const distribution=row?branches.map(b=>({branch:b,qty:n(row[b])})).sort((a,b)=>b.qty-a.qty):[];return <div className="ba-stack"><PageHead eyebrow="INVENTORY" title="SKU Explorer" text="Select one SKU and inspect its exact branch distribution."/><div className="toolbar"><select value={sku} onChange={e=>setSku(e.target.value)}><option value="">Select SKU…</option>{options.map(x=><option key={x}>{x}</option>)}</select></div>{row?<><div className="ba-metrics"><Metric label="SKU" value={row.SKU} detail={row["Item Name"]} Icon={PackageSearch}/><Metric label="NETWORK TOTAL" value={fmt(row.total)} detail={row.UOM} Icon={Boxes}/><Metric label="BRANCHES WITH STOCK" value={distribution.filter(x=>x.qty>0).length} detail={`of ${branches.length}`} Icon={Building2}/></div><section className="ba-panel"><div className="rank-list">{distribution.map((x,i)=><div key={x.branch}><span>{String(i+1).padStart(2,"0")}</span><b>{x.branch}</b><small>{row["Item Name"]}</small><strong>{fmt(x.qty)} {row.UOM}</strong></div>)}</div></section></>:<Empty text="Choose an SKU to open its branch distribution."/>}</div>}

function HistoricalWorkspace({tab,data,historical,historicalLoading,range,setRange,loadHistorical}){
 const allCurrent=[...(data.daily||[]),...(data.weekly||[])];
 const dates=historical?.dates||[]; const byDate=historical?.byDate||{};
 const [sku,setSku]=useState(""); const [branch,setBranch]=useState("");
 const skus=[...new Set(allCurrent.map(x=>x.SKU).filter(Boolean))].sort(); const branches=(data.branches||[]).map(b=>b.name);
 const dateTotal=d=>[...(byDate[d]?.daily||[]),...(byDate[d]?.weekly||[])].reduce((a,r)=>a+n(r.total),0);
 const seriesForSku=sku?dates.map(d=>{const rows=[...(byDate[d]?.daily||[]),...(byDate[d]?.weekly||[])];const r=rows.find(x=>x.SKU===sku);return {date:d,total:n(r?.total),row:r}}):[];
 const branchSeries=branch?dates.map(d=>{const rows=[...(byDate[d]?.daily||[]),...(byDate[d]?.weekly||[])];return {date:d,total:rows.reduce((a,r)=>a+n(r[branch]),0)};}):[];
 const first=dates[0],last=dates[dates.length-1];
 const movement=(()=>{if(!first||!last)return[];const a=[...(byDate[first]?.daily||[]),...(byDate[first]?.weekly||[])];const b=[...(byDate[last]?.daily||[]),...(byDate[last]?.weekly||[])];const map=new Map(a.map(r=>[`${r.SKU}|${r.UOM}`,r]));return b.map(r=>{const old=map.get(`${r.SKU}|${r.UOM}`);return {...r,start:n(old?.total),end:n(r.total),change:n(r.total)-n(old?.total),abs:Math.abs(n(r.total)-n(old?.total))}})} )();
 const rangeBar=<div className="toolbar"><label>From <input type="date" value={range.start} onChange={e=>setRange(x=>({...x,start:e.target.value}))}/></label><label>To <input type="date" value={range.end} onChange={e=>setRange(x=>({...x,end:e.target.value}))}/></label><button onClick={()=>loadHistorical(false)} disabled={historicalLoading}><RefreshCcw className={historicalLoading?"spin":""}/> Load range</button></div>;
 if(historicalLoading)return <TabLoader tab={tab}/>;
 if(!historical)return <div className="ba-stack"><PageHead eyebrow="HISTORICAL" title="Historical Intelligence" text="Choose a date range to load real historical stock columns from branch sheets."/>{rangeBar}<Empty text="Load a date range to activate this workspace."/></div>;
 if(tab==="stock-movement")return <div className="ba-stack"><PageHead eyebrow="INTELLIGENCE" title="Stock Movement" text="Absolute quantity movement between the first and last loaded dates."/>{rangeBar}<section className="ba-panel"><div className="rank-list">{[...movement].sort((a,b)=>b.abs-a.abs).slice(0,50).map((r,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><b>{r["Item Name"]}</b><small>{r.SKU} · {r.start} → {r.end}</small><strong>{r.change>0?"+":""}{fmt(r.change)}</strong></div>)}</div></section></div>;
 if(tab==="item-history")return <div className="ba-stack"><PageHead eyebrow="INTELLIGENCE" title="Item History" text="One SKU across every loaded historical date."/>{rangeBar}<select value={sku} onChange={e=>setSku(e.target.value)}><option value="">Select SKU…</option>{skus.map(x=><option key={x}>{x}</option>)}</select>{sku?<section className="ba-panel"><div className="rank-list">{seriesForSku.map((x,i)=><div key={x.date}><span>{String(i+1).padStart(2,"0")}</span><b>{x.date}</b><small>{x.row?.["Item Name"]||sku}</small><strong>{fmt(x.total)}</strong></div>)}</div></section>:<Empty text="Choose an SKU to view its date history."/>}</div>;
 if(tab==="branch-trends")return <div className="ba-stack"><PageHead eyebrow="INTELLIGENCE" title="Branch Trends" text="Total loaded inventory quantity for one branch across the selected date range."/>{rangeBar}<select value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Select branch…</option>{branches.map(x=><option key={x}>{x}</option>)}</select>{branch?<section className="ba-panel"><div className="rank-list">{branchSeries.map((x,i)=><div key={x.date}><span>{String(i+1).padStart(2,"0")}</span><b>{x.date}</b><small>{branch}</small><strong>{fmt(x.total)}</strong></div>)}</div></section>:<Empty text="Choose a branch to inspect its trend."/>}</div>;
 if(tab==="fast-movers"||tab==="slow-movers"){const rows=[...movement].filter(r=>r.category!=="FOOD ITEMS").sort((a,b)=>tab==="fast-movers"?b.abs-a.abs:a.abs-b.abs).slice(0,50);return <div className="ba-stack"><PageHead eyebrow="INTELLIGENCE" title={tab==="fast-movers"?"Fast Movers":"Slow Movers"} text="DRY + MISC only, ranked by absolute movement between the first and last loaded dates."/>{rangeBar}<section className="ba-panel"><div className="rank-list">{rows.map((r,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><b>{r["Item Name"]}</b><small>{r.SKU} · {r.category}</small><strong>{fmt(r.abs)}</strong></div>)}</div></section></div>}
 if(tab==="date-comparison")return <div className="ba-stack"><PageHead eyebrow="ANALYSIS" title="Date Comparison" text="Network inventory total by loaded date."/>{rangeBar}<section className="ba-panel"><div className="rank-list">{dates.map((d,i)=><div key={d}><span>{String(i+1).padStart(2,"0")}</span><b>{d}</b><small>Daily + Weekly network quantity</small><strong>{fmt(dateTotal(d))}</strong></div>)}</div></section></div>;
 if(tab==="variance-analyzer")return <div className="ba-stack"><PageHead eyebrow="ANALYSIS" title="Variance Analyzer" text="Largest positive and negative first-to-last date changes."/>{rangeBar}<section className="ba-panel"><div className="rank-list">{[...movement].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,60).map((r,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span><b>{r["Item Name"]}</b><small>{r.SKU} · {r.start} → {r.end}</small><strong>{r.change>0?"+":""}{fmt(r.change)}</strong></div>)}</div></section></div>;
 if(tab==="date-range-reports")return <div className="ba-stack"><PageHead eyebrow="REPORTS" title="Date Range Reports" text="Audit the exact dates currently loaded for reporting."/>{rangeBar}<div className="ba-metrics"><Metric label="DATES" value={dates.length} detail={`${first||"—"} → ${last||"—"}`} Icon={CalendarDays}/><Metric label="BRANCHES" value={(historical.branches||[]).length} detail="included in range" Icon={Building2}/><Metric label="FAILED" value={(historical.failedBranches||[]).length} detail="branch reads" Icon={ShieldAlert}/></div></div>;
 return null;
}

function ComparisonWorkspace({tab,data}){
 const all=[...(data.daily||[]),...(data.weekly||[])];const branches=(data.branches||[]).map(b=>b.name);
 const [a,setA]=useState(branches[0]||""),[b,setB]=useState(branches[1]||"");
 const [skuA,setSkuA]=useState(all[0]?.SKU||""),[skuB,setSkuB]=useState(all[1]?.SKU||"");
 if(tab==="branch-comparison"){const qa=all.reduce((s,r)=>s+n(r[a]),0),qb=all.reduce((s,r)=>s+n(r[b]),0);return <div className="ba-stack"><PageHead eyebrow="ANALYSIS" title="Branch Comparison" text="Side-by-side selected-date branch totals and item coverage."/><div className="toolbar"><select value={a} onChange={e=>setA(e.target.value)}>{branches.map(x=><option key={x}>{x}</option>)}</select><select value={b} onChange={e=>setB(e.target.value)}>{branches.map(x=><option key={x}>{x}</option>)}</select></div><div className="ba-metrics"><Metric label={a||"BRANCH A"} value={fmt(qa)} detail={`${all.filter(r=>n(r[a])>0).length} active items`} Icon={Building2}/><Metric label={b||"BRANCH B"} value={fmt(qb)} detail={`${all.filter(r=>n(r[b])>0).length} active items`} Icon={Building2}/><Metric label="DIFFERENCE" value={fmt(qa-qb)} detail={`${a} minus ${b}`} Icon={GitCompareArrows}/></div></div>}
 if(tab==="item-comparison"){const ra=all.find(r=>r.SKU===skuA),rb=all.find(r=>r.SKU===skuB);return <div className="ba-stack"><PageHead eyebrow="ANALYSIS" title="Item Comparison" text="Compare two SKUs by network total and branch coverage."/><div className="toolbar"><select value={skuA} onChange={e=>setSkuA(e.target.value)}>{all.map((r,i)=><option key={`${r.SKU}-${i}`} value={r.SKU}>{r.SKU} · {r["Item Name"]}</option>)}</select><select value={skuB} onChange={e=>setSkuB(e.target.value)}>{all.map((r,i)=><option key={`${r.SKU}-${i}`} value={r.SKU}>{r.SKU} · {r["Item Name"]}</option>)}</select></div><div className="ba-metrics"><Metric label={skuA||"SKU A"} value={fmt(ra?.total)} detail={ra?.["Item Name"]||"—"} Icon={Boxes}/><Metric label={skuB||"SKU B"} value={fmt(rb?.total)} detail={rb?.["Item Name"]||"—"} Icon={Boxes}/><Metric label="TOTAL GAP" value={fmt(n(ra?.total)-n(rb?.total))} detail="A minus B" Icon={Layers3}/></div></div>}
 if(tab==="category-comparison"){const cats=["FOOD ITEMS","DRY ITEMS","MISC ITEMS","UNCATEGORIZED DETECTED"];return <div className="ba-stack"><PageHead eyebrow="ANALYSIS" title="Category Comparison" text="Selected-date quantity and item count by category."/><div className="category-cards">{cats.map(c=>{const rows=all.filter(r=>r.category===c);return <section className="ba-panel" key={c}><span className="eyebrow">{c}</span><h2>{fmt(rows.reduce((s,r)=>s+n(r.total),0))}</h2><p>{rows.length} items</p></section>})}</div></div>}
 return null;
}

function ManagementWorkspace({tab,data,managers,managerLoading,loadManagers}){
 const [selected,setSelected]=useState(""); const list=managers?.managers||[]; const mgr=list.find(x=>x.name===selected); const all=[...(data.daily||[]),...(data.weekly||[])];
 useEffect(()=>{if(!managers&&!managerLoading)loadManagers(false)},[managers,managerLoading]);
 if(managerLoading)return <TabLoader tab={tab}/>;
 if(!managers)return <Empty text="Manager mapping has not loaded."/>;
 if(tab==="area-managers")return <div className="ba-stack"><PageHead eyebrow="MANAGEMENT" title="Area Managers" text="Directly from the AreaManager / BranchName mapping sheet."/><div className="manager-grid">{list.map((m,i)=><section className="ba-panel" key={m.name}><span className="eyebrow">AREA MANAGER {String(i+1).padStart(2,"0")}</span><h3>{m.name}</h3><p>{m.branches.length} assigned branches</p><div className="chip-row">{m.branches.map(b=><span key={b}>{b}</span>)}</div></section>)}</div></div>;
 if(tab==="manager-branches")return <div className="ba-stack"><PageHead eyebrow="MANAGEMENT" title="Manager Branch View" text="Select a manager to aggregate only their mapped branches."/><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select manager…</option>{list.map(m=><option key={m.name}>{m.name}</option>)}</select>{mgr?<><div className="ba-metrics"><Metric label="MANAGER" value={mgr.name} detail="mapping sheet" Icon={UserRoundCog}/><Metric label="BRANCHES" value={mgr.branches.length} detail="assigned" Icon={Building2}/><Metric label="TOTAL QTY" value={fmt(all.reduce((s,r)=>s+mgr.branches.reduce((a,b)=>a+n(r[b]),0),0))} detail="selected-date mapped branches" Icon={Boxes}/></div><section className="ba-panel"><div className="rank-list">{mgr.branches.map((b,i)=><div key={b}><span>{String(i+1).padStart(2,"0")}</span><b>{b}</b><small>Mapped to {mgr.name}</small><strong>{fmt(all.reduce((s,r)=>s+n(r[b]),0))}</strong></div>)}</div></section></>:<Empty text="Choose an Area Manager."/>}</div>;
 if(tab==="area-comparison")return <div className="ba-stack"><PageHead eyebrow="MANAGEMENT" title="Area Comparison" text="Compare mapped management areas by selected-date aggregate quantity."/><section className="ba-panel"><div className="rank-list">{list.map((m,i)=>{const qty=all.reduce((s,r)=>s+m.branches.reduce((a,b)=>a+n(r[b]),0),0);return <div key={m.name}><span>{String(i+1).padStart(2,"0")}</span><b>{m.name}</b><small>{m.branches.length} branches</small><strong>{fmt(qty)}</strong></div>})}</div></section></div>;
 return null;
}

const REPORT_CATEGORIES=["FOOD ITEMS","DRY ITEMS","MISC ITEMS","UNCATEGORIZED DETECTED"];
const safeSheetName=v=>String(v||"Report").replace(/[\\/?*\[\]:]/g," ").slice(0,31);
const reportDateLabel=v=>String(v||"").replaceAll("-","/");
const cellBorder={top:{style:"thin",color:{rgb:"D9E2F0"}},bottom:{style:"thin",color:{rgb:"D9E2F0"}},left:{style:"thin",color:{rgb:"D9E2F0"}},right:{style:"thin",color:{rgb:"D9E2F0"}}};
const headerStyle={font:{bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"17365D"}},alignment:{horizontal:"center",vertical:"center",wrapText:true},border:cellBorder};
const subHeaderStyle={font:{bold:true,color:{rgb:"17365D"}},fill:{fgColor:{rgb:"DCE6F1"}},alignment:{horizontal:"center",vertical:"center",wrapText:true},border:cellBorder};
const titleStyle={font:{bold:true,color:{rgb:"FFFFFF"},sz:18},fill:{fgColor:{rgb:"0F243E"}},alignment:{horizontal:"left",vertical:"center"}};
const bodyStyle={alignment:{vertical:"center"},border:cellBorder};
const numberStyle={alignment:{horizontal:"right",vertical:"center"},border:cellBorder,numFmt:"0.00"};

function applyReportSheetStyle(ws,{titleRows=0,freeze="D2",autoFilter=true}={}){
  if(!ws["!ref"])return;
  const range=XLSX.utils.decode_range(ws["!ref"]);
  for(let r=0;r<=range.e.r;r++)for(let c=0;c<=range.e.c;c++){
    const addr=XLSX.utils.encode_cell({r,c}); const cell=ws[addr]; if(!cell)continue;
    if(r<titleRows) cell.s=titleStyle;
    else if(r===titleRows) cell.s=headerStyle;
    else cell.s=typeof cell.v==="number"?numberStyle:bodyStyle;
  }
  ws["!rows"]=[...Array(titleRows).fill({hpt:26}),{hpt:28}];
  ws["!freeze"]={xSplit:3,ySplit:titleRows+1,topLeftCell:freeze,activePane:"bottomRight",state:"frozen"};
  if(autoFilter)ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:titleRows,c:0},e:{r:range.e.r,c:range.e.c}})};
}

function makeInventorySheet(title,date,rows,branches){
  const head=["Item Name","SKU","UOM","Category",...branches,"Total"];
  const aoa=[[`${title} · ${reportDateLabel(date)}`],head,...rows.map(r=>[r["Item Name"]||r.itemName||"",r.SKU||r.sku||"",r.UOM||r.uom||"",r.category||"",...branches.map(b=>n(r[b]??r.branches?.[b])),n(r.Total??r.total)])];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:head.length-1}}];
  ws["!cols"]=[{wch:42},{wch:14},{wch:12},{wch:24},...branches.map(()=>({wch:15})),{wch:15}];
  applyReportSheetStyle(ws,{titleRows:1,freeze:"E3"});
  return ws;
}

function downloadWorkbook(wb,fileName){XLSX.writeFile(wb,fileName,{compression:true,bookType:"xlsx"});}

function buildLiveWorkbook(data){
  const branches=(data.branches||[]).map(b=>b.name); const daily=data.daily||[], weekly=data.weekly||[]; const all=[...daily,...weekly];
  const wb=XLSX.utils.book_new();
  const summary=[
    ["BART INVENTORY REPORT"],["Report Date",data.date||""],["Generated",new Date().toLocaleString()],[],
    ["Metric","Value"],["Branches",branches.length],["Daily Items",daily.length],["Weekly Items",weekly.length],["Total Item Records",all.length],["Network Quantity",all.reduce((a,r)=>a+n(r.Total??r.total),0)],["Failed Branches",(data.failedBranches||[]).length],[],
    ["Category","Items","Network Quantity"],...REPORT_CATEGORIES.map(c=>{const rows=all.filter(r=>r.category===c);return[c,rows.length,rows.reduce((a,r)=>a+n(r.Total??r.total),0)]})
  ];
  const sws=XLSX.utils.aoa_to_sheet(summary); sws["!cols"]=[{wch:34},{wch:24},{wch:24}]; sws["A1"].s=titleStyle; sws["A5"].s=headerStyle; sws["B5"].s=headerStyle; [13].forEach(rr=>{for(let c=0;c<3;c++){const a=XLSX.utils.encode_cell({r:rr-1,c});if(sws[a])sws[a].s=headerStyle}}); XLSX.utils.book_append_sheet(wb,sws,"Dashboard Summary");
  XLSX.utils.book_append_sheet(wb,makeInventorySheet("DAILY INVENTORY",data.date,daily,branches),"Daily");
  XLSX.utils.book_append_sheet(wb,makeInventorySheet("WEEKLY INVENTORY",data.date,weekly,branches),"Weekly");
  REPORT_CATEGORIES.forEach(c=>{const rows=all.filter(r=>r.category===c);if(rows.length)XLSX.utils.book_append_sheet(wb,makeInventorySheet(c,data.date,rows,branches),safeSheetName(c));});
  return wb;
}

function flattenRange(historical,mode){
  const branches=(historical.branches||[]).map(b=>b.name); const out=[];
  for(const date of historical.dates||[]){
    const bucket=historical.byDate?.[date]||{}; const modes=mode?[mode]:["daily","weekly"];
    for(const m of modes)for(const r of bucket[m]||[])out.push({date,mode:m==="daily"?"Daily":"Weekly",...r});
  }
  return {rows:out,branches};
}
function makeRangeSheet(title,rows,branches){
  const head=["Date","Type","Item Name","SKU","UOM","Category",...branches,"Total"];
  const aoa=[[title],head,...rows.map(r=>[r.date,r.mode,r["Item Name"]||r.itemName||"",r.SKU||r.sku||"",r.UOM||r.uom||"",r.category||"",...branches.map(b=>n(r[b]??r.branches?.[b])),n(r.Total??r.total)])];
  const ws=XLSX.utils.aoa_to_sheet(aoa); ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:head.length-1}}]; ws["!cols"]=[{wch:13},{wch:10},{wch:42},{wch:14},{wch:12},{wch:24},...branches.map(()=>({wch:15})),{wch:15}]; applyReportSheetStyle(ws,{titleRows:1,freeze:"G3"}); return ws;
}
function buildRangeWorkbook(historical,selectedSkus=[]){
  const daily=flattenRange(historical,"daily"), weekly=flattenRange(historical,"weekly"), combined=flattenRange(historical); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,makeRangeSheet(`DAILY · ${historical.startDate} → ${historical.endDate}`,daily.rows,daily.branches),"Daily");
  XLSX.utils.book_append_sheet(wb,makeRangeSheet(`WEEKLY · ${historical.startDate} → ${historical.endDate}`,weekly.rows,weekly.branches),"Weekly");
  XLSX.utils.book_append_sheet(wb,makeRangeSheet(`COMBINED · ${historical.startDate} → ${historical.endDate}`,combined.rows,combined.branches),"Combined");
  const chosen=new Set(selectedSkus); const fast=chosen.size?combined.rows.filter(r=>chosen.has(r.SKU||r.sku)):[];
  const fws=makeRangeSheet(`FAST MOVING SELECTION · ${historical.startDate} → ${historical.endDate}`,fast,combined.branches); XLSX.utils.book_append_sheet(wb,fws,"Fast Moving");
  return wb;
}

function ReportsWorkspace({tab,data}){
 const all=[...(data.daily||[]),...(data.weekly||[])],branches=(data.branches||[]).map(b=>b.name);
 const d=new Date();d.setDate(d.getDate()-7);const defaultStart=d.toISOString().slice(0,10);
 const [range,setRange]=useState({start:defaultStart,end:data.date||new Date().toISOString().slice(0,10)});
 const [rangeData,setRangeData]=useState(null),[busy,setBusy]=useState(false),[reportError,setReportError]=useState("");
 const [skuSearch,setSkuSearch]=useState(""),[selectedSkus,setSelectedSkus]=useState([]);
 const skuOptions=useMemo(()=>{const m=new Map();all.forEach(r=>{const sku=String(r.SKU||"").trim();if(sku&&!m.has(sku))m.set(sku,{sku,name:r["Item Name"]||"",uom:r.UOM||""})});return [...m.values()].sort((a,b)=>a.sku.localeCompare(b.sku))},[data]);
 const visibleSkus=skuOptions.filter(x=>`${x.sku} ${x.name} ${x.uom}`.toLowerCase().includes(skuSearch.toLowerCase())).slice(0,40);
 const exportCsv=()=>{const head=["SKU","Item Name","UOM","Category",...branches,"Total"];const lines=[head,...all.map(r=>[r.SKU,r["Item Name"],r.UOM,r.category,...branches.map(b=>r[b]),r.total])].map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));const blob=new Blob([lines.join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`BART_Admin_${data.date||"inventory"}.csv`;a.click();URL.revokeObjectURL(a.href)};
 const liveExcel=()=>downloadWorkbook(buildLiveWorkbook(data),`BART_Report_${data.date}.xlsx`);
 async function loadRangeAndDownload(){
   if(!range.start||!range.end)return; setBusy(true);setReportError("");
   try{const r=await fetch(`/api/admin/bart/date-range?start=${range.start}&end=${range.end}`);const j=await r.json();if(!r.ok||j.success===false)throw new Error(j.error||j.message||`HTTP ${r.status}`);setRangeData(j);downloadWorkbook(buildRangeWorkbook(j,selectedSkus),`BART_Stock_Movement_${range.start}_${range.end}.xlsx`)}catch(e){setReportError(e.message||"Unable to generate date-range report")}finally{setBusy(false)}
 }
 function toggleSku(sku){setSelectedSkus(x=>x.includes(sku)?x.filter(v=>v!==sku):[...x,sku])}
 if(tab==="report-studio")return <div className="ba-stack"><PageHead eyebrow="TOP PRIORITY / REPORTS" title="BART Download Center" text="Generate the same operational Excel reports from the Admin portal — without changing Staff operations or Google Sheets."/><section className="download-hero"><div><span className="eyebrow">LIVE PROFESSIONAL REPORT</span><h2>{data.date}</h2><p>Dashboard Summary + Daily + Weekly + category worksheets in one formatted Excel workbook.</p><div className="download-tags"><span>{branches.length} branches</span><span>{data.daily?.length||0} daily items</span><span>{data.weekly?.length||0} weekly items</span></div></div><button className="download-main" onClick={liveExcel}><FileSpreadsheet/><span><b>Generate LIVE Excel</b><small>BART_Report_{data.date}.xlsx</small></span><Download/></button></section><section className="ba-panel report-range-card"><header><div><span className="eyebrow">STOCK MOVEMENT</span><h3>Date Range Excel Report</h3></div></header><div className="report-range-grid"><label><span>FROM DATE</span><input type="date" value={range.start} onChange={e=>setRange(x=>({...x,start:e.target.value}))}/></label><label><span>TO DATE</span><input type="date" value={range.end} onChange={e=>setRange(x=>({...x,end:e.target.value}))}/></label></div><div className="sku-picker"><div className="searchbox"><Search/><input value={skuSearch} onChange={e=>setSkuSearch(e.target.value)} placeholder="Search SKU or item for Fast Moving sheet…"/></div>{skuSearch&&<div className="sku-results">{visibleSkus.map(x=><button key={x.sku} className={selectedSkus.includes(x.sku)?"selected":""} onClick={()=>toggleSku(x.sku)}><b>{x.sku}</b><span>{x.name}</span><small>{x.uom}</small></button>)}</div>}<div className="selected-skus">{selectedSkus.map(sku=><button key={sku} onClick={()=>toggleSku(sku)}>{sku} ×</button>)}</div></div>{reportError&&<div className="report-error"><AlertTriangle/>{reportError}</div>}<button className="download-range" disabled={busy||!range.start||!range.end} onClick={loadRangeAndDownload}>{busy?<LoaderCircle className="spin"/>:<FileChartColumn/>}<span><b>{busy?"Building workbook…":"Generate Date Range Excel"}</b><small>Daily · Weekly · Combined · Fast Moving</small></span><Download/></button>{rangeData&&<div className="report-ready"><ClipboardCheck/>Last report loaded {rangeData.dates?.length||0} dates across {rangeData.branches?.length||0} branches.</div>}</section></div>;
 if(tab==="executive-report")return <div className="ba-stack"><PageHead eyebrow="REPORTS" title="Executive Report" text="Compact management summary of the selected-date snapshot."/><div className="ba-metrics"><Metric label="NETWORK QTY" value={fmt(all.reduce((s,r)=>s+n(r.total),0))} detail="daily + weekly" Icon={Boxes}/><Metric label="FAILED BRANCHES" value={(data.failedBranches||[]).length} detail="data pipeline" Icon={ShieldAlert}/><Metric label="UNCATEGORIZED" value={all.filter(r=>r.category==="UNCATEGORIZED DETECTED").length} detail="classification" Icon={Tags}/></div><button className="primary-action" onClick={liveExcel}><Download/> Download Professional Excel</button></div>;
 if(tab==="custom-export")return <div className="ba-stack"><PageHead eyebrow="REPORTS" title="Custom Export" text="Raw current snapshot export for ad-hoc analysis."/><div className="notice"><FileSpreadsheet/><div><b>CSV includes identity, category, every branch and total.</b><span>The professional Excel report remains available in Download Center.</span></div></div><button className="primary-action" onClick={exportCsv}><Download/> Download CSV</button></div>;
 if(tab==="report-history")return <div className="ba-stack"><PageHead eyebrow="REPORTS" title="Report History" text="Generated files download directly to the Admin device; they are not persisted by the current backend."/><div className="notice"><History/><div><b>No fake report history is stored.</b><span>Use Download Center whenever a fresh workbook is required.</span></div></div></div>;
 return null;
}

function Empty({text}){return <div className="empty"><PackageSearch/><b>{text}</b></div>}

function BranchWorkspace({branch,data,onBack}){const status=(data.failedBranches||[]).find(x=>(x.name||x.branch)===branch.name||x.code===branch.code);const daily=(data.daily||[]).filter(r=>r[branch.name]!==undefined);const weekly=(data.weekly||[]).filter(r=>r[branch.name]!==undefined);return <div className="branch-workspace"><button className="backline" onClick={onBack}><ArrowLeft/> BART / BRANCHES</button><section className="branch-hero"><div><span className="eyebrow">BRANCH WORKSPACE</span><h1>{branch.name}</h1><p>{branch.code} · Selected inventory snapshot</p></div><div className="branch-health"><i/> {status?"FETCH FAILED":"DATA CONNECTED"}</div></section><div className="ba-metrics"><Metric label="DAILY RECORDS" value={daily.length} detail="available item rows" Icon={ClipboardCheck}/><Metric label="WEEKLY RECORDS" value={weekly.length} detail="available item rows" Icon={CalendarDays}/><Metric label="DAILY QTY" value={fmt(daily.reduce((a,r)=>a+n(r[branch.name]),0))} detail="branch snapshot" Icon={Boxes}/><Metric label="WEEKLY QTY" value={fmt(weekly.reduce((a,r)=>a+n(r[branch.name]),0))} detail="branch snapshot" Icon={Warehouse}/></div><section className="ba-panel"><header><div><span className="eyebrow">BRANCH INVENTORY</span><h3>Complete loaded stock</h3></div></header><div className="branch-items">{[...daily,...weekly].map((r,i)=><div key={i}><b>{r["Item Name"]}</b><span>{r.SKU||"—"} · {r.UOM}</span><strong>{fmt(r[branch.name])}</strong></div>)}</div></section></div>}

export default function BartAdminPortal({onBack}){
 const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)};
 const weekAgo=()=>{const d=new Date();d.setDate(d.getDate()-8);return d.toISOString().slice(0,10)};
 const [tab,setTab]=useState("command-center"),[openGroup,setOpenGroup]=useState("command"),[date,setDate]=useState(yesterday),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[branch,setBranch]=useState(null),[navOpen,setNavOpen]=useState(false);
 const [managers,setManagers]=useState(null),[managerLoading,setManagerLoading]=useState(false);
 const [historical,setHistorical]=useState(null),[historicalLoading,setHistoricalLoading]=useState(false),[range,setRange]=useState({start:weekAgo(),end:yesterday()});
 async function getJson(url,opts){const r=await fetch(url,opts);const j=await r.json();if(!r.ok||j.success===false)throw new Error(j.error||j.message||`HTTP ${r.status}`);return j}
 async function load(force=false){setLoading(true);setError("");try{setData(await getJson(`/api/admin/bart/inventory?date=${date}${force?"&force=1":""}`))}catch(e){setError(e.message||"Unable to load Admin inventory")}finally{setTimeout(()=>setLoading(false),420)}}
 async function loadManagers(force=false){setManagerLoading(true);try{setManagers(await getJson(`/api/admin/bart/manager-mapping${force?"?force=1":""}`))}catch(e){setError(e.message)}finally{setManagerLoading(false)}}
 async function loadHistorical(force=false){if(!range.start||!range.end)return;setHistoricalLoading(true);try{setHistorical(await getJson(`/api/admin/bart/date-range?start=${range.start}&end=${range.end}${force?"&force=1":""}`))}catch(e){setError(e.message)}finally{setHistoricalLoading(false)}}
 useEffect(()=>{load(false)},[date]);
 const historicalTabs=new Set(["stock-movement","item-history","branch-trends","fast-movers","slow-movers","date-comparison","variance-analyzer","date-range-reports"]);
 useEffect(()=>{if(historicalTabs.has(tab)&&!historical&&!historicalLoading)loadHistorical(false)},[tab]);
 function choose(id,g){setTab(id);setOpenGroup(g);setBranch(null);setNavOpen(false)}
 const meta=ALL_TABS.find(x=>x.id===tab); let body=null;
 if(data){
   const special=<SnapshotSpecial tab={tab} data={data} setTab={setTab}/>;
   const compare=<ComparisonWorkspace tab={tab} data={data}/>;
   const manage=<ManagementWorkspace tab={tab} data={data} managers={managers} managerLoading={managerLoading} loadManagers={loadManagers}/>;
   const reports=<ReportsWorkspace tab={tab} data={data}/>;
   const historicalBody=<HistoricalWorkspace tab={tab} data={data} historical={historical} historicalLoading={historicalLoading} range={range} setRange={setRange} loadHistorical={loadHistorical}/>;
   if(tab==="command-center")body=<CommandCenter data={data} date={date} setTab={setTab}/>;
   else if(tab==="branch-network")body=<BranchNetwork data={data} onBranch={setBranch}/>;
   else if(tab==="inventory-matrix")body=<InventoryView data={data}/>;
   else if(tab==="daily-inventory")body=<InventoryView data={data} mode="daily"/>;
   else if(tab==="weekly-inventory")body=<InventoryView data={data} mode="weekly"/>;
   else if(tab==="global-search")body=<SearchView data={data}/>;
   else if(tab==="sku-explorer")body=<SkuExplorer data={data}/>;
   else if(tab==="exception-center")body=<Exceptions data={data}/>;
   else if(tab==="zero-stock")body=<Exceptions data={data} type="zero"/>;
   else if(tab==="uncategorized")body=<Exceptions data={data} type="unc"/>;
   else if(tab==="data-health")body=<DataHealth data={data}/>;
   else if(special)body=special;
   else if(historicalTabs.has(tab))body=historicalBody;
   else if(compare)body=compare;
   else if(["area-managers","manager-branches","area-comparison"].includes(tab))body=manage;
   else if(["report-studio","executive-report","custom-export","report-history"].includes(tab))body=reports;
   else body=<div className="ba-stack"><PageHead eyebrow={meta?.group?.toUpperCase()} title={meta?.label} text="This workspace is intentionally distinct and will only display data supported by its source."/><Empty text="No unsupported or duplicated analytics are shown here."/></div>;
 }
 return <div className="bart-admin"><aside className={navOpen?"open":""}><div className="admin-brand"><div className="brand-mark">B</div><div><b>BART</b><span>ADMIN COMMAND</span></div></div><nav>{GROUPS.map(g=><div className="nav-group" key={g.id}><button className="group-title" onClick={()=>setOpenGroup(openGroup===g.id?"":g.id)}><span>{g.label}</span><small>{g.tabs.length}</small></button><AnimatePresence initial={false}>{openGroup===g.id&&<motion.div className="group-tabs" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}>{g.tabs.map(([id,label,Icon])=><button key={id} className={tab===id?"active":""} onClick={()=>choose(id,g.id)}><Icon size={16}/><span>{label}</span></button>)}</motion.div>}</AnimatePresence></div>)}</nav><button className="all-brands" onClick={onBack}><ArrowLeft/> ALL BRANDS</button></aside>
 <main><header className="admin-top"><button className="mobile-nav" onClick={()=>setNavOpen(!navOpen)}><Command/></button><div className="crumb"><span>DAM UNITED / BART</span><b>{meta?.label||"Command Center"}</b></div><div className="top-actions"><button className="top-download" onClick={()=>choose("report-studio","reports")}><Download/> Download Center</button><label><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={()=>load(true)} disabled={loading}><RefreshCcw className={loading?"spin":""}/> Refresh</button></div></header><div className="admin-content">{branch&&data?<BranchWorkspace branch={branch} data={data} onBack={()=>setBranch(null)}/>:error?<div className="fatal"><AlertTriangle/><h2>Admin data unavailable</h2><p>{error}</p><button onClick={()=>{setError("");load(true)}}>Retry connection</button></div>:<AnimatePresence mode="wait">{loading?<motion.div key={`load-${tab}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><TabLoader tab={tab}/></motion.div>:<motion.div key={tab} initial={{opacity:0,y:18,filter:"blur(8px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,y:-8}} transition={{duration:.35}}>{body}</motion.div>}</AnimatePresence>}</div></main></div>
}
