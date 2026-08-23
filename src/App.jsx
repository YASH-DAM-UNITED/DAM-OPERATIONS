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
  Search,
  MapPin,
  ChevronRight,
} from "lucide-react";


import "./index.css";

import BartStaffDashboard from "./BartStaffDashboard.jsx";

/* =========================================================
   HOME PORTALS
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

    small: "01 / BART",

    label: "COFFEE CULTURE",

    tagline: "Built for the rush.",

    description:
      "Fast-moving branch operations engineered around people, coffee and momentum.",

    primary: "#ff5f57",

    secondary: "#ff9c75",
  },

  {
    id: "glor",
    name: "GLOR",
    code: "G",

    small: "02 / GLOR",

    label: "PREMIUM EXPERIENCE",

    tagline: "Precision in motion.",

    description:
      "A refined operational environment built around control, clarity and elevated service.",

    primary: "#b89858",

    secondary: "#ead7a5",
  },

  {
    id: "mooma",
    name: "MOOMA",
    code: "M",

    small: "03 / MOOMA",

    label: "CREATIVE CULTURE",

    tagline: "Made to feel different.",

    description:
      "A fluid operational world where creativity, warmth and everyday execution connect.",

    primary: "#e47ca7",

    secondary: "#ffc1d8",
  },
];

/* =========================================================
   TEMPORARY BRANCH LIST

   IMPORTANT:
   NEXT WE WILL REPLACE THIS WITH REAL DATA FROM:
   Cloudflare → D1 → MASTERBRANCHSHEET

========================================================= */

const temporaryBranches = {
  bart: [
    {
      code: "B001",
      name: "BART Branch 01",
    },

    {
      code: "B002",
      name: "BART Branch 02",
    },

    {
      code: "B003",
      name: "BART Branch 03",
    },

    {
      code: "B004",
      name: "BART Branch 04",
    },

    {
      code: "B005",
      name: "BART Branch 05",
    },
  ],

  glor: [
    {
      code: "G001",
      name: "GLOR Branch 01",
    },

    {
      code: "G002",
      name: "GLOR Branch 02",
    },

    {
      code: "G003",
      name: "GLOR Branch 03",
    },
  ],

  mooma: [
    {
      code: "M001",
      name: "MOOMA Branch 01",
    },

    {
      code: "M002",
      name: "MOOMA Branch 02",
    },

    {
      code: "M003",
      name: "MOOMA Branch 03",
    },
  ],
};

/* =========================================================
   DAM LOGO
========================================================= */

function DAMLogo({ light = false }) {
  return (
    <div className={`dam-logo ${light ? "dam-logo-light" : ""}`}>
      <div className="dam-logo-mark">
        <Building2 size={18} />
      </div>

      <div className="dam-logo-text">
        <strong>DAM</strong>

        <span>OPERATIONS</span>
      </div>
    </div>
  );
}

/* =========================================================
   SYSTEM STATUS
========================================================= */

function SystemStatus({
  light = false,
  text = "SYSTEM ONLINE",
}) {
  return (
    <div
      className={`system-status ${
        light ? "status-light" : ""
      }`}
    >
      <span className="system-status-dot" />

      {text}
    </div>
  );
}

/* =========================================================
   HR / ADMIN LOGIN MODAL
========================================================= */

function LoginModal({
  portal,
  close,
}) {
  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  if (!portal) {
    return null;
  }

  const Icon = portal.icon;

  function submit(e) {
    e.preventDefault();

    if (!password.trim()) {
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      alert(
        `${portal.title} authentication will be connected later.`
      );
    }, 600);
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        exit={{
          opacity: 0,
        }}
        onMouseDown={close}
      >
        <motion.div
          className="login-modal"
          initial={{
            opacity: 0,
            y: 35,
            scale: 0.94,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.96,
          }}
          onMouseDown={(e) =>
            e.stopPropagation()
          }
        >
          <button
            className="modal-close"
            onClick={close}
          >
            <X size={18} />
          </button>

          <div className="modal-icon">
            <Icon size={26} />
          </div>

          <div className="modal-security">
            <LockKeyhole size={12} />

            SECURITY VERIFICATION
          </div>

          <h2>
            {portal.title} Access
          </h2>

          <p>
            Authenticate your credentials
            to continue.
          </p>

          <form onSubmit={submit}>
            <label>
              PASSWORD
            </label>

            <div className="password-box">
              <LockKeyhole size={17} />

              <input
                autoFocus
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                placeholder="Enter system password"
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
              />

              <button
                type="button"
                className="show-password"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>

            <button
              className="verify-button"
              disabled={loading}
            >
              {loading ? (
                <span className="loader" />
              ) : (
                <>
                  Verify & Continue

                  <ArrowRight
                    size={16}
                  />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* =========================================================
   HOME PAGE
========================================================= */

function Home({
  openPortal,
  activePortal,
  closePortal,
}) {
  return (
    <div className="app">
      <div className="background-grid" />

      <div className="noise" />

      <div className="orb orb-one" />

      <div className="orb orb-two" />

      <div className="orb orb-three" />

      <nav className="navbar">
        <DAMLogo />

        <SystemStatus />
      </nav>

      <main className="hero">
        <motion.div
          className="hero-badge"
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <Sparkles size={13} />

          INTERNAL OPERATIONS NETWORK
        </motion.div>

        <motion.h1
          initial={{
            opacity: 0,
            y: 35,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.75,
          }}
        >
          One network.

          <br />

          <span>
            Every operation.
          </span>
        </motion.h1>

        <motion.p
          className="hero-description"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
          }}
        >
          The central operating system
          for branch teams, workforce
          management, inventory movement
          and executive control.
        </motion.p>

        <motion.div
          className="live-info"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.3,
          }}
        >
          <div>
            <Activity size={15} />

            Live Operations
          </div>

          <span className="info-divider" />

          <div>
            <Boxes size={15} />

            Multi-Brand Network
          </div>

          <span className="info-divider" />

          <div>
            <ShieldCheck
              size={15}
            />

            Secure Access
          </div>
        </motion.div>

        <div className="portal-grid">
          {portals.map(
            (
              portal,
              index
            ) => {
              const Icon =
                portal.icon;

              return (
                <motion.article
                  key={
                    portal.id
                  }
                  className={`portal-card ${portal.id}`}
                  initial={{
                    opacity: 0,
                    y: 45,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      0.35 +
                      index *
                        0.09,
                  }}
                  whileHover={{
                    y: -8,
                  }}
                >
                  <div className="card-shine" />

                  <div className="card-top">
                    <div className="portal-icon">
                      <Icon
                        size={23}
                      />
                    </div>

                    <span className="portal-number">
                      {
                        portal.number
                      }
                    </span>
                  </div>

                  <div className="portal-badge">
                    {
                      portal.badge
                    }
                  </div>

                  <h2>
                    {portal.title}
                  </h2>

                  <h3>
                    {
                      portal.subtitle
                    }
                  </h3>

                  <p>
                    {
                      portal.description
                    }
                  </p>

                  <button
                    className="portal-button"
                    onClick={() =>
                      openPortal(
                        portal
                      )
                    }
                  >
                    {
                      portal.button
                    }

                    <div className="arrow-circle">
                      <ArrowRight
                        size={17}
                      />
                    </div>
                  </button>
                </motion.article>
              );
            }
          )}
        </div>
      </main>

      <LoginModal
        portal={activePortal}
        close={closePortal}
      />
    </div>
  );
}

/* =========================================================
   BRAND SELECTION PAGE
========================================================= */

function BrandWorld({
  onBack,
  selectBrand,
}) {
  const [hovered, setHovered] =
    useState(null);

  return (
    <motion.div
      className={`brand-world-screen ${
        hovered
          ? `world-${hovered}`
          : ""
      }`}
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
    >
      <div className="world-noise" />

      <div className="world-grid-lines" />

      <div className="world-topbar">
        <DAMLogo light />

        <div className="world-topbar-right">
          <SystemStatus
            light
            text="STAFF NETWORK"
          />

          <button
            className="world-exit"
            onClick={onBack}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="world-heading">
        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="world-kicker"
        >
          DAM / BRAND GATEWAY
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
        >
          Select your world.
        </motion.h1>

        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
        >
          Three identities. One
          operational network.
        </motion.p>
      </div>

      <div className="worlds">
        {brands.map(
          (
            brand,
            index
          ) => {
            const active =
              hovered ===
              brand.id;

            const somethingActive =
              hovered !== null;

            const dimmed =
              somethingActive &&
              !active;

            return (
              <motion.button
                key={
                  brand.id
                }
                className={`world-panel ${brand.id}-world ${
                  active
                    ? "world-active"
                    : ""
                } ${
                  dimmed
                    ? "world-dimmed"
                    : ""
                }`}
                style={{
                  "--brand-primary":
                    brand.primary,

                  "--brand-secondary":
                    brand.secondary,
                }}
                onMouseEnter={() =>
                  setHovered(
                    brand.id
                  )
                }
                onMouseLeave={() =>
                  setHovered(null)
                }
                onClick={() =>
                  selectBrand(
                    brand
                  )
                }
              >
                {/* =========================
                    BART VISUAL
                ========================= */}

                {brand.id ===
                  "bart" && (
                  <div className="bart-art">
                    <div className="bart-sun" />

                    <div className="bart-orbit bart-orbit-1" />

                    <div className="bart-orbit bart-orbit-2" />

                    <div className="bart-dot bart-dot-1" />

                    <div className="bart-dot bart-dot-2" />
                  </div>
                )}

                {/* =========================
                    GLOR VISUAL
                ========================= */}

                {brand.id ===
                  "glor" && (
                  <div className="glor-art">
                    <div className="glor-light" />

                    <div className="glor-diamond glor-diamond-1" />

                    <div className="glor-diamond glor-diamond-2" />

                    <div className="glor-line" />
                  </div>
                )}

                {/* =========================
                    MOOMA VISUAL
                ========================= */}

                {brand.id ===
                  "mooma" && (
                  <div className="mooma-art">
                    <div className="mooma-blob mooma-blob-1" />

                    <div className="mooma-blob mooma-blob-2" />

                    <div className="mooma-ball mooma-ball-1" />

                    <div className="mooma-ball mooma-ball-2" />
                  </div>
                )}

                <div className="world-number">
                  0
                  {index + 1}
                </div>

                <div className="world-content">
                  <span className="world-brand-label">
                    {
                      brand.label
                    }
                  </span>

                  <div className="world-letter">
                    {
                      brand.code
                    }
                  </div>

                  <h2>
                    {
                      brand.name
                    }
                  </h2>

                  <h3>
                    {
                      brand.tagline
                    }
                  </h3>

                  <p>
                    {
                      brand.description
                    }
                  </p>

                  <div className="world-enter">
                    <span>
                      ENTER WORLD
                    </span>

                    <div>
                      <ArrowRight
                        size={18}
                      />
                    </div>
                  </div>
                </div>

                <div className="world-bottom-code">
                  {
                    brand.small
                  }
                </div>
              </motion.button>
            );
          }
        )}
      </div>

      <div className="world-footer">
        <span>
          MOVE TO EXPLORE
        </span>

        <span>•</span>

        <span>
          CLICK TO ENTER
        </span>
      </div>
    </motion.div>
  );
}

/* =========================================================
   BRANCH SELECTION PAGE
========================================================= */

function BranchScreen({
  brand,
  onBack,
  onSelect,
}) {
  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  const branches =
    temporaryBranches[
      brand.id
    ] || [];

  const filtered =
    branches.filter(
      (branch) =>
        `${branch.code} ${branch.name}`
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );

  return (
    <motion.div
      className={`branch-world branch-world-${brand.id}`}
      style={{
        "--brand-primary":
          brand.primary,

        "--brand-secondary":
          brand.secondary,
      }}
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
    >
      <div className="branch-world-bg" />

      <div className="world-noise" />

      <div className="branch-nav">
        <DAMLogo light />

        <SystemStatus
          light
          text={`${brand.name} NETWORK`}
        />
      </div>

      <main className="branch-main">
        <button
          className="branch-back"
          onClick={onBack}
        >
          <ArrowLeft
            size={16}
          />

          ALL BRANDS
        </button>

        <div className="branch-title-area">
          <motion.span
            className="branch-brand-tag"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
          >
            {brand.name} /
            BRANCH ACCESS
          </motion.span>

          <motion.h1
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            Where are you

            <br />

            <em>
              operating?
            </em>
          </motion.h1>

          <p>
            Select your{" "}
            {brand.name} branch
            to continue into the
            staff network.
          </p>
        </div>

        <motion.div
          className="branch-selector"
          initial={{
            opacity: 0,
            y: 30,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
          }}
        >
          <div className="branch-search-new">
            <Search
              size={18}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder={`Search ${brand.name} branches`}
            />

            <span>
              {
                filtered.length
              }{" "}
              LOCATIONS
            </span>
          </div>

          <div className="branch-items">
            {filtered.map(
              (
                branch,
                index
              ) => {
                const active =
                  selected?.code ===
                  branch.code;

                return (
                  <motion.button
                    key={
                      branch.code
                    }
                    className={`branch-item-new ${
                      active
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelected(
                        branch
                      )
                    }
                    initial={{
                      opacity: 0,
                      x: -15,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    transition={{
                      delay:
                        index *
                        0.04,
                    }}
                  >
                    <span className="branch-index">
                      {String(
                        index +
                          1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <div className="branch-location-icon">
                      <MapPin
                        size={17}
                      />
                    </div>

                    <div className="branch-item-info">
                      <strong>
                        {
                          branch.name
                        }
                      </strong>

                      <small>
                        {
                          branch.code
                        }
                      </small>
                    </div>

                    <ChevronRight
                      size={18}
                    />
                  </motion.button>
                );
              }
            )}
          </div>

          <AnimatePresence>
            {selected && (
              <motion.div
                className="branch-selection-footer"
                initial={{
                  opacity: 0,
                  y: 12,
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
                  <small>
                    READY TO ENTER
                  </small>

                  <strong>
                    {
                      selected.name
                    }
                  </strong>
                </div>

                <button
                  onClick={() =>
                    onSelect(
                      selected
                    )
                  }
                >
                  CONTINUE

                  <ArrowRight
                    size={17}
                  />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <div className="giant-brand-word">
        {brand.name}
      </div>
    </motion.div>
  );
}

/* =========================================================
   BRANCH LOGIN

   FOR NOW:
   ANY NON-EMPTY PASSWORD WILL OPEN DASHBOARD.

   NEXT:
   Cloudflare backend will verify actual password.
========================================================= */

function BranchLogin({
  brand,
  branch,
  onBack,
  onSuccess,
}) {
  const [password, setPassword] =
    useState("");

  const [show, setShow] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  function authenticate() {
    setError("");

    if (
      !password.trim()
    ) {
      setError(
        "Enter branch password."
      );

      return;
    }

    setLoading(true);

    /*
      TEMPORARY FRONTEND AUTH.

      NEXT:
      fetch("/api/staff/login")
    */

    setTimeout(() => {
      setLoading(false);

      onSuccess(branch);
    }, 500);
  }

  return (
    <motion.div
      className={`brand-login-screen login-${brand.id}`}
      style={{
        "--brand-primary":
          brand.primary,

        "--brand-secondary":
          brand.secondary,
      }}
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
    >
      <div className="login-world-bg" />

      <div className="world-noise" />

      <nav className="branch-nav">
        <DAMLogo light />

        <SystemStatus
          light
          text={branch.code}
        />
      </nav>

      <main className="brand-login-main">
        <button
          className="branch-back"
          onClick={onBack}
        >
          <ArrowLeft
            size={16}
          />

          CHANGE BRANCH
        </button>

        <motion.div
          className="brand-login-box"
          initial={{
            opacity: 0,
            y: 35,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            type: "spring",
            damping: 24,
          }}
        >
          <span className="login-brand-mini">
            {brand.name} /
            STAFF ACCESS
          </span>

          <div className="login-letter">
            {
              brand.code
            }
          </div>

          <h1>
            {
              branch.name
            }
          </h1>

          <div className="login-branch-code">
            <MapPin
              size={13}
            />

            {
              branch.code
            }
          </div>

          <p>
            Authenticate this
            branch to enter the
            operations workspace.
          </p>

          <label>
            BRANCH PASSWORD
          </label>

          <div className="cinematic-password">
            <LockKeyhole
              size={18}
            />

            <input
              type={
                show
                  ? "text"
                  : "password"
              }
              placeholder="Enter branch password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              onKeyDown={(
                e
              ) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  authenticate();
                }
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShow(
                  !show
                )
              }
            >
              {show ? (
                <EyeOff
                  size={17}
                />
              ) : (
                <Eye
                  size={17}
                />
              )}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop:
                  "9px",

                color:
                  "#ff6559",

                fontSize:
                  "8px",

                fontWeight:
                  700,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="cinematic-login-button"
            onClick={
              authenticate
            }
            disabled={
              loading
            }
          >
            {loading ? (
              <>
                VERIFYING...
              </>
            ) : (
              <>
                ENTER OPERATIONS

                <ArrowRight
                  size={18}
                />
              </>
            )}
          </button>

          <div className="login-security">
            <ShieldCheck
              size={13}
            />

            SECURE DAM
            OPERATIONS GATEWAY
          </div>
        </motion.div>
      </main>

      <div className="login-giant-word">
        {brand.name}
      </div>
    </motion.div>
  );
}

/* =========================================================
   MAIN APP CONTROLLER
========================================================= */

function App() {
  /*
    AVAILABLE PAGES:

    home
    brands
    branches
    branch-login
    bart-dashboard
  */

  const [page, setPage] =
    useState("home");

  const [
    activePortal,
    setActivePortal,
  ] = useState(null);

  const [
    selectedBrand,
    setSelectedBrand,
  ] = useState(null);

  const [
    selectedBranch,
    setSelectedBranch,
  ] = useState(null);

  const [
    authenticatedBranch,
    setAuthenticatedBranch,
  ] = useState(null);

  /* =======================================================
     HOME PORTAL CLICK
  ======================================================= */

  function portalClick(
    portal
  ) {
    /*
      STAFF DOES NOT ASK PASSWORD HERE.
    */

    if (
      portal.id ===
      "staff"
    ) {
      setActivePortal(null);

      setPage(
        "brands"
      );

      return;
    }

    /*
      HR + ADMIN STILL USE MODAL.
    */

    setActivePortal(
      portal
    );
  }

  /* =======================================================
     SELECT BRAND
  ======================================================= */

  function chooseBrand(
    brand
  ) {
    setSelectedBrand(
      brand
    );

    setSelectedBranch(
      null
    );

    setAuthenticatedBranch(
      null
    );

    /*
      Clicking BART / GLOR / MOOMA
      opens BRANCH LIST.
    */

    setPage(
      "branches"
    );
  }

  /* =======================================================
     SELECT BRANCH
  ======================================================= */

  function chooseBranch(
    branch
  ) {
    setSelectedBranch(
      branch
    );

    /*
      Branch selected →
      now show password.
    */

    setPage(
      "branch-login"
    );
  }

  /* =======================================================
     LOGIN SUCCESS
  ======================================================= */

  function handleBranchLoginSuccess(
    branch
  ) {
    setAuthenticatedBranch(
      branch
    );

    /*
      BART →
      BART STAFF DASHBOARD.
    */

    if (
      selectedBrand?.id ===
      "bart"
    ) {
      setPage(
        "bart-dashboard"
      );

      return;
    }

    /*
      GLOR / MOOMA dashboards
      come later.
    */

    alert(
      `${selectedBrand?.name} dashboard will be built next.`
    );
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  function logoutStaff() {
    setAuthenticatedBranch(
      null
    );

    setSelectedBranch(
      null
    );

    setSelectedBrand(
      null
    );

    setPage(
      "brands"
    );
  }

  /* =======================================================
     MODULE CLICK
  ======================================================= */

  function handleBartModule(
    module
  ) {
    /*
      NEXT:

      stock-record
      schedule
      stock-view
      transfer

      will each open their
      own React pages.
    */

    console.log(
      "BART MODULE:",
      module
    );

    alert(
      `Next we will build: ${module}`
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AnimatePresence mode="wait">
      {/* =========================
          HOME
      ========================= */}

      {page ===
        "home" && (
        <motion.div
          key="home"
          exit={{
            opacity: 0,
          }}
        >
          <Home
            openPortal={
              portalClick
            }
            activePortal={
              activePortal
            }
            closePortal={() =>
              setActivePortal(
                null
              )
            }
          />
        </motion.div>
      )}

      {/* =========================
          BRAND SELECTION
      ========================= */}

      {page ===
        "brands" && (
        <BrandWorld
          key="brands"
          onBack={() =>
            setPage(
              "home"
            )
          }
          selectBrand={
            chooseBrand
          }
        />
      )}

      {/* =========================
          BRANCH SELECTION
      ========================= */}

      {page ===
        "branches" &&
        selectedBrand && (
          <BranchScreen
            key={`branches-${selectedBrand.id}`}
            brand={
              selectedBrand
            }
            onBack={() => {
              setSelectedBranch(
                null
              );

              setSelectedBrand(
                null
              );

              setPage(
                "brands"
              );
            }}
            onSelect={
              chooseBranch
            }
          />
        )}

      {/* =========================
          BRANCH PASSWORD
      ========================= */}

      {page ===
        "branch-login" &&
        selectedBrand &&
        selectedBranch && (
          <BranchLogin
            key={`login-${selectedBranch.code}`}
            brand={
              selectedBrand
            }
            branch={
              selectedBranch
            }
            onBack={() => {
              setSelectedBranch(
                null
              );

              setPage(
                "branches"
              );
            }}
            onSuccess={
              handleBranchLoginSuccess
            }
          />
        )}

      {/* =========================
          BART STAFF DASHBOARD
      ========================= */}

      {page ===
        "bart-dashboard" &&
        selectedBrand?.id ===
          "bart" &&
        authenticatedBranch && (
          <motion.div
            key="bart-dashboard"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >
            <BartStaffDashboard
              branch={
                authenticatedBranch
              }

              /*
                CHANGE BRANCH
              */
              onBack={() => {
                setAuthenticatedBranch(
                  null
                );

                setSelectedBranch(
                  null
                );

                setPage(
                  "branches"
                );
              }}

              /*
                LOGOUT
              */
              onLogout={
                logoutStaff
              }

              /*
                REFRESH
              */
              onRefresh={() => {
                console.log(
                  "Refresh BART branch data"
                );
              }}

              /*
                MODULE CLICK
              */
              onModule={
                handleBartModule
              }
            />
          </motion.div>
        )}
    </AnimatePresence>
  );
}

export default App;
