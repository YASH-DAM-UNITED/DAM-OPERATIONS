import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Building2, Coffee,
  Moon, ShieldCheck, Sparkles, Sun
} from "lucide-react";
import "./BartAdminPortal.css";

const BRANDS=[
  {id:"bart",name:"BART",code:"01",count:"31 BRANCHES",tag:"COFFEE OPERATIONS",status:"ADMIN DATA READY",Icon:Coffee,copy:"Inventory intelligence, branch operations and professional reporting."},
  {id:"mooma",name:"MOOMA",code:"02",count:"2 BRANCHES",tag:"CREATIVE OPERATIONS",status:"ADMIN SPACE",Icon:Sparkles,copy:"Dedicated MOOMA command environment, isolated from BART operations."},
  {id:"glor",name:"GLOR",code:"03",count:"BRANCH NETWORK",tag:"PREMIUM OPERATIONS",status:"ADMIN SPACE",Icon:Building2,copy:"GLOR operations and reporting in its own protected environment."},
];

export default function AdminBrandGateway({onBack,onSelect}){
  const [active,setActive]=useState(0);
  const [entering,setEntering]=useState(null);
  const [theme,setTheme]=useState(()=>localStorage.getItem("bart-admin-theme")||"dark");

  useEffect(()=>{
    document.documentElement.setAttribute("data-bart-admin-theme",theme);
    localStorage.setItem("bart-admin-theme",theme);
  },[theme]);

  const move=(dir)=>setActive(i=>(i+dir+BRANDS.length)%BRANDS.length);
  const brand=BRANDS[active];

  const selectBrand=(b)=>{
    setEntering(b.id);
    window.setTimeout(()=>onSelect(b),650);
  };

  return <div className={`admin-gateway gateway-${brand.id}`}>
    <div className="gateway-orb orb-a"/><div className="gateway-orb orb-b"/><div className="gateway-grid"/>
    <header>
      <button onClick={onBack}><ArrowLeft/> PORTALS</button>
      <div className="gateway-lock"><ShieldCheck/><span>DAM UNITED</span><b>ADMIN OPERATIONS</b></div>
      <button className="gateway-theme" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>
        {theme==="dark"?<Sun/>:<Moon/>}{theme==="dark"?"LIGHT":"NIGHT"}
      </button>
    </header>

    <motion.section className="gateway-title" initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} transition={{type:"spring",stiffness:120,damping:18}}>
      <span>OPERATING BRANDS</span>
      <h1>Choose your <em>command environment.</em></h1>
      <p>Swipe, drag or use the arrows. Every brand stays operationally isolated.</p>
    </motion.section>

    <section className="brand-carousel">
      <button className="carousel-arrow left" onClick={()=>move(-1)}><ArrowLeft/></button>
      <div className="carousel-stage">
        {BRANDS.map((b,i)=>{
          let delta=i-active;
          if(delta>1)delta-=BRANDS.length;
          if(delta<-1)delta+=BRANDS.length;
          const isActive=delta===0;
          return <motion.button
            key={b.id}
            className={`carousel-brand ${isActive?"active":""} ${entering===b.id?"entering":""}`}
            animate={{
              x:delta*360,
              scale:isActive?1:0.82,
              rotateY:delta*18,
              opacity:isActive?1:0.48,
              zIndex:isActive?5:2
            }}
            transition={{type:"spring",stiffness:180,damping:22}}
            drag={isActive?"x":false}
            dragConstraints={{left:0,right:0}}
            onDragEnd={(_,info)=>{if(info.offset.x<-70)move(1);else if(info.offset.x>70)move(-1)}}
            onClick={()=>isActive?selectBrand(b):setActive(i)}
            whileHover={isActive?{y:-10}:{opacity:.72}}
            whileTap={isActive?{scale:.97}:{}}
          >
            <div className="brand-top"><span>{b.code}</span><b>{b.status}</b></div>
            <b.Icon className="gateway-icon"/>
            <div className="brand-copy"><small>{b.tag}</small><h2>{b.name}</h2><p>{b.count}</p><em>{b.copy}</em></div>
            <div className="enter">{isActive?"ENTER COMMAND":"BRING TO FRONT"} <ArrowUpRight/></div>
          </motion.button>
        })}
      </div>
      <button className="carousel-arrow right" onClick={()=>move(1)}><ArrowRight/></button>
    </section>

    <div className="carousel-dots">{BRANDS.map((b,i)=><button key={b.id} className={i===active?"active":""} onClick={()=>setActive(i)} aria-label={b.name}/>)}</div>

    <AnimatePresence>{entering&&<motion.div className="gateway-transition" initial={{scale:0,opacity:0}} animate={{scale:3,opacity:1}} exit={{opacity:0}} transition={{duration:.65,ease:[.22,1,.36,1]}}/>}</AnimatePresence>
  </div>
}
