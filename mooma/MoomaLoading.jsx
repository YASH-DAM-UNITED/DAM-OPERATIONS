import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function MoomaLoading({ label = "PREPARING OPERATIONS", compact = false }) {
  return (
    <div className={`mooma-loader ${compact ? "compact" : ""}`}>
      <div className="mooma-loader-stage">
        <motion.div className="mooma-loader-ring ring-a" animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
        <motion.div className="mooma-loader-ring ring-b" animate={{ rotate: -360 }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
        <motion.div className="mooma-loader-core" animate={{ scale: [1, 1.08, 1], rotate: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
          M
        </motion.div>
        <motion.span className="mooma-loader-spark s1" animate={{ opacity: [0,1,0], y: [4,-16,-24] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <motion.span className="mooma-loader-spark s2" animate={{ opacity: [0,1,0], x: [0,18,24] }} transition={{ duration: 1.7, repeat: Infinity, delay: .25 }} />
      </div>
      <div className="mooma-loader-copy"><Sparkles size={12}/><strong>{label}</strong><span>MOOMA · DAM OPERATIONS</span></div>
      <motion.div className="mooma-loader-line"><motion.i animate={{ x: ["-100%","240%"] }} transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}/></motion.div>
    </div>
  );
}
