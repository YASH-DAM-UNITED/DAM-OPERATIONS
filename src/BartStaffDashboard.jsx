import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  Database,
  Eye,
  LoaderCircle,
  LogOut,
  MapPin,
  PackageCheck,
  PackageOpen,
  PackageX,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from "lucide-react";

import BartStockRecord from "./BartStockRecord";
import BartStockTransfer from "./BartStockTransfer";


/* ============================================================
   CONFIG
============================================================ */

const SESSION_TIMEOUT_MS =
  30 * 60 * 1000;

const TRANSFER_POLL_MS =
  15000;


/* ============================================================
   MODULES
============================================================ */

const modules = [
  {
    id: "stock-record",
    icon: ClipboardList,
    number: "01",
    title: "Stock Record",
    subtitle: "DAILY & WEEKLY ENTRY",
    description:
      "Record daily, weekly and bakery stock with review and submission controls.",
  },

  {
    id: "schedule",
    icon: CalendarDays,
    number: "02",
    title: "Staff Schedule",
    subtitle: "SHIFT OPERATIONS",
    description:
      "View branch staffing, shift assignments and operational schedules.",
  },

  {
    id: "stock-view",
    icon: Boxes,
    number: "03",
    title: "Stock View",
    subtitle: "BRANCH INVENTORY",
    description:
      "Review current Daily and Weekly stock data for this branch.",
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


/* ============================================================
   TRANSFER ITEM FORMATTER
============================================================ */

function normalizeTransferItems(
  transfer
) {
  const itemText =
    String(
      transfer?.items || ""
    ).replace(
      /â€¢/g,
      "•"
    );

  const items =
    itemText
      .split("\n")
      .map(
        (item) =>
          item
            .replace(
              /^•\s*/,
              ""
            )
            .trim()
      )
      .filter(Boolean);

  const quantities =
    String(
      transfer?.quantities || ""
    )
      .split("\n")
      .map(
        (qty) =>
          qty.trim()
      )
      .filter(Boolean);

  const length =
    Math.max(
      items.length,
      quantities.length
    );

  return Array.from(
    { length },
    (_, index) => ({
      item:
        items[index] ||
        "Item",

      quantity:
        quantities[index] ||
        "-",
    })
  );
}


/* ============================================================
   TRANSFER POPUP
============================================================ */

function TransferPopup({
  transfer,
  busy,
  onClose,
  onAccept,
  onReject,
}) {
  const items =
    useMemo(
      () =>
        normalizeTransferItems(
          transfer
        ),
      [transfer]
    );

  if (!transfer) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="dam-transfer-overlay"
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
          className="dam-transfer-popup"
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
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 18,
          }}
          transition={{
            type: "spring",
            stiffness: 270,
            damping: 23,
          }}
        >
          <button
            type="button"
            className="dam-transfer-x"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>

          <div className="dam-transfer-logo">
            <Truck size={25} />
          </div>

          <span className="dam-transfer-label">
            NEW TRANSFER RECEIVED
          </span>

          <h2>
            Incoming Transfer
          </h2>

          <div className="dam-transfer-id">
            {transfer.id}
          </div>

          <div className="dam-transfer-route">
            <div>
              <small>
                FROM
              </small>

              <strong>
                {transfer.origin}
              </strong>
            </div>

            <ArrowRight
              size={18}
            />

            <div>
              <small>
                TO
              </small>

              <strong>
                {transfer.destination}
              </strong>
            </div>
          </div>

          <div className="dam-transfer-items">
            {items.map(
              (
                entry,
                index
              ) => (
                <div
                  className="dam-transfer-item"
                  key={`${entry.item}-${index}`}
                >
                  <span>
                    {entry.item}
                  </span>

                  <strong>
                    {entry.quantity}
                  </strong>
                </div>
              )
            )}
          </div>

          <div className="dam-transfer-reason">
            <small>
              REASON / REFERENCE
            </small>

            <strong>
              {transfer.reason ||
                "No reason provided"}
            </strong>
          </div>

          <div className="dam-transfer-warning">
            <AlertTriangle
              size={15}
            />

            Rejecting this transfer returns stock to the origin branch and removes it from the destination branch.
          </div>

          <div className="dam-transfer-buttons">
            <button
              type="button"
              className="dam-reject-transfer"
              disabled={busy}
              onClick={onReject}
            >
              {busy ? (
                <LoaderCircle
                  size={17}
                  className="dam-spin"
                />
              ) : (
                <PackageX
                  size={17}
                />
              )}

              REJECT
            </button>

            <button
              type="button"
              className="dam-accept-transfer"
              disabled={busy}
              onClick={onAccept}
            >
              {busy ? (
                <LoaderCircle
                  size={17}
                  className="dam-spin"
                />
              ) : (
                <PackageCheck
                  size={17}
                />
              )}

              ACCEPT
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


/* ============================================================
   STOCK TABLE
============================================================ */

function StockTable({
  title,
  rows,
}) {
  if (
    !Array.isArray(
      rows
    ) ||
    rows.length === 0
  ) {
    return (
      <div className="dam-stock-empty">
        No {title.toLowerCase()} found.
      </div>
    );
  }

  const columns =
    Object.keys(
      rows[0]
    );

  return (
    <section className="dam-stock-section">
      <div className="dam-stock-section-head">
        <div>
          <span>
            STOCK VIEW
          </span>

          <h3>
            {title}
          </h3>
        </div>

        <strong>
          {rows.length} ITEMS
        </strong>
      </div>

      <div className="dam-stock-table-wrap">
        <table className="dam-stock-table">
          <thead>
            <tr>
              {columns.map(
                (column) => (
                  <th
                    key={column}
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (
                row,
                index
              ) => (
                <tr
                  key={index}
                >
                  {columns.map(
                    (
                      column
                    ) => (
                      <td
                        key={column}
                      >
                        {row[column]}
                      </td>
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


/* ============================================================
   MAIN DASHBOARD
============================================================ */

export default function BartStaffDashboard({
  branch,
  onBack,
  onLogout,
  onRefresh,
  onModule,
}) {
  /* ==========================================================
     ACTIVE MODULE
  ========================================================== */

  const [
    activeModule,
    setActiveModule,
  ] =
    useState(null);


  /* ==========================================================
     TRANSFERS
  ========================================================== */

  const [
    pendingTransfers,
    setPendingTransfers,
  ] =
    useState([]);

  const [
    transfersLoading,
    setTransfersLoading,
  ] =
    useState(true);

  const [
    activeTransfer,
    setActiveTransfer,
  ] =
    useState(null);

  const [
    transferBusy,
    setTransferBusy,
  ] =
    useState(false);

  const [
    transferMessage,
    setTransferMessage,
  ] =
    useState(null);


  /* ==========================================================
     STOCK VIEW
  ========================================================== */

  const [
    showStockView,
    setShowStockView,
  ] =
    useState(false);

  const [
    stockLoading,
    setStockLoading,
  ] =
    useState(false);

  const [
    stockData,
    setStockData,
  ] =
    useState(null);

  const [
    stockError,
    setStockError,
  ] =
    useState("");

  const [
    stockSource,
    setStockSource,
  ] =
    useState("");

  const [
    stockSyncedAt,
    setStockSyncedAt,
  ] =
    useState(null);


  /* ==========================================================
     DATABASE
  ========================================================== */

  const [
    databaseRefreshing,
    setDatabaseRefreshing,
  ] =
    useState(false);

  const [
    databaseStatus,
    setDatabaseStatus,
  ] =
    useState({
      branches: 0,
      transfers: 0,
      drafts: 0,
      lastSync: null,
    });

  const [
    databaseMessage,
    setDatabaseMessage,
  ] =
    useState(null);


  /* ==========================================================
     SESSION
  ========================================================== */

  const lastActivityRef =
    useRef(
      Date.now()
    );

  const logoutTriggeredRef =
    useRef(false);

  const touchSession =
    useCallback(
      () => {
        lastActivityRef.current =
          Date.now();
      },
      []
    );


  useEffect(() => {
    const events = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    const activityHandler =
      () => {
        touchSession();
      };

    events.forEach(
      (eventName) => {
        window.addEventListener(
          eventName,
          activityHandler,
          {
            passive: true,
          }
        );
      }
    );

    const timer =
      window.setInterval(
        () => {
          const inactive =
            Date.now() -
            lastActivityRef.current;

          if (
            inactive >=
              SESSION_TIMEOUT_MS &&
            !logoutTriggeredRef.current
          ) {
            logoutTriggeredRef.current =
              true;

            alert(
              "Session expired due to 30 minutes of inactivity."
            );

            onLogout?.();
          }
        },
        15000
      );

    return () => {
      window.clearInterval(
        timer
      );

      events.forEach(
        (eventName) => {
          window.removeEventListener(
            eventName,
            activityHandler
          );
        }
      );
    };
  }, [
    onLogout,
    touchSession,
  ]);


  /* ==========================================================
     DATABASE STATUS
  ========================================================== */

  const loadDatabaseStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/admin/database-status",
              {
                cache: "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            return;
          }

          setDatabaseStatus({
            branches:
              Number(
                data.bartBranches ||
                0
              ),

            transfers:
              Number(
                data.transfers ||
                0
              ),

            drafts:
              Number(
                data.stockDrafts ||
                0
              ),

            lastSync:
              data.lastSync ||
              null,
          });
        } catch (error) {
          console.error(
            "Database status error:",
            error
          );
        }
      },
      []
    );


  /* ==========================================================
     LIVE TRANSFER CHECK
  ========================================================== */

  const loadPendingTransfers =
    useCallback(
      async ({
        openPopup =
          false,
      } = {}) => {
        if (
          !branch?.code
        ) {
          return;
        }

        try {
          setTransfersLoading(
            true
          );

          const response =
            await fetch(
              `/api/staff/bart/pending-transfers?branch=${encodeURIComponent(
                branch.code
              )}`,
              {
                cache: "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
              "Unable to check transfers."
            );
          }

          const transfers =
            Array.isArray(
              data.transfers
            )
              ? data.transfers
              : [];

          setPendingTransfers(
            transfers
          );

          if (
            openPopup &&
            transfers.length >
              0
          ) {
            setActiveTransfer(
              transfers[0]
            );
          }
        } catch (error) {
          console.error(
            "Transfer load error:",
            error
          );
        } finally {
          setTransfersLoading(
            false
          );
        }
      },
      [
        branch?.code,
      ]
    );


  /* ==========================================================
     DASHBOARD POLLING

     IMPORTANT:
     Polling runs ONLY while the main dashboard is active.
     When Stock Record / Stock Transfer opens, this effect
     clears the interval and makes zero 15-second dashboard polls.
  ========================================================== */

  useEffect(() => {
    if (
      activeModule !== null
    ) {
      return undefined;
    }

    touchSession();

    loadDatabaseStatus();

    loadPendingTransfers({
      openPopup: true,
    });

    const interval =
      window.setInterval(
        () => {
          loadPendingTransfers({
            openPopup: false,
          });
        },
        TRANSFER_POLL_MS
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    activeModule,
    branch?.code,
    loadDatabaseStatus,
    loadPendingTransfers,
    touchSession,
  ]);


  /* ==========================================================
     ACCEPT / REJECT TRANSFER
  ========================================================== */

  async function respondToTransfer(
    action
  ) {
    if (
      !activeTransfer ||
      transferBusy
    ) {
      return;
    }

    if (
      action ===
      "reject"
    ) {
      const confirmed =
        window.confirm(
          "Reject this transfer?\n\nStock will be returned to the origin branch and removed from this destination branch."
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      touchSession();

      setTransferBusy(
        true
      );

      setTransferMessage(
        null
      );

      const response =
        await fetch(
          "/api/staff/bart/transfer/respond",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                transferId:
                  activeTransfer.id,

                action,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "Transfer operation failed."
        );
      }

      setTransferMessage({
        type:
          "success",

        text:
          data.message ||
          (
            action ===
            "accept"
              ? "Transfer accepted."
              : "Transfer rejected."
          ),
      });

      setActiveTransfer(
        null
      );

      if (
        action ===
        "reject"
      ) {
        setStockData(
          null
        );
      }

      await loadPendingTransfers({
        openPopup: false,
      });

      await loadDatabaseStatus();
    } catch (error) {
      setTransferMessage({
        type:
          "error",

        text:
          error.message ||
          "Transfer operation failed.",
      });
    } finally {
      setTransferBusy(
        false
      );
    }
  }


  /* ==========================================================
     STOCK VIEW
  ========================================================== */

  async function loadStockView(
    forceRefresh =
      false
  ) {
    if (
      !branch?.code
    ) {
      return;
    }

    try {
      touchSession();

      setStockLoading(
        true
      );

      setStockError(
        ""
      );

      const url =
        `/api/staff/bart/stock-view?branch=${encodeURIComponent(
          branch.code
        )}${
          forceRefresh
            ? "&refresh=1"
            : ""
        }`;

      const response =
        await fetch(
          url,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "Unable to load stock."
        );
      }

      setStockData(
        data.stock
      );

      setStockSource(
        data.source ||
        ""
      );

      setStockSyncedAt(
        data.syncedAt ||
        null
      );
    } catch (error) {
      setStockError(
        error.message ||
        "Unable to load stock."
      );
    } finally {
      setStockLoading(
        false
      );
    }
  }


  async function toggleStockView() {
    touchSession();

    const next =
      !showStockView;

    setShowStockView(
      next
    );

    if (
      next &&
      !stockData
    ) {
      await loadStockView(
        false
      );
    }
  }


  /* ==========================================================
     MANUAL DATABASE REFRESH
  ========================================================== */

  async function refreshDatabase() {
    const password =
      window.prompt(
        "Enter database refresh password:"
      );

    if (!password) {
      return;
    }

    try {
      touchSession();

      setDatabaseRefreshing(
        true
      );

      setDatabaseMessage({
        type:
          "info",

        text:
          "Refreshing master database from Google Sheets...",
      });

      const response =
        await fetch(
          "/api/admin/sync-bart",
          {
            method:
              "POST",

            headers: {
              "X-Admin-Key":
                password,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "Database refresh failed."
        );
      }

      setDatabaseMessage({
        type:
          "success",

        text:
          `Database refreshed: ${data.branches} branches and ${data.transfers} transfers.`,
      });

      await loadDatabaseStatus();

      await loadPendingTransfers({
        openPopup: false,
      });

      onRefresh?.();
    } catch (error) {
      setDatabaseMessage({
        type:
          "error",

        text:
          error.message ||
          "Database refresh failed.",
      });
    } finally {
      setDatabaseRefreshing(
        false
      );
    }
  }


  /* ==========================================================
     DASHBOARD REFRESH
  ========================================================== */

  async function refreshDashboard() {
    touchSession();

    await Promise.all([
      loadDatabaseStatus(),

      loadPendingTransfers({
        openPopup: false,
      }),
    ]);

    if (
      showStockView
    ) {
      await loadStockView(
        false
      );
    }

    onRefresh?.();
  }


  /* ==========================================================
     MODULE ROUTING
  ========================================================== */

  async function openModule(
    moduleId
  ) {
    touchSession();

    if (
      moduleId ===
      "stock-record"
    ) {
      setActiveModule(
        "stock-record"
      );

      return;
    }

    if (
      moduleId ===
        "stock-transfer" ||
      moduleId ===
        "transfer"
    ) {
      setActiveModule(
        "stock-transfer"
      );

      return;
    }

    if (
      moduleId ===
      "stock-view"
    ) {
      await toggleStockView();

      return;
    }

    /*
      Staff Schedule remains connected to the parent flow
      until its React module is converted.
    */

    onModule?.(
      moduleId
    );
  }


  /* ==========================================================
     TIME FORMAT
  ========================================================== */

  function formatTime(
    value
  ) {
    if (!value) {
      return "Not synced";
    }

    try {
      const actual =
        typeof value ===
        "number"
          ? value * 1000
          : value;

      return new Date(
        actual
      ).toLocaleString();
    } catch {
      return String(
        value
      );
    }
  }


  /* ==========================================================
     STOCK RECORD MODULE
  ========================================================== */

  if (
    activeModule ===
    "stock-record"
  ) {
    return (
      <BartStockRecord
        branch={branch}
        onBack={() => {
          setActiveModule(
            null
          );

          /*
            A Stock Record submission can change stock.
            Do not keep old local Stock View data.
          */

          setStockData(
            null
          );
        }}
      />
    );
  }


  /* ==========================================================
     STOCK TRANSFER MODULE
  ========================================================== */

  if (
    activeModule ===
    "stock-transfer"
  ) {
    return (
      <BartStockTransfer
        branch={branch}
        onBack={() => {
          /*
            Transfer can change both origin and destination stock.
            Discard this branch's local Stock View cache.
          */

          setStockData(
            null
          );

          /*
            Return to main Dashboard.
            The dashboard polling effect starts again automatically.
          */

          setActiveModule(
            null
          );
        }}
      />
    );
  }


  /* ==========================================================
     MAIN DASHBOARD UI
  ========================================================== */

  return (
    <div className="bart-dashboard">

      <div className="bart-dashboard-grid" />

      <div className="bart-dashboard-glow glow-one" />

      <div className="bart-dashboard-glow glow-two" />


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="bart-dashboard-nav">

        <motion.div
          className="bart-dash-brand"
          initial={{
            opacity: 0,
            x: -15,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <div className="bart-dash-logo">
            <Coffee
              size={19}
            />
          </div>

          <div>
            <strong>
              BART
            </strong>

            <span>
              STAFF OPERATIONS
            </span>
          </div>
        </motion.div>


        <motion.div
          className="bart-nav-actions"
          initial={{
            opacity: 0,
            x: 15,
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


          <button
            type="button"
            className="bart-icon-button"
            disabled={
              databaseRefreshing
            }
            onClick={
              refreshDatabase
            }
            title="Refresh Database"
          >
            {databaseRefreshing ? (
              <LoaderCircle
                size={17}
                className="dam-spin"
              />
            ) : (
              <Database
                size={17}
              />
            )}
          </button>


          <button
            type="button"
            className="bart-icon-button"
            onClick={
              refreshDashboard
            }
            title="Refresh Dashboard"
          >
            <RefreshCcw
              size={17}
            />
          </button>


          <button
            type="button"
            className="bart-icon-button danger"
            onClick={() => {
              touchSession();

              onLogout?.();
            }}
            title="Logout"
          >
            <LogOut
              size={17}
            />
          </button>
        </motion.div>
      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="bart-dashboard-main">

        <motion.button
          type="button"
          className="bart-back-button"
          onClick={() => {
            touchSession();

            onBack?.();
          }}
          initial={{
            opacity: 0,
            x: -10,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <ArrowLeft
            size={15}
          />

          CHANGE BRANCH
        </motion.button>


        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="bart-dashboard-hero">

          <motion.div
            className="bart-hero-copy"
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="bart-mini-label">
              <Activity
                size={12}
              />

              BART BRANCH NETWORK
            </div>

            <h1>
              Branch operations,
              <br />

              <span>
                in one place.
              </span>
            </h1>

            <p>
              Manage stock records, inventory, transfers, schedules and branch operations through one workspace.
            </p>
          </motion.div>


          <motion.div
            className="bart-branch-card"
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.97,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
          >
            <div className="bart-branch-top">
              <div className="bart-branch-location">
                <MapPin
                  size={16}
                />
              </div>

              <span>
                ACTIVE BRANCH
              </span>
            </div>

            <h2>
              {branch?.name ||
                "BART Branch"}
            </h2>

            <div className="bart-branch-code">
              {branch?.code ||
                "B000"}
            </div>

            <div className="bart-branch-meta">
              <div>
                <Clock3
                  size={14}
                />

                <span>
                  30 Min Session
                </span>
              </div>

              <div>
                <ShieldCheck
                  size={14}
                />

                <span>
                  Authenticated
                </span>
              </div>
            </div>
          </motion.div>
        </section>


        {/* ====================================================
            LIVE TRANSFER CENTER
        ==================================================== */}

        <motion.section
          className={
            `bart-notification-strip ${
              pendingTransfers.length >
              0
                ? "dam-has-transfer"
                : ""
            }`
          }
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div className="bart-notification-icon">
            <Bell
              size={17}
            />
          </div>

          <div className="bart-notification-text">
            <small>
              LIVE TRANSFER CENTER
            </small>

            <strong>
              {transfersLoading
                ? "Checking latest transfers..."
                : pendingTransfers.length >
                  0
                ? `${pendingTransfers.length} pending transfer${
                    pendingTransfers.length >
                    1
                      ? "s"
                      : ""
                  }`
                : "No pending transfers right now"}
            </strong>
          </div>

          <button
            type="button"
            disabled={
              transfersLoading ||
              pendingTransfers.length ===
                0
            }
            onClick={() => {
              touchSession();

              if (
                pendingTransfers.length >
                0
              ) {
                setActiveTransfer(
                  pendingTransfers[0]
                );
              }
            }}
          >
            {pendingTransfers.length >
            0
              ? "Review Transfer"
              : "No Transfers"}

            <ArrowRight
              size={15}
            />
          </button>
        </motion.section>


        {/* ====================================================
            TRANSFER MESSAGE
        ==================================================== */}

        <AnimatePresence>
          {transferMessage && (
            <motion.div
              className={
                `bart-operation-message ${transferMessage.type}`
              }
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
              {transferMessage.type ===
              "success" ? (
                <CheckCircle2
                  size={16}
                />
              ) : (
                <XCircle
                  size={16}
                />
              )}

              <span>
                {transferMessage.text}
              </span>

              <button
                type="button"
                onClick={() =>
                  setTransferMessage(
                    null
                  )
                }
              >
                <X
                  size={14}
                />
              </button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ====================================================
            DATABASE STATUS
        ==================================================== */}

        <motion.section
          className="bart-database-status-card"
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div className="bart-db-status-left">
            <div className="bart-db-icon">
              <Database
                size={17}
              />
            </div>

            <div>
              <small>
                LIVE CACHE
              </small>

              <strong>
                CLOUDFLARE D1
              </strong>
            </div>
          </div>

          <div className="bart-db-stat">
            <small>
              BRANCHES
            </small>

            <strong>
              {databaseStatus.branches}
            </strong>
          </div>

          <div className="bart-db-stat">
            <small>
              TRANSFERS
            </small>

            <strong>
              {databaseStatus.transfers}
            </strong>
          </div>

          <div className="bart-db-stat">
            <small>
              DRAFTS
            </small>

            <strong>
              {databaseStatus.drafts}
            </strong>
          </div>

          <div className="bart-db-sync">
            <small>
              MASTER SYNC
            </small>

            <strong>
              {formatTime(
                databaseStatus.lastSync
              )}
            </strong>
          </div>

          <button
            type="button"
            className="database-refresh-btn"
            disabled={
              databaseRefreshing
            }
            onClick={
              refreshDatabase
            }
          >
            {databaseRefreshing ? (
              <LoaderCircle
                size={15}
                className="dam-spin"
              />
            ) : (
              <RotateCcw
                size={15}
              />
            )}

            {databaseRefreshing
              ? "SYNCING"
              : "REFRESH DATABASE"}
          </button>
        </motion.section>


        {/* ====================================================
            DATABASE MESSAGE
        ==================================================== */}

        <AnimatePresence>
          {databaseMessage && (
            <motion.div
              className={
                `bart-operation-message ${databaseMessage.type}`
              }
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
              {databaseMessage.type ===
              "success" ? (
                <CheckCircle2
                  size={16}
                />
              ) : databaseMessage.type ===
                "error" ? (
                <XCircle
                  size={16}
                />
              ) : (
                <LoaderCircle
                  size={16}
                  className="dam-spin"
                />
              )}

              <span>
                {databaseMessage.text}
              </span>

              <button
                type="button"
                onClick={() =>
                  setDatabaseMessage(
                    null
                  )
                }
              >
                <X
                  size={14}
                />
              </button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ====================================================
            MODULE TITLE
        ==================================================== */}

        <section className="bart-module-header">
          <div>
            <span>
              OPERATIONS
            </span>

            <h2>
              What do you need to do?
            </h2>
          </div>

          <div className="bart-module-count">
            04 MODULES
          </div>
        </section>


        {/* ====================================================
            MODULE CARDS
        ==================================================== */}

        <section className="bart-module-grid">
          {modules.map(
            (
              module,
              index
            ) => {
              const Icon =
                module.icon;

              const active =
                module.id ===
                  "stock-view" &&
                showStockView;

              return (
                <motion.button
                  type="button"
                  key={module.id}
                  className={
                    `bart-module-card ${
                      active
                        ? "dam-module-active"
                        : ""
                    }`
                  }
                  onClick={() =>
                    openModule(
                      module.id
                    )
                  }
                  initial={{
                    opacity: 0,
                    y: 28,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      0.12 +
                      index *
                        0.07,
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
                      <Icon
                        size={22}
                      />
                    </div>

                    <span className="bart-module-number">
                      {module.number}
                    </span>
                  </div>

                  <div className="bart-module-subtitle">
                    {module.subtitle}
                  </div>

                  <h3>
                    {module.title}
                  </h3>

                  <p>
                    {module.description}
                  </p>

                  <div className="bart-module-open">
                    <span>
                      {active
                        ? "CLOSE VIEW"
                        : "OPEN MODULE"}
                    </span>

                    <div>
                      {active ? (
                        <Eye
                          size={16}
                        />
                      ) : (
                        <ArrowRight
                          size={16}
                        />
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            }
          )}
        </section>


        {/* ====================================================
            STOCK VIEW
        ==================================================== */}

        <AnimatePresence>
          {showStockView && (
            <motion.section
              className="dam-stock-view"
              initial={{
                opacity: 0,
                y: 25,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: 15,
              }}
            >
              <div className="dam-stock-view-header">
                <div>
                  <span>
                    {branch?.code} / STOCK VIEW
                  </span>

                  <h2>
                    {branch?.name} Inventory
                  </h2>

                  <p>
                    Current Daily and Weekly stock information.
                  </p>
                </div>

                <div className="dam-stock-actions">
                  {stockSource && (
                    <span className="dam-stock-source">
                      {stockSource}
                    </span>
                  )}

                  {stockSyncedAt && (
                    <span className="dam-stock-source">
                      {formatTime(
                        stockSyncedAt
                      )}
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={
                      stockLoading
                    }
                    onClick={() =>
                      loadStockView(
                        true
                      )
                    }
                  >
                    {stockLoading ? (
                      <LoaderCircle
                        size={15}
                        className="dam-spin"
                      />
                    ) : (
                      <RotateCcw
                        size={15}
                      />
                    )}

                    REFRESH STOCK
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowStockView(
                        false
                      )
                    }
                  >
                    <X
                      size={15}
                    />
                  </button>
                </div>
              </div>

              {stockLoading &&
              !stockData ? (
                <div className="dam-stock-loading">
                  <LoaderCircle
                    size={25}
                    className="dam-spin"
                  />

                  Loading branch stock...
                </div>
              ) : stockError ? (
                <div className="dam-stock-error">
                  <XCircle
                    size={18}
                  />

                  {stockError}
                </div>
              ) : stockData ? (
                <>
                  <StockTable
                    title="Daily Items Stock"
                    rows={
                      stockData.daily
                    }
                  />

                  <StockTable
                    title="Weekly Items Stock"
                    rows={
                      stockData.weekly
                    }
                  />
                </>
              ) : null}
            </motion.section>
          )}
        </AnimatePresence>


        {/* ====================================================
            BOTTOM STATUS
        ==================================================== */}

        <motion.section
          className="bart-bottom-status"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.4,
          }}
        >
          <div>
            <PackageOpen
              size={17}
            />

            <span>
              <strong>
                Branch Operations
              </strong>

              <small>
                Staff system ready
              </small>
            </span>
          </div>

          <div className="bart-status-line" />

          <div>
            <ShieldCheck
              size={17}
            />

            <span>
              <strong>
                Smart D1 Cache
              </strong>

              <small>
                Google API protected
              </small>
            </span>
          </div>

          <div className="bart-status-line" />

          <div>
            <Bell
              size={17}
            />

            <span>
              <strong>
                Live Transfers
              </strong>

              <small>
                Automatic checks active
              </small>
            </span>
          </div>
        </motion.section>
      </main>


      {/* ======================================================
          TRANSFER POPUP
      ====================================================== */}

      <TransferPopup
        transfer={
          activeTransfer
        }
        busy={
          transferBusy
        }
        onClose={() =>
          setActiveTransfer(
            null
          )
        }
        onAccept={() =>
          respondToTransfer(
            "accept"
          )
        }
        onReject={() =>
          respondToTransfer(
            "reject"
          )
        }
      />
    </div>
  );
}
