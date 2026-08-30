import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Boxes, RefreshCcw, Search, Sparkles } from "lucide-react";
import { activeScroll, moomaFetch } from "./moomaApi.js";
import MoomaLoading from "./MoomaLoading.jsx";

export default function MoomaStockView({branch,onBack}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[tab,setTab]=useState("daily"),[search,setSearch]=useState("");const tableRef=useRef(null);
 async function load(force=false){try{setLoading(true);setError("");const r=await moomaFetch(`/api/mooma/stock-view?branch=${encodeURIComponent(branch.code)}${force?"&refresh=1":""}`);setData(r.stock||r.data||{})}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load(false)},[branch?.code]);useEffect(()=>{if(data)activeScroll(tableRef,"start")},[tab]);
 const rows=useMemo(()=>{const a=data?.[tab]||[],q=search.trim().toLowerCase();return q?a.filter(x=>JSON.stringify(x).toLowerCase().includes(q)):a},[data,tab,search]);const cols=rows[0]?Object.keys(rows[0]):[];
 if(loading&&!data)return <div className="mooma-stock-view"><MoomaLoading label="LOADING STOCK VIEW"/></div>;
 return <motion.div className="mooma-stock-view" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}><header className="msv-header"><button onClick={onBack}><ArrowLeft size={15}/> DASHBOARD</button><div><Boxes size={17}/><strong>MOOMA</strong><small>STOCK VIEW</small></div><span>{branch.code} · {branch.name}</span></header><main className="msv-main"><div className="msv-hero"><span><Sparkles size={13}/> BRANCH INVENTORY</span><h1>Stock <em>visibility.</em></h1><p>Same BART stock table experience with MOOMA identity.</p></div>{error&&<div className="msv-error">{error}</div>}<section className="msv-panel"><div className="msv-toolbar"><div className="msv-tabs"><button className={tab==="daily"?"active":""} onClick={()=>setTab("daily")}>DAILY</button><button className={tab==="weekly"?"active":""} onClick={()=>setTab("weekly")}>WEEKLY</button></div><div className="msv-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item, SKU or UOM"/></div><button onClick={()=>load(true)}><RefreshCcw size={14}/> REFRESH GOOGLE</button></div><div ref={tableRef} className="msv-table-wrap"><table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c}>{String(r[c]??"")}</td>)}</tr>)}</tbody></table>{!rows.length&&<div className="msv-empty">No {tab} stock rows found.</div>}</div></section></main></motion.div>
}
