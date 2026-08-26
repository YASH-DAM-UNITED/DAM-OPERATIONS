import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

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
  Database,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  PackageCheck,
  PackageX,
  Truck,
  X,
  AlertTriangle,
  RotateCcw,
  Layers3,
  Timer,
} from "lucide-react";


/* ============================================================
   CONFIGURATION
============================================================ */

const SESSION_TIMEOUT_MS =
  30 * 60 * 1000;

const API = {
  databaseStatus:
    "/api/admin/database-status",

  databaseSync:
    "/api/admin/sync-bart",

  pendingTransfers:
    "/api/staff/bart/pending-transfers",

  transferRespond:
    "/api/staff/bart/transfer/respond",
};


/* ============================================================
   BART STAFF MODULES
============================================================ */

const modules = [
  {
    id: "stock-record",

    icon: ClipboardList,

    number: "01",

    title: "Stock Record",

    subtitle:
      "DAILY & WEEKLY ENTRY",

    description:
      "Record branch stock quantities and submit daily or weekly operational stock updates.",
  },

  {
    id: "schedule",

    icon: CalendarDays,

    number: "02",

    title: "Staff Schedule",

    subtitle:
      "SHIFT OPERATIONS",

    description:
      "View staff assignments, shifts and branch workforce scheduling.",
  },

  {
    id: "stock-view",

    icon: Boxes,

    number: "03",

    title: "Stock View",

    subtitle:
      "BRANCH INVENTORY",

    description:
      "Review current daily and weekly stock records for this branch.",
  },

  {
    id: "transfer",

    icon: ArrowLeftRight,

    number: "04",

    title: "Stock Transfer",

    subtitle:
      "INTERNAL MOVEMENT",

    description:
      "Send and receive stock between DAM branches with transfer tracking.",
  },
];


/* ============================================================
   TRANSFER ITEMS FORMATTER
============================================================ */

function normalizeTransferItems(
  itemsText,
  quantitiesText
) {
  const items =
    String(itemsText || "")
      .replace(/â€¢/g, "•")
      .split("\n")
      .map((item) =>
        item
          .replace(/^•\s*/, "")
          .trim()
      )
      .filter(Boolean);

  const quantities =
    String(quantitiesText || "")
      .split("\n")
      .map((qty) =>
        qty.trim()
      )
      .filter(Boolean);

  const size =
    Math.max(
      items.length,
      quantities.length
    );

  return Array.from(
    {
      length: size,
    },
    (_, index) => ({
      item:
        items[index] || "Item",

      quantity:
        quantities[index] || "-",
    })
  );
}


/* ============================================================
   TRANSFER MODAL
============================================================ */

function TransferModal({
  transfer,
  loading,
  onClose,
  onAccept,
  onReject,
}) {
  const items =
    useMemo(
      () =>
        normalizeTransferItems(
          transfer?.items,
          transfer?.quantities
        ),
      [
        transfer?.items,
        transfer?.quantities,
      ]
    );

  if (!transfer) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="bart-transfer-backdrop"
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        exit={{
          opacity: 0,
        }}
        onMouseDown={() => {
          if (!loading) {
            onClose();
          }
        }}
      >
        <motion.div
          className="bart-transfer-modal"
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
            scale: 0.96,
            y: 20,
          }}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 24,
          }}
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            className="bart-transfer-close"
            disabled={loading}
            onClick={onClose}
          >
            <X size={18} />
          </button>

          <div className="bart-transfer-modal-icon">
            <Truck size={24} />
          </div>

          <div className="bart-transfer-kicker">
            NEW TRANSFER RECEIVED
          </div>

          <h2>
            Incoming stock transfer
          </h2>

          <div className="bart-transfer-id">
            {transfer.id}
          </div>

          <div className="bart-transfer-route">
            <div>
              <small>FROM</small>

              <strong>
                {transfer.origin}
              </strong>
            </div>

            <ArrowRight
              size={18}
            />

            <div>
              <small>TO</small>

              <strong>
                {transfer.destination}
              </strong>
            </div>
          </div>

          <div className="bart-transfer-items">
            <div className="bart-transfer-items-head">
              <Layers3 size={16} />

              <strong>
                Transfer Items
              </strong>

              <span>
                {items.length}
              </span>
            </div>

            {items.map(
              (entry, index) => (
                <div
                  className="bart-transfer-item"
                  key={`${entry.item}-${index}`}
                >
                  <div>
                    <span>
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <strong>
                      {entry.item}
                    </strong>
                  </div>

                  <b>
                    {entry.quantity}
                  </b>
                </div>
              )
            )}
          </div>

          <div className="bart-transfer-reason">
            <small>
              REASON / REFERENCE
            </small>

            <strong>
              {transfer.reason ||
                "No reason provided"}
            </strong>
          </div>

          <div className="bart-transfer-warning">
            <AlertTriangle
              size={15}
            />

            Rejecting reverses the stock movement:
            quantity is returned to the origin and
            removed from this destination branch.
          </div>

          <div className="bart-transfer-actions">
            <button
              type="button"
              className="bart-transfer-reject"
              disabled={loading}
              onClick={onReject}
            >
              {loading ? (
                <LoaderCircle
                  className="branch-loading-spinner"
                  size={17}
                />
              ) : (
                <PackageX
                  size={17}
                />
              )}

              Reject Transfer
            </button>

            <button
              type="button"
              className="bart-transfer-accept"
              disabled={loading}
              onClick={onAccept}
            >
              {loading ? (
                <LoaderCircle
                  className="branch-loading-spinner"
                  size={17}
                />
              ) : (
                <PackageCheck
                  size={17}
                />
              )}

              Accept Transfer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


/* ============================================================
   MAIN BART STAFF DASHBOARD
============================================================ */

export default function BartStaffDashboard({
  branch = {
    code: "B001",
    name: "BART Branch",
  },

  onBack,
  onLogout,
  onRefresh,
  onModule,
}) {
  /* ==========================================================
     DATABASE
  ========================================================== */

  const [
    databaseStatus,
    setDatabaseStatus,
  ] = useState({
    branches: 0,
    transfers: 0,
    lastSync: null,
  });

  const [
    databaseRefreshing,
    setDatabaseRefreshing,
  ] = useState(false);

  const [
    databaseMessage,
    setDatabaseMessage,
  ] = useState(null);


  /* ==========================================================
     TRANSFERS
  ========================================================== */

  const [
    pendingTransfers,
    setPendingTransfers,
  ] = useState([]);

  const [
    transfersLoading,
    setTransfersLoading,
  ] = useState(true);

  const [
    activeTransfer,
    setActiveTransfer,
  ] = useState(null);

  const [
    transferActionLoading,
    setTransferActionLoading,
  ] = useState(false);

  const [
    transferMessage,
    setTransferMessage,
  ] = useState(null);


  /* ==========================================================
     SESSION / ACTIVITY
  ========================================================== */

  const lastActivityRef =
    useRef(Date.now());

  const logoutTriggeredRef =
    useRef(false);


  /* ==========================================================
     ACTIVITY REFRESH
  ========================================================== */

  const refreshActivity =
    useCallback(() => {
      lastActivityRef.current =
        Date.now();
    }, []);


  /* ==========================================================
     SESSION TIMEOUT

     Old Streamlit:
     SESSION_TIMEOUT = 30 * 60
  ========================================================== */

  useEffect(() => {
    const activityEvents = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    const handleActivity = () => {
      refreshActivity();
    };

    activityEvents.forEach(
      (eventName) => {
        window.addEventListener(
          eventName,
          handleActivity,
          {
            passive: true,
          }
        );
      }
    );

    const interval =
      window.setInterval(
        () => {
          const inactiveFor =
            Date.now() -
            lastActivityRef.current;

          if (
            inactiveFor >=
              SESSION_TIMEOUT_MS &&
            !logoutTriggeredRef.current
          ) {
            logoutTriggeredRef.current =
              true;

            alert(
              "Logged out due to 30 minutes of inactivity."
            );

            onLogout?.();
          }
        },
        15000
      );

    return () => {
      window.clearInterval(
        interval
      );

      activityEvents.forEach(
        (eventName) => {
          window.removeEventListener(
            eventName,
            handleActivity
          );
        }
      );
    };
  }, [
    onLogout,
    refreshActivity,
  ]);


  /* ==========================================================
     DATABASE STATUS

     D1 ONLY.
     Google called = 0.
  ========================================================== */

  const loadDatabaseStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              API.databaseStatus,
              {
                cache:
                  "no-store",
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

            lastSync:
              data.lastSync ||
              null,
          });
        } catch (error) {
          console.error(
            "Database status:",
            error
          );
        }
      },
      []
    );


  /* ==========================================================
     LOAD PENDING TRANSFERS

     D1 ONLY.
     This replaces check_for_pending_transfers().
  ========================================================== */

  const loadPendingTransfers =
    useCallback(
      async ({
        openFirst =
          true,
      } = {}) => {
        if (!branch?.code) {
          return;
        }

        try {
          setTransfersLoading(
            true
          );

          const url =
            `${API.pendingTransfers}` +
            `?branch=${encodeURIComponent(
              branch.code
            )}`;

          const response =
            await fetch(url, {
              cache:
                "no-store",
            });

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

          /*
            Same behavior as Streamlit:
            pending transfer dialog is shown
            after login.
          */

          if (
            openFirst &&
            transfers.length >
              0
          ) {
            setActiveTransfer(
              transfers[0]
            );
          }
        } catch (error) {
          console.error(
            "Pending transfer error:",
            error
          );

          setPendingTransfers(
            []
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
     FIRST DASHBOARD LOAD
  ========================================================== */

  useEffect(() => {
    refreshActivity();

    loadDatabaseStatus();

    loadPendingTransfers({
      openFirst: true,
    });
  }, [
    branch?.code,
    loadDatabaseStatus,
    loadPendingTransfers,
    refreshActivity,
  ]);


  /* ==========================================================
     ACCEPT / REJECT

     Backend performs Google operations.

     ACCEPT:
     Transfer Status -> Accepted

     REJECT:
     Origin stock += Qty
     Destination stock -= Qty
     Transfer Status -> Rejected
  ========================================================== */

  async function respondToTransfer(
    action
  ) {
    if (
      !activeTransfer ||
      transferActionLoading
    ) {
      return;
    }

    const isReject =
      action === "reject";

    if (isReject) {
      const confirmed =
        window.confirm(
          "Reject this transfer?\n\nThe stock will be returned to the origin branch and removed from this branch."
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      refreshActivity();

      setTransferActionLoading(
        true
      );

      setTransferMessage(
        null
      );

      const response =
        await fetch(
          API.transferRespond,
          {
            method: "POST",

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
            `Unable to ${action} transfer.`
        );
      }

      setTransferMessage({
        type: "success",

        text:
          action ===
          "accept"
            ? `Transfer ${activeTransfer.id} accepted successfully.`
            : `Transfer ${activeTransfer.id} rejected. Stock reversal completed.`,
      });

      setActiveTransfer(
        null
      );

      /*
        Reload pending list FROM D1.
      */

      await loadPendingTransfers({
        openFirst: false,
      });

      await loadDatabaseStatus();
    } catch (error) {
      console.error(
        "Transfer response:",
        error
      );

      setTransferMessage({
        type: "error",

        text:
          error.message ||
          "Transfer operation failed.",
      });
    } finally {
      setTransferActionLoading(
        false
      );
    }
  }


  /* ==========================================================
     REFRESH DATABASE

     THIS is the intentional Google -> D1 call.
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
      refreshActivity();

      setDatabaseRefreshing(
        true
      );

      setDatabaseMessage({
        type: "info",

        text:
          "Reading latest branch and transfer data from Google Sheets...",
      });

      const response =
        await fetch(
          API.databaseSync,
          {
            method: "POST",

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
          `Database updated: ${
            data.branches ??
            data.count ??
            0
          } branches and ${
            data.transfers ??
            0
          } transfers synced.`,
      });

      await loadDatabaseStatus();

      await loadPendingTransfers({
        openFirst: false,
      });

      onRefresh?.();
    } catch (error) {
      setDatabaseMessage({
        type: "error",

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
     NORMAL SCREEN REFRESH

     DOES NOT CALL GOOGLE.
  ========================================================== */

  async function refreshScreen() {
    refreshActivity();

    await Promise.all([
      loadDatabaseStatus(),

      loadPendingTransfers({
        openFirst: false,
      }),
    ]);

    onRefresh?.();
  }


  /* ==========================================================
     MODULE OPEN
  ========================================================== */

  function openModule(
    moduleId
  ) {
    refreshActivity();

    onModule?.(
      moduleId
    );
  }


  /* ==========================================================
     LAST SYNC FORMAT
  ========================================================== */

  function formatLastSync(
    value
  ) {
    if (!value) {
      return "Never";
    }

    try {
      return new Date(
        value
      ).toLocaleString();
    } catch {
      return value;
    }
  }


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="bart-dashboard">
      <div className="bart-dashboard-grid" />

      <div className="bart-dashboard-glow glow-one" />

      <div className="bart-dashboard-glow glow-two" />


      {/* =====================================================
          NAV
      ===================================================== */}

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

          {/* GOOGLE -> D1 DATABASE REFRESH */}

          <button
            type="button"
            className="bart-icon-button"
            disabled={
              databaseRefreshing
            }
            onClick={
              refreshDatabase
            }
            title="Refresh Database from Google Sheets"
          >
            {databaseRefreshing ? (
              <LoaderCircle
                size={17}
                className="branch-loading-spinner"
              />
            ) : (
              <Database
                size={17}
              />
            )}
          </button>

          {/* NORMAL D1 REFRESH */}

          <button
            type="button"
            className="bart-icon-button"
            onClick={
              refreshScreen
            }
            title="Refresh Dashboard"
          >
            <RefreshCcw
              size={17}
            />
          </button>

          {/* LOGOUT */}

          <button
            type="button"
            className="bart-icon-button danger"
            onClick={() => {
              refreshActivity();

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


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="bart-dashboard-main">
        <motion.button
          type="button"
          className="bart-back-button"
          onClick={() => {
            refreshActivity();

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


        {/* ===================================================
            HERO
        =================================================== */}

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
              Manage stock records,
              transfers, schedules and
              daily branch operations
              from your BART workspace.
            </p>
          </motion.div>


          {/* ACTIVE BRANCH */}

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
                "B001"}
            </div>

            <div className="bart-branch-meta">
              <div>
                <Timer
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


        {/* ===================================================
            TRANSFER CENTER
        =================================================== */}

        <motion.section
          className={`bart-notification-strip ${
            pendingTransfers.length >
            0
              ? "has-pending-transfer"
              : ""
          }`}
          initial={{
            opacity: 0,
            y: 18,
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
              TRANSFER CENTER
            </small>

            <strong>
              {transfersLoading
                ? "Checking pending transfers..."
                : pendingTransfers.length >
                  0
                ? `${
                    pendingTransfers.length
                  } pending transfer${
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
              refreshActivity();

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


        {/* ===================================================
            TRANSFER RESULT
        =================================================== */}

        <AnimatePresence>
          {transferMessage && (
            <motion.div
              className={`bart-operation-message ${transferMessage.type}`}
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
                {
                  transferMessage.text
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setTransferMessage(
                    null
                  )
                }
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ===================================================
            DATABASE STATUS
        =================================================== */}

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
                Cloudflare D1
              </strong>
            </div>
          </div>

          <div className="bart-db-stat">
            <small>
              BRANCHES
            </small>

            <strong>
              {
                databaseStatus.branches
              }
            </strong>
          </div>

          <div className="bart-db-stat">
            <small>
              TRANSFERS
            </small>

            <strong>
              {
                databaseStatus.transfers
              }
            </strong>
          </div>

          <div className="bart-db-sync">
            <small>
              LAST GOOGLE SYNC
            </small>

            <strong>
              {formatLastSync(
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
                className="branch-loading-spinner"
                size={16}
              />
            ) : (
              <RotateCcw
                size={16}
              />
            )}

            {databaseRefreshing
              ? "SYNCING..."
              : "REFRESH DATABASE"}
          </button>
        </motion.section>


        {/* DATABASE MESSAGE */}

        <AnimatePresence>
          {databaseMessage && (
            <motion.div
              className={`bart-operation-message ${databaseMessage.type}`}
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
                  className="branch-loading-spinner"
                />
              )}

              <span>
                {
                  databaseMessage.text
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setDatabaseMessage(
                    null
                  )
                }
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ===================================================
            MODULE HEADING
        =================================================== */}

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


        {/* ===================================================
            MODULES
        =================================================== */}

        <section className="bart-module-grid">
          {modules.map(
            (
              module,
              index
            ) => {
              const Icon =
                module.icon;

              return (
                <motion.button
                  type="button"
                  key={
                    module.id
                  }
                  className="bart-module-card"
                  onClick={() =>
                    openModule(
                      module.id
                    )
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
                    delay:
                      0.18 +
                      index *
                        0.07,
                  }}
                  whileHover={{
                    y: -7,
                  }}
                  whileTap={{
                    scale:
                      0.985,
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
                      {
                        module.number
                      }
                    </span>
                  </div>

                  <div className="bart-module-subtitle">
                    {
                      module.subtitle
                    }
                  </div>

                  <h3>
                    {
                      module.title
                    }
                  </h3>

                  <p>
                    {
                      module.description
                    }
                  </p>

                  <div className="bart-module-open">
                    <span>
                      OPEN MODULE
                    </span>

                    <div>
                      <ArrowRight
                        size={16}
                      />
                    </div>
                  </div>
                </motion.button>
              );
            }
          )}
        </section>


        {/* ===================================================
            BOTTOM STATUS
        =================================================== */}

        <motion.section
          className="bart-bottom-status"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.45,
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
                Ready for staff use
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
                D1 Protected
              </strong>

              <small>
                Repeated reads do not hit Google
              </small>
            </span>
          </div>

          <div className="bart-status-line" />

          <div>
            <Clock3
              size={17}
            />

            <span>
              <strong>
                Session Security
              </strong>

              <small>
                30-minute inactivity logout
              </small>
            </span>
          </div>
        </motion.section>
      </main>


      {/* =====================================================
          PENDING TRANSFER POPUP
      ===================================================== */}

      <TransferModal
        transfer={
          activeTransfer
        }
        loading={
          transferActionLoading
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
