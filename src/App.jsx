import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ShieldCheck,
  Users,
  UserCog,
  LockKeyhole,
  X,
  Eye,
  EyeOff,
  Activity,
  Boxes,
  Sparkles,
} from "lucide-react";
import "./index.css";

const portals = [
  {
    id: "staff",
    number: "01",
    icon: Users,
    title: "Staff",
    subtitle: "Branch Operations",
    description:
      "Stock entries, transfers, daily operations and branch-level tools.",
    button: "Enter Staff Portal",
    badge: "BRANCH ACCESS",
  },
  {
    id: "hr",
    number: "02",
    icon: UserCog,
    title: "HR",
    subtitle: "People & Scheduling",
    description:
      "Employee records, schedules, attendance and workforce operations.",
    button: "Enter HR Portal",
    badge: "SECURE ACCESS",
  },
  {
    id: "admin",
    number: "03",
    icon: ShieldCheck,
    title: "Admin",
    subtitle: "Command Center",
    description:
      "Analytics, branch controls, configuration and management intelligence.",
    button: "Enter Admin Portal",
    badge: "RESTRICTED",
  },
];

function FloatingOrb({ className }) {
  return <div className={`orb ${className}`} />;
}

function LoginModal({ portal, close }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!portal) return null;

  const Icon = portal.icon;

  const handleLogin = (e) => {
    e.preventDefault();

    if (!password.trim()) return;

    setLoading(true);

    // Temporary frontend demo.
    // We will connect this to Cloudflare + Google backend next.
    setTimeout(() => {
      setLoading(false);

      alert(`${portal.title} login backend will be connected next.`);
    }, 650);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={close}
      >
        <motion.div
          className="login-modal"
          initial={{
            opacity: 0,
            scale: 0.92,
            y: 30,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 20,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={close}>
            <X size={19} />
          </button>

          <div className="modal-icon">
            <Icon size={28} />
          </div>

          <div className="modal-security">
            <LockKeyhole size={13} />
            SECURITY VERIFICATION
          </div>

          <h2>{portal.title} Access</h2>

          <p>
            Authenticate your credentials to continue into the{" "}
            {portal.subtitle.toLowerCase()} environment.
          </p>

          <form onSubmit={handleLogin}>
            <label>Password</label>

            <div className="password-box">
              <LockKeyhole size={18} />

              <input
                autoFocus
                type={showPassword ? "text" : "password"}
                placeholder="Enter system password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button className="verify-button" disabled={loading}>
              {loading ? (
                <span className="loader" />
              ) : (
                <>
                  Verify & Continue
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="secure-footer">
            <ShieldCheck size={14} />
            Encrypted authentication channel
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [activePortal, setActivePortal] = useState(null);

const handlePortal = (portal) => {
  if (portal.id === "staff") {
    window.location.href = "/staff";
    return;
  }

  setActivePortal(portal);
};

  return (
    <div className="app">
      <div className="background-grid" />
      <div className="noise" />

      <FloatingOrb className="orb-one" />
      <FloatingOrb className="orb-two" />
      <FloatingOrb className="orb-three" />

      <div className="beam beam-one" />
      <div className="beam beam-two" />

      <nav className="navbar">
        <motion.div
          className="brand"
          initial={{ opacity: 0, x: -25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="brand-symbol">
            <Building2 size={20} />
          </div>

          <div>
            <strong>DAM</strong>
            <span>OPERATIONS</span>
          </div>
        </motion.div>

        <motion.div
          className="network-status"
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="status-dot" />
          SYSTEM ONLINE
        </motion.div>
      </nav>

      <main className="hero">
        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Sparkles size={13} />
          INTERNAL OPERATIONS NETWORK
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.25,
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          One network.
          <br />
          <span>Every operation.</span>
        </motion.h1>

        <motion.p
          className="hero-description"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.65 }}
        >
          The central operating system for branch teams, workforce management,
          inventory movement and executive control.
        </motion.p>

        <motion.div
          className="live-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <div>
            <Activity size={15} />
            <span>Live Operations</span>
          </div>

          <span className="info-divider" />

          <div>
            <Boxes size={15} />
            <span>Multi-Branch Network</span>
          </div>

          <span className="info-divider" />

          <div>
            <ShieldCheck size={15} />
            <span>Secure Access</span>
          </div>
        </motion.div>

        <div className="portal-grid">
          {portals.map((portal, index) => {
            const Icon = portal.icon;

            return (
              <motion.article
                key={portal.id}
                className={`portal-card ${portal.id}`}
                initial={{
                  opacity: 0,
                  y: 55,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.55 + index * 0.1,
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{
                  y: -8,
                }}
              >
                <div className="card-shine" />

                <div className="card-top">
                  <div className="portal-icon">
                    <Icon size={23} />
                  </div>

                  <span className="portal-number">{portal.number}</span>
                </div>

                <div className="portal-badge">{portal.badge}</div>

                <h2>{portal.title}</h2>
                <h3>{portal.subtitle}</h3>

                <p>{portal.description}</p>

                <button
                  className="portal-button"
                  onClick={() => handlePortal(portal)}
                >
                  <span>{portal.button}</span>

                  <div className="arrow-circle">
                    <ArrowRight size={17} />
                  </div>
                </button>
              </motion.article>
            );
          })}
        </div>
      </main>

      <footer>
        <span>DAM OPERATIONS</span>

        <div className="footer-line" />

        <span>Central Command Network</span>
      </footer>

      <LoginModal
        portal={activePortal}
        close={() => setActivePortal(null)}
      />
    </div>
  );
}

export default App;
