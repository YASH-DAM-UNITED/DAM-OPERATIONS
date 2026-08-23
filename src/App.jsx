import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
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
  Coffee,
  Crown,
  Heart,
  ChevronRight,
  MapPin,
  Search,
} from "lucide-react";

import "./index.css";

/* =========================================================
   MAIN PORTALS
========================================================= */

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

/* =========================================================
   BRANDS
========================================================= */

const brands = [
  {
    id: "bart",
    name: "BART",
    code: "B",
    icon: Coffee,
    eyebrow: "COFFEE • CULTURE • OPERATIONS",
    tagline: "Crafted operations.",
    description:
      "Enter the BART operational network for branch stock, transfers and daily activity.",
    color: "#f45f58",
    colorDark: "#c9413b",
    soft: "rgba(244,95,88,.12)",
    gradient:
      "linear-gradient(135deg, rgba(244,95,88,.18), rgba(255,255,255,.72))",
  },

  {
    id: "glor",
    name: "GLOR",
    code: "G",
    icon: Crown,
    eyebrow: "PREMIUM • SERVICE • CONTROL",
    tagline: "Operate with distinction.",
    description:
      "Access the GLOR network and manage branch operations through a premium workspace.",
    color: "#7357e8",
    colorDark: "#5237c7",
    soft: "rgba(115,87,232,.12)",
    gradient:
      "linear-gradient(135deg, rgba(115,87,232,.17), rgba(255,255,255,.72))",
  },

  {
    id: "mooma",
    name: "MOOMA",
    code: "M",
    icon: Heart,
    eyebrow: "CREATIVE • WARM • CONNECTED",
    tagline: "Made to flow.",
    description:
      "Step into the MOOMA operations environment for connected branch management.",
    color: "#d77a9c",
    colorDark: "#b5577a",
    soft: "rgba(215,122,156,.13)",
    gradient:
      "linear-gradient(135deg, rgba(215,122,156,.18), rgba(255,255,255,.72))",
  },
];

/*
 TEMPORARY BRANCHES

 Later these will NOT stay in React.

 Cloudflare API will read:
 MASTERBRANCHSHEET / D1

 and return branches according to selected brand.
*/

const temporaryBranches = {
  bart: [
    { code: "B001", name: "BART Branch 01" },
    { code: "B002", name: "BART Branch 02" },
    { code: "B003", name: "BART Branch 03" },
  ],

  glor: [
    { code: "G001", name: "GLOR Branch 01" },
    { code: "G002", name: "GLOR Branch 02" },
    { code: "G003", name: "GLOR Branch 03" },
  ],

  mooma: [
    { code: "M001", name: "MOOMA Branch 01" },
    { code: "M002", name: "MOOMA Branch 02" },
    { code: "M003", name: "MOOMA Branch 03" },
  ],
};

/* =========================================================
   BACKGROUND
========================================================= */

function FloatingOrb({ className }) {
  return <div className={`orb ${className}`} />;
}

function GlobalBackground() {
  return (
    <>
      <div className="background-grid" />
      <div className="noise" />

      <FloatingOrb className="orb-one" />
      <FloatingOrb className="orb-two" />
      <FloatingOrb className="orb-three" />

      <div className="beam beam-one" />
      <div className="beam beam-two" />
    </>
  );
}

/* =========================================================
   LOGO / NAVBAR
========================================================= */

function MainNavbar({ label = "SYSTEM ONLINE" }) {
  return (
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
        {label}
      </motion.div>
    </nav>
  );
}

/* =========================================================
   HR / ADMIN LOGIN
========================================================= */

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

    setTimeout(() => {
      setLoading(false);

      alert(
        `${portal.title} authentication will be connected to the backend.`
      );
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
   BRAND SELECTION
========================================================= */

function BrandSelection({ onBack, onSelectBrand }) {
  return (
    <div className="app">
      <GlobalBackground />

      <MainNavbar label="STAFF NETWORK" />

      <main className="brand-selection-page">
        <motion.button
          className="brand-back-button"
          onClick={onBack}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -4 }}
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          className="brand-selection-heading"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="hero-badge">
            <Sparkles size={13} />
            DAM STAFF NETWORK
          </div>

          <h1>
            Choose your
            <br />
            <span>brand.</span>
          </h1>

          <p>
            Select your operational environment to continue to your branch
            workspace.
          </p>
        </motion.div>

        <div className="brand-world-grid">
          {brands.map((brand, index) => {
            const Icon = brand.icon;

            return (
              <motion.button
                key={brand.id}
                className={`brand-world-card brand-${brand.id}`}
                onClick={() => onSelectBrand(brand)}
                initial={{
                  opacity: 0,
                  y: 60,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                transition={{
                  delay: 0.2 + index * 0.12,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{
                  y: -12,
                  scale: 1.015,
                }}
                whileTap={{
                  scale: 0.985,
                }}
                style={{
                  "--brand-color": brand.color,
                  "--brand-soft": brand.soft,
                  "--brand-gradient": brand.gradient,
                }}
              >
                <div className="brand-world-light" />

                <div className="brand-ring brand-ring-one" />
                <div className="brand-ring brand-ring-two" />

                <div className="brand-card-header">
                  <div className="brand-big-icon">
                    <Icon size={26} />
                  </div>

                  <span className="brand-code">{brand.code}</span>
                </div>

                <div className="brand-eyebrow">{brand.eyebrow}</div>

                <h2>{brand.name}</h2>

                <h3>{brand.tagline}</h3>

                <p>{brand.description}</p>

                <div className="brand-enter">
                  <span>ENTER {brand.name}</span>

                  <div className="brand-enter-icon">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   BRANCH SELECTION
========================================================= */

function BranchSelection({ brand, onBack, onBranchSelected }) {
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);

  const Icon = brand.icon;

  const branches = temporaryBranches[brand.id] || [];

  const filteredBranches = branches.filter((branch) => {
    const text = `${branch.code} ${branch.name}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div
      className={`app brand-environment brand-environment-${brand.id}`}
      style={{
        "--active-brand": brand.color,
        "--active-brand-dark": brand.colorDark,
        "--active-brand-soft": brand.soft,
      }}
    >
      <GlobalBackground />

      <MainNavbar label={`${brand.name} NETWORK`} />

      <main className="branch-selection-page">
        <motion.button
          className="brand-back-button"
          onClick={onBack}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -4 }}
        >
          <ArrowLeft size={16} />
          Change Brand
        </motion.button>

        <motion.div
          className="selected-brand-header"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="selected-brand-icon"
            initial={{
              scale: 0.6,
              rotate: -15,
            }}
            animate={{
              scale: 1,
              rotate: 0,
            }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 15,
            }}
          >
            <Icon size={29} />
          </motion.div>

          <div>
            <div className="selected-brand-eyebrow">
              {brand.name} OPERATIONS
            </div>

            <h1>
              Select your
              <span> branch.</span>
            </h1>

            <p>
              Choose the branch you are currently operating before
              authentication.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="branch-panel"
          initial={{
            opacity: 0,
            y: 35,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
          }}
        >
          <div className="branch-search">
            <Search size={18} />

            <input
              placeholder={`Search ${brand.name} branches...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="branch-list">
            <AnimatePresence>
              {filteredBranches.map((branch, index) => {
                const selected =
                  selectedBranch?.code === branch.code;

                return (
                  <motion.button
                    key={branch.code}
                    className={`branch-row ${
                      selected ? "branch-row-selected" : ""
                    }`}
                    initial={{
                      opacity: 0,
                      x: -15,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                    transition={{
                      delay: index * 0.04,
                    }}
                    onClick={() => setSelectedBranch(branch)}
                  >
                    <div className="branch-row-icon">
                      <MapPin size={18} />
                    </div>

                    <div className="branch-row-info">
                      <strong>{branch.name}</strong>

                      <span>{branch.code}</span>
                    </div>

                    <ChevronRight size={18} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {selectedBranch && (
              <motion.div
                className="branch-continue-container"
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <div>
                  <small>SELECTED BRANCH</small>

                  <strong>
                    {selectedBranch.code} • {selectedBranch.name}
                  </strong>
                </div>

                <button
                  onClick={() =>
                    onBranchSelected(selectedBranch)
                  }
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}

/* =========================================================
   TEMPORARY BRANCH LOGIN PAGE

   NEXT STEP:
   This will connect to Cloudflare + D1 + Google.
========================================================= */

function BranchLogin({ brand, branch, onBack }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const Icon = brand.icon;

  return (
    <div
      className={`app brand-environment brand-environment-${brand.id}`}
      style={{
        "--active-brand": brand.color,
        "--active-brand-dark": brand.colorDark,
        "--active-brand-soft": brand.soft,
      }}
    >
      <GlobalBackground />

      <MainNavbar label={`${branch.code} ACTIVE`} />

      <main className="branch-login-page">
        <motion.button
          className="brand-back-button"
          onClick={onBack}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft size={16} />
          Change Branch
        </motion.button>

        <motion.div
          className="branch-login-card"
          initial={{
            opacity: 0,
            scale: 0.94,
            y: 30,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          transition={{
            type: "spring",
            stiffness: 230,
            damping: 22,
          }}
        >
          <div className="branch-login-brand-icon">
            <Icon size={27} />
          </div>

          <div className="branch-login-brand">
            {brand.name} STAFF ACCESS
          </div>

          <h1>{branch.name}</h1>

          <div className="branch-login-code">
            <MapPin size={14} />
            {branch.code}
          </div>

          <p>
            Enter your branch password to continue to the staff
            operations dashboard.
          </p>

          <label>BRANCH PASSWORD</label>

          <div className="brand-password-box">
            <LockKeyhole size={18} />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter branch password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          <button
            className="branch-authenticate-button"
            onClick={() => {
              if (!password.trim()) return;

              alert(
                `NEXT: ${branch.code} will authenticate through Cloudflare backend.`
              );
            }}
          >
            Authenticate Branch
            <ArrowRight size={18} />
          </button>

          <div className="branch-secure-note">
            <ShieldCheck size={14} />
            Credentials will be verified securely by DAM Operations
          </div>
        </motion.div>
      </main>
    </div>
  );
}

/* =========================================================
   HOME PAGE
========================================================= */

function HomePage({ onPortal, activePortal, closePortal }) {
  return (
    <div className="app">
      <GlobalBackground />

      <MainNavbar />

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
          The central operating system for branch teams, workforce
          management, inventory movement and executive control.
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
            <span>Multi-Brand Network</span>
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

                  <span className="portal-number">
                    {portal.number}
                  </span>
                </div>

                <div className="portal-badge">
                  {portal.badge}
                </div>

                <h2>{portal.title}</h2>

                <h3>{portal.subtitle}</h3>

                <p>{portal.description}</p>

                <button
                  className="portal-button"
                  onClick={() => onPortal(portal)}
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
        close={closePortal}
      />
    </div>
  );
}

/* =========================================================
   APP CONTROLLER
========================================================= */

function App() {
  const [page, setPage] = useState("home");

  const [activePortal, setActivePortal] = useState(null);

  const [selectedBrand, setSelectedBrand] = useState(null);

  const [selectedBranch, setSelectedBranch] = useState(null);

  const handlePortal = (portal) => {
    /*
      STAFF:
      NO PASSWORD HERE.

      Staff goes directly to Brand Selection.
    */

    if (portal.id === "staff") {
      setActivePortal(null);
      setPage("brands");
      return;
    }

    /*
      HR + ADMIN:
      Keep security modal.
    */

    setActivePortal(portal);
  };

  const selectBrand = (brand) => {
    setSelectedBrand(brand);
    setSelectedBranch(null);
    setPage("branches");
  };

  const selectBranch = (branch) => {
    setSelectedBranch(branch);
    setPage("branch-login");
  };

  /* HOME */

  if (page === "home") {
    return (
      <HomePage
        onPortal={handlePortal}
        activePortal={activePortal}
        closePortal={() => setActivePortal(null)}
      />
    );
  }

  /* BRAND SELECTION */

  if (page === "brands") {
    return (
      <BrandSelection
        onBack={() => setPage("home")}
        onSelectBrand={selectBrand}
      />
    );
  }

  /* BRANCH SELECTION */

  if (page === "branches" && selectedBrand) {
    return (
      <BranchSelection
        brand={selectedBrand}
        onBack={() => {
          setSelectedBrand(null);
          setPage("brands");
        }}
        onBranchSelected={selectBranch}
      />
    );
  }

  /* BRANCH LOGIN */

  if (
    page === "branch-login" &&
    selectedBrand &&
    selectedBranch
  ) {
    return (
      <BranchLogin
        brand={selectedBrand}
        branch={selectedBranch}
        onBack={() => {
          setSelectedBranch(null);
          setPage("branches");
        }}
      />
    );
  }

  /* FAIL SAFE */

  return (
    <HomePage
      onPortal={handlePortal}
      activePortal={activePortal}
      closePortal={() => setActivePortal(null)}
    />
  );
}

export default App;
