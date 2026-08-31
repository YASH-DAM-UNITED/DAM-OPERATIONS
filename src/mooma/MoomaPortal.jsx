import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function MoomaPortal({ onBack }) {
  return (
    <motion.div
      className="mooma-portal"
      initial={{
        opacity: 0,
        scale: 0.985,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.985,
      }}
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* BACKGROUND */}
      <div className="mooma-bg" />
      <div className="mooma-grid" />
      <div className="mooma-orb mooma-orb-one" />
      <div className="mooma-orb mooma-orb-two" />

      {/* HEADER */}
      <header className="mooma-header">
        <div className="mooma-brand">
          <div className="mooma-logo">
            M
          </div>

          <div className="mooma-brand-text">
            <strong>MOOMA</strong>
            <span>DAM OPERATIONS</span>
          </div>
        </div>

        <div className="mooma-status">
          <span className="mooma-status-dot" />

          SYSTEM ONLINE
        </div>
      </header>

      {/* MAIN */}
      <main className="mooma-main">
        <button
          type="button"
          className="mooma-back"
          onClick={onBack}
        >
          <ArrowLeft size={16} />

          ALL BRANDS
        </button>

        <section className="mooma-hero">
          <motion.div
            className="mooma-eyebrow"
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.08,
            }}
          >
            <Sparkles size={14} />

            DAM / MOOMA STAFF NETWORK
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.12,
              duration: 0.5,
            }}
          >
            Welcome to
            <br />

            <span>MOOMA.</span>
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: 15,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.2,
            }}
          >
            Your MOOMA staff operations workspace is
            ready. Branch access, stock management,
            transfers and staff scheduling will operate
            from this network.
          </motion.p>

          <motion.div
            className="mooma-ready-card"
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.28,
            }}
          >
            <div className="mooma-ready-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <small>CONNECTION STATUS</small>

              <strong>
                MOOMA PORTAL READY
              </strong>
            </div>

            <ArrowRight
              className="mooma-ready-arrow"
              size={19}
            />
          </motion.div>
        </section>
      </main>

      <div className="mooma-giant-word">
        MOOMA
      </div>
    </motion.div>
  );
}
