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
  ArrowLeft,
  PackagePlus,
  ArrowLeftRight,
  ClipboardList,
  CalendarDays,
  BarChart3,
  Bell,
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

/* =========================================================
   HR + ADMIN LOGIN MODAL ONLY
   ========================================================= */

function LoginModal({ portal, close }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!portal) return null;

  const Icon = portal.icon;

  const handleLogin = (e) => {
    e.preventDefault();

    if (!password.trim()) {
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      alert(`${portal.title} backend authentication will be connected next.`);
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

/* =========================================================
   STAFF DASHBOARD
   NO PASSWORD
   ========================================================= */

function StaffDashboard({ goBack }) {
  const staffModules = [
    {
      icon: PackagePlus,
      title: "Stock Entry",
      description:
        "Enter daily and weekly stock quantities for your branch.",
    },
    {
      icon: ArrowLeftRight,
      title: "Stock Transfer",
      description:
        "Transfer stock between branches and track movement instantly.",
    },
    {
      icon: ClipboardList,
      title: "Daily Operations",
      description:
        "Complete branch operational entries and daily reporting.",
    },
    {
      icon: CalendarDays,
      title: "Staff Schedule",
      description:
        "View branch shifts, assignments and daily schedules.",
    },
    {
      icon: BarChart3,
      title: "Branch Reports",
      description:
        "View submitted records and branch performance information.",
    },
    {
      icon: Bell,
      title: "Notifications",
      description:
        "View operational alerts, requests and important updates.",
    },
  ];

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
        >
          <span className="status-dot" />
          STAFF NETWORK
        </motion.div>
      </nav>

      <main
        style={{
          position: "relative",
          zIndex: 5,
          maxWidth: "1230px",
          margin: "25px auto",
          padding: "20px 32px 60px",
        }}
      >
        <motion.button
          onClick={goBack}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -4 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "1px solid rgba(20,20,23,.08)",
            background: "rgba(255,255,255,.65)",
            backdropFilter: "blur(18px)",
            padding: "10px 15px",
            borderRadius: "12px",
            fontWeight: "700",
            fontSize: "11px",
            color: "#44444b",
          }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            marginTop: "40px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 13px",
              borderRadius: "100px",
              color: "#bd4b46",
              background: "rgba(244,95,88,.07)",
              fontSize: "10px",
              fontWeight: "800",
              letterSpacing: "1.5px",
            }}
          >
            <Sparkles size={13} />
            BRANCH OPERATIONS
          </div>

          <h1
            style={{
              marginTop: "18px",
              fontFamily: "Manrope, sans-serif",
              fontSize: "clamp(45px, 5vw, 72px)",
              lineHeight: ".98",
              letterSpacing: "-4px",
              color: "#171719",
            }}
          >
            Staff
            <br />
            <span style={{ color: "#f45f58" }}>Command Center.</span>
          </h1>

          <p
            style={{
              marginTop: "20px",
              color: "#777780",
              fontSize: "14px",
              maxWidth: "560px",
              lineHeight: "1.7",
            }}
          >
            Manage daily branch activity, stock movements and operational
            submissions from one place.
          </p>
        </motion.div>

        <div
          style={{
            marginTop: "45px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {staffModules.map((module, index) => {
            const Icon = module.icon;

            return (
              <motion.div
                key={module.title}
                initial={{
                  opacity: 0,
                  y: 35,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.18 + index * 0.07,
                }}
                whileHover={{
                  y: -6,
                  scale: 1.01,
                }}
                style={{
                  minHeight: "220px",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  padding: "24px",
                  borderRadius: "24px",
                  border: "1px solid rgba(20,20,23,.07)",
                  background: "rgba(255,255,255,.72)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 18px 50px rgba(30,30,35,.05)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "15px",
                    color: "#f45f58",
                    background: "rgba(244,95,88,.08)",
                  }}
                >
                  <Icon size={22} />
                </div>

                <h2
                  style={{
                    marginTop: "25px",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: "22px",
                    letterSpacing: "-1px",
                  }}
                >
                  {module.title}
                </h2>

                <p
                  style={{
                    marginTop: "9px",
                    color: "#82828b",
                    fontSize: "12px",
                    lineHeight: "1.6",
                  }}
                >
                  {module.description}
                </p>

                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "20px",
                    fontWeight: "800",
                    fontSize: "10px",
                    letterSpacing: "1px",
                    color: "#55555c",
                  }}
                >
                  OPEN MODULE

                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "11px",
                      background: "#171719",
                      color: "white",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ArrowRight size={16} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer>
        <span>DAM OPERATIONS</span>

        <div className="footer-line" />

        <span>Branch Operations Network</span>
      </footer>
    </div>
  );
}

/* =========================================================
   MAIN HOME PAGE
   ========================================================= */

function App() {
  const [activePortal, setActivePortal] = useState(null);
  const [currentPage, setCurrentPage] = useState("home");

  const handlePortal = (portal) => {
    if (portal.id === "staff") {
      setActivePortal(null);
      setCurrentPage("staff");
      return;
    }

    setActivePortal(portal);
  };

  if (currentPage === "staff") {
    return <StaffDashboard goBack={() => setCurrentPage("home")} />;
  }

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
          transition={{
            delay: 0.38,
            duration: 0.65,
          }}
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
