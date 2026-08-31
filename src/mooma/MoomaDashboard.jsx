import {
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
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Inbox,
  LoaderCircle,
  LogOut,
  PackageCheck,
  RefreshCcw,
  Truck,
  X,
  XCircle,
} from "lucide-react";

import {
  acceptMoomaTransfer,
  activeScroll,
  getMoomaPendingTransfers,
  rejectMoomaTransfer,
} from "./moomaApi.js";


/* ============================================================
   DASHBOARD MODULES
============================================================ */

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
      "Create stock transfers and review transfer history.",
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


/* ============================================================
   TRANSFER HELPERS
============================================================ */

function transferIdOf(transfer) {
  return (
    transfer?.transferId ||
    transfer?.id ||
    transfer?.txId ||
    transfer?.transactionId ||
    ""
  );
}


function transferFromOf(transfer) {
  return (
    transfer?.fromBranchName ||
    transfer?.fromName ||
    transfer?.fromBranch ||
    transfer?.originBranchName ||
    transfer?.originBranch ||
    transfer?.from ||
    "MOOMA BRANCH"
  );
}


function transferFromCodeOf(transfer) {
  return (
    transfer?.fromBranchCode ||
    transfer?.fromCode ||
    transfer?.originBranchCode ||
    transfer?.originBranch ||
    transfer?.fromBranch ||
    ""
  );
}


function transferDateOf(transfer) {
  return (
    transfer?.createdAt ||
    transfer?.date ||
    transfer?.timestamp ||
    transfer?.created ||
    ""
  );
}


function transferItemsOf(transfer) {
  if (Array.isArray(transfer?.items)) {
    return transfer.items;
  }

  if (Array.isArray(transfer?.transferItems)) {
    return transfer.transferItems;
  }

  return [];
}


function itemNameOf(item) {
  return (
    item?.itemName ||
    item?.name ||
    item?.item ||
    item?.description ||
    "ITEM"
  );
}


function itemSkuOf(item) {
  return (
    item?.sku ||
    item?.SKU ||
    item?.itemCode ||
    ""
  );
}


function itemQtyOf(item) {
  return (
    item?.qty ??
    item?.quantity ??
    item?.amount ??
    0
  );
}


function itemUomOf(item) {
  return (
    item?.uom ||
    item?.UOM ||
    item?.unit ||
    ""
  );
}


/* ============================================================
   MOOMA DASHBOARD
============================================================ */

export default function MoomaDashboard({
  branch,
  onLogout,
  onModule,
}) {
  const branchCode =
    branch?.code ||
    branch?.branchCode ||
    "MOOMA";

  const branchName =
    branch?.name ||
    branch?.branchName ||
    "MOOMA BRANCH";


  /* ==========================================================
     STATE
  ========================================================== */

  const [
    pendingTransfers,
    setPendingTransfers,
  ] = useState([]);

  const [
    pendingLoading,
    setPendingLoading,
  ] = useState(true);

  const [
    pendingError,
    setPendingError,
  ] = useState("");

  const [
    popupOpen,
    setPopupOpen,
  ] = useState(false);

  const [
    currentTransferIndex,
    setCurrentTransferIndex,
  ] = useState(0);

  const [
    confirmAction,
    setConfirmAction,
  ] = useState("");

  const [
    actionBusy,
    setActionBusy,
  ] = useState(false);

  const [
    actionResult,
    setActionResult,
  ] = useState(null);

  const pendingSectionRef =
    useRef(null);


  /* ==========================================================
     CURRENT POPUP TRANSFER
  ========================================================== */

  const currentTransfer =
    useMemo(() => {
      if (
        pendingTransfers.length === 0
      ) {
        return null;
      }

      return (
        pendingTransfers[
          currentTransferIndex
        ] || pendingTransfers[0]
      );
    }, [
      pendingTransfers,
      currentTransferIndex,
    ]);


  /* ==========================================================
     LOAD PENDING TRANSFERS
  ========================================================== */

  async function loadPendingTransfers({
    showPopup = false,
    moveToSection = false,
  } = {}) {
    if (!branchCode) {
      return;
    }

    setPendingLoading(true);
    setPendingError("");

    try {
      const data =
        await getMoomaPendingTransfers(
          branchCode
        );

      const transfers =
        Array.isArray(data?.transfers)
          ? data.transfers
          : Array.isArray(data?.pending)
            ? data.pending
            : Array.isArray(data?.data)
              ? data.data
              : [];

      setPendingTransfers(
        transfers
      );

      if (
        currentTransferIndex >=
        transfers.length
      ) {
        setCurrentTransferIndex(0);
      }

      /*
       * FIRST DASHBOARD ENTRY:
       *
       * Pending transfers exist
       * -> popup immediately.
       */

      if (
        showPopup &&
        transfers.length > 0
      ) {
        setCurrentTransferIndex(0);
        setConfirmAction("");
        setActionResult(null);
        setPopupOpen(true);
      }

      /*
       * No pending transfers.
       */
      if (
        transfers.length === 0
      ) {
        setPopupOpen(false);
        setCurrentTransferIndex(0);
      }

      if (moveToSection) {
        activeScroll(
          pendingSectionRef,
          {
            delay: 100,
            block: "start",
          }
        );
      }
    } catch (error) {
      console.error(
        "[MOOMA DASHBOARD] Pending transfer error:",
        error
      );

      setPendingError(
        error?.message ||
          "Unable to load incoming transfers."
      );
    } finally {
      setPendingLoading(false);
    }
  }


  /* ==========================================================
     DASHBOARD ENTRY
  ========================================================== */

  useEffect(() => {
    /*
     * IMPORTANT:
     *
     * Every time branch dashboard opens,
     * immediately check incoming transfers.
     */

    loadPendingTransfers({
      showPopup: true,
    });
  }, [branchCode]);


  /* ==========================================================
     BODY SCROLL LOCK
  ========================================================== */

  useEffect(() => {
    if (!popupOpen) {
      return;
    }

    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [popupOpen]);


  /* ==========================================================
     OPEN PENDING POPUP MANUALLY
  ========================================================== */

  function openPendingPopup() {
    if (
      pendingTransfers.length === 0
    ) {
      activeScroll(
        pendingSectionRef,
        {
          block: "start",
        }
      );

      return;
    }

    setCurrentTransferIndex(0);
    setConfirmAction("");
    setActionResult(null);
    setPopupOpen(true);
  }


  /* ==========================================================
     CLOSE POPUP
  ========================================================== */

  function closePopup() {
    if (actionBusy) {
      return;
    }

    setPopupOpen(false);
    setConfirmAction("");
    setActionResult(null);
  }


  /* ==========================================================
     PREVIOUS TRANSFER
  ========================================================== */

  function previousTransfer() {
    if (
      currentTransferIndex <= 0 ||
      actionBusy
    ) {
      return;
    }

    setConfirmAction("");
    setActionResult(null);

    setCurrentTransferIndex(
      (current) => current - 1
    );
  }


  /* ==========================================================
     NEXT TRANSFER
  ========================================================== */

  function nextTransfer() {
    if (
      currentTransferIndex >=
        pendingTransfers.length - 1 ||
      actionBusy
    ) {
      return;
    }

    setConfirmAction("");
    setActionResult(null);

    setCurrentTransferIndex(
      (current) => current + 1
    );
  }


  /* ==========================================================
     ASK ACCEPT / REJECT
  ========================================================== */

  function askAction(action) {
    if (
      !currentTransfer ||
      actionBusy
    ) {
      return;
    }

    setActionResult(null);
    setConfirmAction(action);
  }


  /* ==========================================================
     EXECUTE ACCEPT / REJECT
  ========================================================== */

  async function executeTransferAction() {
    if (
      !currentTransfer ||
      !confirmAction ||
      actionBusy
    ) {
      return;
    }

    const transferId =
      transferIdOf(
        currentTransfer
      );

    if (!transferId) {
      setActionResult({
        type: "error",
        title: "ACTION FAILED",
        message:
          "Transfer ID is missing.",
      });

      return;
    }

    const action =
      confirmAction;

    setActionBusy(true);
    setActionResult(null);

    try {
      let response;

      if (action === "accept") {
        response =
          await acceptMoomaTransfer({
            transferId,
          });
      } else {
        response =
          await rejectMoomaTransfer({
            transferId,
          });
      }

      /*
       * Remove processed transfer
       * immediately from local queue.
       */

      const remainingTransfers =
        pendingTransfers.filter(
          (transfer) =>
            transferIdOf(transfer) !==
            transferId
        );

      setPendingTransfers(
        remainingTransfers
      );

      setConfirmAction("");

      setActionResult({
        type: "success",

        title:
          action === "accept"
            ? "TRANSFER ACCEPTED"
            : "TRANSFER REJECTED",

        message:
          response?.message ||
          (
            action === "accept"
              ? "Incoming stock transfer has been accepted successfully."
              : "Incoming stock transfer has been rejected successfully."
          ),

        remaining:
          remainingTransfers.length,
      });

      /*
       * Keep index valid.
       */

      if (
        currentTransferIndex >=
          remainingTransfers.length &&
        remainingTransfers.length > 0
      ) {
        setCurrentTransferIndex(
          remainingTransfers.length - 1
        );
      }

      /*
       * We deliberately keep popup open
       * so staff see success first.
       */
    } catch (error) {
      console.error(
        "[MOOMA DASHBOARD] Transfer response failed:",
        error
      );

      setActionResult({
        type: "error",
        title: "ACTION FAILED",
        message:
          error?.message ||
          "Unable to process this transfer.",
      });
    } finally {
      setActionBusy(false);
    }
  }


  /* ==========================================================
     CONTINUE AFTER SUCCESS
  ========================================================== */

  async function continueAfterResult() {
    if (
      actionResult?.type !==
      "success"
    ) {
      setActionResult(null);
      return;
    }

    /*
     * More pending transfers:
     * continue inside popup.
     */

    if (
      pendingTransfers.length > 0
    ) {
      setActionResult(null);
      setConfirmAction("");

      return;
    }

    /*
     * No transfers remaining.
     * Close popup and refresh server.
     */

    setPopupOpen(false);
    setActionResult(null);
    setConfirmAction("");

    await loadPendingTransfers();
  }


  /* ==========================================================
     MODULE
  ========================================================== */

  function openModule(moduleId) {
    onModule?.(
      moduleId
    );
  }


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <>
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
        <div className="mooma-dash-background" />

        <div className="mooma-dash-grid-background" />


        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="mooma-dash-header">
          <div className="mooma-dash-brand">
            <div className="mooma-dash-brand-mark">
              M
            </div>

            <div className="mooma-dash-brand-copy">
              <strong>
                MOOMA
              </strong>

              <span>
                DAM OPERATIONS
              </span>
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

              <span>
                CHANGE BRANCH
              </span>
            </button>
          </div>
        </header>


        {/* ====================================================
            MAIN
        ==================================================== */}

        <main className="mooma-dash-main">
          {/* HERO */}

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
                Branch operations are connected
                and ready. Select an operation
                below to continue.
              </p>


              <div className="mooma-dash-connection-row">
                <div>
                  <span className="mooma-dash-live-dot" />

                  <div>
                    <small>
                      BRANCH NETWORK
                    </small>

                    <strong>
                      CONNECTED
                    </strong>
                  </div>
                </div>


                <button
                  type="button"

                  className={
                    `mooma-dash-pending-summary ${
                      pendingTransfers.length
                        ? "has-pending"
                        : ""
                    }`
                  }

                  onClick={
                    openPendingPopup
                  }
                >
                  <Inbox size={16} />

                  <div>
                    <small>
                      INCOMING TRANSFERS
                    </small>

                    <strong>
                      {pendingLoading
                        ? "CHECKING..."
                        : pendingTransfers.length
                          ? `${pendingTransfers.length} PENDING`
                          : "NO PENDING"}
                    </strong>
                  </div>

                  <ArrowRight size={14} />
                </button>
              </div>
            </div>


            {/* CORE */}

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
                  y: [
                    0,
                    -6,
                    0,
                  ],
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


          {/* ==================================================
              MODULES
          ================================================== */}

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


            <div className="mooma-dash-module-grid">
              {MODULES.map(
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

                      className="mooma-dash-module"

                      onClick={() => {
                        openModule(
                          module.id
                        );
                      }}

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

                        <ArrowRight size={16} />
                      </div>
                    </motion.button>
                  );
                }
              )}
            </div>
          </section>


          {/* ==================================================
              SMALL DASHBOARD TRANSFER STATUS
          ================================================== */}

          <section
            ref={pendingSectionRef}
            className="mooma-dash-pending-mini"
          >
            <div className="mooma-dash-pending-mini-copy">
              <div className="mooma-dash-pending-mini-icon">
                <ArrowLeftRight size={20} />
              </div>

              <div>
                <span>
                  INCOMING STOCK TRANSFERS
                </span>

                <h3>
                  {pendingLoading
                    ? "Checking transfer queue..."
                    : pendingTransfers.length
                      ? `${pendingTransfers.length} transfer${
                          pendingTransfers.length > 1
                            ? "s"
                            : ""
                        } waiting for action`
                      : "No pending transfers"}
                </h3>

                {pendingError && (
                  <p>
                    {pendingError}
                  </p>
                )}
              </div>
            </div>


            <div className="mooma-dash-pending-mini-actions">
              <button
                type="button"

                className="mooma-dash-mini-refresh"

                disabled={pendingLoading}

                onClick={() => {
                  loadPendingTransfers({
                    moveToSection: true,
                  });
                }}
              >
                <RefreshCcw
                  size={14}

                  className={
                    pendingLoading
                      ? "mooma-spinner"
                      : ""
                  }
                />

                REFRESH
              </button>


              {pendingTransfers.length > 0 && (
                <button
                  type="button"

                  className="mooma-dash-mini-process"

                  onClick={
                    openPendingPopup
                  }
                >
                  PROCESS NOW

                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </section>


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


      {/* ======================================================
          PENDING TRANSFER POPUP
      ====================================================== */}

      <AnimatePresence>
        {popupOpen &&
          currentTransfer && (
            <motion.div
              className="mooma-transfer-popup-overlay"

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
                className="mooma-transfer-popup"

                initial={{
                  opacity: 0,
                  scale: 0.94,
                  y: 28,
                }}

                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}

                exit={{
                  opacity: 0,
                  scale: 0.97,
                  y: 15,
                }}

                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 28,
                }}
              >
                {/* ============================================
                    POPUP TOP
                ============================================ */}

                <div className="mooma-transfer-popup-top">
                  <div className="mooma-transfer-popup-alert-icon">
                    <Truck size={21} />
                  </div>

                  <div className="mooma-transfer-popup-title">
                    <span>
                      ACTION REQUIRED
                    </span>

                    <h2>
                      Incoming Stock Transfer
                    </h2>

                    <p>
                      Stock is waiting for
                      confirmation at this branch.
                    </p>
                  </div>

                  <button
                    type="button"

                    className="mooma-transfer-popup-close"

                    onClick={
                      closePopup
                    }

                    disabled={
                      actionBusy
                    }
                  >
                    <X size={18} />
                  </button>
                </div>


                {/* ============================================
                    PENDING COUNT
                ============================================ */}

                <div className="mooma-transfer-popup-countbar">
                  <div>
                    <span className="mooma-transfer-popup-live" />

                    <strong>
                      {
                        pendingTransfers.length
                      }{" "}
                      PENDING
                    </strong>
                  </div>

                  <span>
                    TRANSFER{" "}
                    {Math.min(
                      currentTransferIndex + 1,
                      pendingTransfers.length
                    )}
                    {" / "}
                    {
                      pendingTransfers.length
                    }
                  </span>
                </div>


                {/* ============================================
                    RESULT VIEW
                ============================================ */}

                {actionResult ? (
                  <motion.div
                    className={
                      `mooma-transfer-popup-result ${
                        actionResult.type
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
                    <div className="mooma-transfer-result-icon">
                      {actionResult.type ===
                      "success" ? (
                        <CheckCircle2
                          size={35}
                        />
                      ) : (
                        <AlertCircle
                          size={35}
                        />
                      )}
                    </div>

                    <span>
                      MOOMA TRANSFER SYSTEM
                    </span>

                    <h3>
                      {
                        actionResult.title
                      }
                    </h3>

                    <p>
                      {
                        actionResult.message
                      }
                    </p>

                    {actionResult.type ===
                      "success" && (
                      <div className="mooma-transfer-result-remaining">
                        {pendingTransfers.length >
                        0 ? (
                          <>
                            <Inbox
                              size={15}
                            />

                            {
                              pendingTransfers.length
                            }{" "}
                            MORE PENDING
                          </>
                        ) : (
                          <>
                            <Check
                              size={15}
                            />

                            QUEUE CLEARED
                          </>
                        )}
                      </div>
                    )}

                    <button
                      type="button"

                      onClick={
                        continueAfterResult
                      }
                    >
                      {actionResult.type ===
                      "error"
                        ? "BACK TO TRANSFER"
                        : pendingTransfers.length >
                            0
                          ? "PROCESS NEXT TRANSFER"
                          : "CONTINUE TO DASHBOARD"}

                      <ArrowRight
                        size={16}
                      />
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {/* ========================================
                        TRANSFER INFORMATION
                    ======================================== */}

                    <div className="mooma-transfer-popup-info">
                      <div>
                        <small>
                          FROM BRANCH
                        </small>

                        <strong>
                          {transferFromOf(
                            currentTransfer
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          BRANCH CODE
                        </small>

                        <strong>
                          {transferFromCodeOf(
                            currentTransfer
                          ) || "—"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          DATE / TIME
                        </small>

                        <strong>
                          <Clock3
                            size={13}
                          />

                          {transferDateOf(
                            currentTransfer
                          ) || "—"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          TRANSFER ID
                        </small>

                        <strong>
                          {transferIdOf(
                            currentTransfer
                          ) || "—"}
                        </strong>
                      </div>
                    </div>


                    {/* ========================================
                        ITEMS
                    ======================================== */}

                    <div className="mooma-transfer-popup-items">
                      <div className="mooma-transfer-popup-items-heading">
                        <div>
                          <span>
                            TRANSFER CONTENT
                          </span>

                          <h3>
                            Items Received
                          </h3>
                        </div>

                        <strong>
                          {
                            transferItemsOf(
                              currentTransfer
                            ).length
                          }{" "}
                          ITEMS
                        </strong>
                      </div>


                      <div className="mooma-transfer-popup-table-wrap">
                        <div className="mooma-transfer-popup-table-head">
                          <span>
                            ITEM
                          </span>

                          <span>
                            SKU
                          </span>

                          <span>
                            QTY
                          </span>

                          <span>
                            UOM
                          </span>
                        </div>


                        <div className="mooma-transfer-popup-table-body">
                          {transferItemsOf(
                            currentTransfer
                          ).length === 0 ? (
                            <div className="mooma-transfer-popup-no-items">
                              No item details
                              returned for this
                              transfer.
                            </div>
                          ) : (
                            transferItemsOf(
                              currentTransfer
                            ).map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  className="mooma-transfer-popup-table-row"

                                  key={
                                    `${
                                      itemSkuOf(
                                        item
                                      ) ||
                                      "item"
                                    }-${index}`
                                  }
                                >
                                  <strong>
                                    {itemNameOf(
                                      item
                                    )}
                                  </strong>

                                  <span>
                                    {itemSkuOf(
                                      item
                                    ) || "—"}
                                  </span>

                                  <strong className="mooma-transfer-popup-qty">
                                    {itemQtyOf(
                                      item
                                    )}
                                  </strong>

                                  <span>
                                    {itemUomOf(
                                      item
                                    ) || "—"}
                                  </span>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>
                    </div>


                    {/* ========================================
                        MULTIPLE TRANSFER NAVIGATION
                    ======================================== */}

                    {pendingTransfers.length >
                      1 && (
                      <div className="mooma-transfer-popup-navigation">
                        <button
                          type="button"

                          onClick={
                            previousTransfer
                          }

                          disabled={
                            currentTransferIndex ===
                              0 ||
                            actionBusy
                          }
                        >
                          <ChevronLeft
                            size={15}
                          />

                          PREVIOUS
                        </button>

                        <div>
                          {pendingTransfers.map(
                            (
                              transfer,
                              index
                            ) => (
                              <button
                                type="button"

                                key={
                                  transferIdOf(
                                    transfer
                                  ) ||
                                  index
                                }

                                aria-label={`Open transfer ${
                                  index + 1
                                }`}

                                className={
                                  index ===
                                  currentTransferIndex
                                    ? "active"
                                    : ""
                                }

                                onClick={() => {
                                  if (
                                    actionBusy
                                  ) {
                                    return;
                                  }

                                  setConfirmAction(
                                    ""
                                  );

                                  setActionResult(
                                    null
                                  );

                                  setCurrentTransferIndex(
                                    index
                                  );
                                }}
                              />
                            )
                          )}
                        </div>

                        <button
                          type="button"

                          onClick={
                            nextTransfer
                          }

                          disabled={
                            currentTransferIndex ===
                              pendingTransfers.length -
                                1 ||
                            actionBusy
                          }
                        >
                          NEXT

                          <ChevronRight
                            size={15}
                          />
                        </button>
                      </div>
                    )}


                    {/* ========================================
                        NORMAL ACTION BUTTONS
                    ======================================== */}

                    {!confirmAction && (
                      <div className="mooma-transfer-popup-actions">
                        <button
                          type="button"

                          className="mooma-transfer-popup-reject"

                          onClick={() => {
                            askAction(
                              "reject"
                            );
                          }}

                          disabled={
                            actionBusy
                          }
                        >
                          <XCircle
                            size={18}
                          />

                          <div>
                            <small>
                              RETURN TRANSFER
                            </small>

                            <strong>
                              REJECT
                            </strong>
                          </div>
                        </button>


                        <button
                          type="button"

                          className="mooma-transfer-popup-accept"

                          onClick={() => {
                            askAction(
                              "accept"
                            );
                          }}

                          disabled={
                            actionBusy
                          }
                        >
                          <Check
                            size={18}
                          />

                          <div>
                            <small>
                              STOCK RECEIVED
                            </small>

                            <strong>
                              ACCEPT
                            </strong>
                          </div>
                        </button>
                      </div>
                    )}


                    {/* ========================================
                        CONFIRM ACTION
                    ======================================== */}

                    <AnimatePresence>
                      {confirmAction && (
                        <motion.div
                          className={
                            `mooma-transfer-popup-confirm ${
                              confirmAction
                            }`
                          }

                          initial={{
                            opacity: 0,
                            y: 12,
                          }}

                          animate={{
                            opacity: 1,
                            y: 0,
                          }}

                          exit={{
                            opacity: 0,
                            y: 8,
                          }}
                        >
                          <div className="mooma-transfer-popup-confirm-copy">
                            {confirmAction ===
                            "accept" ? (
                              <CheckCircle2
                                size={23}
                              />
                            ) : (
                              <AlertCircle
                                size={23}
                              />
                            )}

                            <div>
                              <span>
                                CONFIRM ACTION
                              </span>

                              <h4>
                                {confirmAction ===
                                "accept"
                                  ? "Accept this stock transfer?"
                                  : "Reject this stock transfer?"}
                              </h4>

                              <p>
                                {confirmAction ===
                                "accept"
                                  ? "Confirm that this branch has received the listed items and quantities."
                                  : "Confirm that this incoming transfer should be rejected."}
                              </p>
                            </div>
                          </div>


                          <div className="mooma-transfer-popup-confirm-actions">
                            <button
                              type="button"

                              className="mooma-transfer-confirm-cancel"

                              disabled={
                                actionBusy
                              }

                              onClick={() => {
                                setConfirmAction(
                                  ""
                                );
                              }}
                            >
                              CANCEL
                            </button>

                            <button
                              type="button"

                              className={
                                confirmAction ===
                                "accept"
                                  ? "mooma-transfer-confirm-accept"
                                  : "mooma-transfer-confirm-reject"
                              }

                              disabled={
                                actionBusy
                              }

                              onClick={
                                executeTransferAction
                              }
                            >
                              {actionBusy ? (
                                <>
                                  <LoaderCircle
                                    size={16}
                                    className="mooma-spinner"
                                  />

                                  PROCESSING...
                                </>
                              ) : (
                                <>
                                  {confirmAction ===
                                  "accept" ? (
                                    <Check
                                      size={16}
                                    />
                                  ) : (
                                    <X
                                      size={16}
                                    />
                                  )}

                                  CONFIRM{" "}
                                  {confirmAction.toUpperCase()}
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </>
  );
}
