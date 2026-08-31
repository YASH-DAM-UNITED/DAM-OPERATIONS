import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Eye,
  LogOut,
  PackageCheck,
  Truck,
} from "lucide-react";

const MODULES = [
  {
    id: "stock-record",
    number: "01",
    label: "INVENTORY ENTRY",
    title: "Stock Record",
    description:
      "Record daily, weekly and bakery stock for your MOOMA branch.",
    icon: PackageCheck,
  },
  {
    id: "stock-view",
    number: "02",
    label: "INVENTORY CONTROL",
    title: "Stock View",
    description:
      "Review submitted stock records and branch inventory information.",
    icon: Eye,
  },
  {
    id: "stock-transfer",
    number: "03",
    label: "INTERNAL MOVEMENT",
    title: "Stock Transfer",
    description:
      "Transfer stock securely between MOOMA branches.",
    icon: Truck,
  },
  {
    id: "staff-schedule",
    number: "04",
    label: "TEAM OPERATIONS",
    title: "Staff Schedule",
    description:
      "View and manage weekly staff schedules and shift information.",
    icon: CalendarDays,
  },
];

export default function MoomaDashboard({
  branch,
  onLogout,
  onModule,
}) {
  const branchCode =
    branch?.code || "MOOMA";

  const branchName =
    branch?.name || "MOOMA BRANCH";

  return (
    <motion.div
      className="mooma-dash-root"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        duration: 0.35,
      }}
    >
      {/* BACKGROUND */}

      <div className="mooma-dash-background" />
      <div className="mooma-dash-grid-background" />

      {/* HEADER */}

      <header className="mooma-dash-header">
        <div className="mooma-dash-brand">
          <div className="mooma-dash-brand-mark">
            M
          </div>

          <div className="mooma-dash-brand-copy">
            <strong>MOOMA</strong>
            <span>DAM OPERATIONS</span>
          </div>
        </div>

        <div className="mooma-dash-header-right">
          <div className="mooma-dash-online">
            <i />
            SYSTEM ONLINE
          </div>

          <button
            type="button"
            className="mooma-dash-logout"
            onClick={onLogout}
          >
            <LogOut size={15} />
            <span>CHANGE BRANCH</span>
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main className="mooma-dash-main">
        {/* BRANCH INFORMATION */}

        <motion.section
          className="mooma-dash-hero"
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
        >
          <div className="mooma-dash-hero-copy">
            <div className="mooma-dash-eyebrow">
              MOOMA / STAFF OPERATIONS
            </div>

            <div className="mooma-dash-branch-code">
              {branchCode}
            </div>

            <h1>
              {branchName}
            </h1>

            <p>
              Branch operations are connected and ready.
              Select an operation below to continue.
            </p>

            <div className="mooma-dash-connection-row">
              <div>
                <span className="mooma-dash-live-dot" />

                <div>
                  <small>BRANCH NETWORK</small>
                  <strong>CONNECTED</strong>
                </div>
              </div>

              <div>
                <ClipboardList size={16} />

                <div>
                  <small>AVAILABLE MODULES</small>
                  <strong>04 OPERATIONS</strong>
                </div>
              </div>
            </div>
          </div>

          {/* DECORATIVE CORE */}

          <div className="mooma-dash-core-wrap">
            <motion.div
              className="mooma-dash-core-ring mooma-dash-core-ring-one"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            <motion.div
              className="mooma-dash-core-ring mooma-dash-core-ring-two"
              animate={{
                rotate: -360,
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            <motion.div
              className="mooma-dash-core"
              animate={{
                y: [0, -6, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              M
            </motion.div>
          </div>
        </motion.section>

        {/* MODULE HEADER */}

        <section className="mooma-dash-workspace">
          <div className="mooma-dash-section-heading">
            <div>
              <span>
                STAFF WORKSPACE
              </span>

              <h2>
                Choose an operation
              </h2>
            </div>

            <small>
              04 MODULES AVAILABLE
            </small>
          </div>

          {/* MODULES */}

          <div className="mooma-dash-module-grid">
            {MODULES.map(
              (module, index) => {
                const Icon =
                  module.icon;

                return (
                  <motion.button
                    type="button"
                    key={module.id}
                    className="mooma-dash-module"
                    onClick={() =>
                      onModule?.(
                        module.id
                      )
                    }
                    initial={{
                      opacity: 0,
                      y: 25,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay:
                        0.08 +
                        index * 0.07,
                    }}
                    whileHover={{
                      y: -5,
                    }}
                    whileTap={{
                      scale: 0.985,
                    }}
                  >
                    <div className="mooma-dash-module-top">
                      <div className="mooma-dash-module-icon">
                        <Icon size={21} />
                      </div>

                      <span>
                        {module.number}
                      </span>
                    </div>

                    <div className="mooma-dash-module-copy">
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

                    <div className="mooma-dash-module-open">
                      <span>
                        OPEN MODULE
                      </span>

                      <ArrowRight
                        size={16}
                      />
                    </div>
                  </motion.button>
                );
              }
            )}
          </div>
        </section>

        {/* FOOTER */}

        <footer className="mooma-dash-footer">
          <div>
            <span />
            MOOMA OPERATIONS NETWORK
          </div>

          <p>
            {branchCode}
            {" / "}
            {branchName}
          </p>
        </footer>
      </main>
    </motion.div>
  );
}
