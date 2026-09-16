import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Coffee, Crown, IceCreamBowl, Radio, ShieldCheck, Sparkles } from "lucide-react";
import "./BartAdminPortal.css";

const BRANDS = [
  { id:"bart", code:"B", name:"BART", count:"31", Icon:Coffee, tone:"coral", line:"Coffee operations at network scale.", status:"ADMIN DATA READY" },
  { id:"mooma", code:"M", name:"MOOMA", count:"02", Icon:IceCreamBowl, tone:"pink", line:"Creative retail operations, isolated by brand.", status:"CONNECT ADMIN DATA" },
  { id:"glor", code:"G", name:"GLOR", count:"05", Icon:Crown, tone:"gold", line:"Premium service operations and control.", status:"CONNECT ADMIN DATA" },
];

export default function AdminBrandGateway({ onBack, onSelect }) {
  return <div className="ag-root">
    <div className="ag-aurora a"/><div className="ag-aurora b"/><div className="ag-aurora c"/><div className="ag-grid"/><div className="ag-stars"/>
    <header className="ag-top"><button onClick={onBack}><ArrowLeft/> EXIT ADMIN</button><div className="ag-sec"><ShieldCheck/> DAM ADMIN NETWORK <i/></div></header>
    <main className="ag-main">
      <motion.div className="ag-copy" initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} transition={{duration:.65}}>
        <span><Sparkles/> EXECUTIVE OPERATIONS GATEWAY</span>
        <h1>Choose an <em>operational universe.</em></h1>
        <p>Each brand is isolated, live and built as its own command environment.</p>
      </motion.div>
      <div className="ag-brands">
        {BRANDS.map((b,i)=><motion.button key={b.id} className={`ag-brand ${b.tone}`} onClick={()=>onSelect(b)} initial={{opacity:0,y:50,scale:.96}} animate={{opacity:1,y:0,scale:1}} transition={{delay:.16+i*.1,type:"spring",stiffness:110}} whileHover={{y:-12,scale:1.012}}>
          <div className="ag-card-glow"/><div className="ag-orbit"><i/><i/><i/></div>
          <div className="ag-brand-top"><span>0{i+1}</span><div><Radio/> {b.status}</div></div>
          <div className="ag-letter">{b.code}</div>
          <div className="ag-brand-body"><b>{b.name}</b><p>{b.line}</p></div>
          <div className="ag-brand-foot"><span><strong>{b.count}</strong> BRANCHES</span><div>ENTER COMMAND <ArrowUpRight/></div></div>
        </motion.button>)}
      </div>
      <div className="ag-footnote"><i/> SYSTEM THEME ADAPTIVE · LIVE GOOGLE OPERATIONS · SECURE ADMIN SESSION</div>
    </main>
  </div>
}
