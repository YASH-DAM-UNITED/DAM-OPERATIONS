import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Command,
  Database,
  Download,
  FileChartColumn,
  FileSpreadsheet,
  Filter,
  Gauge,
  GitCompareArrows,
  HeartPulse,
  History,
  Layers3,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Table2,
  Tags,
  TrendingDown,
  TrendingUp,
  UserRoundCog,
  UsersRound,
  Warehouse,
  XCircle,
} from "lucide-react";

import "./BartAdminPortal.css";

/* =========================================================
   NAVIGATION
========================================================= */

const GROUPS = [
  {
    id: "command",
    label: "COMMAND",
    tabs: [
      ["command-center", "Command Center", LayoutDashboard],
      ["live-operations", "Live Operations", Activity],
      ["branch-network", "Branch Network", Building2],
      ["attention-center", "Attention Center", ShieldAlert],
    ],
  },

  {
    id: "inventory",
    label: "INVENTORY",
    tabs: [
      ["inventory-matrix", "Inventory Matrix", Table2],
      ["daily-inventory", "Daily Inventory", ClipboardCheck],
      ["weekly-inventory", "Weekly Inventory", CalendarDays],
      ["global-search", "Global Item Search", Search],
      ["sku-explorer", "SKU Explorer", PackageSearch],
      ["category-explorer", "Category Explorer", Tags],
    ],
  },

  {
    id: "intelligence",
    label: "INTELLIGENCE",
    tabs: [
      ["stock-movement", "Stock Movement", ChartNoAxesCombined],
      ["item-history", "Item History", History],
      ["branch-trends", "Branch Trends", TrendingUp],
      ["fast-movers", "Fast Movers", Gauge],
      ["slow-movers", "Slow Movers", TrendingDown],
      ["stock-distribution", "Stock Distribution", Warehouse],
    ],
  },

  {
    id: "analysis",
    label: "ANALYSIS",
    tabs: [
      ["branch-comparison", "Branch Comparison", GitCompareArrows],
      ["item-comparison", "Item Comparison", Layers3],
      ["date-comparison", "Date Comparison", CalendarDays],
      ["category-comparison", "Category Comparison", BarChart3],
      ["variance-analyzer", "Variance Analyzer", CircleGauge],
    ],
  },

  {
    id: "exceptions",
    label: "EXCEPTIONS",
    tabs: [
      ["exception-center", "Exception Center", AlertTriangle],
      ["zero-stock", "Zero Stock", XCircle],
      ["missing-submissions", "Missing Data", ShieldAlert],
      ["uncategorized", "Uncategorized", Tags],
      ["data-anomalies", "Data Anomalies", HeartPulse],
    ],
  },

  {
    id: "management",
    label: "MANAGEMENT",
    tabs: [
      ["area-managers", "Area Managers", UserRoundCog],
      ["manager-branches", "Manager Branch View", UsersRound],
      ["area-comparison", "Area Comparison", MapPinned],
    ],
  },

  {
    id: "reports",
    label: "REPORTS",
    tabs: [
      ["report-studio", "Report Studio", FileSpreadsheet],
      ["date-range-reports", "Date Range Reports", FileChartColumn],
      ["executive-report", "Executive Report", Download],
      ["custom-export", "Custom Export", Filter],
      ["report-history", "Report History", History],
    ],
  },

  {
    id: "system",
    label: "SYSTEM",
    tabs: [
      ["data-health", "Data Health", Database],
      ["system-settings", "System Settings", Settings2],
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((group) =>
  group.tabs.map(([id, label, Icon]) => ({
    id,
    label,
    Icon,
    group: group.id,
  }))
);

/* =========================================================
   HELPERS
========================================================= */

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function fmt(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(n(value));
}

function yesterdayString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function weekAgoString() {
  const date = new Date();
  date.setDate(date.getDate() - 8);
  return date.toISOString().slice(0, 10);
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function Metric({ label, value, detail, Icon = Activity }) {
  return (
    <motion.article
      className="ba-metric"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 18,
      }}
      whileHover={{
        y: -6,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 18,
        },
      }}
    >
      <div className="metric-icon">
        <Icon />
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </motion.article>
  );
}

function PageHead({ eyebrow, title, text, children }) {
  return (
    <motion.section
      className="page-head"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 110,
        damping: 18,
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>

      {children}
    </motion.section>
  );
}

function Empty({ text }) {
  return (
    <div className="empty">
      <PackageSearch />
      <b>{text}</b>
    </div>
  );
}

function TabLoader({ tab }) {
  const meta = ALL_TABS.find((item) => item.id === tab);

  return (
    <div className="ba-loader">
      <div className="ba-loader-stage">
        <div className="orbit o1" />
        <div className="orbit o2" />
        <div className="orbit o3" />

        <motion.div
          className="loader-core"
          animate={{
            scale: [1, 1.14, 1],
            rotate: [0, 8, -8, 0],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
          }}
        >
          <Sparkles />
        </motion.div>
      </div>

      <b>{meta?.label || "BART Admin"}</b>
      <span>Connecting to live operations...</span>
    </div>
  );
}

/* =========================================================
   TABLE
========================================================= */

function AdminTable({ rows = [], branches = [] }) {
  return (
    <div className="ba-table-wrap">
      <table className="ba-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>ITEM NAME</th>
            <th>UOM</th>

            {branches.map((branch) => (
              <th key={branch}>{branch}</th>
            ))}

            <th>TOTAL</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.SKU}-${row["Item Name"]}-${index}`}>
              <td>
                <b>{row.SKU || "—"}</b>
              </td>

              <td>{row["Item Name"]}</td>

              <td>{row.UOM}</td>

              {branches.map((branch) => (
                <td
                  key={branch}
                  className={n(row[branch]) === 0 ? "zero" : ""}
                >
                  {fmt(row[branch])}
                </td>
              ))}

              <td className="total">
                {fmt(row.total ?? row.Total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   NEW INFINITE MARQUEE COMMAND CENTER
========================================================= */

function InfiniteMarquee({ reverse = false }) {
  const words = [
    "BART OPERATIONS",
    "LIVE INVENTORY",
    "BRANCH INTELLIGENCE",
    "REPORTING",
    "STOCK CONTROL",
    "DAM UNITED",
  ];

  return (
    <div className={`bart-marquee ${reverse ? "reverse" : ""}`}>
      <div className="bart-marquee-track">
        {[...words, ...words].map((word, index) => (
          <div key={`${word}-${index}`}>
            <span>{word}</span>
            <i>•</i>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandCenter({ data, date, setTab }) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const uncategorized = all.filter(
    (item) => item.category === "UNCATEGORIZED DETECTED"
  ).length;

  const zeroCells = all.reduce((sum, row) => {
    return (
      sum +
      (data.branches || []).filter(
        (branch) => n(row[branch.name]) === 0
      ).length
    );
  }, 0);

  const operations = [
    {
      id: "global-search",
      number: "01",
      title: "GLOBAL SEARCH",
      description:
        "Search Daily and Weekly stock together across the complete BART network.",
      Icon: Search,
    },

    {
      id: "daily-inventory",
      number: "02",
      title: "DAILY STOCK",
      description:
        "Selected-date Daily inventory across every loaded BART branch.",
      Icon: ClipboardCheck,
    },

    {
      id: "weekly-inventory",
      number: "03",
      title: "WEEKLY STOCK",
      description:
        "Weekly inventory with branch quantities and network totals.",
      Icon: CalendarDays,
    },

    {
      id: "category-explorer",
      number: "04",
      title: "CATEGORIES",
      description:
        "Food, Dry, Miscellaneous and Uncategorized inventory intelligence.",
      Icon: Tags,
    },

    {
      id: "report-studio",
      number: "05",
      title: "REPORT CENTER",
      description:
        "Professional reporting, exports and operational stock intelligence.",
      Icon: FileSpreadsheet,
    },

    {
      id: "area-managers",
      number: "06",
      title: "AREA MANAGERS",
      description:
        "Management mapping and branch-level operational visibility.",
      Icon: UserRoundCog,
    },
  ];

  const networkPercent = data.branchCount
    ? ((data.loadedBranchCount || 0) / data.branchCount) * 100
    : 0;

  return (
    <div className="bart-command-new">

      {/* HERO */}

      <section className="bart-editorial-hero">

        <motion.div
          className="bart-hero-kicker"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <i />
          BART ADMIN / LIVE OPERATIONS / {date}
        </motion.div>

        <div className="bart-hero-layout">

          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 90,
              damping: 17,
            }}
          >
            <h1>
              INVENTORY
              <br />
              <em>INTELLIGENCE.</em>
            </h1>

            <p>
              One operational surface for BART stock visibility,
              branch intelligence and management reporting.
            </p>
          </motion.div>

          <motion.button
            className="bart-network-orb"
            onClick={() => setTab("data-health")}
            initial={{
              opacity: 0,
              scale: 0.7,
              rotate: -12,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
            }}
            transition={{
              delay: 0.15,
              type: "spring",
              stiffness: 100,
              damping: 15,
            }}
            whileHover={{
              scale: 1.05,
              rotate: 3,
            }}
            whileTap={{
              scale: 0.96,
            }}
          >
            <span>NETWORK LIVE</span>

            <strong>
              {data.loadedBranchCount || 0}
            </strong>

            <small>
              OF {data.branchCount || 0} BRANCHES
            </small>

            <ArrowUpRight />
          </motion.button>

        </div>

      </section>

      <InfiniteMarquee />

      {/* CORE OPERATIONS */}

      <section className="bart-operation-zone">

        <div className="bart-section-head">

          <div>
            <span>01 / PRIORITY OPERATIONS</span>
            <h2>
              Everything you
              <br />
              actually use.
            </h2>
          </div>

          <p>
            Your core Streamlit operations rebuilt as a faster,
            cleaner React command environment.
          </p>

        </div>

        <div className="bart-operation-carousel">

          {operations.map(
            ({
              id,
              number,
              title,
              description,
              Icon,
            }, index) => (

              <motion.button
                key={id}
                className="bart-operation-card"
                onClick={() => setTab(id)}
                initial={{
                  opacity: 0,
                  y: 55,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  amount: 0.15,
                }}
                transition={{
                  delay: index * 0.055,
                  type: "spring",
                  stiffness: 115,
                  damping: 17,
                }}
                whileHover={{
                  y: -12,
                  rotate: -0.6,
                }}
                whileTap={{
                  scale: 0.965,
                }}
              >

                <div className="bart-op-top">
                  <span>{number}</span>
                  <ArrowUpRight />
                </div>

                <Icon className="bart-op-icon" />

                <div className="bart-op-copy">
                  <small>OPEN OPERATION</small>

                  <h3>{title}</h3>

                  <p>{description}</p>
                </div>

              </motion.button>

            )
          )}

        </div>

      </section>

      {/* LIVE SIGNALS */}

      <section className="bart-signal-zone">

        <motion.article
          className="bart-network-panel"
          initial={{
            opacity: 0,
            x: -40,
          }}
          whileInView={{
            opacity: 1,
            x: 0,
          }}
          viewport={{
            once: true,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 17,
          }}
        >

          <span className="eyebrow">
            NETWORK CONDITION
          </span>

          <div className="bart-network-number">
            {data.loadedBranchCount || 0}

            <small>
              /{data.branchCount || 0}
            </small>
          </div>

          <div className="health-bar">
            <i
              style={{
                width: `${networkPercent}%`,
              }}
            />
          </div>

          <div className="health-numbers">
            <b>
              {data.loadedBranchCount || 0} responding
            </b>

            <span>
              {(data.failedBranches || []).length} unavailable
            </span>
          </div>

          <button
            onClick={() => setTab("data-health")}
          >
            DATA HEALTH
            <ArrowUpRight />
          </button>

        </motion.article>

        <div className="bart-signal-stack">

          <motion.button
            onClick={() => setTab("daily-inventory")}
            whileHover={{ x: 8 }}
          >
            <ClipboardCheck />

            <span>
              DAILY ITEMS
            </span>

            <strong>
              {(data.daily || []).length}
            </strong>

            <ArrowRight />
          </motion.button>

          <motion.button
            onClick={() => setTab("weekly-inventory")}
            whileHover={{ x: 8 }}
          >
            <CalendarDays />

            <span>
              WEEKLY ITEMS
            </span>

            <strong>
              {(data.weekly || []).length}
            </strong>

            <ArrowRight />
          </motion.button>

          <motion.button
            onClick={() => setTab("uncategorized")}
            whileHover={{ x: 8 }}
          >
            <Tags />

            <span>
              UNCATEGORIZED
            </span>

            <strong>
              {uncategorized}
            </strong>

            <ArrowRight />
          </motion.button>

          <motion.button
            onClick={() => setTab("exception-center")}
            whileHover={{ x: 8 }}
          >
            <AlertTriangle />

            <span>
              ZERO CELLS
            </span>

            <strong>
              {fmt(zeroCells)}
            </strong>

            <ArrowRight />
          </motion.button>

        </div>

      </section>

      {/* REPORT CENTER PROMOTION */}

      <section className="bart-report-feature">

        <motion.div
          className="bart-report-copy"
          initial={{
            opacity: 0,
            y: 35,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
          }}
        >

          <span>
            02 / REPORT CENTER
          </span>

          <h2>
            Operational
            <br />
            <em>reporting.</em>
          </h2>

          <p>
            Live stock reports, selected-item exports,
            historical movement and management intelligence.
          </p>

          <button
            onClick={() => setTab("report-studio")}
          >
            ENTER REPORT CENTER
            <ArrowUpRight />
          </button>

        </motion.div>

        <div className="bart-report-carousel">

          {[
            {
              no: "01",
              tag: "LIVE",
              title: "Professional Inventory",
              text: "Daily + Weekly + category reporting.",
              target: "report-studio",
            },

            {
              no: "02",
              tag: "SEARCH",
              title: "Selected Items",
              text: "Search and inspect multiple products across branches.",
              target: "global-search",
            },

            {
              no: "03",
              tag: "RANGE",
              title: "Stock Movement",
              text: "Historical movement across your selected date range.",
              target: "date-range-reports",
            },
          ].map((card, index) => (

            <motion.button
              key={card.no}
              onClick={() => setTab(card.target)}
              initial={{
                opacity: 0,
                y: 35,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                delay: index * 0.08,
                type: "spring",
              }}
              whileHover={{
                y: -8,
              }}
            >

              <b>{card.tag}</b>

              <h3>{card.title}</h3>

              <p>{card.text}</p>

              <span>{card.no}</span>

              <ArrowUpRight />

            </motion.button>

          ))}

        </div>

      </section>

      <InfiniteMarquee reverse />

    </div>
  );
}

/* =========================================================
   BRANCH NETWORK
========================================================= */

function BranchNetwork({ data, onBranch }) {
  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="NETWORK"
        title={`${data.branchCount || 0} BART branches`}
        text="Open a branch workspace or inspect its current data connection."
      />

      <div className="branch-grid">

        {(data.branches || []).map(
          (branch, index) => (

            <motion.button
              className="branch-card"
              key={branch.code || branch.name}
              onClick={() => onBranch(branch)}
              initial={{
                opacity: 0,
                y: 22,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                delay: Math.min(index * 0.02, 0.3),
              }}
              whileHover={{
                y: -5,
              }}
            >

              <span>
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <b>{branch.name}</b>
                <small>{branch.code}</small>
              </div>

              <i className="online" />

              <ChevronRight />

            </motion.button>

          )
        )}

      </div>

    </div>
  );
}

/* =========================================================
   INVENTORY
========================================================= */

function InventoryView({
  data,
  mode = "all",
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  let source =
    mode === "daily"
      ? data.daily || []
      : mode === "weekly"
      ? data.weekly || []
      : [
          ...(data.daily || []),
          ...(data.weekly || []),
        ];

  const rows = source.filter((row) => {
    const text =
      `${row.SKU || ""} ${row["Item Name"] || ""} ${row.UOM || ""}`.toLowerCase();

    const searchMatch =
      !query.trim() ||
      text.includes(query.toLowerCase());

    const categoryMatch =
      category === "ALL" ||
      row.category === category;

    return searchMatch && categoryMatch;
  });

  const title =
    mode === "daily"
      ? "Daily Inventory"
      : mode === "weekly"
      ? "Weekly Inventory"
      : "Inventory Matrix";

  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="INVENTORY"
        title={title}
        text={`${rows.length} visible items across ${branches.length} branches.`}
      />

      <div className="toolbar">

        <div className="searchbox">
          <Search />

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search SKU, item or UOM..."
          />
        </div>

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
        >
          <option>ALL</option>
          <option>FOOD ITEMS</option>
          <option>DRY ITEMS</option>
          <option>MISC ITEMS</option>
          <option>UNCATEGORIZED DETECTED</option>
        </select>

      </div>

      <AdminTable
        rows={rows}
        branches={branches}
      />

    </div>
  );
}

/* =========================================================
   GLOBAL SEARCH
========================================================= */

function SearchView({ data }) {
  const [query, setQuery] = useState("");

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  const all = [
    ...(data.daily || []).map((item) => ({
      ...item,
      schedule: "Daily",
    })),

    ...(data.weekly || []).map((item) => ({
      ...item,
      schedule: "Weekly",
    })),
  ];

  const rows = query.trim()
    ? all.filter((row) =>
        `${row.SKU || ""} ${row["Item Name"] || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="GLOBAL SEARCH"
        title="Find stock anywhere."
        text="Search an SKU or item name and inspect its distribution across the complete BART network."
      />

      <motion.div
        className="hero-search"
        initial={{
          opacity: 0,
          y: 25,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          type: "spring",
        }}
      >

        <Search />

        <input
          autoFocus
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Try K242, milk, cups..."
        />

        <kbd>LIVE</kbd>

      </motion.div>

      {query && !rows.length ? (

        <Empty text="No matching stock item found for this date." />

      ) : rows.length ? (

        <>

          <div className="ba-metrics">

            <Metric
              label="MATCHES"
              value={rows.length}
              detail="daily + weekly records"
              Icon={Search}
            />

            <Metric
              label="NETWORK TOTAL"
              value={fmt(
                rows.reduce(
                  (sum, row) =>
                    sum + n(row.total),
                  0
                )
              )}
              detail="matching quantity"
              Icon={Boxes}
            />

          </div>

          <AdminTable
            rows={rows}
            branches={branches}
          />

        </>

      ) : (

        <Empty text="Start typing to search across every loaded branch." />

      )}

    </div>
  );
}

/* =========================================================
   SKU EXPLORER
========================================================= */

function SkuExplorer({ data }) {
  const [sku, setSku] = useState("");

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const options = [
    ...new Set(
      all
        .map((item) => item.SKU)
        .filter(Boolean)
    ),
  ].sort();

  const row = all.find(
    (item) => item.SKU === sku
  );

  const distribution = row
    ? branches
        .map((branch) => ({
          branch,
          qty: n(row[branch]),
        }))
        .sort(
          (a, b) =>
            b.qty - a.qty
        )
    : [];

  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="INVENTORY"
        title="SKU Explorer"
        text="Select one SKU and inspect its exact branch distribution."
      />

      <div className="toolbar">

        <select
          value={sku}
          onChange={(event) =>
            setSku(event.target.value)
          }
        >

          <option value="">
            Select SKU…
          </option>

          {options.map((item) => (
            <option key={item}>
              {item}
            </option>
          ))}

        </select>

      </div>

      {row ? (

        <>

          <div className="ba-metrics">

            <Metric
              label="SKU"
              value={row.SKU}
              detail={row["Item Name"]}
              Icon={PackageSearch}
            />

            <Metric
              label="NETWORK TOTAL"
              value={fmt(row.total)}
              detail={row.UOM}
              Icon={Boxes}
            />

            <Metric
              label="BRANCHES WITH STOCK"
              value={
                distribution.filter(
                  (item) =>
                    item.qty > 0
                ).length
              }
              detail={`of ${branches.length}`}
              Icon={Building2}
            />

          </div>

          <section className="ba-panel">

            <div className="rank-list">

              {distribution.map(
                (item, index) => (

                  <div key={item.branch}>

                    <span>
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <b>
                      {item.branch}
                    </b>

                    <small>
                      {row["Item Name"]}
                    </small>

                    <strong>
                      {fmt(item.qty)} {row.UOM}
                    </strong>

                  </div>

                )
              )}

            </div>

          </section>

        </>

      ) : (

        <Empty text="Choose an SKU to open its branch distribution." />

      )}

    </div>
  );
}

/* =========================================================
   EXCEPTIONS
========================================================= */

function Exceptions({
  data,
  type = "all",
}) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  let rows = all;

  if (type === "unc") {
    rows = all.filter(
      (row) =>
        row.category ===
        "UNCATEGORIZED DETECTED"
    );
  }

  if (type === "zero") {
    rows = all.filter((row) =>
      branches.some(
        (branch) =>
          n(row[branch]) === 0
      )
    );
  }

  const title =
    type === "unc"
      ? "Uncategorized Items"
      : type === "zero"
      ? "Zero Stock Signals"
      : "Exception Center";

  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="EXCEPTIONS"
        title={title}
        text="Fact-based exceptions detected from the currently loaded inventory data."
      />

      <div className="ba-metrics">

        <Metric
          label="FAILED BRANCHES"
          value={
            (data.failedBranches || [])
              .length
          }
          detail="Google Sheet fetch failures"
          Icon={Database}
        />

        <Metric
          label="UNCATEGORIZED"
          value={
            all.filter(
              (row) =>
                row.category ===
                "UNCATEGORIZED DETECTED"
            ).length
          }
          detail="records requiring classification"
          Icon={Tags}
        />

        <Metric
          label="ZERO-SIGNAL ITEMS"
          value={
            all.filter((row) =>
              branches.some(
                (branch) =>
                  n(row[branch]) === 0
              )
            ).length
          }
          detail="items with ≥1 zero branch"
          Icon={XCircle}
        />

      </div>

      <AdminTable
        rows={rows.slice(0, 250)}
        branches={branches}
      />

    </div>
  );
}

/* =========================================================
   DATA HEALTH
========================================================= */

function DataHealth({ data }) {
  return (
    <div className="ba-stack">

      <PageHead
        eyebrow="SYSTEM"
        title="Data Health"
        text="Visibility into the Admin data pipeline without exposing credentials."
      />

      <div className="ba-metrics">

        <Metric
          label="LOADED"
          value={data.loadedBranchCount || 0}
          detail="branch sheets responding"
          Icon={Database}
        />

        <Metric
          label="EXPECTED"
          value={data.branchCount || 0}
          detail="branches from master"
          Icon={Building2}
        />

        <Metric
          label="SOURCE"
          value={
            (
              data.source || "google"
            ).toUpperCase()
          }
          detail="current aggregation source"
          Icon={Activity}
        />

        <Metric
          label="GENERATED"
          value={
            data.generatedAt
              ? new Date(
                  data.generatedAt
                ).toLocaleTimeString()
              : "—"
          }
          detail="latest response time"
          Icon={History}
        />

      </div>

      <section className="ba-panel">

        <header>
          <div>
            <span className="eyebrow">
              FAILED BRANCHES
            </span>

            <h3>
              Connection exceptions
            </h3>
          </div>
        </header>

        {(data.failedBranches || []).length ? (

          (data.failedBranches || []).map(
            (item, index) => (

              <div
                className="failure"
                key={index}
              >
                <XCircle />

                <span>
                  {typeof item === "string"
                    ? item
                    : item.name ||
                      item.branch ||
                      "Unknown branch"}
                </span>

                <small>
                  {item.error ||
                    "Could not load branch sheet"}
                </small>
              </div>

            )
          )

        ) : (

          <div className="success-state">
            <ClipboardCheck />
            <b>
              All loaded branches are responding.
            </b>
          </div>

        )}

      </section>

    </div>
  );
}

/* =========================================================
   SNAPSHOT OPERATIONS
========================================================= */

function SnapshotSpecial({
  tab,
  data,
  setTab,
}) {
  const all = [
    ...(data.daily || []).map(
      (item) => ({
        ...item,
        mode: "Daily",
      })
    ),

    ...(data.weekly || []).map(
      (item) => ({
        ...item,
        mode: "Weekly",
      })
    ),
  ];

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  if (tab === "live-operations") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="COMMAND"
          title="Live Operations"
          text="Current selected-date branch response and inventory activity."
        />

        <div className="ba-metrics">

          <Metric
            label="BRANCHES LIVE"
            value={
              data.loadedBranchCount || 0
            }
            detail={`of ${
              data.branchCount || 0
            }`}
            Icon={Building2}
          />

          <Metric
            label="INVENTORY ROWS"
            value={all.length}
            detail="Daily + Weekly"
            Icon={Boxes}
          />

          <Metric
            label="FAILED"
            value={
              (data.failedBranches || [])
                .length
            }
            detail="branch reads"
            Icon={AlertTriangle}
          />

        </div>

      </div>
    );
  }

  if (tab === "attention-center") {
    return (
      <Exceptions
        data={data}
        type="all"
      />
    );
  }

  if (tab === "category-explorer") {
    const categories = [
      "FOOD ITEMS",
      "DRY ITEMS",
      "MISC ITEMS",
      "UNCATEGORIZED DETECTED",
    ];

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INVENTORY"
          title="Category Explorer"
          text="The same operational categories used by the BART stock system."
        />

        <div className="category-cards">

          {categories.map(
            (category, index) => {

              const rows = all.filter(
                (item) =>
                  item.category ===
                  category
              );

              return (
                <motion.button
                  key={category}
                  onClick={() =>
                    setTab(
                      category ===
                        "UNCATEGORIZED DETECTED"
                        ? "uncategorized"
                        : "inventory-matrix"
                    )
                  }
                  initial={{
                    opacity: 0,
                    y: 25,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    delay: index * 0.06,
                  }}
                  whileHover={{
                    y: -6,
                  }}
                >

                  <span>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </span>

                  <b>{category}</b>

                  <strong>
                    {rows.length}
                  </strong>

                  <small>
                    {fmt(
                      rows.reduce(
                        (sum, row) =>
                          sum +
                          n(row.total),
                        0
                      )
                    )}{" "}
                    network qty
                  </small>

                </motion.button>
              );
            }
          )}

        </div>

      </div>
    );
  }

  if (
    tab === "missing-submissions" ||
    tab === "data-anomalies"
  ) {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="EXCEPTIONS"
          title={
            tab === "missing-submissions"
              ? "Missing Data"
              : "Data Anomalies"
          }
          text="This screen only reports facts supported by the currently loaded branch data."
        />

        <div className="notice">
          <ShieldAlert />

          <div>
            <b>
              No fake operational result is generated.
            </b>

            <span>
              Use Data Health and Exceptions for
              branch-fetch failures and inventory
              signals currently supported by the API.
            </span>
          </div>
        </div>

      </div>
    );
  }

  if (tab === "stock-distribution") {
    const branchTotals = branches
      .map((branch) => ({
        branch,
        qty: all.reduce(
          (sum, row) =>
            sum + n(row[branch]),
          0
        ),
      }))
      .sort(
        (a, b) =>
          b.qty - a.qty
      );

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INTELLIGENCE"
          title="Stock Distribution"
          text="Current selected-date inventory quantity by branch."
        />

        <section className="ba-panel">

          <div className="rank-list">

            {branchTotals.map(
              (item, index) => (

                <div key={item.branch}>

                  <span>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </span>

                  <b>
                    {item.branch}
                  </b>

                  <small>
                    Daily + Weekly
                  </small>

                  <strong>
                    {fmt(item.qty)}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>

      </div>
    );
  }

  if (tab === "system-settings") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="SYSTEM"
          title="System Settings"
          text="Operational settings are intentionally kept separate from Google credentials."
        />

        <div className="notice">
          <Settings2 />

          <div>
            <b>
              No credentials are exposed in the frontend.
            </b>

            <span>
              Google service-account secrets remain
              protected in Cloudflare.
            </span>
          </div>
        </div>

      </div>
    );
  }

  return null;
}

/* =========================================================
   END PART 1
   PART 2 CONTINUES DIRECTLY BELOW THIS POINT
========================================================= */


/* =========================================================
   PART 2
   HISTORICAL / MOVEMENT INTELLIGENCE
========================================================= */

function HistoricalWorkspace({
  tab,
  data,
  historical,
  historicalLoading,
  range,
  setRange,
  loadHistorical,
}) {
  const allCurrent = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const dates = historical?.dates || [];
  const byDate = historical?.byDate || {};

  const [sku, setSku] = useState("");
  const [branch, setBranch] = useState("");

  const skus = [
    ...new Set(
      allCurrent
        .map((item) => item.SKU)
        .filter(Boolean)
    ),
  ].sort();

  const branches = (data.branches || []).map(
    (item) => item.name
  );

  function rowsForDate(date) {
    return [
      ...(byDate?.[date]?.daily || []),
      ...(byDate?.[date]?.weekly || []),
    ];
  }

  function dateTotal(date) {
    return rowsForDate(date).reduce(
      (sum, row) => sum + n(row.total),
      0
    );
  }

  const seriesForSku = sku
    ? dates.map((date) => {
        const rows = rowsForDate(date);

        const row = rows.find(
          (item) => item.SKU === sku
        );

        return {
          date,
          total: n(row?.total),
          row,
        };
      })
    : [];

  const branchSeries = branch
    ? dates.map((date) => {
        const rows = rowsForDate(date);

        return {
          date,
          total: rows.reduce(
            (sum, row) =>
              sum + n(row[branch]),
            0
          ),
        };
      })
    : [];

  const first = dates[0];
  const last = dates[dates.length - 1];

  const movement = useMemo(() => {
    if (!first || !last) {
      return [];
    }

    const startRows = rowsForDate(first);
    const endRows = rowsForDate(last);

    const startMap = new Map(
      startRows.map((row) => [
        `${row.SKU}|${row.UOM}`,
        row,
      ])
    );

    return endRows.map((row) => {
      const oldRow = startMap.get(
        `${row.SKU}|${row.UOM}`
      );

      const start = n(oldRow?.total);
      const end = n(row.total);
      const change = end - start;

      return {
        ...row,
        start,
        end,
        change,
        abs: Math.abs(change),
      };
    });
  }, [first, last, byDate]);

  const rangeBar = (
    <div className="toolbar">

      <label>
        From

        <input
          type="date"
          value={range.start}
          onChange={(event) =>
            setRange((current) => ({
              ...current,
              start: event.target.value,
            }))
          }
        />
      </label>

      <label>
        To

        <input
          type="date"
          value={range.end}
          onChange={(event) =>
            setRange((current) => ({
              ...current,
              end: event.target.value,
            }))
          }
        />
      </label>

      <button
        className="primary-action"
        onClick={() =>
          loadHistorical(false)
        }
        disabled={historicalLoading}
      >
        <RefreshCcw
          className={
            historicalLoading
              ? "spin"
              : ""
          }
        />

        Load Range
      </button>

    </div>
  );

  if (historicalLoading) {
    return <TabLoader tab={tab} />;
  }

  if (!historical) {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="HISTORICAL"
          title="Historical Intelligence"
          text="Choose a date range to load real historical stock data."
        />

        {rangeBar}

        <Empty text="Load a date range to activate this workspace." />

      </div>
    );
  }

  /* STOCK MOVEMENT */

  if (tab === "stock-movement") {
    const rows = [...movement]
      .sort(
        (a, b) =>
          b.abs - a.abs
      )
      .slice(0, 100);

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INTELLIGENCE"
          title="Stock Movement"
          text="Quantity movement between the first and last loaded dates."
        />

        {rangeBar}

        <div className="ba-metrics">

          <Metric
            label="FROM"
            value={first || "—"}
            detail="starting snapshot"
            Icon={CalendarDays}
          />

          <Metric
            label="TO"
            value={last || "—"}
            detail="ending snapshot"
            Icon={CalendarDays}
          />

          <Metric
            label="ITEMS"
            value={movement.length}
            detail="movement records"
            Icon={Boxes}
          />

        </div>

        <section className="ba-panel">

          <div className="rank-list">

            {rows.map((row, index) => (

              <motion.div
                key={`${row.SKU}-${index}`}
                initial={{
                  opacity: 0,
                  x: -15,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  delay: Math.min(
                    index * 0.012,
                    0.3
                  ),
                }}
              >

                <span>
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <b>
                  {row["Item Name"]}
                </b>

                <small>
                  {row.SKU} · {fmt(row.start)} →{" "}
                  {fmt(row.end)}
                </small>

                <strong>
                  {row.change > 0
                    ? "+"
                    : ""}
                  {fmt(row.change)}
                </strong>

              </motion.div>

            ))}

          </div>

        </section>

      </div>
    );
  }

  /* ITEM HISTORY */

  if (tab === "item-history") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INTELLIGENCE"
          title="Item History"
          text="Follow one SKU through every loaded historical date."
        />

        {rangeBar}

        <div className="toolbar">

          <select
            value={sku}
            onChange={(event) =>
              setSku(event.target.value)
            }
          >

            <option value="">
              Select SKU…
            </option>

            {skus.map((item) => (
              <option key={item}>
                {item}
              </option>
            ))}

          </select>

        </div>

        {sku ? (

          <section className="ba-panel">

            <div className="rank-list">

              {seriesForSku.map(
                (item, index) => (

                  <div key={item.date}>

                    <span>
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </span>

                    <b>{item.date}</b>

                    <small>
                      {item.row?.[
                        "Item Name"
                      ] || sku}
                    </small>

                    <strong>
                      {fmt(item.total)}
                    </strong>

                  </div>

                )
              )}

            </div>

          </section>

        ) : (

          <Empty text="Choose an SKU to view its date history." />

        )}

      </div>
    );
  }

  /* BRANCH TRENDS */

  if (tab === "branch-trends") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INTELLIGENCE"
          title="Branch Trends"
          text="Total loaded inventory quantity for one branch across the selected date range."
        />

        {rangeBar}

        <div className="toolbar">

          <select
            value={branch}
            onChange={(event) =>
              setBranch(
                event.target.value
              )
            }
          >

            <option value="">
              Select branch…
            </option>

            {branches.map((item) => (
              <option key={item}>
                {item}
              </option>
            ))}

          </select>

        </div>

        {branch ? (

          <section className="ba-panel">

            <div className="rank-list">

              {branchSeries.map(
                (item, index) => (

                  <div key={item.date}>

                    <span>
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </span>

                    <b>
                      {item.date}
                    </b>

                    <small>
                      {branch}
                    </small>

                    <strong>
                      {fmt(item.total)}
                    </strong>

                  </div>

                )
              )}

            </div>

          </section>

        ) : (

          <Empty text="Choose a branch to inspect its trend." />

        )}

      </div>
    );
  }

  /* FAST / SLOW MOVERS */

  if (
    tab === "fast-movers" ||
    tab === "slow-movers"
  ) {
    const rows = [...movement]
      .filter(
        (row) =>
          row.category !==
          "FOOD ITEMS"
      )
      .sort((a, b) =>
        tab === "fast-movers"
          ? b.abs - a.abs
          : a.abs - b.abs
      )
      .slice(0, 100);

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="INTELLIGENCE"
          title={
            tab === "fast-movers"
              ? "Fast Movers"
              : "Slow Movers"
          }
          text="DRY + MISC items ranked by absolute movement between the first and last loaded dates."
        />

        {rangeBar}

        <section className="ba-panel">

          <div className="rank-list">

            {rows.map((row, index) => (

              <div
                key={`${row.SKU}-${index}`}
              >

                <span>
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <b>
                  {row["Item Name"]}
                </b>

                <small>
                  {row.SKU} ·{" "}
                  {row.category}
                </small>

                <strong>
                  {fmt(row.abs)}
                </strong>

              </div>

            ))}

          </div>

        </section>

      </div>
    );
  }

  /* DATE COMPARISON */

  if (tab === "date-comparison") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="ANALYSIS"
          title="Date Comparison"
          text="Network inventory total for every loaded date."
        />

        {rangeBar}

        <section className="ba-panel">

          <div className="rank-list">

            {dates.map(
              (date, index) => (

                <div key={date}>

                  <span>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </span>

                  <b>
                    {date}
                  </b>

                  <small>
                    Daily + Weekly
                    network quantity
                  </small>

                  <strong>
                    {fmt(
                      dateTotal(date)
                    )}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>

      </div>
    );
  }

  /* VARIANCE */

  if (tab === "variance-analyzer") {
    const rows = [...movement]
      .sort(
        (a, b) =>
          Math.abs(b.change) -
          Math.abs(a.change)
      )
      .slice(0, 100);

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="ANALYSIS"
          title="Variance Analyzer"
          text="Largest positive and negative changes between the first and last loaded dates."
        />

        {rangeBar}

        <section className="ba-panel">

          <div className="rank-list">

            {rows.map((row, index) => (

              <div
                key={`${row.SKU}-${index}`}
              >

                <span>
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <b>
                  {row["Item Name"]}
                </b>

                <small>
                  {row.SKU} ·{" "}
                  {fmt(row.start)} →{" "}
                  {fmt(row.end)}
                </small>

                <strong>
                  {row.change > 0
                    ? "+"
                    : ""}
                  {fmt(row.change)}
                </strong>

              </div>

            ))}

          </div>

        </section>

      </div>
    );
  }

  /* DATE RANGE REPORT */

  if (tab === "date-range-reports") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="REPORTS"
          title="Date Range Reports"
          text="Audit the exact historical dates currently loaded for reporting."
        />

        {rangeBar}

        <div className="ba-metrics">

          <Metric
            label="DATES"
            value={dates.length}
            detail={`${first || "—"} → ${
              last || "—"
            }`}
            Icon={CalendarDays}
          />

          <Metric
            label="BRANCHES"
            value={
              (
                historical.branches ||
                []
              ).length
            }
            detail="included in range"
            Icon={Building2}
          />

          <Metric
            label="FAILED"
            value={
              (
                historical.failedBranches ||
                []
              ).length
            }
            detail="branch reads"
            Icon={ShieldAlert}
          />

        </div>

        <section className="ba-panel">

          <div className="rank-list">

            {dates.map(
              (date, index) => (

                <div key={date}>

                  <span>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </span>

                  <b>
                    {date}
                  </b>

                  <small>
                    Historical inventory
                    snapshot
                  </small>

                  <strong>
                    {fmt(
                      dateTotal(date)
                    )}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>

      </div>
    );
  }

  return null;
}

/* =========================================================
   COMPARISON WORKSPACES
========================================================= */

function ComparisonWorkspace({
  tab,
  data,
}) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const branches = (
    data.branches || []
  ).map(
    (item) => item.name
  );

  const [branchA, setBranchA] =
    useState(
      branches[0] || ""
    );

  const [branchB, setBranchB] =
    useState(
      branches[1] || ""
    );

  const [skuA, setSkuA] =
    useState(
      all[0]?.SKU || ""
    );

  const [skuB, setSkuB] =
    useState(
      all[1]?.SKU || ""
    );

  /* BRANCH COMPARISON */

  if (tab === "branch-comparison") {
    const qtyA = all.reduce(
      (sum, row) =>
        sum + n(row[branchA]),
      0
    );

    const qtyB = all.reduce(
      (sum, row) =>
        sum + n(row[branchB]),
      0
    );

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="ANALYSIS"
          title="Branch Comparison"
          text="Side-by-side selected-date branch totals and item coverage."
        />

        <div className="toolbar">

          <select
            value={branchA}
            onChange={(event) =>
              setBranchA(
                event.target.value
              )
            }
          >
            {branches.map((item) => (
              <option key={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={branchB}
            onChange={(event) =>
              setBranchB(
                event.target.value
              )
            }
          >
            {branches.map((item) => (
              <option key={item}>
                {item}
              </option>
            ))}
          </select>

        </div>

        <div className="ba-metrics">

          <Metric
            label={
              branchA || "BRANCH A"
            }
            value={fmt(qtyA)}
            detail={`${
              all.filter(
                (row) =>
                  n(row[branchA]) > 0
              ).length
            } active items`}
            Icon={Building2}
          />

          <Metric
            label={
              branchB || "BRANCH B"
            }
            value={fmt(qtyB)}
            detail={`${
              all.filter(
                (row) =>
                  n(row[branchB]) > 0
              ).length
            } active items`}
            Icon={Building2}
          />

          <Metric
            label="DIFFERENCE"
            value={fmt(
              qtyA - qtyB
            )}
            detail={`${branchA} minus ${branchB}`}
            Icon={GitCompareArrows}
          />

        </div>

      </div>
    );
  }

  /* ITEM COMPARISON */

  if (tab === "item-comparison") {
    const rowA = all.find(
      (row) =>
        row.SKU === skuA
    );

    const rowB = all.find(
      (row) =>
        row.SKU === skuB
    );

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="ANALYSIS"
          title="Item Comparison"
          text="Compare two SKUs by network total."
        />

        <div className="toolbar">

          <select
            value={skuA}
            onChange={(event) =>
              setSkuA(
                event.target.value
              )
            }
          >
            {all.map(
              (row, index) => (
                <option
                  key={`${row.SKU}-${index}`}
                  value={row.SKU}
                >
                  {row.SKU} ·{" "}
                  {row["Item Name"]}
                </option>
              )
            )}
          </select>

          <select
            value={skuB}
            onChange={(event) =>
              setSkuB(
                event.target.value
              )
            }
          >
            {all.map(
              (row, index) => (
                <option
                  key={`${row.SKU}-${index}`}
                  value={row.SKU}
                >
                  {row.SKU} ·{" "}
                  {row["Item Name"]}
                </option>
              )
            )}
          </select>

        </div>

        <div className="ba-metrics">

          <Metric
            label={
              skuA || "SKU A"
            }
            value={fmt(
              rowA?.total
            )}
            detail={
              rowA?.[
                "Item Name"
              ] || "—"
            }
            Icon={Boxes}
          />

          <Metric
            label={
              skuB || "SKU B"
            }
            value={fmt(
              rowB?.total
            )}
            detail={
              rowB?.[
                "Item Name"
              ] || "—"
            }
            Icon={Boxes}
          />

          <Metric
            label="TOTAL GAP"
            value={fmt(
              n(rowA?.total) -
                n(rowB?.total)
            )}
            detail="A minus B"
            Icon={Layers3}
          />

        </div>

      </div>
    );
  }

  /* CATEGORY COMPARISON */

  if (
    tab === "category-comparison"
  ) {
    const categories = [
      "FOOD ITEMS",
      "DRY ITEMS",
      "MISC ITEMS",
      "UNCATEGORIZED DETECTED",
    ];

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="ANALYSIS"
          title="Category Comparison"
          text="Selected-date quantity and item count by category."
        />

        <div className="category-cards">

          {categories.map(
            (category) => {
              const rows =
                all.filter(
                  (row) =>
                    row.category ===
                    category
                );

              return (
                <section
                  className="ba-panel"
                  key={category}
                >

                  <span className="eyebrow">
                    {category}
                  </span>

                  <h2>
                    {fmt(
                      rows.reduce(
                        (sum, row) =>
                          sum +
                          n(row.total),
                        0
                      )
                    )}
                  </h2>

                  <p>
                    {rows.length} items
                  </p>

                </section>
              );
            }
          )}

        </div>

      </div>
    );
  }

  return null;
}

/* =========================================================
   MANAGEMENT
========================================================= */

function ManagementWorkspace({
  tab,
  data,
  managers,
  managerLoading,
  loadManagers,
}) {
  const [selected, setSelected] =
    useState("");

  const list =
    managers?.managers || [];

  const manager = list.find(
    (item) =>
      item.name === selected
  );

  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  useEffect(() => {
    if (
      !managers &&
      !managerLoading
    ) {
      loadManagers(false);
    }
  }, [
    managers,
    managerLoading,
  ]);

  if (managerLoading) {
    return (
      <TabLoader tab={tab} />
    );
  }

  if (!managers) {
    return (
      <Empty text="Manager mapping has not loaded." />
    );
  }

  /* AREA MANAGERS */

  if (tab === "area-managers") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="MANAGEMENT"
          title="Area Managers"
          text="Directly from the AreaManager / BranchName mapping sheet."
        />

        <div className="manager-grid">

          {list.map(
            (item, index) => (

              <motion.section
                className="ba-panel"
                key={item.name}
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
                }}
                transition={{
                  delay: Math.min(
                    index * 0.05,
                    0.3
                  ),
                }}
              >

                <span className="eyebrow">
                  AREA MANAGER{" "}
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <h3>
                  {item.name}
                </h3>

                <p>
                  {item.branches.length}{" "}
                  assigned branches
                </p>

                <div className="chip-row">

                  {item.branches.map(
                    (branch) => (
                      <span key={branch}>
                        {branch}
                      </span>
                    )
                  )}

                </div>

              </motion.section>

            )
          )}

        </div>

      </div>
    );
  }

  /* MANAGER BRANCH VIEW */

  if (
    tab === "manager-branches"
  ) {
    const selectedBranches =
      manager?.branches || [];

    const managerTotal =
      all.reduce(
        (sum, row) =>
          sum +
          selectedBranches.reduce(
            (branchSum, branch) =>
              branchSum +
              n(row[branch]),
            0
          ),
        0
      );

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="MANAGEMENT"
          title="Manager Branch View"
          text="Select an Area Manager and inspect only their assigned branches."
        />

        <div className="toolbar">

          <select
            value={selected}
            onChange={(event) =>
              setSelected(
                event.target.value
              )
            }
          >

            <option value="">
              Select Area Manager…
            </option>

            {list.map((item) => (
              <option
                key={item.name}
                value={item.name}
              >
                {item.name}
              </option>
            ))}

          </select>

        </div>

        {manager ? (

          <>

            <div className="ba-metrics">

              <Metric
                label="AREA MANAGER"
                value={manager.name}
                detail="selected manager"
                Icon={UserRoundCog}
              />

              <Metric
                label="BRANCHES"
                value={
                  selectedBranches.length
                }
                detail="assigned locations"
                Icon={Building2}
              />

              <Metric
                label="NETWORK QTY"
                value={fmt(
                  managerTotal
                )}
                detail="assigned branch stock"
                Icon={Boxes}
              />

            </div>

            <AdminTable
              rows={all}
              branches={
                selectedBranches
              }
            />

          </>

        ) : (

          <Empty text="Choose an Area Manager to open the assigned branch inventory." />

        )}

      </div>
    );
  }

  /* AREA COMPARISON */

  if (
    tab === "area-comparison"
  ) {
    const ranked = list
      .map((item) => {
        const qty =
          all.reduce(
            (sum, row) =>
              sum +
              item.branches.reduce(
                (
                  branchSum,
                  branch
                ) =>
                  branchSum +
                  n(row[branch]),
                0
              ),
            0
          );

        return {
          ...item,
          qty,
        };
      })
      .sort(
        (a, b) =>
          b.qty - a.qty
      );

    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="MANAGEMENT"
          title="Area Comparison"
          text="Current inventory quantity grouped by Area Manager assignments."
        />

        <section className="ba-panel">

          <div className="rank-list">

            {ranked.map(
              (item, index) => (

                <div key={item.name}>

                  <span>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </span>

                  <b>
                    {item.name}
                  </b>

                  <small>
                    {item.branches.length}{" "}
                    branches
                  </small>

                  <strong>
                    {fmt(item.qty)}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>

      </div>
    );
  }

  return null;
}

/* =========================================================
   REPORTS

   IMPORTANT:
   This uses the real loaded Admin data.
   No fake report history is created.
========================================================= */

function ReportsWorkspace({
  tab,
  data,
}) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const branches = (
    data.branches || []
  ).map(
    (item) => item.name
  );

  function exportCsv() {
    const header = [
      "SKU",
      "Item Name",
      "UOM",
      "Category",
      ...branches,
      "Total",
    ];

    const body = all.map(
      (row) => [
        row.SKU,
        row["Item Name"],
        row.UOM,
        row.category,
        ...branches.map(
          (branch) =>
            row[branch]
        ),
        row.total,
      ]
    );

    const csv = [
      header,
      ...body,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      URL.createObjectURL(blob);

    link.download =
      `BART_Admin_${
        data.date ||
        "inventory"
      }.csv`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      link.href
    );
  }

  if (tab === "report-studio") {
    return (
      <div className="ba-stack">

        <section className="download-hero">

          <span className="eyebrow">
            BART REPORT CENTER
          </span>

          <h2>
            Operational
            <br />
            reporting.
          </h2>

          <p>
            The report workspace uses
            the currently loaded BART
            Admin inventory dataset.
          </p>

          <div className="download-tags">
            <span>
              DAILY INVENTORY
            </span>

            <span>
              WEEKLY INVENTORY
            </span>

            <span>
              CATEGORY DATA
            </span>

            <span>
              BRANCH MATRIX
            </span>
          </div>

        </section>

        <div className="ba-metrics">

          <Metric
            label="ROWS"
            value={all.length}
            detail="Daily + Weekly"
            Icon={FileSpreadsheet}
          />

          <Metric
            label="BRANCHES"
            value={branches.length}
            detail="network columns"
            Icon={Building2}
          />

          <Metric
            label="DATE"
            value={
              data.date || "—"
            }
            detail="selected snapshot"
            Icon={CalendarDays}
          />

        </div>

        <div className="report-grid">

          <motion.section
            className="download-main"
            whileHover={{
              y: -5,
            }}
          >

            <FileSpreadsheet />

            <span className="eyebrow">
              CURRENT SNAPSHOT
            </span>

            <h3>
              Inventory CSV
            </h3>

            <p>
              SKU, Item Name, UOM,
              Category, every branch and
              network Total.
            </p>

            <button
              className="primary-action"
              onClick={exportCsv}
            >
              <Download />
              Download CSV
            </button>

          </motion.section>

          <motion.section
            className="download-main"
            whileHover={{
              y: -5,
            }}
          >

            <FileChartColumn />

            <span className="eyebrow">
              HISTORICAL
            </span>

            <h3>
              Date Range Movement
            </h3>

            <p>
              Use Date Range Reports
              for historical stock
              movement and audit data.
            </p>

          </motion.section>

        </div>

      </div>
    );
  }

  if (
    tab === "executive-report"
  ) {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="REPORTS"
          title="Executive Report"
          text="Compact management summary of the selected-date snapshot."
        />

        <div className="ba-metrics">

          <Metric
            label="NETWORK QTY"
            value={fmt(
              all.reduce(
                (sum, row) =>
                  sum +
                  n(row.total),
                0
              )
            )}
            detail="Daily + Weekly"
            Icon={Boxes}
          />

          <Metric
            label="FAILED BRANCHES"
            value={
              (
                data.failedBranches ||
                []
              ).length
            }
            detail="data pipeline"
            Icon={ShieldAlert}
          />

          <Metric
            label="UNCATEGORIZED"
            value={
              all.filter(
                (row) =>
                  row.category ===
                  "UNCATEGORIZED DETECTED"
              ).length
            }
            detail="classification"
            Icon={Tags}
          />

        </div>

      </div>
    );
  }

  if (tab === "custom-export") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="REPORTS"
          title="Custom Export"
          text="Export the complete current snapshot without modifying Google Sheets."
        />

        <div className="notice">

          <FileSpreadsheet />

          <div>

            <b>
              Current export includes
              identity, category, every
              branch and total.
            </b>

            <span>
              This operation only reads
              the current Admin dataset.
            </span>

          </div>

        </div>

        <button
          className="primary-action"
          onClick={exportCsv}
        >
          <Download />
          Download CSV
        </button>

      </div>
    );
  }

  if (tab === "report-history") {
    return (
      <div className="ba-stack">

        <PageHead
          eyebrow="REPORTS"
          title="Report History"
          text="Generated report history is not currently persisted by the backend."
        />

        <div className="notice">

          <History />

          <div>

            <b>
              Report persistence is not
              enabled.
            </b>

            <span>
              No fake report history is
              shown.
            </span>

          </div>

        </div>

      </div>
    );
  }

  return null;
}

/* =========================================================
   BRANCH WORKSPACE
========================================================= */

function BranchWorkspace({
  branch,
  data,
  onBack,
}) {
  const status = (
    data.failedBranches || []
  ).find(
    (item) =>
      (item.name ||
        item.branch) ===
        branch.name ||
      item.code ===
        branch.code
  );

  const daily = (
    data.daily || []
  ).filter(
    (row) =>
      row[branch.name] !==
      undefined
  );

  const weekly = (
    data.weekly || []
  ).filter(
    (row) =>
      row[branch.name] !==
      undefined
  );

  return (
    <div className="branch-workspace">

      <button
        className="backline"
        onClick={onBack}
      >
        <ArrowLeft />
        BART / BRANCHES
      </button>

      <section className="branch-hero">

        <div>

          <span className="eyebrow">
            BRANCH WORKSPACE
          </span>

          <h1>
            {branch.name}
          </h1>

          <p>
            {branch.code} · Selected
            inventory snapshot
          </p>

        </div>

        <div className="branch-health">

          <i />

          {status
            ? "FETCH FAILED"
            : "DATA CONNECTED"}

        </div>

      </section>

      <div className="ba-metrics">

        <Metric
          label="DAILY RECORDS"
          value={daily.length}
          detail="available item rows"
          Icon={ClipboardCheck}
        />

        <Metric
          label="WEEKLY RECORDS"
          value={weekly.length}
          detail="available item rows"
          Icon={CalendarDays}
        />

        <Metric
          label="DAILY QTY"
          value={fmt(
            daily.reduce(
              (sum, row) =>
                sum +
                n(
                  row[
                    branch.name
                  ]
                ),
              0
            )
          )}
          detail="branch snapshot"
          Icon={Boxes}
        />

        <Metric
          label="WEEKLY QTY"
          value={fmt(
            weekly.reduce(
              (sum, row) =>
                sum +
                n(
                  row[
                    branch.name
                  ]
                ),
              0
            )
          )}
          detail="branch snapshot"
          Icon={Warehouse}
        />

      </div>

      <section className="ba-panel">

        <header>

          <div>

            <span className="eyebrow">
              BRANCH INVENTORY
            </span>

            <h3>
              Complete loaded stock
            </h3>

          </div>

        </header>

        <div className="branch-items">

          {[
            ...daily,
            ...weekly,
          ].map(
            (row, index) => (

              <div key={index}>

                <b>
                  {row["Item Name"]}
                </b>

                <span>
                  {row.SKU || "—"} ·{" "}
                  {row.UOM}
                </span>

                <strong>
                  {fmt(
                    row[
                      branch.name
                    ]
                  )}
                </strong>

              </div>

            )
          )}

        </div>

      </section>

    </div>
  );
}

/* =========================================================
   BART ADMIN PORTAL
   IMPORTANT:
   - Same proven Admin API endpoints
   - Main brand gateway is NOT changed
   - Staff operations are NOT touched
========================================================= */

export default function BartAdminPortal({
  onBack,
}) {
  const [tab, setTab] =
    useState(
      "command-center"
    );

  const [openGroup, setOpenGroup] =
    useState("command");

  const [date, setDate] =
    useState(
      yesterdayString
    );

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [branch, setBranch] =
    useState(null);

  const [navOpen, setNavOpen] =
    useState(false);

  const [managers, setManagers] =
    useState(null);

  const [
    managerLoading,
    setManagerLoading,
  ] = useState(false);

  const [
    historical,
    setHistorical,
  ] = useState(null);

  const [
    historicalLoading,
    setHistoricalLoading,
  ] = useState(false);

  const [range, setRange] =
    useState({
      start:
        weekAgoString(),
      end:
        yesterdayString(),
    });

  async function getJson(
    url,
    options
  ) {
    const response =
      await fetch(
        url,
        options
      );

    let json;

    try {
      json =
        await response.json();
    } catch {
      throw new Error(
        `Invalid server response (${response.status})`
      );
    }

    if (
      !response.ok ||
      json.success === false
    ) {
      throw new Error(
        json.error ||
          json.message ||
          `HTTP ${response.status}`
      );
    }

    return json;
  }

  /* MAIN INVENTORY */

  async function load(
    force = false
  ) {
    setLoading(true);
    setError("");

    try {
      const result =
        await getJson(
          `/api/admin/bart/inventory?date=${encodeURIComponent(
            date
          )}${
            force
              ? "&force=1"
              : ""
          }`
        );

      setData(result);

    } catch (err) {

      console.error(
        "BART Admin inventory:",
        err
      );

      setError(
        err?.message ||
          "Unable to load Admin inventory"
      );

    } finally {

      setLoading(false);

    }
  }

  /* MANAGER MAPPING */

  async function loadManagers(
    force = false
  ) {
    setManagerLoading(true);

    try {
      const result =
        await getJson(
          `/api/admin/bart/manager-mapping${
            force
              ? "?force=1"
              : ""
          }`
        );

      setManagers(result);

    } catch (err) {

      console.error(
        "Manager mapping:",
        err
      );

      setError(
        err?.message ||
          "Unable to load manager mapping"
      );

    } finally {

      setManagerLoading(false);

    }
  }

  /* HISTORICAL */

  async function loadHistorical(
    force = false
  ) {
    if (
      !range.start ||
      !range.end
    ) {
      return;
    }

    setHistoricalLoading(true);

    try {
      const result =
        await getJson(
          `/api/admin/bart/date-range?start=${encodeURIComponent(
            range.start
          )}&end=${encodeURIComponent(
            range.end
          )}${
            force
              ? "&force=1"
              : ""
          }`
        );

      setHistorical(result);

    } catch (err) {

      console.error(
        "Historical Admin data:",
        err
      );

      setError(
        err?.message ||
          "Unable to load historical data"
      );

    } finally {

      setHistoricalLoading(
        false
      );

    }
  }

  /* LOAD INVENTORY WHEN DATE CHANGES */

  useEffect(() => {
    load(false);
  }, [date]);

  const historicalTabs =
    useMemo(
      () =>
        new Set([
          "stock-movement",
          "item-history",
          "branch-trends",
          "fast-movers",
          "slow-movers",
          "date-comparison",
          "variance-analyzer",
          "date-range-reports",
        ]),
      []
    );

  useEffect(() => {
    if (
      historicalTabs.has(tab) &&
      !historical &&
      !historicalLoading
    ) {
      loadHistorical(false);
    }
  }, [
    tab,
    historical,
    historicalLoading,
  ]);

  function choose(
    id,
    group
  ) {
    setTab(id);
    setOpenGroup(group);
    setBranch(null);
    setNavOpen(false);
  }

  const meta =
    ALL_TABS.find(
      (item) =>
        item.id === tab
    );

  let body = null;

  if (data) {
    const special =
      (
        <SnapshotSpecial
          tab={tab}
          data={data}
          setTab={setTab}
        />
      );

    const comparison =
      (
        <ComparisonWorkspace
          tab={tab}
          data={data}
        />
      );

    const management =
      (
        <ManagementWorkspace
          tab={tab}
          data={data}
          managers={managers}
          managerLoading={
            managerLoading
          }
          loadManagers={
            loadManagers
          }
        />
      );

    const reports =
      (
        <ReportsWorkspace
          tab={tab}
          data={data}
        />
      );

    const historicalBody =
      (
        <HistoricalWorkspace
          tab={tab}
          data={data}
          historical={
            historical
          }
          historicalLoading={
            historicalLoading
          }
          range={range}
          setRange={setRange}
          loadHistorical={
            loadHistorical
          }
        />
      );

    if (
      tab ===
      "command-center"
    ) {
      body = (
        <CommandCenter
          data={data}
          date={date}
          setTab={setTab}
        />
      );
    }

    else if (
      tab ===
      "branch-network"
    ) {
      body = (
        <BranchNetwork
          data={data}
          onBranch={
            setBranch
          }
        />
      );
    }

    else if (
      tab ===
      "inventory-matrix"
    ) {
      body = (
        <InventoryView
          data={data}
        />
      );
    }

    else if (
      tab ===
      "daily-inventory"
    ) {
      body = (
        <InventoryView
          data={data}
          mode="daily"
        />
      );
    }

    else if (
      tab ===
      "weekly-inventory"
    ) {
      body = (
        <InventoryView
          data={data}
          mode="weekly"
        />
      );
    }

    else if (
      tab ===
      "global-search"
    ) {
      body = (
        <SearchView
          data={data}
        />
      );
    }

    else if (
      tab ===
      "sku-explorer"
    ) {
      body = (
        <SkuExplorer
          data={data}
        />
      );
    }

    else if (
      tab ===
      "exception-center"
    ) {
      body = (
        <Exceptions
          data={data}
        />
      );
    }

    else if (
      tab ===
      "zero-stock"
    ) {
      body = (
        <Exceptions
          data={data}
          type="zero"
        />
      );
    }

    else if (
      tab ===
      "uncategorized"
    ) {
      body = (
        <Exceptions
          data={data}
          type="unc"
        />
      );
    }

    else if (
      tab ===
      "data-health"
    ) {
      body = (
        <DataHealth
          data={data}
        />
      );
    }

    else if (special) {
      body = special;
    }

    else if (
      historicalTabs.has(tab)
    ) {
      body =
        historicalBody;
    }

    else if (comparison) {
      body =
        comparison;
    }

    else if (
      [
        "area-managers",
        "manager-branches",
        "area-comparison",
      ].includes(tab)
    ) {
      body =
        management;
    }

    else if (
      [
        "report-studio",
        "executive-report",
        "custom-export",
        "report-history",
      ].includes(tab)
    ) {
      body =
        reports;
    }

    else {
      body = (
        <div className="ba-stack">

          <PageHead
            eyebrow={
              meta?.group?.toUpperCase() ||
              "BART ADMIN"
            }
            title={
              meta?.label ||
              "Workspace"
            }
            text="This workspace only displays data supported by the current BART Admin source."
          />

          <Empty text="No unsupported or duplicated analytics are shown here." />

        </div>
      );
    }
  }

  return (
    <div className="bart-admin">

      {/* ===================================================
          LEFT ADMIN NAVIGATION
      =================================================== */}

      <aside
        className={
          navOpen
            ? "open"
            : ""
        }
      >

        <div className="admin-brand">

          <div className="brand-mark">
            B
          </div>

          <div>
            <b>BART</b>
            <span>
              ADMIN COMMAND
            </span>
          </div>

        </div>

        <nav>

          {GROUPS.map(
            (group) => (

              <div
                className="nav-group"
                key={group.id}
              >

                <button
                  className="group-title"
                  onClick={() =>
                    setOpenGroup(
                      openGroup ===
                        group.id
                        ? ""
                        : group.id
                    )
                  }
                >

                  <span>
                    {group.label}
                  </span>

                  <small>
                    {group.tabs.length}
                  </small>

                </button>

                <AnimatePresence
                  initial={false}
                >

                  {openGroup ===
                    group.id && (

                    <motion.div
                      className="group-tabs"
                      initial={{
                        height: 0,
                        opacity: 0,
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                      }}
                    >

                      {group.tabs.map(
                        ([
                          id,
                          label,
                          Icon,
                        ]) => (

                          <button
                            key={id}
                            className={
                              tab === id
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              choose(
                                id,
                                group.id
                              )
                            }
                          >

                            <Icon />

                            <span>
                              {label}
                            </span>

                          </button>

                        )
                      )}

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>

            )
          )}

        </nav>

        <button
          className="all-brands"
          onClick={onBack}
        >
          <ArrowLeft />
          ALL BRANDS
        </button>

      </aside>

      {/* ===================================================
          MAIN BART ADMIN
      =================================================== */}

      <main>

        <header className="admin-top">

          <button
            className="mobile-nav"
            onClick={() =>
              setNavOpen(
                !navOpen
              )
            }
          >
            <Command />
          </button>

          <div className="crumb">

            <span>
              DAM UNITED / BART
            </span>

            <b>
              {meta?.label ||
                "Command Center"}
            </b>

          </div>

          <div className="top-actions">

            <label>

              <CalendarDays />

              <input
                type="date"
                value={date}
                onChange={(
                  event
                ) =>
                  setDate(
                    event.target
                      .value
                  )
                }
              />

            </label>

            <button
              onClick={() =>
                load(true)
              }
              disabled={loading}
            >

              <RefreshCcw
                className={
                  loading
                    ? "spin"
                    : ""
                }
              />

              Refresh

            </button>

          </div>

        </header>

        <div className="admin-content">

          {branch && data ? (

            <BranchWorkspace
              branch={branch}
              data={data}
              onBack={() =>
                setBranch(null)
              }
            />

          ) : error ? (

            <div className="fatal">

              <AlertTriangle />

              <h2>
                Admin data unavailable
              </h2>

              <p>{error}</p>

              <button
                onClick={() => {
                  setError("");
                  load(true);
                }}
              >
                Retry connection
              </button>

            </div>

          ) : (

            <AnimatePresence
              mode="wait"
            >

              {loading ? (

                <motion.div
                  key={`load-${tab}`}
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

                  <TabLoader
                    tab={tab}
                  />

                </motion.div>

              ) : (

                <motion.div
                  key={tab}
                  initial={{
                    opacity: 0,
                    y: 24,
                    scale: 0.995,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: -12,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 20,
                  }}
                >

                  {body}

                </motion.div>

              )}

            </AnimatePresence>

          )}

        </div>

      </main>

    </div>
  );
}
