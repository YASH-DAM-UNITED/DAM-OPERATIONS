import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  PackageCheck,
  RefreshCcw,
  Search,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import "./Mooma.css";


/* ============================================================
   MOOMA STOCK VIEW
============================================================ */


/* ============================================================
   API
============================================================ */

const API_BASE = "/api/mooma";


async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }

  if (data?.success === false) {
    throw new Error(
      data?.message ||
        "Request failed."
    );
  }

  return data;
}


/* ============================================================
   HELPERS
============================================================ */

function clean(value) {
  return String(value ?? "").trim();
}


function numberValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function formatNumber(value) {
  const number = numberValue(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(number);
}


function formatDateLabel(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(
    `${value}T12:00:00`
  );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function formatSyncTime(value) {
  if (!value) {
    return "Not synced";
  }

  let parsed;

  if (
    typeof value === "number"
  ) {
    parsed = new Date(
      value * 1000
    );
  } else {
    parsed = new Date(value);
  }

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Synced";
  }

  return parsed.toLocaleString(
    "en-GB",
    {
      timeZone: "Asia/Riyadh",

      day: "2-digit",
      month: "short",

      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function isDateColumn(value) {
  const text = clean(value);

  return /^\d{4}-\d{2}-\d{2}$/.test(
    text
  );
}


function getDateColumns(rows) {
  const set = new Set();

  for (const row of rows || []) {
    for (
      const key of Object.keys(
        row || {}
      )
    ) {
      if (isDateColumn(key)) {
        set.add(key);
      }
    }
  }

  return [...set].sort(
    (a, b) =>
      new Date(b) -
      new Date(a)
  );
}


function getSku(row) {
  if (!row) {
    return "";
  }

  const possible = [
    "SKU",
    "Sku",
    "sku",
    "Item Code",
    "ItemCode",
  ];

  for (const key of possible) {
    if (
      Object.prototype.hasOwnProperty.call(
        row,
        key
      )
    ) {
      return clean(row[key]);
    }
  }

  return "";
}


function getUom(row) {
  if (!row) {
    return "";
  }

  const possible = [
    "UOM",
    "Uom",
    "uom",
    "Unit",
    "UNIT",
  ];

  for (const key of possible) {
    if (
      Object.prototype.hasOwnProperty.call(
        row,
        key
      )
    ) {
      return clean(row[key]);
    }
  }

  return "";
}


function getItemName(row) {
  return clean(
    row?.Item ||
      row?.item ||
      row?.["Item Name"] ||
      ""
  );
}


/* ============================================================
   SCANNER LOADER
============================================================ */

function StockScanner({
  branchCode,
}) {
  return (
    <motion.div
      className="msv-loader"
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
        className="msv-loader-box"
        initial={{
          scale: 0.96,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
      >
        <div className="msv-loader-head">
          <Database size={20} />

          <div>
            <span>
              MOOMA DATABASE
            </span>

            <strong>
              STOCK SCAN
            </strong>
          </div>
        </div>


        <div className="msv-scanner">
          <div className="msv-grid" />

          <motion.div
            className="msv-laser"
            initial={{
              top: "3%",
            }}
            animate={{
              top: [
                "3%",
                "94%",
                "3%",
              ],
            }}
            transition={{
              duration: 1.25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="msv-scan-center"
            animate={{
              opacity: [
                0.55,
                1,
                0.55,
              ],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
            }}
          >
            <Boxes size={30} />

            <strong>
              {branchCode ||
                "MOOMA"}
            </strong>

            <span>
              READING STOCK DATA
            </span>
          </motion.div>
        </div>


        <div className="msv-loader-status">
          <motion.span
            animate={{
              opacity: [
                0.3,
                1,
                0.3,
              ],
            }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
            }}
          />

          CONNECTING TO GOOGLE SHEETS
        </div>
      </motion.div>
    </motion.div>
  );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  search,
}) {
  return (
    <motion.div
      className="msv-empty"
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
    >
      <Boxes size={36} />

      <strong>
        {search
          ? "NO MATCHING ITEMS"
          : "NO STOCK DATA"}
      </strong>

      <p>
        {search
          ? "Try another item name or SKU."
          : "There is no stock information available for this selection."}
      </p>
    </motion.div>
  );
}


/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  icon,
  label,
  value,
  small,
}) {
  return (
    <motion.div
      className="msv-summary-card"
      whileHover={{
        y: -3,
      }}
      transition={{
        duration: 0.18,
      }}
    >
      <div className="msv-summary-icon">
        {icon}
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong
          className={
            small
              ? "msv-summary-small"
              : ""
          }
        >
          {value}
        </strong>
      </div>
    </motion.div>
  );
}


/* ============================================================
   MAIN
============================================================ */

export default function MoomaStockView({
  branch,
  branchCode: branchCodeProp,
  branchName: branchNameProp,
  onBack,
}) {

  /* ============================================================
     BRANCH
  ============================================================ */

  const branchCode =
    clean(
      branch?.code ||
        branch?.branchCode ||
        branchCodeProp
    ).toUpperCase();

  const branchName =
    clean(
      branch?.name ||
        branch?.branchName ||
        branchNameProp
    ) || "MOOMA BRANCH";


  /* ============================================================
     STATE
  ============================================================ */

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [connected, setConnected] =
    useState(false);

  const [daily, setDaily] =
    useState([]);

  const [weekly, setWeekly] =
    useState([]);

  const [syncedAt, setSyncedAt] =
    useState(null);

  const [mode, setMode] =
    useState("daily");

  const [search, setSearch] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [dateMenu, setDateMenu] =
    useState(false);


  /* ============================================================
     LOAD STOCK
  ============================================================ */

  const loadStock =
    useCallback(
      async (
        silent = false
      ) => {
        if (!branchCode) {
          setError(
            "Branch code is missing."
          );

          setLoading(false);

          return;
        }

        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        try {
          const data =
            await fetchJSON(
              `${API_BASE}/stock-view?branch=${encodeURIComponent(
                branchCode
              )}`
            );

          const nextDaily =
            Array.isArray(
              data?.stock?.daily
            )
              ? data.stock.daily
              : [];

          const nextWeekly =
            Array.isArray(
              data?.stock?.weekly
            )
              ? data.stock.weekly
              : [];

          setDaily(nextDaily);
          setWeekly(nextWeekly);

          setSyncedAt(
            data?.syncedAt ||
              Date.now() / 1000
          );

          setConnected(true);
        } catch (err) {
          console.error(
            "MOOMA STOCK VIEW ERROR:",
            err
          );

          setConnected(false);

          setError(
            err?.message ||
              "Stock connection failed."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [branchCode]
    );


  useEffect(() => {
    loadStock(false);
  }, [loadStock]);


  /* ============================================================
     AVAILABLE DATES
  ============================================================ */

  const allRows =
    useMemo(
      () => [
        ...daily,
        ...weekly,
      ],
      [daily, weekly]
    );


  const dates =
    useMemo(
      () =>
        getDateColumns(
          allRows
        ),
      [allRows]
    );


  useEffect(() => {
    if (!dates.length) {
      setSelectedDate("");
      return;
    }

    if (
      !selectedDate ||
      !dates.includes(
        selectedDate
      )
    ) {
      setSelectedDate(
        dates[0]
      );
    }
  }, [
    dates,
    selectedDate,
  ]);


  /* ============================================================
     CURRENT DATA
  ============================================================ */

  const currentRows =
    useMemo(() => {
      if (mode === "weekly") {
        return weekly;
      }

      if (mode === "all") {
        return [
          ...daily.map(
            (row) => ({
              ...row,
              __section:
                "DAILY",
            })
          ),

          ...weekly.map(
            (row) => ({
              ...row,
              __section:
                "WEEKLY",
            })
          ),
        ];
      }

      return daily;
    }, [
      mode,
      daily,
      weekly,
    ]);


  /* ============================================================
     FILTER
  ============================================================ */

  const filteredRows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return currentRows;
      }

      return currentRows.filter(
        (row) => {
          const name =
            getItemName(
              row
            ).toLowerCase();

          const sku =
            getSku(
              row
            ).toLowerCase();

          const uom =
            getUom(
              row
            ).toLowerCase();

          return (
            name.includes(
              query
            ) ||
            sku.includes(
              query
            ) ||
            uom.includes(
              query
            )
          );
        }
      );
    }, [
      currentRows,
      search,
    ]);


  /* ============================================================
     SUMMARY
  ============================================================ */

  const summary =
    useMemo(() => {
      let recorded = 0;
      let zero = 0;
      let totalQty = 0;

      for (
        const row of filteredRows
      ) {
        const value =
          selectedDate
            ? numberValue(
                row?.[
                  selectedDate
                ]
              )
            : numberValue(
                row?.Total
              );

        if (value > 0) {
          recorded += 1;
        } else {
          zero += 1;
        }

        totalQty += value;
      }

      return {
        items:
          filteredRows.length,

        recorded,

        zero,

        totalQty,
      };
    }, [
      filteredRows,
      selectedDate,
    ]);


  /* ============================================================
     DATE NAVIGATION
  ============================================================ */

  const selectedDateIndex =
    dates.indexOf(
      selectedDate
    );


  function newerDate() {
    if (
      selectedDateIndex > 0
    ) {
      setSelectedDate(
        dates[
          selectedDateIndex -
            1
        ]
      );
    }
  }


  function olderDate() {
    if (
      selectedDateIndex >= 0 &&
      selectedDateIndex <
        dates.length - 1
    ) {
      setSelectedDate(
        dates[
          selectedDateIndex +
            1
        ]
      );
    }
  }


  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="msv-page">

      <AnimatePresence>
        {loading && (
          <StockScanner
            branchCode={
              branchCode
            }
          />
        )}
      </AnimatePresence>


      {/* ========================================================
          TOP BAR
      ======================================================== */}

      <header className="msv-topbar">

        <button
          type="button"
          className="msv-back"
          onClick={() =>
            onBack?.()
          }
        >
          <ArrowLeft
            size={18}
          />

          <span>
            DASHBOARD
          </span>
        </button>


        <div className="msv-brand">
          <div className="msv-brand-mark">
            M
          </div>

          <div>
            <span>
              MOOMA OPERATIONS
            </span>

            <strong>
              STOCK VIEW
            </strong>
          </div>
        </div>


        <div
          className={`msv-connection ${
            connected
              ? "online"
              : "offline"
          }`}
        >
          {connected ? (
            <Wifi size={15} />
          ) : (
            <WifiOff
              size={15}
            />
          )}

          <span>
            {connected
              ? "LIVE"
              : "OFFLINE"}
          </span>
        </div>

      </header>


      {/* ========================================================
          HERO
      ======================================================== */}

      <section className="msv-hero">

        <motion.div
          className="msv-hero-copy"
          initial={{
            opacity: 0,
            x: -18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <span className="msv-eyebrow">
            INVENTORY DATABASE
          </span>

          <h1>
            Stock
            <span> View</span>
          </h1>

          <p>
            Live read-only stock
            information for{" "}
            <strong>
              {branchCode}
            </strong>
            .
          </p>
        </motion.div>


        <motion.div
          className="msv-branch-card"
          initial={{
            opacity: 0,
            x: 18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <div>
            <small>
              ACTIVE BRANCH
            </small>

            <strong>
              {branchCode ||
                "MOOMA"}
            </strong>

            <span>
              {branchName}
            </span>
          </div>

          <Database
            size={27}
          />
        </motion.div>

      </section>


      {/* ========================================================
          ERROR
      ======================================================== */}

      <AnimatePresence>
        {error && (
          <motion.div
            className="msv-error"
            initial={{
              opacity: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
            }}
          >
            <CircleAlert
              size={18}
            />

            <div>
              <strong>
                STOCK CONNECTION
                FAILED
              </strong>

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                loadStock(
                  false
                )
              }
            >
              RETRY
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ========================================================
          CONTROL PANEL
      ======================================================== */}

      <section className="msv-controls">

        <div className="msv-mode-tabs">

          {[
            [
              "daily",
              "DAILY",
            ],
            [
              "weekly",
              "WEEKLY",
            ],
            [
              "all",
              "ALL",
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <button
                type="button"
                key={value}
                className={
                  mode === value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setMode(
                    value
                  )
                }
              >
                {label}
              </button>
            )
          )}

        </div>


        <div className="msv-control-right">

          {/* DATE */}

          <div className="msv-date-control">

            <button
              type="button"
              className="msv-date-arrow"
              disabled={
                selectedDateIndex <
                  0 ||
                selectedDateIndex >=
                  dates.length -
                    1
              }
              onClick={
                olderDate
              }
              title="Older date"
            >
              <ChevronLeft
                size={17}
              />
            </button>


            <div className="msv-date-wrap">

              <button
                type="button"
                className="msv-date-button"
                onClick={() =>
                  setDateMenu(
                    (value) =>
                      !value
                  )
                }
              >
                <CalendarDays
                  size={17}
                />

                <div>
                  <small>
                    STOCK DATE
                  </small>

                  <strong>
                    {selectedDate
                      ? formatDateLabel(
                          selectedDate
                        )
                      : "NO DATE"}
                  </strong>
                </div>
              </button>


              <AnimatePresence>
                {dateMenu && (
                  <motion.div
                    className="msv-date-menu"
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale:
                        0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -5,
                    }}
                  >
                    <div className="msv-date-menu-head">
                      <span>
                        AVAILABLE
                        DATES
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setDateMenu(
                            false
                          )
                        }
                      >
                        <X
                          size={
                            15
                          }
                        />
                      </button>
                    </div>

                    <div className="msv-date-list">
                      {dates.map(
                        (
                          date
                        ) => (
                          <button
                            type="button"
                            key={
                              date
                            }
                            className={
                              selectedDate ===
                              date
                                ? "active"
                                : ""
                            }
                            onClick={() => {
                              setSelectedDate(
                                date
                              );

                              setDateMenu(
                                false
                              );
                            }}
                          >
                            <CalendarDays
                              size={
                                14
                              }
                            />

                            <span>
                              {formatDateLabel(
                                date
                              )}
                            </span>
                          </button>
                        )
                      )}

                      {!dates.length && (
                        <div className="msv-no-dates">
                          No stock
                          dates found.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>


            <button
              type="button"
              className="msv-date-arrow"
              disabled={
                selectedDateIndex <=
                0
              }
              onClick={
                newerDate
              }
              title="Newer date"
            >
              <ChevronRight
                size={17}
              />
            </button>

          </div>


          {/* REFRESH */}

          <button
            type="button"
            className="msv-refresh"
            disabled={
              refreshing
            }
            onClick={() =>
              loadStock(true)
            }
          >
            <RefreshCcw
              size={16}
              className={
                refreshing
                  ? "msv-spin"
                  : ""
              }
            />

            {refreshing
              ? "REFRESHING"
              : "REFRESH"}
          </button>

        </div>

      </section>


      {/* ========================================================
          SUMMARY
      ======================================================== */}

      <section className="msv-summary">

        <SummaryCard
          icon={
            <Boxes
              size={19}
            />
          }
          label="VISIBLE ITEMS"
          value={
            summary.items
          }
        />

        <SummaryCard
          icon={
            <PackageCheck
              size={19}
            />
          }
          label="RECORDED"
          value={
            summary.recorded
          }
        />

        <SummaryCard
          icon={
            <CircleAlert
              size={19}
            />
          }
          label="ZERO STOCK"
          value={
            summary.zero
          }
        />

        <SummaryCard
          icon={
            <Database
              size={19}
            />
          }
          label="LAST SYNC"
          value={formatSyncTime(
            syncedAt
          )}
          small
        />

      </section>


      {/* ========================================================
          TABLE HEADER / SEARCH
      ======================================================== */}

      <section className="msv-database">

        <div className="msv-database-head">

          <div>
            <span>
              LIVE STOCK
              DATABASE
            </span>

            <strong>
              {mode.toUpperCase()}{" "}
              INVENTORY
            </strong>
          </div>


          <div className="msv-search">

            <Search
              size={17}
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search item, SKU or UOM..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
              >
                <X
                  size={15}
                />
              </button>
            )}

          </div>

        </div>


        {/* ======================================================
            TABLE
        ====================================================== */}

        {filteredRows.length ? (

          <div className="msv-table-wrap">

            <table className="msv-table">

              <thead>
                <tr>
                  {mode ===
                    "all" && (
                    <th className="msv-section-col">
                      TYPE
                    </th>
                  )}

                  <th className="msv-item-col">
                    ITEM NAME
                  </th>

                  <th>
                    SKU
                  </th>

                  <th>
                    UOM
                  </th>

                  <th className="msv-value-head">
                    {selectedDate
                      ? formatDateLabel(
                          selectedDate
                        )
                      : "STOCK"}
                  </th>

                  <th className="msv-total-head">
                    ALL DATES TOTAL
                  </th>
                </tr>
              </thead>


              <tbody>
                <AnimatePresence
                  mode="popLayout"
                >
                  {filteredRows.map(
                    (
                      row,
                      index
                    ) => {

                      const name =
                        getItemName(
                          row
                        );

                      const sku =
                        getSku(
                          row
                        );

                      const uom =
                        getUom(
                          row
                        );

                      const qty =
                        selectedDate
                          ? numberValue(
                              row?.[
                                selectedDate
                              ]
                            )
                          : 0;

                      const total =
                        numberValue(
                          row?.Total
                        );

                      return (
                        <motion.tr
                          key={`${row.__section || mode}-${sku}-${name}-${index}`}
                          initial={{
                            opacity:
                              0,
                            y: 6,
                          }}
                          animate={{
                            opacity:
                              1,
                            y: 0,
                          }}
                          transition={{
                            delay:
                              Math.min(
                                index *
                                  0.018,
                                0.35
                              ),
                          }}
                        >

                          {mode ===
                            "all" && (
                            <td className="msv-section-cell">
                              <span
                                className={
                                  row.__section ===
                                  "WEEKLY"
                                    ? "weekly"
                                    : "daily"
                                }
                              >
                                {
                                  row.__section
                                }
                              </span>
                            </td>
                          )}


                          <td className="msv-item-cell">
                            <div className="msv-item-icon">
                              <Boxes
                                size={
                                  15
                                }
                              />
                            </div>

                            <strong>
                              {name ||
                                "Unnamed Item"}
                            </strong>
                          </td>


                          <td className="msv-sku">
                            {sku ||
                              "—"}
                          </td>


                          <td className="msv-uom">
                            {uom ||
                              "—"}
                          </td>


                          <td className="msv-qty">
                            <span
                              className={
                                qty >
                                0
                                  ? "has-stock"
                                  : "zero-stock"
                              }
                            >
                              {formatNumber(
                                qty
                              )}
                            </span>
                          </td>


                          <td className="msv-total">
                            {formatNumber(
                              total
                            )}
                          </td>

                        </motion.tr>
                      );
                    }
                  )}
                </AnimatePresence>
              </tbody>

            </table>

          </div>

        ) : (

          <EmptyState
            search={
              search
            }
          />

        )}


        {/* ======================================================
            FOOTER
        ====================================================== */}

        <div className="msv-database-footer">

          <div>
            <span
              className={`msv-live-dot ${
                connected
                  ? "online"
                  : ""
              }`}
            />

            {connected
              ? "GOOGLE SHEETS CONNECTED"
              : "DATABASE DISCONNECTED"}
          </div>


          <div>
            <strong>
              {
                filteredRows.length
              }
            </strong>{" "}
            ITEMS

            <span className="msv-footer-divider">
              /
            </span>

            SELECTED QTY{" "}

            <strong>
              {formatNumber(
                summary.totalQty
              )}
            </strong>
          </div>

        </div>

      </section>


      <div className="msv-bottom-space" />

    </div>
  );
}
