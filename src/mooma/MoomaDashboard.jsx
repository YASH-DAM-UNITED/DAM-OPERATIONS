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
  Rocket,
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
   MOOMA DASHBOARD MODULES
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
   HELPERS
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


function safeParseJson(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("[MOOMA] JSON parse failed:", value, error);
    return null;
  }
}

function normalizeTransferItems(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const parsed = safeParseJson(value);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed?.transferItems)) return parsed.transferItems;
    if (Array.isArray(parsed?.itemList)) return parsed.itemList;
  }

  if (value && typeof value === "object") {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.transferItems)) return value.transferItems;
    if (Array.isArray(value.itemList)) return value.itemList;
  }

  return [];
}

function transferItemsOf(transfer) {
  if (!transfer) return [];

  const candidates = [
    transfer.items,
    transfer.transferItems,
    transfer.itemList,
    transfer.itemsJson,
    transfer.items_json,
  ];

  for (const candidate of candidates) {
    const items = normalizeTransferItems(candidate);
    if (items.length) return items;
  }

  for (const wrapperValue of [transfer.payload, transfer.data]) {
    let wrapper = wrapperValue;
    if (typeof wrapper === "string") wrapper = safeParseJson(wrapper);
    if (!wrapper) continue;

    for (const candidate of [
      wrapper.items,
      wrapper.transferItems,
      wrapper.itemList,
    ]) {
      const items = normalizeTransferItems(candidate);
      if (items.length) return items;
    }
  }

  console.warn(
    "[MOOMA] Transfer found but item list could not be decoded:",
    transfer
  );
  return [];
}

function itemNameOf(item) {
  return (
    item?.itemName ||
    item?.name ||
    item?.item ||
    item?.description ||
    item?.Item ||
    item?.ITEM ||
    item?.["Item Name"] ||
    item?.["ITEM NAME"] ||
    "ITEM"
  );
}

function itemSkuOf(item) {
  return (
    item?.sku ||
    item?.SKU ||
    item?.itemCode ||
    item?.code ||
    item?.itemSku ||
    item?.["Item Code"] ||
    item?.["ITEM CODE"] ||
    ""
  );
}

function itemQtyOf(item) {
  const value =
    item?.qty ??
    item?.quantity ??
    item?.amount ??
    item?.Quantity ??
    item?.QTY ??
    item?.Qty ??
    item?.transferQty ??
    item?.transferQuantity ??
    item?.["Transfer Qty"] ??
    item?.["TRANSFER QTY"] ??
    0;

  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : value;
}

function itemUomOf(item) {
  return (
    item?.uom ||
    item?.UOM ||
    item?.unit ||
    item?.Unit ||
    item?.UNIT ||
    item?.["DATE-> UOM"] ||
    item?.["DATE -> UOM"] ||
    item?.["Date-> UOM"] ||
    item?.["Date -> UOM"] ||
    ""
  );
}


/* ============================================================
   COMPONENT
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
     TRANSFER STATE
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
     CURRENT TRANSFER
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
        ] ||
        pendingTransfers[0]
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
        Array.isArray(
          data?.transfers
        )
          ? data.transfers
          : Array.isArray(
                data?.pending
              )
            ? data.pending
            : Array.isArray(
                  data?.data
                )
              ? data.data
              : [];

      setPendingTransfers(
        transfers
      );

      if (
        currentTransferIndex >=
        transfers.length
      ) {
        setCurrentTransferIndex(
          0
        );
      }

      /*
       * Automatically show popup
       * when dashboard opens AND
       * pending transfers exist.
       */

      if (
        showPopup &&
        transfers.length > 0
      ) {
        setCurrentTransferIndex(
          0
        );

        setConfirmAction("");

        setActionResult(null);

        setPopupOpen(true);
      }

      /*
       * Nothing pending.
       */

      if (
        transfers.length === 0
      ) {
        setPopupOpen(false);

        setCurrentTransferIndex(
          0
        );
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
        "[MOOMA] Pending transfers:",
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
     FIRST DASHBOARD OPEN
  ========================================================== */

  useEffect(() => {
    loadPendingTransfers({
      showPopup: true,
    });
  }, [branchCode]);


  /* ==========================================================
     LOCK PAGE WHILE POPUP OPEN
  ========================================================== */

  useEffect(() => {
    if (!popupOpen) {
      return;
    }

    const oldOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        oldOverflow;
    };
  }, [popupOpen]);


  /* ==========================================================
     OPEN POPUP MANUALLY
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
     CLOSE
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
      (current) =>
        current - 1
    );
  }


  /* ==========================================================
     NEXT TRANSFER
  ========================================================== */

  function nextTransfer() {
    if (
      currentTransferIndex >=
        pendingTransfers.length -
          1 ||
      actionBusy
    ) {
      return;
    }

    setConfirmAction("");

    setActionResult(null);

    setCurrentTransferIndex(
      (current) =>
        current + 1
    );
  }


  /* ==========================================================
     ASK ACTION
  ========================================================== */

  function askAction(action) {
    if (
      !currentTransfer ||
      actionBusy
    ) {
      return;
    }

    setActionResult(null);

    setConfirmAction(
      action
    );
  }


  /* ==========================================================
     ACCEPT / REJECT
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

        title:
          "ACTION FAILED",

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

      if (
        action === "accept"
      ) {
        response =
          await acceptMoomaTransfer({
             transferId,
             branchCode,
           });
      } else {
        response =
          await rejectMoomaTransfer({
             transferId,
             branchCode,
           });
      }


      /*
       * Remove completed transfer
       * from local queue.
       */

      const remaining =
        pendingTransfers.filter(
          (transfer) =>
            transferIdOf(
              transfer
            ) !== transferId
        );

      setPendingTransfers(
        remaining
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
      });


      if (
        currentTransferIndex >=
          remaining.length &&
        remaining.length > 0
      ) {
        setCurrentTransferIndex(
          remaining.length - 1
        );
      }
    } catch (error) {
      console.error(
        "[MOOMA] Transfer action:",
        error
      );

      setActionResult({
        type: "error",

        title:
          "ACTION FAILED",

        message:
          error?.message ||
          "Unable to process this transfer.",
      });
    } finally {
      setActionBusy(false);
    }
  }


  /* ==========================================================
     CONTINUE AFTER RESULT
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
     * More transfers remain.
     */

    if (
      pendingTransfers.length > 0
    ) {
      setActionResult(null);

      setConfirmAction("");

      return;
    }

    /*
     * Queue finished.
     */

    setPopupOpen(false);

    setActionResult(null);

    setConfirmAction("");

    await loadPendingTransfers();
  }


  /* ==========================================================
     OPEN MODULE
  ========================================================== */

  function openModule(
    moduleId
  ) {
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
              onClick={
                onLogout
              }
            >
              <LogOut
                size={15}
              />

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


          {/* ==================================================
              HERO
          ================================================== */}

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
                Branch operations are
                connected and ready.
                Select an operation below
                to continue.
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

                  <Inbox
                    size={16}
                  />

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

                  <ArrowRight
                    size={14}
                  />

                </button>

              </div>

            </div>


            {/* ==================================================
                CORE ANIMATION
            ================================================== */}

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

                      onClick={() =>
                        openModule(
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
                          index *
                            0.07,
                      }}

                      whileHover={{
                        y: -5,
                      }}

                      whileTap={{
                        scale:
                          0.985,
                      }}
                    >

                      <div className="mooma-dash-module-top">

                        <div className="mooma-dash-module-icon">

                          <Icon
                            size={21}
                          />

                        </div>

                        <span>
                          {
                            module.number
                          }
                        </span>

                      </div>


                      <div className="mooma-dash-module-copy">

                        <small>
                          {
                            module.label
                          }
                        </small>

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


          {/* ==================================================
              TRANSFER QUEUE STATUS
          ================================================== */}

          <section
            ref={
              pendingSectionRef
            }

            className="mooma-dash-pending-mini"
          >

            <div className="mooma-dash-pending-mini-copy">

              <div className="mooma-dash-pending-mini-icon">

                <ArrowLeftRight
                  size={20}
                />

              </div>


              <div>

                <span>
                  LIVE TRANSFER QUEUE
                </span>


                <h3>

                  {pendingLoading
                    ? "Checking incoming transfers..."
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
                    {
                      pendingError
                    }
                  </p>
                )}

              </div>

            </div>


            <div className="mooma-dash-pending-mini-actions">

              <button
                type="button"

                className="mooma-dash-mini-refresh"

                disabled={
                  pendingLoading
                }

                onClick={() => {
                  loadPendingTransfers({
                    moveToSection:
                      true,
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


              {pendingTransfers.length >
                0 && (

                <button
                  type="button"

                  className="mooma-dash-mini-process"

                  onClick={
                    openPendingPopup
                  }
                >

                  PROCESS NOW

                  <ArrowRight
                    size={14}
                  />

                </button>

              )}

            </div>

          </section>


          {/* ==================================================
              FOOTER
          ================================================== */}

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
          TRANSFER POPUP SYSTEM
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

            transition={{
              duration: 0.3,
            }}
          >


            {/* =================================================
                BALL -> 3 BOUNCES -> FLOWER -> CARD
            ================================================= */}

            <motion.div
              className="mooma-transfer-popup mooma-transfer-flower"

              initial={{
                opacity: 0,

                x: "58vw",

                y: -120,

                scale: 0.055,

                borderRadius:
                  "50%",
              }}

              animate={{
                opacity: [
                  0,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                ],

                x: [
                  "58vw",
                  "37vw",
                  "23vw",
                  "12vw",
                  "5vw",
                  "2vw",
                  0,
                  0,
                ],

                /*
                 * Three physical-looking
                 * decreasing bounces.
                 */

                y: [
                  -120,
                  180,
                  -125,
                  115,
                  -65,
                  45,
                  -12,
                  0,
                ],

                /*
                 * Keep it looking like
                 * a ball during bounces.
                 * Then flower open.
                 */

                scale: [
                  0.055,
                  0.062,
                  0.067,
                  0.072,
                  0.078,
                  0.09,
                  0.17,
                  1,
                ],

                borderRadius: [
                  "50%",
                  "50%",
                  "50%",
                  "50%",
                  "50%",
                  "50%",
                  "44%",
                  "22px",
                ],
              }}

              exit={{
                opacity: 0,

                scale: 0.82,

                y: 25,

                borderRadius:
                  "45%",
              }}

              transition={{
                duration: 2.15,

                times: [
                  0,
                  0.12,
                  0.27,
                  0.41,
                  0.55,
                  0.67,
                  0.78,
                  1,
                ],

                ease:
                  "easeInOut",
              }}
            >


              {/* =================================================
                  FLOWER PETALS
              ================================================= */}

              <motion.div
                className="mooma-transfer-petals"

                initial={{
                  opacity: 0,
                  scale: 0,
                  rotate: -35,
                }}

                animate={{
                  opacity: [
                    0,
                    0,
                    0,
                    0.8,
                    0,
                  ],

                  scale: [
                    0,
                    0,
                    0.4,
                    1.45,
                    1.8,
                  ],

                  rotate: [
                    -35,
                    -35,
                    0,
                    45,
                    75,
                  ],
                }}

                transition={{
                  duration: 2.15,

                  times: [
                    0,
                    0.68,
                    0.76,
                    0.89,
                    1,
                  ],
                }}
              >

                <span />
                <span />
                <span />
                <span />
                <span />
                <span />

              </motion.div>


              {/* =================================================
                  CONTENT APPEARS AFTER FLOWER OPENS
              ================================================= */}

              <motion.div
                className="mooma-transfer-flower-content"

                initial={{
                  opacity: 0,
                  y: 18,
                  scale: 0.96,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}

                transition={{
                  delay: 1.82,
                  duration: 0.42,
                  ease: "easeOut",
                }}
              >


                {/* ===============================================
                    POPUP HEADER
                =============================================== */}

                <div className="mooma-transfer-popup-top">

                  <div className="mooma-transfer-popup-alert-icon">

                    <Rocket
                      size={21}
                    />

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
                      confirmation at{" "}
                      {branchName}.
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

                    <X
                      size={18}
                    />

                  </button>

                </div>


                {/* ===============================================
                    COUNT
                =============================================== */}

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
                      currentTransferIndex +
                        1,

                      pendingTransfers.length
                    )}

                    {" / "}

                    {
                      pendingTransfers.length
                    }

                  </span>

                </div>


                {/* ===============================================
                    RESULT
                =============================================== */}

                {actionResult ? (

                  <motion.div
                    className={
                      `mooma-transfer-popup-result ${
                        actionResult.type
                      }`
                    }

                    initial={{
                      opacity: 0,
                      scale: 0.95,
                      y: 14,
                    }}

                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                    }}
                  >

                    <motion.div
                      className="mooma-transfer-result-icon"

                      initial={{
                        scale: 0,
                      }}

                      animate={{
                        scale: [
                          0,
                          1.18,
                          1,
                        ],
                      }}

                      transition={{
                        duration:
                          0.45,
                      }}
                    >

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

                    </motion.div>


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


                    {/* ===========================================
                        TRANSFER INFORMATION
                    =========================================== */}

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
                          ) ||
                            "—"}

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
                          ) ||
                            "—"}

                        </strong>

                      </div>


                      <div>

                        <small>
                          TRANSFER ID
                        </small>

                        <strong>

                          {transferIdOf(
                            currentTransfer
                          ) ||
                            "—"}

                        </strong>

                      </div>

                    </div>


                    {/* ===========================================
                        ITEMS
                    =========================================== */}

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

                                <motion.div
                                  className="mooma-transfer-popup-table-row"

                                  key={
                                    `${
                                      itemSkuOf(
                                        item
                                      ) ||
                                      "item"
                                    }-${index}`
                                  }

                                  initial={{
                                    opacity:
                                      0,

                                    x: 15,
                                  }}

                                  animate={{
                                    opacity:
                                      1,

                                    x: 0,
                                  }}

                                  transition={{
                                    delay:
                                      1.9 +
                                      index *
                                        0.035,
                                  }}
                                >

                                  <strong>
                                    {itemNameOf(
                                      item
                                    )}
                                  </strong>

                                  <span>
                                    {itemSkuOf(
                                      item
                                    ) ||
                                      "—"}
                                  </span>

                                  <strong className="mooma-transfer-popup-qty">

                                    {itemQtyOf(
                                      item
                                    )}

                                  </strong>

                                  <span>

                                    {itemUomOf(
                                      item
                                    ) ||
                                      "—"}

                                  </span>

                                </motion.div>

                              )
                            )

                          )}

                        </div>

                      </div>

                    </div>


                    {/* ===========================================
                        MULTIPLE TRANSFERS
                    =========================================== */}

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

                                aria-label={
                                  `Open transfer ${
                                    index +
                                    1
                                  }`
                                }

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


                    {/* ===========================================
                        ACTION BUTTONS
                    =========================================== */}

                    {!confirmAction && (

                      <div className="mooma-transfer-popup-actions">


                        <motion.button
                          type="button"

                          className="mooma-transfer-popup-reject"

                          onClick={() =>
                            askAction(
                              "reject"
                            )
                          }

                          disabled={
                            actionBusy
                          }

                          whileHover={{
                            y: -2,
                          }}

                          whileTap={{
                            scale:
                              0.98,
                          }}
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

                        </motion.button>


                        <motion.button
                          type="button"

                          className="mooma-transfer-popup-accept"

                          onClick={() =>
                            askAction(
                              "accept"
                            )
                          }

                          disabled={
                            actionBusy
                          }

                          whileHover={{
                            y: -2,
                          }}

                          whileTap={{
                            scale:
                              0.98,
                          }}
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

                        </motion.button>

                      </div>

                    )}


                    {/* ===========================================
                        CONFIRM ACTION
                    =========================================== */}

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

                              onClick={() =>
                                setConfirmAction(
                                  ""
                                )
                              }
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

          </motion.div>

        )}

      </AnimatePresence>

    </>
  );
}
