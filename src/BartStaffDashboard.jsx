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


/* ============================================================
   CONFIG
============================================================ */

const SESSION_TIMEOUT =
  30 * 60 * 1000;


/* ============================================================
   MODULES
============================================================ */

const modules = [
  {
    id:
      "stock-record",

    icon:
      ClipboardList,

    number:
      "01",

    title:
      "Stock Record",

    subtitle:
      "DAILY & WEEKLY ENTRY",

    description:
      "Record branch stock quantities and submit daily or weekly operational stock updates.",
  },

  {
    id:
      "schedule",

    icon:
      CalendarDays,

    number:
      "02",

    title:
      "Staff Schedule",

    subtitle:
      "SHIFT OPERATIONS",

    description:
      "View staff assignments, shifts and branch scheduling information.",
  },

  {
    id:
      "stock-view",

    icon:
      Boxes,

    number:
      "03",

    title:
      "Stock View",

    subtitle:
      "BRANCH INVENTORY",

    description:
      "Review daily and weekly stock balances directly from this branch.",
  },

  {
    id:
      "transfer",

    icon:
      ArrowLeftRight,

    number:
      "04",

    title:
      "Stock Transfer",

    subtitle:
      "INTERNAL MOVEMENT",

    description:
      "Send and receive stock between DAM branches with transfer tracking.",
  },
];


/* ============================================================
   TRANSFER ITEM FORMATTER
============================================================ */

function transferItems(
  transfer
) {

  const items =
    String(
      transfer?.items ||
      ""
    )
      .replace(
        /â€¢/g,
        "•"
      )
      .split("\n")
      .map(
        (value) =>
          value
            .replace(
              /^•\s*/,
              ""
            )
            .trim()
      )
      .filter(Boolean);


  const quantities =
    String(
      transfer?.quantities ||
      ""
    )
      .split("\n")
      .map(
        (value) =>
          value.trim()
      )
      .filter(Boolean);


  const amount =
    Math.max(
      items.length,
      quantities.length
    );


  return Array.from(
    {
      length:
        amount,
    },

    (_, index) => ({

      item:
        items[
          index
        ] ||
        "Item",

      quantity:
        quantities[
          index
        ] ||
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
  close,
  accept,
  reject,
}) {

  const items =
    useMemo(
      () =>
        transferItems(
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
          opacity:
            0,
        }}
        animate={{
          opacity:
            1,
        }}
        exit={{
          opacity:
            0,
        }}
      >
        <motion.div
          className="dam-transfer-popup"
          initial={{
            opacity:
              0,

            scale:
              0.94,

            y:
              30,
          }}
          animate={{
            opacity:
              1,

            scale:
              1,

            y:
              0,
          }}
        >
          <button
            className="dam-transfer-x"
            disabled={busy}
            onClick={close}
          >
            <X
              size={18}
            />
          </button>


          <div className="dam-transfer-logo">
            <Truck
              size={25}
            />
          </div>


          <span className="dam-transfer-label">
            NEW TRANSFER RECEIVED
          </span>


          <h2>
            Incoming Transfer
          </h2>


          <div className="dam-transfer-id">
            {
              transfer.id
            }
          </div>


          <div className="dam-transfer-route">
            <div>
              <small>
                FROM
              </small>

              <strong>
                {
                  transfer.origin
                }
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
                {
                  transfer.destination
                }
              </strong>
            </div>
          </div>


          <div className="dam-transfer-items">
            {items.map(
              (
                item,
                index
              ) => (

                <div
                  className="dam-transfer-item"
                  key={
                    index
                  }
                >
                  <span>
                    {
                      item.item
                    }
                  </span>

                  <strong>
                    {
                      item.quantity
                    }
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
              {
                transfer.reason ||
                "No reason provided"
              }
            </strong>
          </div>


          <div className="dam-transfer-warning">
            <AlertTriangle
              size={15}
            />

            Rejecting this transfer
            returns stock to the
            origin and removes it
            from the destination.
          </div>


          <div className="dam-transfer-buttons">
            <button
              className="dam-reject-transfer"
              disabled={busy}
              onClick={reject}
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
              className="dam-accept-transfer"
              disabled={busy}
              onClick={accept}
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
    !rows ||
    rows.length === 0
  ) {

    return (
      <div className="dam-stock-empty">
        No {title.toLowerCase()}
        stock records found.
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
          {
            rows.length
          } ITEMS
        </strong>
      </div>


      <div className="dam-stock-table-wrap">

        <table className="dam-stock-table">

          <thead>
            <tr>
              {columns.map(
                (column) => (

                  <th
                    key={
                      column
                    }
                  >
                    {
                      column
                    }
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
                  key={
                    index
                  }
                >

                  {columns.map(
                    (
                      column
                    ) => (

                      <td
                        key={
                          column
                        }
                      >
                        {
                          row[
                            column
                          ]
                        }
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
   DASHBOARD
============================================================ */

export default function BartStaffDashboard({
  branch,
  onBack,
  onLogout,
  onRefresh,
  onModule,
}) {

  /* ==========================================================
     TRANSFERS
  ========================================================== */

  const [
    pendingTransfers,
    setPendingTransfers,
  ] =
    useState([]);


  const [
    transferLoading,
    setTransferLoading,
  ] =
    useState(true);


  const [
    selectedTransfer,
    setSelectedTransfer,
  ] =
    useState(null);


  const [
    transferBusy,
    setTransferBusy,
  ] =
    useState(false);


  /* ==========================================================
     STOCK VIEW
  ========================================================== */

  const [
    showStock,
    setShowStock,
  ] =
    useState(false);


  const [
    stockLoading,
    setStockLoading,
  ] =
    useState(false);


  const [
    stock,
    setStock,
  ] =
    useState(null);


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


  const [
    stockError,
    setStockError,
  ] =
    useState("");


  /* ==========================================================
     DATABASE
  ========================================================== */

  const [
    databaseRefreshing,
    setDatabaseRefreshing,
  ] =
    useState(false);


  /* ==========================================================
     SESSION
  ========================================================== */

  const lastActivity =
    useRef(
      Date.now()
    );


  function touch() {

    lastActivity.current =
      Date.now();
  }


  useEffect(() => {

    const events = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];


    const handler =
      () =>
        touch();


    events.forEach(
      (event) =>

        window.addEventListener(
          event,
          handler,
          {
            passive:
              true,
          }
        )
    );


    const timer =
      window.setInterval(
        () => {

          if (
            Date.now() -
              lastActivity.current >=
            SESSION_TIMEOUT
          ) {

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
        (event) =>

          window.removeEventListener(
            event,
            handler
          )
      );
    };

  }, [onLogout]);


  /* ==========================================================
     LIVE TRANSFERS

     Automatically called when
     entering branch dashboard.

     Also polls every 15 seconds.

     Backend decides whether Google
     actually needs to be called.
  ========================================================== */

  const loadTransfers =
    useCallback(

      async (
        openPopup =
          false
      ) => {

        if (
          !branch?.code
        ) {

          return;
        }


        try {

          setTransferLoading(
            true
          );


          const response =
            await fetch(

              `/api/staff/bart/pending-transfers?branch=${encodeURIComponent(
                branch.code
              )}`,

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

            setSelectedTransfer(
              transfers[0]
            );
          }


        } catch (error) {

          console.error(
            error
          );

        } finally {

          setTransferLoading(
            false
          );
        }
      },

      [
        branch?.code,
      ]
    );


  /*
    Immediate check when branch enters.
  */

  useEffect(() => {

    loadTransfers(
      true
    );


    /*
      Continue checking every 15 sec.

      Most of these requests hit D1.
      Backend only refreshes Google when
      shared transfer cache is stale.
    */

    const interval =
      window.setInterval(
        () => {

          loadTransfers(
            false
          );
        },

        15000
      );


    return () =>
      window.clearInterval(
        interval
      );

  }, [
    loadTransfers,
  ]);


  /* ==========================================================
     TRANSFER RESPONSE
  ========================================================== */

  async function respondTransfer(
    action
  ) {

    if (
      !selectedTransfer
    ) {

      return;
    }


    if (
      action ===
      "reject"
    ) {

      const confirmReject =
        window.confirm(
          "Reject this transfer?\n\nStock will be returned to the origin branch and removed from this branch."
        );


      if (
        !confirmReject
      ) {

        return;
      }
    }


    try {

      setTransferBusy(
        true
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
                  selectedTransfer.id,

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


      alert(
        data.message ||
        "Transfer updated successfully."
      );


      setSelectedTransfer(
        null
      );


      /*
        Immediately refresh D1 list.
      */

      await loadTransfers(
        false
      );


      /*
        If reject changed stock,
        clear currently displayed stock.
      */

      if (
        action ===
        "reject"
      ) {

        setStock(
          null
        );
      }


    } catch (error) {

      alert(
        error.message
      );

    } finally {

      setTransferBusy(
        false
      );
    }
  }


  /* ==========================================================
     STOCK VIEW

     Normal:
     D1 cached data if under 30 min.

     First/open/stale:
     Google -> D1.

     Force refresh:
     Google immediately.
  ========================================================== */

  async function loadStock(
    force = false
  ) {

    if (
      !branch?.code
    ) {

      return;
    }


    try {

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
          force
            ? "&refresh=1"
            : ""
        }`;


      const response =
        await fetch(
          url,
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

        throw new Error(
          data.message ||
          "Unable to load stock."
        );
      }


      setStock(
        data.stock
      );


      setStockSource(
        data.source
      );


      setStockSyncedAt(
        data.syncedAt
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


  /* ==========================================================
     STOCK VIEW BUTTON
  ========================================================== */

  async function toggleStockView() {

    touch();


    const newState =
      !showStock;


    setShowStock(
      newState
    );


    /*
      Only load when opening.
    */

    if (
      newState &&
      !stock
    ) {

      await loadStock(
        false
      );
    }
  }


  /* ==========================================================
     DATABASE REFRESH

     Master branch/password/SheetIDs.
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

      setDatabaseRefreshing(
        true
      );


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
          "Refresh failed."
        );
      }


      alert(
        `Database refreshed.\n\nBranches: ${data.branches}\nTransfers: ${data.transfers}`
      );


      await loadTransfers(
        false
      );


      onRefresh?.();


    } catch (error) {

      alert(
        error.message
      );

    } finally {

      setDatabaseRefreshing(
        false
      );
    }
  }


  /* ==========================================================
     MODULE CLICK
  ========================================================== */

  async function moduleClick(
    module
  ) {

    touch();


    if (
      module ===
      "stock-view"
    ) {

      await toggleStockView();

      return;
    }


    /*
      Remaining pages are connected
      in next conversion steps.
    */

    onModule?.(
      module
    );
  }


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="bart-dashboard">

      <div className="bart-dashboard-grid" />

      <div className="bart-dashboard-glow glow-one" />

      <div className="bart-dashboard-glow glow-two" />


      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <header className="bart-dashboard-nav">

        <div className="bart-dash-brand">

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
        </div>


        <div className="bart-nav-actions">

          <div className="bart-session-status">
            <span />

            LIVE SESSION
          </div>


          <button
            className="bart-icon-button"
            onClick={
              refreshDatabase
            }
            disabled={
              databaseRefreshing
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
            className="bart-icon-button"
            onClick={() => {

              loadTransfers(
                false
              );

              if (
                showStock
              ) {

                loadStock(
                  false
                );
              }

              onRefresh?.();
            }}
            title="Refresh Dashboard"
          >
            <RefreshCcw
              size={17}
            />
          </button>


          <button
            className="bart-icon-button danger"
            onClick={() =>
              onLogout?.()
            }
          >
            <LogOut
              size={17}
            />
          </button>
        </div>
      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="bart-dashboard-main">

        <button
          className="bart-back-button"
          onClick={() =>
            onBack?.()
          }
        >
          <ArrowLeft
            size={15}
          />

          CHANGE BRANCH
        </button>


        {/* HERO */}

        <section className="bart-dashboard-hero">

          <div className="bart-hero-copy">

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
              Manage stock, transfers,
              schedules and daily branch
              operations from your BART
              workspace.
            </p>
          </div>


          <div className="bart-branch-card">

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
              {
                branch?.name
              }
            </h2>


            <div className="bart-branch-code">
              {
                branch?.code
              }
            </div>


            <div className="bart-branch-meta">

              <div>
                <Clock3
                  size={14}
                />

                <span>
                  Session Active
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
          </div>
        </section>


        {/* ====================================================
            LIVE TRANSFER CENTER
        ==================================================== */}

        <section
          className={
            `bart-notification-strip ${
              pendingTransfers.length >
              0
                ? "dam-has-transfer"
                : ""
            }`
          }
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

              {transferLoading
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
            disabled={
              pendingTransfers.length ===
              0
            }
            onClick={() =>
              setSelectedTransfer(
                pendingTransfers[
                  0
                ]
              )
            }
          >

            {pendingTransfers.length >
            0
              ? "Review Transfer"
              : "No Transfers"}

            <ArrowRight
              size={15}
            />
          </button>
        </section>


        {/* ====================================================
            MODULES
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
                  key={
                    module.id
                  }
                  type="button"
                  className={`bart-module-card ${
                    module.id ===
                      "stock-view" &&
                    showStock
                      ? "dam-module-active"
                      : ""
                  }`}
                  onClick={() =>
                    moduleClick(
                      module.id
                    )
                  }
                  initial={{
                    opacity:
                      0,

                    y:
                      25,
                  }}
                  animate={{
                    opacity:
                      1,

                    y:
                      0,
                  }}
                  transition={{
                    delay:
                      index *
                      0.05,
                  }}
                  whileHover={{
                    y:
                      -6,
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

                      {module.id ===
                        "stock-view" &&
                      showStock
                        ? "CLOSE VIEW"
                        : "OPEN MODULE"}

                    </span>


                    <div>

                      {module.id ===
                        "stock-view" &&
                      showStock ? (

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
            ACTUAL STOCK VIEW
        ==================================================== */}

        <AnimatePresence>

          {showStock && (

            <motion.section
              className="dam-stock-view"
              initial={{
                opacity:
                  0,

                y:
                  20,
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

                y:
                  10,
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
                    Daily and weekly stock records.
                  </p>
                </div>


                <div className="dam-stock-actions">

                  {stockSource && (

                    <span className="dam-stock-source">
                      {stockSource}
                    </span>
                  )}


                  <button
                    disabled={
                      stockLoading
                    }
                    onClick={() =>
                      loadStock(
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
                    onClick={() =>
                      setShowStock(
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
              !stock ? (

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

                  {
                    stockError
                  }
                </div>

              ) : stock ? (

                <>

                  <StockTable
                    title="Daily Items Stock"
                    rows={
                      stock.daily
                    }
                  />


                  <StockTable
                    title="Weekly Items Stock"
                    rows={
                      stock.weekly
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

        <section className="bart-bottom-status">

          <div>

            <PackageOpen
              size={17}
            />

            <span>

              <strong>
                Smart Cache
              </strong>

              <small>
                D1 protects Google API
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
                Live Transfers
              </strong>

              <small>
                Automatic transfer checks
              </small>

            </span>
          </div>
        </section>
      </main>


      {/* ======================================================
          TRANSFER POPUP
      ====================================================== */}

      <TransferPopup
        transfer={
          selectedTransfer
        }

        busy={
          transferBusy
        }

        close={() =>
          setSelectedTransfer(
            null
          )
        }

        accept={() =>
          respondTransfer(
            "accept"
          )
        }

        reject={() =>
          respondTransfer(
            "reject"
          )
        }
      />
    </div>
  );
}
