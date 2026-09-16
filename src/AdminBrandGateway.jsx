import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Coffee, ShieldCheck, Sparkles } from "lucide-react";
import "./BartAdminPortal.css";

const brands=[
 {id:"bart",name:"BART",code:"01",count:"31 BRANCHES",tag:"COFFEE OPERATIONS",status:"ADMIN DATA READY",Icon:Coffee},
 {id:"mooma",name:"MOOMA",code:"02",count:"2 BRANCHES",tag:"CREATIVE OPERATIONS",status:"CONNECT ADMIN DATA",Icon:Sparkles},
 {id:"glor",name:"GLOR",code:"03",count:"BRANCH NETWORK",tag:"PREMIUM OPERATIONS",status:"CONNECT ADMIN DATA",Icon:Building2},
];
export default function AdminBrandGateway({onBack,onSelect}){return <div className="admin-gateway"><div className="gateway-noise"/><header><button onClick={onBack}><ArrowLeft/> PORTALS</button><div><ShieldCheck/><span>DAM UNITED</span><b>ADMIN OPERATIONS</b></div><small>SECURE COMMAND ENVIRONMENT</small></header><section className="gateway-title"><motion.span initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>OPERATING BRANDS</motion.span><motion.h1 initial={{opacity:0,y:25}} animate={{opacity:1,y:0}} transition={{delay:.08}}>Choose your<br/><em>command environment.</em></motion.h1><motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.18}}>Each brand remains operationally isolated. Enter a brand to access its branches, intelligence, exceptions and reports.</motion.p></section><div className="gateway-brands">{brands.map((b,i)=><motion.button key={b.id} onClick={()=>onSelect(b)} initial={{opacity:0,y:45}} animate={{opacity:1,y:0}} transition={{delay:.18+i*.08}} whileHover={{y:-10}}><div className="brand-top"><span>{b.code}</span><b>{b.status}</b></div><b.Icon className="gateway-icon"/><div className="brand-copy"><small>{b.tag}</small><h2>{b.name}</h2><p>{b.count}</p></div><div className="enter">ENTER COMMAND <ArrowUpRight/></div></motion.button>)}</div></div>}
