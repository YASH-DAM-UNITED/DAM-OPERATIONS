import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Eye, LogOut, MoveRight, PackageCheck } from "lucide-react";
import MoomaStockRecord from "./MoomaStockRecord.jsx";
import MoomaStockView from "./MoomaStockView.jsx";
import MoomaStockTransfer from "./MoomaStockTransfer.jsx";
import MoomaStaffSchedule from "./MoomaStaffSchedule.jsx";
import "./MoomaDashboard.css";

const modules = [
  ["stock-record", "Stock Record", "Daily, weekly & bakery entry", PackageCheck],
  ["stock-view", "Stock View", "Live branch stock overview", Eye],
  ["stock-transfer", "Stock Transfer", "Move stock between MOOMA branches", MoveRight],
  ["schedule", "Staff Schedule", "Weekly shifts, OT & team movement", CalendarDays],
];

export default function MoomaDashboard({ branch, onBack, onLogout }) {
  const [active, setActive] = useState(null);
  if (active === "stock-record") return <MoomaStockRecord branch={branch} onBack={() => setActive(null)} />;
  if (active === "stock-view") return <MoomaStockView branch={branch} onBack={() => setActive(null)} />;
  if (active === "stock-transfer") return <MoomaStockTransfer branch={branch} onBack={() => setActive(null)} />;
  if (active === "schedule") return <MoomaStaffSchedule branch={branch} onBack={() => setActive(null)} />;

  return <div className="md-page">
    <header className="md-header">
      <button className="md-ghost" onClick={onBack}><ArrowLeft size={16}/> CHANGE BRANCH</button>
      <div className="md-brand"><span>M</span><div><b>MOOMA</b><small>OPERATIONS NETWORK</small></div></div>
      <button className="md-ghost" onClick={onLogout || onBack}><LogOut size={16}/> EXIT</button>
    </header>
    <main className="md-main">
      <section className="md-hero"><div><small>MOOMA / BRANCH OPERATIONS</small><h1>{branch?.name}</h1><p>{branch?.code} · Choose an operation to continue.</p></div><div className="md-live"><i/> SYSTEM ONLINE</div></section>
      <section className="md-grid">{modules.map(([id,title,sub,Icon],i)=><motion.button key={id} className="md-card" onClick={()=>setActive(id)} initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} transition={{delay:.06*i}} whileHover={{y:-6,scale:1.015}}><Icon size={24}/><small>0{i+1}</small><h2>{title}</h2><p>{sub}</p><span>OPEN MODULE <MoveRight size={15}/></span></motion.button>)}</section>
    </main>
    <div className="md-word">MOOMA</div>
  </div>;
}
