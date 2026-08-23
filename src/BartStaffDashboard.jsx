import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  RefreshCcw,
  LogOut,
  Bell,
  Activity,
  PackageOpen,
  ArrowLeftRight,
  ClipboardList,
  MapPin,
  Clock3,
  Coffee,
  ShieldCheck,
} from "lucide-react";

/* =========================================================
   BART STAFF MODULES
========================================================= */

const modules = [
  {
    id: "stock-record",
    icon: ClipboardList,
    number: "01",
    title: "Stock Record",
    subtitle: "DAILY & WEEKLY ENTRY",
    description:
      "Record branch stock quantities and submit daily or weekly operational stock updates.",
  },

  {
    id: "schedule",
    icon: CalendarDays,
    number: "02",
    title: "Staff Schedule",
    subtitle: "SHIFT OPERATIONS",
    description:
      "View staff assignments, daily shifts and branch scheduling information.",
  },

  {
    id: "stock-view",
    icon: Boxes,
    number: "03",
    title: "Stock View",
    subtitle: "BRANCH INVENTORY",
    description:
      "Review daily and weekly stock balances with fast branch-level visibility.",
  },

  {
    id: "transfer",
    icon: ArrowLeftRight,
    number: "04",
    title: "Stock Transfer",
    subtitle: "INTERNAL MOVEMENT",
    description:
      "Send and receive stock between DAM branches with transfer tracking.",
  },
];

/* =========================================================
   BART STAFF DASHBOARD
========================================================= */

function BartStaffDashboard({
  branch = {
    code: "B001",
    name: "BART Branch",
  },

  onBack,
  onLogout,
  onRefresh,
  onModule,
}) {
  return (
    <div className="bart-dashboard">
      {/* BACKGROUND */}

      <div className="bart-dashboard-grid" />

      <div className="bart-dashboard-glow glow-one" />

      <div className="bart-dashboard-glow glow-two" />

      {/* ===================================================
          NAVIGATION
      =================================================== */}

      <header className="bart-dashboard-nav">
        <motion.div
          className="bart-dash-brand"
          initial={{
            opacity: 0,
            x: -18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <div className="bart-dash-logo">
            <Coffee size={19} />
          </div>

          <div>
            <strong>BART</strong>

            <span>STAFF OPERATIONS</span>
          </div>
        </motion.div>

        <motion.div
          className="bart-nav-actions"
          initial={{
            opacity: 0,
            x: 18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <div className="bart-session-status">
            <span />

            LIVE SESSION
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={() => onRefresh?.()}
            className="bart-icon-button"
            title="Refresh"
          >
            <RefreshCcw size={17} />
          </button>

          {/* LOGOUT */}

          <button
            type="button"
            onClick={() => onLogout?.()}
            className="bart-icon-button danger"
            title="Logout"
          >
            <LogOut size={17} />
          </button>
        </motion.div>
      </header>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="bart-dashboard-main">
        {/* CHANGE BRANCH */}

        <motion.button
          type="button"
          className="bart-back-button"
          onClick={() => onBack?.()}
          initial={{
            opacity: 0,
            x: -10,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <ArrowLeft size={15} />

          CHANGE BRANCH
        </motion.button>

        {/* =================================================
            HERO
        ================================================= */}

        <section className="bart-dashboard-hero">
          <motion.div
            className="bart-hero-copy"
            initial={{
              opacity: 0,
              y: 28,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.55,
            }}
          >
            <div className="bart-mini-label">
              <Activity size={12} />

              BART BRANCH NETWORK
            </div>

            <h1>
              Branch operations,
              <br />

              <span>in one place.</span>
            </h1>

            <p>
              Manage stock, transfers, schedules and daily branch operations
              from your BART workspace.
            </p>
          </motion.div>

          {/* ACTIVE BRANCH CARD */}

          <motion.div
            className="bart-branch-card"
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              delay: 0.1,
              duration: 0.5,
            }}
          >
            <div className="bart-branch-top">
              <div className="bart-branch-location">
                <MapPin size={16} />
              </div>

              <span>ACTIVE BRANCH</span>
            </div>

            <h2>{branch?.name || "BART Branch"}</h2>

            <div className="bart-branch-code">
              {branch?.code || "B001"}
            </div>

            <div className="bart-branch-meta">
              <div>
                <Clock3 size={14} />

                <span>Session Active</span>
              </div>

              <div>
                <ShieldCheck size={14} />

                <span>Authenticated</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* =================================================
            TRANSFER STATUS
        ================================================= */}

        <motion.section
          className="bart-notification-strip"
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.17,
          }}
        >
          <div className="bart-notification-icon">
            <Bell size={17} />
          </div>

          <div className="bart-notification-text">
            <small>TRANSFER CENTER</small>

            <strong>No pending transfers right now</strong>
          </div>

          <button
            type="button"
            onClick={() => onModule?.("transfer")}
          >
            View Transfers

            <ArrowRight size={15} />
          </button>
        </motion.section>

        {/* =================================================
            MODULE HEADING
        ================================================= */}

        <section className="bart-module-header">
          <div>
            <span>OPERATIONS</span>

            <h2>What do you need to do?</h2>
          </div>

          <div className="bart-module-count">
            04 MODULES
          </div>
        </section>

        {/* =================================================
            MODULES
        ================================================= */}

        <section className="bart-module-grid">
          {modules.map((module, index) => {
            const Icon = module.icon;

            return (
              <motion.button
                type="button"
                key={module.id}
                className="bart-module-card"
                onClick={() => onModule?.(module.id)}
                initial={{
                  opacity: 0,
                  y: 30,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.22 + index * 0.07,
                  duration: 0.45,
                }}
                whileHover={{
                  y: -7,
                }}
                whileTap={{
                  scale: 0.985,
                }}
              >
                <div className="bart-card-light" />

                <div className="bart-module-top">
                  <div className="bart-module-icon">
                    <Icon size={22} />
                  </div>

                  <span className="bart-module-number">
                    {module.number}
                  </span>
                </div>

                <div className="bart-module-subtitle">
                  {module.subtitle}
                </div>

                <h3>{module.title}</h3>

                <p>{module.description}</p>

                <div className="bart-module-open">
                  <span>OPEN MODULE</span>

                  <div>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </section>

        {/* =================================================
            BOTTOM STATUS
        ================================================= */}

        <motion.section
          className="bart-bottom-status"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.5,
          }}
        >
          <div>
            <PackageOpen size={17} />

            <span>
              <strong>Branch data</strong>

              <small>Ready for operations</small>
            </span>
          </div>

          <div className="bart-status-line" />

          <div>
            <ShieldCheck size={17} />

            <span>
              <strong>Secure session</strong>

              <small>Branch access verified</small>
            </span>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

export default BartStaffDashboard;
