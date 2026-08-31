import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Eye,
  PackageCheck,
  RefreshCcw,
  Truck,
} from "lucide-react";

const modules = [
  {
    id: "stock-record",
    number: "01",
    title: "Stock Record",
    subtitle: "STOCK ENTRY",
    description:
      "Record daily, weekly and bakery stock for this branch.",
    icon: PackageCheck,
  },

  {
    id: "stock-view",
    number: "02",
    title: "Stock View",
    subtitle: "STOCK CONTROL",
    description:
      "Review recorded stock values and branch inventory data.",
    icon: Eye,
  },

  {
    id: "stock-transfer",
    number: "03",
    title: "Stock Transfer",
    subtitle: "BRANCH TRANSFER",
    description:
      "Transfer stock between MOOMA branches securely.",
    icon: Truck,
  },

  {
    id: "staff-schedule",
    number: "04",
    title: "Staff Schedule",
    subtitle: "PEOPLE OPERATIONS",
    description:
      "Manage weekly staff shifts, OT and employee schedules.",
    icon: CalendarDays,
  },
];

export default function MoomaDashboard({
  branch,
  onBack,
  onModule,
}) {
  return (
    <motion.div
      className="mooma-dashboard"
      initial={{
        opacity: 0,
        scale: 1.015,
        filter: "blur(12px)",
      }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mooma-dashboard-bg" />

      <nav className="mooma-dashboard-nav">
        <button
          type="button"
          className="mooma-dashboard-back"
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          CHANGE BRANCH
        </button>

        <div className="mooma-dashboard-brand">
          <div className="mooma-dashboard-logo">
            M
          </div>

          <div>
            <strong>MOOMA</strong>
            <span>STAFF OPERATIONS</span>
          </div>
        </div>

        <button
          type="button"
          className="mooma-dashboard-refresh"
        >
          <RefreshCcw size={15} />
        </button>
      </nav>

      <main className="mooma-dashboard-main">
        <section className="mooma-dashboard-hero">
          <div>
            <small>
              MOOMA / BRANCH OPERATIONS
            </small>

            <h1>
              {branch?.name}
            </h1>

            <p>
              {branch?.code}
              {" · "}
              Select the operation you want to continue with.
            </p>

            <div className="mooma-dashboard-status">
              <span>
                <i />
                SYSTEM ONLINE
              </span>

              <span>
                GOOGLE SHEETS CONNECTED
              </span>
            </div>
          </div>

          <motion.div
            className="mooma-dashboard-orbit"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div className="orbit-one" />
            <div className="orbit-two" />

            <div className="orbit-core">
              M
            </div>
          </motion.div>
        </section>

        <section className="mooma-dashboard-modules">
          <div className="mooma-dashboard-heading">
            <div>
              <small>
                STAFF WORKSPACE
              </small>

              <h2>
                Choose an operation
              </h2>
            </div>

            <span>
              4 LIVE MODULES
            </span>
          </div>

          <div className="mooma-dashboard-grid">
            {modules.map((module, index) => {
              const Icon = module.icon;

              return (
                <motion.button
                  type="button"
                  key={module.id}
                  className="mooma-dashboard-card"
                  onClick={() =>
                    onModule?.(module.id)
                  }
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: 0.08 * index,
                  }}
                  whileHover={{
                    y: -6,
                  }}
                  whileTap={{
                    scale: 0.985,
                  }}
                >
                  <div className="mooma-dashboard-card-top">
                    <div className="mooma-dashboard-card-icon">
                      <Icon size={22} />
                    </div>

                    <small>
                      {module.number}
                    </small>
                  </div>

                  <div className="mooma-dashboard-card-copy">
                    <span>
                      {module.subtitle}
                    </span>

                    <h3>
                      {module.title}
                    </h3>

                    <p>
                      {module.description}
                    </p>
                  </div>

                  <div className="mooma-dashboard-open">
                    OPEN MODULE
                    <ArrowRight size={15} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>
    </motion.div>
  );
}
