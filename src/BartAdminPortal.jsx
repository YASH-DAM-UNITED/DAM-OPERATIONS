import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
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
  LoaderCircle,
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

import * as XLSX from "xlsx-js-style";
import "./BartAdminPortal.css";

/* =========================================================
   NAVIGATION
========================================================= */

const GROUPS = [
  {
    id: "reports",
    label: "REPORTS / DOWNLOADS",
    tabs: [
      ["report-studio", "Download Center", FileSpreadsheet],
      ["date-range-reports", "Date Range Reports", FileChartColumn],
      ["executive-report", "Executive Report", Download],
      ["custom-export", "Custom Export", Filter],
      ["report-history", "Report History", History],
    ],
  },

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
    id: "system",
    label: "SYSTEM",
    tabs: [
      ["data-health", "Data Health", Database],
      ["system-settings", "System Settings", Settings2],
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((group) =>
  group.tabs.map((tab) => ({
    id: tab[0],
    label: tab[1],
    Icon: tab[2],
    group: group.id,
  }))
);

/* =========================================================
   BASIC HELPERS
========================================================= */

const numberValue = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(numberValue(value));

const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

const weekAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 8);
  return date.toISOString().slice(0, 10);
};

const safeSheetName = (value) =>
  String(value || "Report")
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31);

/* =========================================================
   EXCEL HELPERS
========================================================= */

const TITLE_STYLE = {
  font: {
    bold: true,
    color: { rgb: "FFFFFF" },
    sz: 16,
  },
  fill: {
    fgColor: { rgb: "111827" },
  },
  alignment: {
    vertical: "center",
    horizontal: "left",
  },
};

const HEADER_STYLE = {
  font: {
    bold: true,
    color: { rgb: "FFFFFF" },
  },
  fill: {
    fgColor: { rgb: "1F2937" },
  },
  alignment: {
    vertical: "center",
    horizontal: "center",
    wrapText: true,
  },
  border: {
    top: { style: "thin", color: { rgb: "374151" } },
    bottom: { style: "thin", color: { rgb: "374151" } },
    left: { style: "thin", color: { rgb: "374151" } },
    right: { style: "thin", color: { rgb: "374151" } },
  },
};

const CELL_STYLE = {
  border: {
    top: { style: "thin", color: { rgb: "E5E7EB" } },
    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
    left: { style: "thin", color: { rgb: "E5E7EB" } },
    right: { style: "thin", color: { rgb: "E5E7EB" } },
  },
  alignment: {
    vertical: "center",
  },
};

const TOTAL_STYLE = {
  ...CELL_STYLE,
  font: {
    bold: true,
    color: { rgb: "065F46" },
  },
  fill: {
    fgColor: { rgb: "ECFDF5" },
  },
};

function styleWorksheet(
  worksheet,
  {
    headerRow = 1,
    titleRow = 0,
    freeze = "E2",
    autoFilter = true,
  } = {}
) {
  if (!worksheet || !worksheet["!ref"]) return;

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];

      if (!cell) continue;

      if (row === titleRow) {
        cell.s = TITLE_STYLE;
      } else if (row === headerRow) {
        cell.s = HEADER_STYLE;
      } else {
        cell.s = CELL_STYLE;

        if (col === range.e.c) {
          cell.s = TOTAL_STYLE;
        }
      }
    }
  }

  worksheet["!freeze"] = {
    xSplit: Math.max(
      0,
      XLSX.utils.decode_cell(freeze).c
    ),
    ySplit: Math.max(
      0,
      XLSX.utils.decode_cell(freeze).r
    ),
    topLeftCell: freeze,
    activePane: "bottomRight",
    state: "frozen",
  };

  if (autoFilter) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow, c: range.s.c },
        e: { r: range.e.r, c: range.e.c },
      }),
    };
  }
}

function inventorySheet(rows, branches, title) {
  const headers = [
    "SKU",
    "ITEM NAME",
    "UOM",
    "CATEGORY",
    ...branches,
    "TOTAL",
  ];

  const dataRows = rows.map((row) => [
    row.SKU || "",
    row["Item Name"] || "",
    row.UOM || "",
    row.category || "",
    ...branches.map((branch) => numberValue(row[branch])),
    numberValue(row.total ?? row.Total),
  ]);

  const aoa = [
    [title],
    headers,
    ...dataRows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: headers.length - 1 },
    },
  ];

  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 13 },
    { wch: 25 },
    ...branches.map(() => ({ wch: 16 })),
    { wch: 16 },
  ];

  worksheet["!rows"] = [
    { hpt: 28 },
    { hpt: 30 },
  ];

  styleWorksheet(worksheet, {
    titleRow: 0,
    headerRow: 1,
    freeze: "E3",
  });

  return worksheet;
}

function dashboardSummarySheet(data) {
  const daily = data.daily || [];
  const weekly = data.weekly || [];
  const all = [...daily, ...weekly];

  const categories = [
    "FOOD ITEMS",
    "DRY ITEMS",
    "MISC ITEMS",
    "UNCATEGORIZED DETECTED",
  ];

  const rows = [
    ["BART ADMIN PROFESSIONAL STOCK REPORT"],
    [],
    ["REPORT DATE", data.date || ""],
    ["GENERATED", new Date().toLocaleString()],
    ["EXPECTED BRANCHES", data.branchCount || 0],
    ["LOADED BRANCHES", data.loadedBranchCount || 0],
    ["FAILED BRANCHES", (data.failedBranches || []).length],
    [],
    ["INVENTORY SUMMARY", "ITEMS", "NETWORK QTY"],
    [
      "DAILY",
      daily.length,
      daily.reduce(
        (sum, row) => sum + numberValue(row.total ?? row.Total),
        0
      ),
    ],
    [
      "WEEKLY",
      weekly.length,
      weekly.reduce(
        (sum, row) => sum + numberValue(row.total ?? row.Total),
        0
      ),
    ],
    [
      "COMBINED",
      all.length,
      all.reduce(
        (sum, row) => sum + numberValue(row.total ?? row.Total),
        0
      ),
    ],
    [],
    ["CATEGORY", "ITEMS", "NETWORK QTY"],
    ...categories.map((category) => {
      const categoryRows = all.filter(
        (row) => row.category === category
      );

      return [
        category,
        categoryRows.length,
        categoryRows.reduce(
          (sum, row) =>
            sum + numberValue(row.total ?? row.Total),
          0
        ),
      ];
    }),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 2 },
    },
  ];

  worksheet["!cols"] = [
    { wch: 32 },
    { wch: 18 },
    { wch: 22 },
  ];

  if (worksheet.A1) {
    worksheet.A1.s = TITLE_STYLE;
  }

  ["A9", "B9", "C9", "A14", "B14", "C14"].forEach(
    (address) => {
      if (worksheet[address]) {
        worksheet[address].s = HEADER_STYLE;
      }
    }
  );

  return worksheet;
}

function buildLiveWorkbook(data) {
  const workbook = XLSX.utils.book_new();

  const branches = (data.branches || []).map(
    (branch) => branch.name
  );

  const daily = data.daily || [];
  const weekly = data.weekly || [];
  const all = [...daily, ...weekly];

  XLSX.utils.book_append_sheet(
    workbook,
    dashboardSummarySheet(data),
    "Dashboard Summary"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    inventorySheet(
      daily,
      branches,
      `BART DAILY INVENTORY — ${data.date || ""}`
    ),
    "Daily"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    inventorySheet(
      weekly,
      branches,
      `BART WEEKLY INVENTORY — ${data.date || ""}`
    ),
    "Weekly"
  );

  const categories = [
    "FOOD ITEMS",
    "DRY ITEMS",
    "MISC ITEMS",
    "UNCATEGORIZED DETECTED",
  ];

  categories.forEach((category) => {
    const rows = all.filter(
      (row) => row.category === category
    );

    if (!rows.length) return;

    XLSX.utils.book_append_sheet(
      workbook,
      inventorySheet(
        rows,
        branches,
        `${category} — ${data.date || ""}`
      ),
      safeSheetName(category)
    );
  });

  return workbook;
}

function downloadWorkbook(workbook, fileName) {
  XLSX.writeFile(workbook, fileName, {
    compression: true,
    bookType: "xlsx",
  });
}

/* =========================================================
   DATE RANGE REPORT
========================================================= */

function buildMovementRows(rangeData, mode) {
  const dates = rangeData?.dates || [];
  const byDate = rangeData?.byDate || {};

  const itemMap = new Map();

  dates.forEach((date) => {
    const snapshot = byDate[date] || {};

    let rows = [];

    if (mode === "daily") {
      rows = snapshot.daily || [];
    } else if (mode === "weekly") {
      rows = snapshot.weekly || [];
    } else {
      rows = [
        ...(snapshot.daily || []),
        ...(snapshot.weekly || []),
      ];
    }

    rows.forEach((row) => {
      const key = `${row.SKU || ""}|${row.UOM || ""}|${
        row["Item Name"] || ""
      }`;

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          SKU: row.SKU || "",
          "Item Name": row["Item Name"] || "",
          UOM: row.UOM || "",
          Category: row.category || "",
          values: {},
        });
      }

      itemMap.get(key).values[date] = numberValue(
        row.total ?? row.Total
      );
    });
  });

  return [...itemMap.values()];
}

function movementSheet(rangeData, mode, title) {
  const dates = rangeData?.dates || [];
  const rows = buildMovementRows(rangeData, mode);

  const headers = [
    "SKU",
    "ITEM NAME",
    "UOM",
    "CATEGORY",
    ...dates,
    "START",
    "END",
    "CHANGE",
    "ABS MOVEMENT",
  ];

  const output = rows.map((row) => {
    const start = numberValue(
      row.values[dates[0]]
    );

    const end = numberValue(
      row.values[dates[dates.length - 1]]
    );

    return [
      row.SKU,
      row["Item Name"],
      row.UOM,
      row.Category,
      ...dates.map((date) =>
        numberValue(row.values[date])
      ),
      start,
      end,
      end - start,
      Math.abs(end - start),
    ];
  });

  const aoa = [
    [title],
    headers,
    ...output,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: headers.length - 1 },
    },
  ];

  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 13 },
    { wch: 24 },
    ...dates.map(() => ({ wch: 13 })),
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];

  styleWorksheet(worksheet, {
    titleRow: 0,
    headerRow: 1,
    freeze: "E3",
  });

  return worksheet;
}

function fastMovingSheet(rangeData, selectedSkus = []) {
  const rows = buildMovementRows(
    rangeData,
    "combined"
  );

  const dates = rangeData?.dates || [];

  let filtered = rows;

  if (selectedSkus.length) {
    filtered = rows.filter((row) =>
      selectedSkus.includes(row.SKU)
    );
  }

  const output = filtered
    .map((row) => {
      const start = numberValue(
        row.values[dates[0]]
      );

      const end = numberValue(
        row.values[dates[dates.length - 1]]
      );

      return {
        ...row,
        start,
        end,
        change: end - start,
        movement: Math.abs(end - start),
      };
    })
    .sort(
      (a, b) => b.movement - a.movement
    );

  const aoa = [
    ["BART FAST MOVING ITEMS"],
    [
      "RANK",
      "SKU",
      "ITEM NAME",
      "UOM",
      "CATEGORY",
      "START",
      "END",
      "CHANGE",
      "ABS MOVEMENT",
    ],

    ...output.map((row, index) => [
      index + 1,
      row.SKU,
      row["Item Name"],
      row.UOM,
      row.Category,
      row.start,
      row.end,
      row.change,
      row.movement,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 8 },
    },
  ];

  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 42 },
    { wch: 13 },
    { wch: 25 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];

  styleWorksheet(worksheet, {
    titleRow: 0,
    headerRow: 1,
    freeze: "F3",
  });

  return worksheet;
}

function buildRangeWorkbook(
  rangeData,
  selectedSkus = []
) {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    movementSheet(
      rangeData,
      "daily",
      "BART DAILY STOCK MOVEMENT"
    ),
    "Daily"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    movementSheet(
      rangeData,
      "weekly",
      "BART WEEKLY STOCK MOVEMENT"
    ),
    "Weekly"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    movementSheet(
      rangeData,
      "combined",
      "BART COMBINED STOCK MOVEMENT"
    ),
    "Combined"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    fastMovingSheet(
      rangeData,
      selectedSkus
    ),
    "Fast Moving"
  );

  return workbook;
}

/* =========================================================
   SHARED UI
========================================================= */

const loaderCopy = [
  [
    "Synchronizing branch constellation",
    "Reading operational signals",
  ],
  [
    "Assembling inventory matrix",
    "Aligning branch quantities",
  ],
  [
    "Tracing stock pathways",
    "Building movement intelligence",
  ],
  [
    "Inspecting exceptions",
    "Separating signal from noise",
  ],
  [
    "Calibrating analytics",
    "Preparing comparison layers",
  ],
  [
    "Mapping branch network",
    "Verifying data availability",
  ],
  [
    "Preparing command surface",
    "Prioritizing management signals",
  ],
  [
    "Compiling report intelligence",
    "Structuring export layers",
  ],
];

function TabLoader({ tab }) {
  const index =
    Math.abs(
      tab
        .split("")
        .reduce(
          (sum, char) =>
            sum + char.charCodeAt(0),
          0
        )
    ) % loaderCopy.length;

  const [title, subtitle] =
    loaderCopy[index];

  return (
    <div
      className={`ba-loader loader-${index}`}
    >
      <div className="ba-loader-stage">
        <span className="orbit o1" />
        <span className="orbit o2" />
        <span className="orbit o3" />

        <div className="loader-core">
          <Sparkles size={22} />
        </div>

        <div className="scan-line" />
      </div>

      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  Icon = Activity,
}) {
  return (
    <motion.div
      className="ba-metric"
      whileHover={{ y: -4 }}
    >
      <div className="metric-icon">
        <Icon size={18} />
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </motion.div>
  );
}

function PageHead({
  eyebrow,
  title,
  text,
  children,
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">
          {eyebrow}
        </span>

        <h2>{title}</h2>
        <p>{text}</p>
      </div>

      {children}
    </div>
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

function AdminTable({
  rows,
  branches,
}) {
  return (
    <div className="ba-table-wrap">
      <table className="ba-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>ITEM NAME</th>
            <th>UOM</th>

            {branches.map((branch) => (
              <th key={branch}>
                {branch}
              </th>
            ))}

            <th>TOTAL</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.SKU}-${row["Item Name"]}-${index}`}
            >
              <td>
                <b>{row.SKU || "—"}</b>
              </td>

              <td>
                {row["Item Name"]}
              </td>

              <td>{row.UOM}</td>

              {branches.map((branch) => (
                <td
                  key={branch}
                  className={
                    numberValue(
                      row[branch]
                    ) === 0
                      ? "zero"
                      : ""
                  }
                >
                  {formatNumber(
                    row[branch]
                  )}
                </td>
              ))}

              <td className="total">
                {formatNumber(
                  row.total ??
                    row.Total
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   COMMAND CENTER
========================================================= */

function CommandCenter({
  data,
  date,
  setTab,
}) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const uncategorized = all.filter(
    (row) =>
      row.category ===
      "UNCATEGORIZED DETECTED"
  ).length;

  const zeroSignals = all.reduce(
    (sum, row) =>
      sum +
      (data.branches || []).filter(
        (branch) =>
          numberValue(
            row[branch.name]
          ) === 0
      ).length,
    0
  );

  return (
    <div className="ba-stack">
      <section className="ba-hero">
        <div>
          <span className="eyebrow">
            BART / OPERATIONS COMMAND
          </span>

          <h1>Good day, Admin.</h1>

          <p>
            One surface for the
            signals that deserve
            management attention on{" "}
            <b>{date}</b>.
          </p>
        </div>

        <div className="hero-radar">
          <div className="radar-ring r1" />
          <div className="radar-ring r2" />
          <div className="radar-dot" />

          <strong>
            {data.loadedBranchCount ||
              0}
          </strong>

          <span>
            BRANCHES ONLINE
          </span>
        </div>
      </section>

      <div className="ba-metrics">
        <Metric
          label="NETWORK"
          value={`${
            data.loadedBranchCount ||
            0
          }/${
            data.branchCount || 0
          }`}
          detail="branches responding"
          Icon={Building2}
        />

        <Metric
          label="DAILY ITEMS"
          value={
            (data.daily || [])
              .length
          }
          detail="items detected"
          Icon={ClipboardCheck}
        />

        <Metric
          label="WEEKLY ITEMS"
          value={
            (data.weekly || [])
              .length
          }
          detail="items detected"
          Icon={CalendarDays}
        />

        <Metric
          label="ATTENTION"
          value={
            (data.failedBranches ||
              []).length +
            uncategorized
          }
          detail="signals to review"
          Icon={AlertTriangle}
        />
      </div>

      <div className="ba-grid-2">
        <section className="ba-panel">
          <header>
            <div>
              <span className="eyebrow">
                NETWORK CONDITION
              </span>

              <h3>
                Branch availability
              </h3>
            </div>

            <button
              onClick={() =>
                setTab(
                  "data-health"
                )
              }
            >
              Open health{" "}
              <ChevronRight
                size={15}
              />
            </button>
          </header>

          <div className="health-bar">
            <i
              style={{
                width: `${
                  data.branchCount
                    ? ((data.loadedBranchCount ||
                        0) /
                        data.branchCount) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="health-numbers">
            <b>
              {data.loadedBranchCount ||
                0}{" "}
              healthy
            </b>

            <span>
              {
                (
                  data.failedBranches ||
                  []
                ).length
              }{" "}
              unavailable
            </span>
          </div>
        </section>

        <section className="ba-panel">
          <header>
            <div>
              <span className="eyebrow">
                DATA SIGNALS
              </span>

              <h3>
                Immediate checks
              </h3>
            </div>

            <button
              onClick={() =>
                setTab(
                  "exception-center"
                )
              }
            >
              Inspect{" "}
              <ChevronRight
                size={15}
              />
            </button>
          </header>

          <div className="signal-list">
            <div>
              <AlertTriangle />

              <span>
                <b>
                  {uncategorized}
                </b>{" "}
                uncategorized item
                records
              </span>
            </div>

            <div>
              <XCircle />

              <span>
                <b>
                  {formatNumber(
                    zeroSignals
                  )}
                </b>{" "}
                zero branch/item
                cells
              </span>
            </div>

            <div>
              <Database />

              <span>
                <b>
                  {
                    (
                      data.failedBranches ||
                      []
                    ).length
                  }
                </b>{" "}
                branch fetch
                failures
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="ba-panel quick">
        <header>
          <div>
            <span className="eyebrow">
              QUICK INTELLIGENCE
            </span>

            <h3>
              Jump directly into
              analysis
            </h3>
          </div>
        </header>

        <div className="quick-grid">
          {[
            [
              "global-search",
              "Find any SKU",
              Search,
            ],
            [
              "branch-comparison",
              "Compare branches",
              GitCompareArrows,
            ],
            [
              "stock-movement",
              "Stock movement",
              ChartNoAxesCombined,
            ],
            [
              "report-studio",
              "Download Center",
              FileSpreadsheet,
            ],
            [
              "exception-center",
              "Exceptions",
              ShieldAlert,
            ],
            [
              "inventory-matrix",
              "Inventory matrix",
              Table2,
            ],
          ].map(
            ([
              id,
              label,
              Icon,
            ]) => (
              <button
                key={id}
                onClick={() =>
                  setTab(id)
                }
              >
                <Icon />
                <span>
                  {label}
                </span>
                <ChevronRight />
              </button>
            )
          )}
        </div>
      </section>
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
  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
    useState("ALL");

  const branches = (
    data.branches || []
  ).map((branch) => branch.name);

  let rows =
    mode === "daily"
      ? data.daily || []
      : mode === "weekly"
      ? data.weekly || []
      : [
          ...(data.daily || []),
          ...(data.weekly || []),
        ];

  rows = rows.filter(
    (row) =>
      (category === "ALL" ||
        row.category ===
          category) &&
      (!query ||
        `${row.SKU} ${
          row["Item Name"]
        } ${row.UOM}`
          .toLowerCase()
          .includes(
            query.toLowerCase()
          ))
  );

  return (
    <div className="ba-stack">
      <PageHead
        eyebrow="INVENTORY"
        title={
          mode === "all"
            ? "Inventory Matrix"
            : `${
                mode[0].toUpperCase() +
                mode.slice(1)
              } Inventory`
        }
        text={`${rows.length} visible items across ${branches.length} branches.`}
      />

      <div className="toolbar">
        <div className="searchbox">
          <Search />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search SKU, item or UOM..."
          />
        </div>

        <select
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
        >
          <option>ALL</option>
          <option>
            FOOD ITEMS
          </option>
          <option>
            DRY ITEMS
          </option>
          <option>
            MISC ITEMS
          </option>
          <option>
            UNCATEGORIZED DETECTED
          </option>
        </select>
      </div>

      <AdminTable
        rows={rows}
        branches={branches}
      />
    </div>
  );
}

function SearchView({ data }) {
  const [query, setQuery] =
    useState("");

  const branches = (
    data.branches || []
  ).map((branch) => branch.name);

  const all = [
    ...(data.daily || []).map(
      (row) => ({
        ...row,
        schedule: "Daily",
      })
    ),

    ...(data.weekly || []).map(
      (row) => ({
        ...row,
        schedule: "Weekly",
      })
    ),
  ];

  const rows = query
    ? all.filter((row) =>
        `${row.SKU} ${
          row["Item Name"]
        } ${row.UOM}`
          .toLowerCase()
          .includes(
            query.toLowerCase()
          )
      )
    : [];

  return (
    <div className="ba-stack">
      <PageHead
        eyebrow="SEARCH"
        title="Global Item Search"
        text="Search Daily and Weekly inventory together."
      />

      <div className="toolbar">
        <div className="searchbox">
          <Search />

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search SKU or product..."
          />
        </div>
      </div>

      {query ? (
        <AdminTable
          rows={rows}
          branches={branches}
        />
      ) : (
        <Empty text="Enter an SKU or product name." />
      )}
    </div>
  );
}

/* =========================================================
   DOWNLOAD CENTER
========================================================= */

function ReportsWorkspace({
  tab,
  data,
}) {
  const branches = (
    data.branches || []
  ).map((branch) => branch.name);

  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const [range, setRange] =
    useState({
      start: weekAgo(),
      end: yesterday(),
    });

  const [busy, setBusy] =
    useState(false);

  const [
    reportError,
    setReportError,
  ] = useState("");

  const [
    rangeData,
    setRangeData,
  ] = useState(null);

  const [
    skuSearch,
    setSkuSearch,
  ] = useState("");

  const [
    selectedSkus,
    setSelectedSkus,
  ] = useState([]);

  const skuOptions = useMemo(() => {
    const map = new Map();

    all.forEach((row) => {
      const sku = String(
        row.SKU || ""
      ).trim();

      if (!sku) return;

      if (!map.has(sku)) {
        map.set(sku, {
          sku,
          name:
            row["Item Name"] || "",
          uom: row.UOM || "",
        });
      }
    });

    return [...map.values()].sort(
      (a, b) =>
        a.sku.localeCompare(b.sku)
    );
  }, [all]);

  const visibleSkus =
    skuSearch.trim()
      ? skuOptions
          .filter((item) =>
            `${item.sku} ${item.name}`
              .toLowerCase()
              .includes(
                skuSearch
                  .toLowerCase()
              )
          )
          .slice(0, 30)
      : [];

  function toggleSku(sku) {
    setSelectedSkus(
      (current) =>
        current.includes(sku)
          ? current.filter(
              (value) =>
                value !== sku
            )
          : [...current, sku]
    );
  }

  function downloadLiveExcel() {
    const workbook =
      buildLiveWorkbook(data);

    downloadWorkbook(
      workbook,
      `BART_Report_${data.date}.xlsx`
    );
  }

  function exportCsv() {
    const headers = [
      "SKU",
      "Item Name",
      "UOM",
      "Category",
      ...branches,
      "Total",
    ];

    const rows = all.map(
      (row) => [
        row.SKU,
        row["Item Name"],
        row.UOM,
        row.category,
        ...branches.map(
          (branch) =>
            row[branch]
        ),
        row.total ?? row.Total,
      ]
    );

    const csv = [
      headers,
      ...rows,
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
        type: "text/csv;charset=utf-8",
      }
    );

    const anchor =
      document.createElement("a");

    anchor.href =
      URL.createObjectURL(blob);

    anchor.download =
      `BART_Admin_${
        data.date || "inventory"
      }.csv`;

    anchor.click();

    URL.revokeObjectURL(
      anchor.href
    );
  }

  async function generateRangeReport() {
    if (
      !range.start ||
      !range.end
    ) {
      return;
    }

    if (
      range.start > range.end
    ) {
      setReportError(
        "From Date cannot be after To Date."
      );
      return;
    }

    setBusy(true);
    setReportError("");

    try {
      const response =
        await fetch(
          `/api/admin/bart/date-range?start=${encodeURIComponent(
            range.start
          )}&end=${encodeURIComponent(
            range.end
          )}`
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.error ||
            result.message ||
            `HTTP ${response.status}`
        );
      }

      setRangeData(result);

      const workbook =
        buildRangeWorkbook(
          result,
          selectedSkus
        );

      downloadWorkbook(
        workbook,
        `BART_Stock_Movement_${range.start}_${range.end}.xlsx`
      );
    } catch (error) {
      setReportError(
        error.message ||
          "Unable to generate report."
      );
    } finally {
      setBusy(false);
    }
  }

  if (tab === "report-studio") {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="TOP PRIORITY / REPORTS"
          title="BART Download Center"
          text="Professional operational reports generated directly from the Admin inventory data."
        />

        <section className="download-hero">
          <div>
            <span className="eyebrow">
              LIVE PROFESSIONAL
              REPORT
            </span>

            <h2>{data.date}</h2>

            <p>
              Dashboard Summary +
              Daily + Weekly +
              category worksheets
              in one formatted Excel
              workbook.
            </p>

            <div className="download-tags">
              <span>
                {branches.length}{" "}
                branches
              </span>

              <span>
                {
                  (data.daily || [])
                    .length
                }{" "}
                daily items
              </span>

              <span>
                {
                  (data.weekly || [])
                    .length
                }{" "}
                weekly items
              </span>
            </div>
          </div>

          <button
            className="download-main"
            onClick={
              downloadLiveExcel
            }
          >
            <FileSpreadsheet />

            <span>
              <b>
                Generate LIVE Excel
              </b>

              <small>
                BART_Report_
                {data.date}.xlsx
              </small>
            </span>

            <Download />
          </button>
        </section>

        <section className="ba-panel report-range-card">
          <header>
            <div>
              <span className="eyebrow">
                STOCK MOVEMENT
              </span>

              <h3>
                Date Range Excel
                Report
              </h3>
            </div>
          </header>

          <div className="report-range-grid">
            <label>
              <span>
                FROM DATE
              </span>

              <input
                type="date"
                value={range.start}
                onChange={(
                  event
                ) =>
                  setRange(
                    (current) => ({
                      ...current,
                      start:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>TO DATE</span>

              <input
                type="date"
                value={range.end}
                onChange={(
                  event
                ) =>
                  setRange(
                    (current) => ({
                      ...current,
                      end:
                        event.target
                          .value,
                    })
                  )
                }
              />
            </label>
          </div>

          <div className="sku-picker">
            <div className="searchbox">
              <Search />

              <input
                value={skuSearch}
                onChange={(
                  event
                ) =>
                  setSkuSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search SKU or item for Fast Moving sheet..."
              />
            </div>

            {skuSearch && (
              <div className="sku-results">
                {visibleSkus.map(
                  (item) => (
                    <button
                      key={
                        item.sku
                      }
                      className={
                        selectedSkus.includes(
                          item.sku
                        )
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        toggleSku(
                          item.sku
                        )
                      }
                    >
                      <b>
                        {item.sku}
                      </b>

                      <span>
                        {item.name}
                      </span>

                      <small>
                        {item.uom}
                      </small>
                    </button>
                  )
                )}
              </div>
            )}

            <div className="selected-skus">
              {selectedSkus.map(
                (sku) => (
                  <button
                    key={sku}
                    onClick={() =>
                      toggleSku(sku)
                    }
                  >
                    {sku} ×
                  </button>
                )
              )}
            </div>
          </div>

          {reportError && (
            <div className="report-error">
              <AlertTriangle />
              {reportError}
            </div>
          )}

          <button
            className="download-range"
            disabled={
              busy ||
              !range.start ||
              !range.end
            }
            onClick={
              generateRangeReport
            }
          >
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <FileChartColumn />
            )}

            <span>
              <b>
                {busy
                  ? "Building workbook…"
                  : "Generate Date Range Excel"}
              </b>

              <small>
                Daily · Weekly ·
                Combined · Fast
                Moving
              </small>
            </span>

            <Download />
          </button>

          {rangeData && (
            <div className="report-ready">
              <ClipboardCheck />

              Last report loaded{" "}
              {
                (
                  rangeData.dates ||
                  []
                ).length
              }{" "}
              dates across{" "}
              {
                (
                  rangeData.branches ||
                  []
                ).length
              }{" "}
              branches.
            </div>
          )}
        </section>
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
          text="Selected-date management summary and professional workbook."
        />

        <div className="ba-metrics">
          <Metric
            label="NETWORK QTY"
            value={formatNumber(
              all.reduce(
                (sum, row) =>
                  sum +
                  numberValue(
                    row.total ??
                      row.Total
                  ),
                0
              )
            )}
            detail="daily + weekly"
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

        <button
          className="primary-action"
          onClick={
            downloadLiveExcel
          }
        >
          <Download />
          Download Professional
          Excel
        </button>
      </div>
    );
  }

  if (tab === "custom-export") {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="REPORTS"
          title="Custom Export"
          text="Raw selected-date snapshot for ad-hoc analysis."
        />

        <div className="notice">
          <FileSpreadsheet />

          <div>
            <b>
              CSV contains SKU,
              item, UOM, category,
              every branch and total.
            </b>

            <span>
              Use Download Center
              for the professionally
              formatted Excel
              workbook.
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
          text="Reports download directly to the Admin device."
        />

        <div className="notice">
          <History />

          <div>
            <b>
              No fake report history
              is stored.
            </b>

            <span>
              Generate a fresh
              workbook from Download
              Center whenever
              required.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* =========================================================
   BASIC SECONDARY WORKSPACES
========================================================= */

function BranchNetwork({
  data,
  onBranch,
}) {
  return (
    <div className="ba-stack">
      <PageHead
        eyebrow="NETWORK"
        title={`${
          data.branchCount || 0
        } BART branches`}
        text="Open a branch workspace or inspect its current data connection."
      />

      <div className="branch-grid">
        {(data.branches || []).map(
          (branch, index) => (
            <motion.button
              key={branch.code}
              className="branch-card"
              onClick={() =>
                onBranch(branch)
              }
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay:
                  index * 0.018,
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

              <div>
                <b>
                  {branch.name}
                </b>

                <small>
                  {branch.code}
                </small>
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

function SimpleWorkspace({
  tab,
  data,
  setTab,
}) {
  const all = [
    ...(data.daily || []),
    ...(data.weekly || []),
  ];

  const branches = (
    data.branches || []
  ).map((branch) => branch.name);

  if (
    tab === "live-operations"
  ) {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="COMMAND"
          title="Live Operations"
          text="Current selected-date branch response and inventory activity."
        />

        <div className="ba-metrics">
          <Metric
            label="RESPONDING"
            value={
              data.loadedBranchCount ||
              0
            }
            detail="branch sheets loaded"
            Icon={Activity}
          />

          <Metric
            label="FAILED"
            value={
              (
                data.failedBranches ||
                []
              ).length
            }
            detail="fetch failures"
            Icon={XCircle}
          />

          <Metric
            label="ACTIVE ITEMS"
            value={
              all.filter(
                (row) =>
                  numberValue(
                    row.total
                  ) > 0
              ).length
            }
            detail="network quantity > 0"
            Icon={Boxes}
          />
        </div>
      </div>
    );
  }

  if (
    tab === "attention-center"
  ) {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="COMMAND"
          title="Attention Center"
          text="Fetch failures, uncategorized records and zero-value signals."
        />

        <div className="ba-metrics">
          <Metric
            label="FETCH FAILURES"
            value={
              (
                data.failedBranches ||
                []
              ).length
            }
            detail="branches requiring review"
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
            detail="classification required"
            Icon={Tags}
          />

          <Metric
            label="ZERO-SIGNAL ITEMS"
            value={
              all.filter((row) =>
                branches.some(
                  (branch) =>
                    numberValue(
                      row[branch]
                    ) === 0
                )
              ).length
            }
            detail="at least one zero branch"
            Icon={XCircle}
          />
        </div>
      </div>
    );
  }

  if (
    tab === "category-explorer"
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
          eyebrow="INVENTORY"
          title="Category Explorer"
          text="Selected-date item counts and network quantities."
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
                    {formatNumber(
                      rows.reduce(
                        (
                          sum,
                          row
                        ) =>
                          sum +
                          numberValue(
                            row.total
                          ),
                        0
                      )
                    )}
                  </h2>

                  <p>
                    {rows.length}{" "}
                    item records
                  </p>
                </section>
              );
            }
          )}
        </div>
      </div>
    );
  }

  if (
    tab === "missing-submissions"
  ) {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="EXCEPTIONS"
          title="Missing Data"
          text="Branches the Admin API could not load."
        />

        <div className="ba-metrics">
          <Metric
            label="EXPECTED"
            value={
              data.branchCount || 0
            }
            detail="master branches"
            Icon={Building2}
          />

          <Metric
            label="LOADED"
            value={
              data.loadedBranchCount ||
              0
            }
            detail="successful reads"
            Icon={Database}
          />

          <Metric
            label="MISSING"
            value={
              (
                data.failedBranches ||
                []
              ).length
            }
            detail="failed reads"
            Icon={ShieldAlert}
          />
        </div>
      </div>
    );
  }

  if (
    tab === "stock-distribution"
  ) {
    const top = [...all]
      .sort(
        (a, b) =>
          numberValue(b.total) -
          numberValue(a.total)
      )
      .slice(0, 30);

    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="INTELLIGENCE"
          title="Stock Distribution"
          text="Highest selected-date network inventory quantities."
        />

        <section className="ba-panel">
          <div className="rank-list">
            {top.map(
              (row, index) => (
                <div
                  key={`${row.SKU}-${index}`}
                >
                  <span>
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <b>
                    {
                      row[
                        "Item Name"
                      ]
                    }
                  </b>

                  <small>
                    {row.SKU} ·{" "}
                    {row.UOM}
                  </small>

                  <strong>
                    {formatNumber(
                      row.total
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

  if (
    tab === "system-settings"
  ) {
    return (
      <div className="ba-stack">
        <PageHead
          eyebrow="SYSTEM"
          title="System Settings"
          text="Read-only Admin runtime information."
        />

        <div className="ba-metrics">
          <Metric
            label="ADMIN POOL"
            value={
              data.adminPool
                ?.accountsConfigured ||
              1
            }
            detail={
              data.adminPool?.mode ||
              "Admin Google pool"
            }
            Icon={Database}
          />

          <Metric
            label="CONCURRENCY"
            value={
              data.adminPool
                ?.concurrency ||
              "—"
            }
            detail="controlled branch jobs"
            Icon={Activity}
          />

          <Metric
            label="DATE"
            value={
              data.date || "—"
            }
            detail="selected inventory date"
            Icon={CalendarDays}
          />
        </div>
      </div>
    );
  }

  return null;
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

  const branches = (
    data.branches || []
  ).map((branch) => branch.name);

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
          numberValue(
            row[branch]
          ) === 0
      )
    );
  }

  return (
    <div className="ba-stack">
      <PageHead
        eyebrow="EXCEPTIONS"
        title={
          type === "unc"
            ? "Uncategorized Items"
            : type === "zero"
            ? "Zero Stock Signals"
            : "Exception Center"
        }
        text="Fact-based exceptions detected from the loaded inventory data."
      />

      <AdminTable
        rows={rows.slice(0, 300)}
        branches={branches}
      />
    </div>
  );
}

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
          value={
            data.loadedBranchCount ||
            0
          }
          detail="branch sheets responding"
          Icon={Database}
        />

        <Metric
          label="EXPECTED"
          value={
            data.branchCount || 0
          }
          detail="branches from master"
          Icon={Building2}
        />

        <Metric
          label="SOURCE"
          value={(
            data.source || "google"
          ).toUpperCase()}
          detail="aggregation source"
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
          detail="latest response"
          Icon={History}
        />
      </div>
    </div>
  );
}

/* =========================================================
   BRANCH WORKSPACE
========================================================= */

function BranchWorkspace({
  branch,
  data,
  onBack,
}) {
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

          <h1>{branch.name}</h1>

          <p>
            {branch.code} · Selected
            inventory snapshot
          </p>
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
          value={formatNumber(
            daily.reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row[branch.name]
                ),
              0
            )
          )}
          detail="branch snapshot"
          Icon={Boxes}
        />

        <Metric
          label="WEEKLY QTY"
          value={formatNumber(
            weekly.reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row[branch.name]
                ),
              0
            )
          )}
          detail="branch snapshot"
          Icon={Warehouse}
        />
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function BartAdminPortal({
  onBack,
}) {
  const [tab, setTab] =
    useState("command-center");

  const [
    openGroup,
    setOpenGroup,
  ] = useState("command");

  const [date, setDate] =
    useState(yesterday);

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [branch, setBranch] =
    useState(null);

  const [
    navOpen,
    setNavOpen,
  ] = useState(false);

  async function getJson(url) {
    const response =
      await fetch(url);

    const result =
      await response.json();

    if (
      !response.ok ||
      result.success === false
    ) {
      throw new Error(
        result.error ||
          result.message ||
          `HTTP ${response.status}`
      );
    }

    return result;
  }

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
    } catch (error) {
      setError(
        error.message ||
          "Unable to load Admin inventory."
      );
    } finally {
      setTimeout(
        () => setLoading(false),
        420
      );
    }
  }

  useEffect(() => {
    load(false);
  }, [date]);

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
    if (
      tab === "command-center"
    ) {
      body = (
        <CommandCenter
          data={data}
          date={date}
          setTab={setTab}
        />
      );
    } else if (
      tab === "branch-network"
    ) {
      body = (
        <BranchNetwork
          data={data}
          onBranch={setBranch}
        />
      );
    } else if (
      tab ===
      "inventory-matrix"
    ) {
      body = (
        <InventoryView
          data={data}
        />
      );
    } else if (
      tab ===
      "daily-inventory"
    ) {
      body = (
        <InventoryView
          data={data}
          mode="daily"
        />
      );
    } else if (
      tab ===
      "weekly-inventory"
    ) {
      body = (
        <InventoryView
          data={data}
          mode="weekly"
        />
      );
    } else if (
      tab === "global-search"
    ) {
      body = (
        <SearchView
          data={data}
        />
      );
    } else if (
      tab ===
      "exception-center"
    ) {
      body = (
        <Exceptions
          data={data}
        />
      );
    } else if (
      tab === "zero-stock"
    ) {
      body = (
        <Exceptions
          data={data}
          type="zero"
        />
      );
    } else if (
      tab ===
      "uncategorized"
    ) {
      body = (
        <Exceptions
          data={data}
          type="unc"
        />
      );
    } else if (
      tab === "data-health"
    ) {
      body = (
        <DataHealth
          data={data}
        />
      );
    } else if (
      [
        "report-studio",
        "executive-report",
        "custom-export",
        "report-history",
      ].includes(tab)
    ) {
      body = (
        <ReportsWorkspace
          tab={tab}
          data={data}
        />
      );
    } else {
      const special =
        SimpleWorkspace({
          tab,
          data,
          setTab,
        });

      body =
        special || (
          <div className="ba-stack">
            <PageHead
              eyebrow={(
                meta?.group ||
                "BART"
              ).toUpperCase()}
              title={
                meta?.label ||
                "Workspace"
              }
              text="This existing Admin workspace remains available. The Download Center changes do not alter Staff operations."
            />

            <Empty text="No additional content is required on this screen for the Download Center update." />
          </div>
        );
    }
  }

  return (
    <div className="bart-admin">
      <aside
        className={
          navOpen ? "open" : ""
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
                    {
                      group.tabs
                        .length
                    }
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
                        height:
                          "auto",
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
                              tab ===
                              id
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
                            <Icon
                              size={
                                16
                              }
                            />

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
            <button
              className="top-download"
              onClick={() =>
                choose(
                  "report-studio",
                  "reports"
                )
              }
            >
              <Download />
              Download Center
            </button>

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
                Admin data
                unavailable
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
            <AnimatePresence mode="wait">
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
                    y: 18,
                    filter:
                      "blur(8px)",
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    filter:
                      "blur(0px)",
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  transition={{
                    duration: 0.35,
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
