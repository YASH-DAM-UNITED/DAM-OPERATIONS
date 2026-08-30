import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, MapPin, RefreshCcw, Search, Sparkles } from "lucide-react";
import { activeScroll, moomaFetch } from "./moomaApi.js";
import MoomaDashboard from "./MoomaDashboard.jsx";
import MoomaLoading from "./MoomaLoading.jsx";
import "./MoomaPortal.css";

export default function MoomaPortal({ onBack }) {
  const [branches,setBranches]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [search,setSearch]=useState(""), [selected,setSelected]=useState(null), [authenticated,setAuthenticated]=useState(null);
  const [password,setPassword]=useState(""), [showPassword,setShowPassword]=useState(false), [loginBusy,setLoginBusy]=useState(false), [loginError,setLoginError]=useState("");
  const readyRef=useRef(null), errorRef=useRef(null);

  async function loadBranches(){ try{setLoading(true);setError("");const r=await moomaFetch("/api/mooma/branches");setBranches(r.branches||[])}catch(e){setError(e.message);setTimeout(()=>activeScroll(errorRef),30)}finally{setLoading(false)} }
  useEffect(()=>{loadBranches()},[]);
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return q?branches.filter(b=>`${b.code} ${b.name}`.toLowerCase().includes(q)):branches},[branches,search]);
  function choose(branch){setSelected(branch);setPassword("");setLoginError("");setTimeout(()=>activeScroll(readyRef),40)}
  async function authenticate(){if(!selected||!password.trim()||loginBusy)return;try{setLoginBusy(true);setLoginError("");const r=await moomaFetch("/api/mooma/login",{method:"POST",body:JSON.stringify({branchCode:selected.code,password})});setAuthenticated(r.branch)}catch(e){setLoginError(e.message);activeScroll(readyRef)}finally{setLoginBusy(false)}}
  if(authenticated) return <MoomaDashboard branch={authenticated} onBack={()=>{setAuthenticated(null);setPassword("")}} onLogout={()=>{setAuthenticated(null);setSelected(null);setPassword("");onBack?.()}}/>;

  return <motion.div className="mooma-portal" initial={{opacity:0,filter:"blur(12px)",scale:1.01}} animate={{opacity:1,filter:"blur(0px)",scale:1}} transition={{duration:.65,ease:[.22,1,.36,1]}}>
    <div className="mooma-portal-grid"/><div className="mooma-portal-glow a"/><div className="mooma-portal-glow b"/>
    <header className="mooma-portal-nav"><button onClick={onBack}><ArrowLeft size={16}/> ALL BRANDS</button><div className="mooma-portal-brand"><div>M</div><span><strong>MOOMA</strong><small>STAFF OPERATIONS</small></span></div><div className="mooma-live"><i/> LIVE NETWORK</div></header>
    <main className="mooma-portal-main">
      <motion.section className="mooma-portal-hero" initial={{opacity:0,y:26}} animate={{opacity:1,y:0}} transition={{delay:.12}}><div><span className="eyebrow"><Sparkles size={13}/> MOOMA / BRANCH ACCESS</span><h1>Choose your <em>branch.</em></h1><p>Same DAM operational flow, built for MOOMA.</p></div><div className="mooma-count"><small>LIVE DIRECTORY</small><strong>{loading?"…":branches.length}</strong><span>MOOMA LOCATIONS</span></div></motion.section>
      <section className="mooma-portal-panel"><div className="mooma-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search branch code or name"/><span>{filtered.length} LOCATIONS</span></div>
        {loading?<MoomaLoading label="CONNECTING BRANCH NETWORK" compact/>:error?<div ref={errorRef} className="mooma-portal-error"><AlertCircle/><strong>CONNECTION FAILED</strong><p>{error}</p><button onClick={loadBranches}><RefreshCcw size={14}/> RETRY</button></div>:<>
          <div className="mooma-branch-grid">{filtered.map((b,i)=><motion.button key={b.code} className={`mooma-branch-row ${selected?.code===b.code?"active":""}`} onClick={()=>choose(b)} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:Math.min(.03*i,.3)}} whileTap={{scale:.99}}><span>{String(i+1).padStart(2,"0")}</span><div className="pin"><MapPin size={17}/></div><div><strong>{b.name}</strong><small>{b.code}</small></div><ArrowRight size={17}/></motion.button>)}</div>
          <AnimatePresence>{selected&&<motion.div ref={readyRef} className="mooma-ready" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0}}><div className="ready-copy"><small>READY TO ENTER</small><strong>{selected.code} • {selected.name}</strong></div><div className="mooma-login-box"><LockKeyhole size={16}/><input autoFocus type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&authenticate()} placeholder="Branch password"/><button className="eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button><button className="continue" onClick={authenticate} disabled={loginBusy||!password.trim()}>{loginBusy?<LoaderCircle className="dam-spin" size={15}/>:<>CONTINUE <ArrowRight size={15}/></>}</button></div>{loginError&&<div className="login-error"><AlertCircle size={13}/>{loginError}</div>}</motion.div>}</AnimatePresence>
        </>}
      </section>
    </main><div className="mooma-portal-word">MOOMA</div>
  </motion.div>
}
