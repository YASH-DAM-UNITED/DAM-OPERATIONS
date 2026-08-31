import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Boxes,
  CircleAlert,
  Database,
  PackageCheck,
  RefreshCcw,
  Search,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import "./Mooma.css";


/* ============================================================
   MOOMA STOCK VIEW
   ------------------------------------------------------------
   Shows ALL Google Sheet stock dates together.
   Exact UOM header supported:
   DATE-> UOM
============================================================ */


/* ============================================================
   API
============================================================ */

const API_BASE =
  "/api/mooma";


async function fetchJSON(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        cache:
          "no-store",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );


  let data = null;


  try {
    data =
      await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }


  if (
    data?.success ===
    false
  ) {
    throw new Error(
      data?.message ||
        "Request failed."
    );
  }


  return data;
}


/* ============================================================
   GENERAL HELPERS
============================================================ */

function clean(value) {
  return String(
    value ?? ""
  ).trim();
}


function numberValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }


  const parsed =
    Number(
      String(value)
        .replace(/,/g, "")
        .trim()
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatNumber(
  value
) {
  const number =
    numberValue(value);


  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits:
        3,
    }
  ).format(number);
}


/* ============================================================
   DATE HELPERS
============================================================ */

function isDateColumn(
  value
) {
  const text =
    clean(value);


  /*
   * Main Stocks format:
   *
   * 2026-08-30
   */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    return true;
  }


  /*
   * Optional support if
   * Google Sheets returns
   * slash-formatted dates.
   */

  if (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(
      text
    )
  ) {
    return true;
  }


  return false;
}


function prettyDate(
  value
) {
  const text =
    clean(value);


  if (!text) {
    return "";
  }


  /*
   * YYYY-MM-DD
   */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    const [
      year,
      month,
      day,
    ] =
      text
        .split("-")
        .map(Number);


    const date =
      new Date(
        year,
        month - 1,
        day
      );


    return date.toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",
      }
    );
  }


  return text;
}


/* ============================================================
   SYNC TIME
============================================================ */

function formatSyncTime(
  value
) {
  if (!value) {
    return "NOT SYNCED";
  }


  let parsed;


  if (
    typeof value ===
    "number"
  ) {
    parsed =
      new Date(
        value * 1000
      );
  } else {
    parsed =
      new Date(value);
  }


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "SYNCED";
  }


  return parsed.toLocaleString(
    "en-GB",
    {
      timeZone:
        "Asia/Riyadh",

      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}


/* ============================================================
   ITEM HELPERS
============================================================ */

function getItemName(
  row
) {
  return clean(
    row?.Item ||
      row?.ITEM ||
      row?.item ||
      row?.["Item Name"] ||
      row?.["ITEM NAME"] ||
      ""
  );
}


/* ============================================================
   SKU
============================================================ */

function getSku(
  row
) {
  if (!row) {
    return "";
  }


  const possible = [
    "SKU",
    "Sku",
    "sku",
    "Item Code",
    "ItemCode",
    "ITEM CODE",
  ];


  for (
    const key of possible
  ) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          row,
          key
        )
    ) {
      return clean(
        row[key]
      );
    }
  }


  return "";
}


/* ============================================================
   UOM

   IMPORTANT:
   Actual Google Sheet header:
   DATE-> UOM
============================================================ */

function getUom(
  row
) {
  if (!row) {
    return "";
  }


  const possible = [
    "DATE-> UOM",

    /*
     * Fallbacks only.
     */

    "DATE->UOM",
    "Date-> UOM",
    "Date->UOM",
    "UOM",
    "Uom",
    "uom",
    "Unit",
    "UNIT",
  ];


  for (
    const key of possible
  ) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          row,
          key
        )
    ) {
      return clean(
        row[key]
      );
    }
  }


  return "";
}


/* ============================================================
   ALL DATE COLUMNS

   IMPORTANT:
   Keeps Google Sheet column order.
   Does NOT sort dates.
============================================================ */

function getDateColumns(
  rows
) {
  const result =
    [];

  const seen =
    new Set();


  for (
    const row of
    rows || []
  ) {
    const keys =
      Object.keys(
        row || {}
      );


    for (
      const key of keys
    ) {
      if (
        !isDateColumn(
          key
        )
      ) {
        continue;
      }


      if (
        seen.has(key)
      ) {
        continue;
      }


      seen.add(key);

      result.push(key);
    }
  }


  return result;
}


/* ============================================================
   ROW TOTAL ACROSS ALL DATES
============================================================ */

function calculateDateTotal(
  row,
  dateColumns
) {
  let total = 0;


  for (
    const date of
    dateColumns
  ) {
    total +=
      numberValue(
        row?.[date]
      );
  }


  return total;
}


/* ============================================================
   STOCK SCANNER
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
          scale:
            0.94,

          opacity:
            0,

          y:
            20,
        }}

        animate={{
          scale:
            1,

          opacity:
            1,

          y:
            0,
        }}

        transition={{
          duration:
            0.32,
        }}
      >

        <div className="msv-loader-head">

          <Database
            size={20}
          />


          <div>

            <span>
              MOOMA DATABASE
            </span>


            <strong>
              INVENTORY SCANNER
            </strong>

          </div>

        </div>


        <div className="msv-scanner">

          <div className="msv-grid" />


          <motion.div
            className="msv-laser"

            initial={{
              top:
                "3%",
            }}

            animate={{
              top: [
                "3%",
                "94%",
                "3%",
              ],
            }}

            transition={{
              duration:
                1.3,

              repeat:
                Infinity,

              ease:
                "easeInOut",
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

              scale: [
                0.98,
                1,
                0.98,
              ],
            }}

            transition={{
              duration:
                0.85,

              repeat:
                Infinity,

              ease:
                "easeInOut",
            }}
          >

            <Boxes
              size={31}
            />


            <strong>
              {branchCode ||
                "MOOMA"}
            </strong>


            <span>
              SCANNING ALL STOCK DATES
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
              duration:
                0.7,

              repeat:
                Infinity,
            }}
          />


          READING GOOGLE SHEET DATABASE

        </div>

      </motion.div>

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
  small = false,
}) {
  return (

    <motion.div
      className="msv-summary-card"

      whileHover={{
        y: -3,
      }}

      transition={{
        duration:
          0.18,
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
   EMPTY
============================================================ */

function EmptyState({
  search,
}) {
  return (

    <motion.div
      className="msv-empty"

      initial={{
        opacity:
          0,

        y:
          12,
      }}

      animate={{
        opacity:
          1,

        y:
          0,
      }}
    >

      <Boxes
        size={36}
      />


      <strong>

        {search
          ? "NO MATCHING ITEMS"
          : "NO STOCK DATA"}

      </strong>


      <p>

        {search
          ? "Try another item name, SKU or UOM."
          : "There is no stock information available for this branch."}

      </p>

    </motion.div>
  );
}


/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function MoomaStockView({
  branch,
  branchCode:
    branchCodeProp,
  branchName:
    branchNameProp,
  onBack,
}) {

  /* ==========================================================
     BRANCH
  ========================================================== */

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
    ) ||
    "MOOMA BRANCH";


  /* ==========================================================
     STATE
  ========================================================== */

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    connected,
    setConnected,
  ] =
    useState(false);


  const [
    daily,
    setDaily,
  ] =
    useState([]);


  const [
    weekly,
    setWeekly,
  ] =
    useState([]);


  const [
    syncedAt,
    setSyncedAt,
  ] =
    useState(null);


  const [
    mode,
    setMode,
  ] =
    useState(
      "daily"
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  /* ==========================================================
     LOAD STOCK
  ========================================================== */

  const loadStock =
    useCallback(
      async (
        silent = false
      ) => {

        if (!branchCode) {

          setError(
            "Branch code is missing."
          );

          setLoading(
            false
          );

          return;
        }


        if (silent) {

          setRefreshing(
            true
          );

        } else {

          setLoading(
            true
          );

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
              data
                ?.stock
                ?.daily
            )
              ? data.stock.daily
              : [];


          const nextWeekly =
            Array.isArray(
              data
                ?.stock
                ?.weekly
            )
              ? data.stock.weekly
              : [];


          setDaily(
            nextDaily
          );


          setWeekly(
            nextWeekly
          );


          setSyncedAt(
            data?.syncedAt ||
              Math.floor(
                Date.now() /
                  1000
              )
          );


          setConnected(
            true
          );


          console.log(
            "[MOOMA STOCK VIEW] DAILY:",
            nextDaily.length
          );


          console.log(
            "[MOOMA STOCK VIEW] WEEKLY:",
            nextWeekly.length
          );


        } catch (
          err
        ) {

          console.error(
            "[MOOMA STOCK VIEW]",
            err
          );


          setConnected(
            false
          );


          setError(
            err?.message ||
              "Stock connection failed."
          );

        } finally {

          setLoading(
            false
          );


          setRefreshing(
            false
          );
        }
      },

      [
        branchCode,
      ]
    );


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(
    () => {

      loadStock(
        false
      );

    },

    [
      loadStock,
    ]
  );


  /* ==========================================================
     ALL RAW ROWS
  ========================================================== */

  const allRawRows =
    useMemo(
      () => [
        ...daily,
        ...weekly,
      ],

      [
        daily,
        weekly,
      ]
    );


  /* ==========================================================
     ALL GOOGLE SHEET DATES

     EVERY DATE.
     NO DATE SELECTOR.
  ========================================================== */

  const dateColumns =
    useMemo(
      () =>
        getDateColumns(
          allRawRows
        ),

      [
        allRawRows,
      ]
    );


  /* ==========================================================
     CURRENT MODE ROWS
  ========================================================== */

  const currentRows =
    useMemo(
      () => {

        if (
          mode ===
          "weekly"
        ) {
          return weekly.map(
            (row) => ({
              ...row,

              __section:
                "WEEKLY",
            })
          );
        }


        if (
          mode ===
          "all"
        ) {
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


        return daily.map(
          (row) => ({
            ...row,

            __section:
              "DAILY",
          })
        );
      },

      [
        mode,
        daily,
        weekly,
      ]
    );


  /* ==========================================================
     SEARCH
  ========================================================== */

  const filteredRows =
    useMemo(
      () => {

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
      },

      [
        currentRows,
        search,
      ]
    );


  /* ==========================================================
     SUMMARY
  ========================================================== */

  const summary =
    useMemo(
      () => {

        let cellsWithStock =
          0;

        let zeroCells =
          0;

        let allDateQty =
          0;


        for (
          const row of
          filteredRows
        ) {

          for (
            const date of
            dateColumns
          ) {

            const value =
              numberValue(
                row?.[date]
              );


            if (
              value > 0
            ) {
              cellsWithStock +=
                1;
            } else {
              zeroCells +=
                1;
            }


            allDateQty +=
              value;
          }
        }


        return {
          items:
            filteredRows.length,

          dates:
            dateColumns.length,

          recorded:
            cellsWithStock,

          zero:
            zeroCells,

          quantity:
            allDateQty,
        };
      },

      [
        filteredRows,
        dateColumns,
      ]
    );


  /* ==========================================================
     RETURN
  ========================================================== */

  return (

    <div className="msv-page">


      {/* ======================================================
          SCANNER
      ====================================================== */}

      <AnimatePresence>

        {loading && (

          <StockScanner
            branchCode={
              branchCode
            }
          />

        )}

      </AnimatePresence>


      {/* ======================================================
          TOP BAR
      ====================================================== */}

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
          className={
            `msv-connection ${
              connected
                ? "online"
                : "offline"
            }`
          }
        >

          {connected ? (

            <Wifi
              size={15}
            />

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


      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="msv-hero">


        <motion.div
          className="msv-hero-copy"

          initial={{
            opacity:
              0,

            x:
              -18,
          }}

          animate={{
            opacity:
              1,

            x:
              0,
          }}
        >

          <span className="msv-eyebrow">
            INVENTORY DATABASE
          </span>


          <h1>

            Stock

            <span>
              {" "}View
            </span>

          </h1>


          <p>

            Complete stock history for{" "}

            <strong>
              {branchCode}
            </strong>

            {" "}with every available
            stock date.

          </p>

        </motion.div>


        <motion.div
          className="msv-branch-card"

          initial={{
            opacity:
              0,

            x:
              18,
          }}

          animate={{
            opacity:
              1,

            x:
              0,
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


      {/* ======================================================
          ERROR
      ====================================================== */}

      <AnimatePresence>

        {error && (

          <motion.div
            className="msv-error"

            initial={{
              opacity:
                0,

              y:
                -8,
            }}

            animate={{
              opacity:
                1,

              y:
                0,
            }}

            exit={{
              opacity:
                0,
            }}
          >

            <CircleAlert
              size={18}
            />


            <div>

              <strong>
                STOCK CONNECTION FAILED
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


      {/* ======================================================
          CONTROLS
      ====================================================== */}

      <section className="msv-controls msv-controls-all-dates">


        {/* ====================================================
            DAILY / WEEKLY / ALL
        ==================================================== */}

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

                key={
                  value
                }

                className={
                  mode ===
                  value
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


          {/* ==================================================
              DATE COUNT
          ================================================== */}

          <div className="msv-all-date-indicator">

            <Database
              size={16}
            />


            <div>

              <small>
                STOCK HISTORY
              </small>


              <strong>

                {dateColumns.length}

                {" "}

                DATE
                {dateColumns.length ===
                1
                  ? ""
                  : "S"}

              </strong>

            </div>

          </div>


          {/* ==================================================
              REFRESH
          ================================================== */}

          <button
            type="button"

            className="msv-refresh"

            disabled={
              refreshing
            }

            onClick={() =>
              loadStock(
                true
              )
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


      {/* ======================================================
          SUMMARY
      ====================================================== */}

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
            <Database
              size={19}
            />
          }

          label="STOCK DATES"

          value={
            summary.dates
          }
        />


        <SummaryCard
          icon={
            <PackageCheck
              size={19}
            />
          }

          label="RECORDED CELLS"

          value={
            summary.recorded
          }
        />


        <SummaryCard
          icon={
            <RefreshCcw
              size={19}
            />
          }

          label="LAST SYNC"

          value={
            formatSyncTime(
              syncedAt
            )
          }

          small
        />

      </section>


      {/* ======================================================
          DATABASE
      ====================================================== */}

      <section className="msv-database">


        {/* ====================================================
            DATABASE HEADER
        ==================================================== */}

        <div className="msv-database-head">

          <div>

            <span>
              COMPLETE STOCK HISTORY
            </span>


            <strong>

              {mode.toUpperCase()}

              {" "}

              INVENTORY

              {" • "}

              {dateColumns.length}

              {" "}

              DATE
              {dateColumns.length ===
              1
                ? ""
                : "S"}

            </strong>

          </div>


          {/* ==================================================
              SEARCH
          ================================================== */}

          <div className="msv-search">

            <Search
              size={17}
            />


            <input
              value={
                search
              }

              onChange={(
                event
              ) =>
                setSearch(
                  event
                    .target
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


        {/* ====================================================
            TABLE
        ==================================================== */}

        {filteredRows.length >
        0 ? (

          <div className="msv-table-wrap msv-all-dates-table-wrap">


            <table className="msv-table msv-all-dates-table">


              {/* ==============================================
                  HEADER
              ============================================== */}

              <thead>

                <tr>


                  {/* ==========================================
                      TYPE
                  ========================================== */}

                  {mode ===
                    "all" && (

                    <th className="msv-section-col msv-sticky-type">

                      TYPE

                    </th>

                  )}


                  {/* ==========================================
                      ITEM NAME
                  ========================================== */}

                  <th
                    className={
                      mode ===
                      "all"
                        ? "msv-item-col msv-sticky-item msv-sticky-item-with-type"
                        : "msv-item-col msv-sticky-item"
                    }
                  >

                    ITEM NAME

                  </th>


                  {/* ==========================================
                      SKU
                  ========================================== */}

                  <th
                    className={
                      mode ===
                      "all"
                        ? "msv-sticky-sku msv-sticky-sku-with-type"
                        : "msv-sticky-sku"
                    }
                  >

                    SKU

                  </th>


                  {/* ==========================================
                      EXACT GOOGLE SHEET HEADER
                  ========================================== */}

                  <th
                    className={
                      mode ===
                      "all"
                        ? "msv-sticky-uom msv-sticky-uom-with-type"
                        : "msv-sticky-uom"
                    }
                  >

                    DATE-&gt; UOM

                  </th>


                  {/* ==========================================
                      ALL STOCK DATES
                  ========================================== */}

                  {dateColumns.map(
                    (
                      date,
                      index
                    ) => (

                      <th
                        key={
                          date
                        }

                        className="msv-date-column-head"

                        title={
                          date
                        }
                      >

                        <span>

                          {prettyDate(
                            date
                          )}

                        </span>


                        <small>

                          {date}

                        </small>

                      </th>

                    )
                  )}


                  {/* ==========================================
                      TOTAL
                  ========================================== */}

                  <th className="msv-total-head msv-total-final">

                    TOTAL

                  </th>

                </tr>

              </thead>


              {/* ==============================================
                  BODY
              ============================================== */}

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


                      /*
                       * Use our own calculated
                       * total from ALL date
                       * columns.
                       */

                      const total =
                        calculateDateTotal(
                          row,
                          dateColumns
                        );


                      return (

                        <motion.tr
                          key={
                            `${
                              row.__section ||
                              mode
                            }-${
                              sku ||
                              "SKU"
                            }-${
                              name ||
                              "ITEM"
                            }-${index}`
                          }

                          initial={{
                            opacity:
                              0,

                            y:
                              7,
                          }}

                          animate={{
                            opacity:
                              1,

                            y:
                              0,
                          }}

                          transition={{
                            delay:
                              Math.min(
                                index *
                                  0.014,
                                0.32
                              ),
                          }}
                        >


                          {/* ====================================
                              TYPE
                          ==================================== */}

                          {mode ===
                            "all" && (

                            <td className="msv-section-cell msv-sticky-type">

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


                          {/* ====================================
                              ITEM NAME
                          ==================================== */}

                          <td
                            className={
                              mode ===
                              "all"
                                ? "msv-item-cell msv-sticky-item msv-sticky-item-with-type"
                                : "msv-item-cell msv-sticky-item"
                            }
                          >

                            <div className="msv-item-icon">

                              <Boxes
                                size={15}
                              />

                            </div>


                            <strong>

                              {name ||
                                "Unnamed Item"}

                            </strong>

                          </td>


                          {/* ====================================
                              SKU
                          ==================================== */}

                          <td
                            className={
                              mode ===
                              "all"
                                ? "msv-sku msv-sticky-sku msv-sticky-sku-with-type"
                                : "msv-sku msv-sticky-sku"
                            }
                          >

                            {sku ||
                              "—"}

                          </td>


                          {/* ====================================
                              DATE-> UOM
                          ==================================== */}

                          <td
                            className={
                              mode ===
                              "all"
                                ? "msv-uom msv-sticky-uom msv-sticky-uom-with-type"
                                : "msv-uom msv-sticky-uom"
                            }
                          >

                            {uom ||
                              "—"}

                          </td>


                          {/* ====================================
                              EVERY STOCK DATE
                          ==================================== */}

                          {dateColumns.map(
                            (
                              date
                            ) => {

                              const quantity =
                                numberValue(
                                  row?.[
                                    date
                                  ]
                                );


                              return (

                                <td
                                  key={
                                    date
                                  }

                                  className="msv-qty msv-date-qty"
                                >

                                  <span
                                    className={
                                      quantity >
                                      0
                                        ? "has-stock"
                                        : "zero-stock"
                                    }
                                  >

                                    {formatNumber(
                                      quantity
                                    )}

                                  </span>

                                </td>

                              );
                            }
                          )}


                          {/* ====================================
                              TOTAL
                          ==================================== */}

                          <td className="msv-total msv-total-final">

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


        {/* ====================================================
            DATABASE FOOTER
        ==================================================== */}

        <div className="msv-database-footer">


          <div>

            <span
              className={
                `msv-live-dot ${
                  connected
                    ? "online"
                    : ""
                }`
              }
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

            </strong>

            {" "}ITEMS


            <span className="msv-footer-divider">

              /

            </span>


            <strong>

              {
                dateColumns.length
              }

            </strong>

            {" "}DATES


            <span className="msv-footer-divider">

              /

            </span>


            ALL-DATE QTY{" "}


            <strong>

              {formatNumber(
                summary.quantity
              )}

            </strong>

          </div>

        </div>

      </section>


      <div className="msv-bottom-space" />

    </div>
  );
}
