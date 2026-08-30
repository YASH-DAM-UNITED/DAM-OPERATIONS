import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  Eye,
  LogOut,
  Moon,
  PackageCheck,
  Sparkles,
  Sun,
  Truck,
} from "lucide-react";

import MoomaLoading from "./MoomaLoading.jsx";
import MoomaStockRecord from "./MoomaStockRecord.jsx";
import MoomaStockView from "./MoomaStockView.jsx";
import MoomaStockTransfer from "./MoomaStockTransfer.jsx";
import MoomaStaffSchedule from "./MoomaStaffSchedule.jsx";




/* ============================================================
   MOOMA DASHBOARD
============================================================ */

const MODULES = [
  {
    id: "stock-record",
    number: "01",
    title: "Stock Record",
    description:
      "Record daily, weekly and bakery stock for your branch.",
    icon: PackageCheck,
    label: "STOCK ENTRY",
  },
  {
    id: "stock-view",
    number: "02",
    title: "Stock View",
    description:
      "Review current branch stock and previously recorded quantities.",
    icon: Eye,
    label: "STOCK CONTROL",
  },
  {
    id: "stock-transfer",
    number: "03",
    title: "Stock Transfer",
    description:
      "Transfer stock securely between MOOMA branches.",
    icon: Truck,
    label: "BRANCH TRANSFER",
  },
  {
    id: "staff-schedule",
    number: "04",
    title: "Staff Schedule",
    description:
      "Create and manage the weekly schedule for your team.",
    icon: CalendarDays,
    label: "PEOPLE OPERATIONS",
  },
];


function getInitialTheme() {
  const savedTheme = localStorage.getItem("mooma-theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}


/* ============================================================
   COMPONENT
============================================================ */

export default function MoomaDashboard({
  branch,
  onBack,
  onLogout,
}) {
  const [activeModule, setActiveModule] = useState(null);
  const [openingModule, setOpeningModule] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);

  const moduleSectionRef = useRef(null);


  /* ============================================================
     THEME
  ============================================================ */

  useEffect(() => {
    localStorage.setItem("mooma-theme", theme);
  }, [theme]);


  function toggleTheme() {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  }


  /* ============================================================
     OPEN MODULE
  ============================================================ */

  function openModule(moduleId) {
    setOpeningModule(moduleId);

    window.setTimeout(() => {
      setActiveModule(moduleId);
      setOpeningModule(null);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 650);
  }


  function closeModule() {
    setActiveModule(null);

    window.setTimeout(() => {
      moduleSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }


  /* ============================================================
     CHILD MODULES
  ============================================================ */

  if (activeModule === "stock-record") {
    return (
      <div data-mooma-theme={theme}>
        <MoomaStockRecord
          branch={branch}
          onBack={closeModule}
        />
      </div>
    );
  }


  if (activeModule === "stock-view") {
    return (
      <div data-mooma-theme={theme}>
        <MoomaStockView
          branch={branch}
          onBack={closeModule}
        />
      </div>
    );
  }


  if (activeModule === "stock-transfer") {
    return (
      <div data-mooma-theme={theme}>
        <MoomaStockTransfer
          branch={branch}
          onBack={closeModule}
        />
      </div>
    );
  }


  if (activeModule === "staff-schedule") {
    return (
      <div data-mooma-theme={theme}>
        <MoomaStaffSchedule
          branch={branch}
          onBack={closeModule}
        />
      </div>
    );
  }


  /* ============================================================
     DASHBOARD
  ============================================================ */

  return (
    <div
      className="mooma-dashboard"
      data-mooma-theme={theme}
    >
      {/* BACKGROUND */}

      <div className="md-grid-background" />

      <div className="md-glow md-glow-one" />

      <div className="md-glow md-glow-two" />

      <div className="md-glow md-glow-three" />

      <div className="md-background-word">
        MOOMA
      </div>


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="md-header">
        <button
          type="button"
          className="md-header-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />

          <span>
            CHANGE BRANCH
          </span>
        </button>


        <div className="md-brand">
          <motion.div
            className="md-brand-mark"
            initial={{
              rotate: -20,
              scale: 0.8,
              opacity: 0,
            }}
            animate={{
              rotate: 0,
              scale: 1,
              opacity: 1,
            }}
            transition={{
              duration: 0.7,
              type: "spring",
            }}
          >
            M
          </motion.div>

          <div className="md-brand-copy">
            <strong>
              MOOMA
            </strong>

            <span>
              OPERATIONS NETWORK
            </span>
          </div>
        </div>


        <div className="md-header-actions">
          <button
            type="button"
            className="md-icon-button"
            onClick={toggleTheme}
            aria-label="Change theme"
            title={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            <AnimatePresence mode="wait">
              {theme === "dark" ? (
                <motion.span
                  key="sun"
                  initial={{
                    rotate: -90,
                    opacity: 0,
                  }}
                  animate={{
                    rotate: 0,
                    opacity: 1,
                  }}
                  exit={{
                    rotate: 90,
                    opacity: 0,
                  }}
                >
                  <Sun size={17} />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{
                    rotate: 90,
                    opacity: 0,
                  }}
                  animate={{
                    rotate: 0,
                    opacity: 1,
                  }}
                  exit={{
                    rotate: -90,
                    opacity: 0,
                  }}
                >
                  <Moon size={17} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>


          <button
            type="button"
            className="md-header-button md-exit-button"
            onClick={onLogout || onBack}
          >
            <LogOut size={16} />

            <span>
              EXIT
            </span>
          </button>
        </div>
      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="md-main">
        {/* HERO */}

        <motion.section
          className="md-hero"
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
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="md-hero-copy">
            <motion.div
              className="md-kicker"
              initial={{
                opacity: 0,
                x: -15,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: 0.15,
              }}
            >
              <Sparkles size={13} />

              MOOMA / BRANCH OPERATIONS
            </motion.div>


            <h1>
              Welcome to
              <br />

              <span>
                {branch?.name || "MOOMA"}
              </span>
            </h1>


            <p>
              Select an operation below to continue.
              Everything here is connected to your
              selected MOOMA branch.
            </p>


            <div className="md-hero-meta">
              <div>
                <small>
                  BRANCH CODE
                </small>

                <strong>
                  {branch?.code || "—"}
                </strong>
              </div>


              <div>
                <small>
                  NETWORK
                </small>

                <strong className="md-online">
                  <i />

                  ONLINE
                </strong>
              </div>
            </div>
          </div>


          <motion.div
            className="md-hero-visual"
            initial={{
              opacity: 0,
              scale: 0.82,
              rotate: 8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
            }}
            transition={{
              duration: 0.9,
              delay: 0.15,
              type: "spring",
            }}
          >
            <div className="md-orbit md-orbit-one" />

            <div className="md-orbit md-orbit-two" />

            <motion.div
              className="md-hero-logo"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              M
            </motion.div>
          </motion.div>
        </motion.section>


        {/* ====================================================
            OPERATIONS
        ==================================================== */}

        <section
          className="md-operation-section"
          ref={moduleSectionRef}
        >
          <motion.div
            className="md-section-heading"
            initial={{
              opacity: 0,
              y: 20,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.3,
            }}
          >
            <div>
              <small>
                STAFF WORKSPACE
              </small>

              <h2>
                Choose an operation
              </h2>
            </div>


            <div className="md-operation-count">
              <Boxes size={15} />

              {MODULES.length} MODULES
            </div>
          </motion.div>


          <div className="md-module-grid">
            {MODULES.map((module, index) => {
              const Icon = module.icon;

              return (
                <motion.button
                  type="button"
                  key={module.id}
                  className="md-module-card"
                  onClick={() =>
                    openModule(module.id)
                  }
                  initial={{
                    opacity: 0,
                    y: 40,
                    scale: 0.96,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.15,
                  }}
                  transition={{
                    duration: 0.55,
                    delay: index * 0.08,
                  }}
                  whileHover={{
                    y: -7,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                >
                  <div className="md-module-top">
                    <div className="md-module-icon">
                      <Icon size={23} />
                    </div>

                    <span className="md-module-number">
                      {module.number}
                    </span>
                  </div>


                  <div className="md-module-content">
                    <small>
                      {module.label}
                    </small>

                    <h3>
                      {module.title}
                    </h3>

                    <p>
                      {module.description}
                    </p>
                  </div>


                  <div className="md-module-open">
                    <span>
                      OPEN MODULE
                    </span>

                    <ArrowRight size={16} />
                  </div>


                  <div className="md-card-shine" />
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>


      {/* ======================================================
          MODULE OPENING ANIMATION
      ====================================================== */}

      <AnimatePresence>
        {openingModule && (
          <motion.div
            className="md-opening-overlay"
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
            <motion.div
              className="md-opening-animation"
              initial={{
                scale: 0.75,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 1.15,
                opacity: 0,
              }}
            >
              <div className="md-opening-rings">
                <i />
                <i />
                <i />

                <span>
                  M
                </span>
              </div>


              <small>
                MOOMA OPERATIONS
              </small>

              <strong>
                {
                  MODULES.find(
                    (module) =>
                      module.id === openingModule
                  )?.title
                }
              </strong>

              <p>
                Preparing your workspace...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
