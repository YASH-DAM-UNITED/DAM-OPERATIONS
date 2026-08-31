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
  ChevronDown,
  ChevronUp,
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
   HELPER
============================================================ */

function transferIdOf(
  transfer
) {
  return (
    transfer?.transferId ||
    transfer?.id ||
    transfer?.txId ||
    transfer?.transactionId ||
    ""
  );
}


function transferFromOf(
  transfer
) {
  return (
    transfer?.fromBranchName ||
    transfer?.fromName ||
    transfer?.fromBranch ||
    transfer?.from ||
    "MOOMA BRANCH"
  );
}


function transferFromCodeOf(
  transfer
) {
  return (
    transfer?.fromBranchCode ||
    transfer?.fromCode ||
    transfer?.fromBranch ||
    ""
  );
}


function transferDateOf(
  transfer
) {
  return (
    transfer?.createdAt ||
    transfer?.date ||
    transfer?.timestamp ||
    ""
  );
}


function transferItemsOf(
  transfer
) {
  if (
    Array.isArray(
      transfer?.items
    )
  ) {
    return transfer.items;
  }

  return [];
}


function itemNameOf(
  item
) {
  return (
    item?.itemName ||
    item?.name ||
    item?.item ||
    "ITEM"
  );
}


function itemSkuOf(
  item
) {
  return (
    item?.sku ||
    item?.SKU ||
    ""
  );
}


function itemQtyOf(
  item
) {
  return (
    item?.qty ??
    item?.quantity ??
    item?.amount ??
    0
  );
}


function itemUomOf(
  item
) {
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
    selectedTransferId,
    setSelectedTransferId,
  ] = useState("");

  const [
    actionBusy,
    setActionBusy,
  ] = useState("");

  const [
    actionMessage,
    setActionMessage,
  ] = useState(null);

  const [
    confirmAction,
    setConfirmAction,
  ] = useState(null);


  /* ==========================================================
     REFS
  ========================================================== */

  const pendingRef =
    useRef(null);

  const transferDetailRef =
    useRef(null);

  const actionResultRef =
    useRef(null);


  /* ==========================================================
     SELECTED TRANSFER
  ========================================================== */

  const selectedTransfer =
    useMemo(
      () =>
        pendingTransfers.find(
          (transfer) =>
            transferIdOf(
              transfer
            ) ===
            selectedTransferId
        ) || null,
      [
        pendingTransfers,
        selectedTransferId,
      ]
    );


  /* ==========================================================
     LOAD PENDING TRANSFERS
  ========================================================== */

  async function loadPendingTransfers({
    moveToSection = false,
  } = {}) {
    if (!branchCode) {
      return;
    }


    setPendingLoading(
      true
    );

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
            : [];


      setPendingTransfers(
        transfers
      );


      /*
       * If currently selected transfer
       * disappeared after ACCEPT/REJECT,
       * close its details.
       */

      if (
        selectedTransferId &&
        !transfers.some(
          (transfer) =>
            transferIdOf(
              transfer
            ) ===
            selectedTransferId
        )
      ) {
        setSelectedTransferId(
          ""
        );
      }


      if (moveToSection) {
        activeScroll(
          pendingRef,
          {
            delay: 120,
            block: "start",
          }
        );
      }
    } catch (error) {
      console.error(
        "[MOOMA DASHBOARD] Pending transfer error:",
        error
      );


      setPendingTransfers(
        []
      );


      setPendingError(
        error?.message ||
          "Unable to load pending transfers."
      );
    } finally {
      setPendingLoading(
        false
      );
    }
  }


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(
    () => {
      loadPendingTransfers();
    },
    [branchCode]
  );


  /* ==========================================================
     OPEN TRANSFER
  ========================================================== */

  function openTransfer(
    transfer
  ) {
    const id =
      transferIdOf(
        transfer
      );


    if (!id) {
      return;
    }


    if (
      selectedTransferId ===
      id
    ) {
      setSelectedTransferId(
        ""
      );

      return;
    }


    setSelectedTransferId(
      id
    );

    setActionMessage(
      null
    );

    setConfirmAction(
      null
    );


    activeScroll(
      transferDetailRef,
      {
        delay: 180,
      }
    );
  }


  /* ==========================================================
     ASK ACCEPT / REJECT
  ========================================================== */

  function askTransferAction(
    action
  ) {
    if (!selectedTransfer) {
      return;
    }


    setConfirmAction(
      action
    );


    setActionMessage(
      null
    );


    activeScroll(
      transferDetailRef,
      {
        delay: 80,
      }
    );
  }


  /* ==========================================================
     EXECUTE ACCEPT / REJECT
  ========================================================== */

  async function executeTransferAction() {
    if (
      !selectedTransfer ||
      !confirmAction
    ) {
      return;
    }


    const transferId =
      transferIdOf(
        selectedTransfer
      );


    if (!transferId) {
      setActionMessage({
        type: "error",
        text:
          "Transfer ID is missing.",
      });

      return;
    }


    const action =
      confirmAction;


    setActionBusy(
      action
    );

    setActionMessage(
      null
    );


    try {
      let data;


      if (
        action ===
        "ACCEPT"
      ) {
        data =
          await acceptMoomaTransfer({
            transferId,
            branchCode,
          });
      } else {
        data =
          await rejectMoomaTransfer({
            transferId,
            branchCode,
          });
      }


      setConfirmAction(
        null
      );


      setActionMessage({
        type:
          "success",

        action,

        text:
          data?.message ||
          (
            action ===
            "ACCEPT"
              ? "Transfer accepted successfully."
              : "Transfer rejected successfully."
          ),
      });


      /*
       * ACTIVE SECTION RULE:
       * after action → result
       */

      activeScroll(
        actionResultRef,
        {
          delay: 100,
        }
      );


      /*
       * Refresh pending list after
       * successful action.
       */

      await loadPendingTransfers();


      /*
       * Then show refreshed pending
       * section.
       */

      window.setTimeout(
        () => {
          activeScroll(
            pendingRef,
            {
              block:
                "start",
            }
          );
        },
        900
      );
    } catch (error) {
      console.error(
        "[MOOMA DASHBOARD] Transfer action error:",
        error
      );


      setActionMessage({
        type:
          "error",

        text:
          error?.message ||
          "Transfer action failed.",
      });


      activeScroll(
        actionResultRef,
        {
          delay: 100,
        }
      );
    } finally {
      setActionBusy("");
    }
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
     UI
  ========================================================== */

  return (
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
      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="mooma-dash-background" />

      <div className="mooma-dash-grid-background" />


      {/* ======================================================
          HEADER
      ====================================================== */}

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


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="mooma-dash-main">
        {/* ====================================================
            HERO
        ==================================================== */}

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

                onClick={() => {
                  activeScroll(
                    pendingRef,
                    {
                      block:
                        "start",
                    }
                  );
                }}
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


        {/* ====================================================
            MODULES
        ==================================================== */}

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


        {/* ====================================================
            PENDING TRANSFERS
        ==================================================== */}

        <section
          ref={
            pendingRef
          }

          className="mooma-dash-pending-section"
        >
          <div className="mooma-dash-pending-heading">
            <div>
              <span>
                LIVE TRANSFER QUEUE
              </span>

              <h2>
                Incoming Transfers
              </h2>

              <p>
                Review and process stock
                sent to this branch.
              </p>
            </div>


            <div className="mooma-dash-pending-heading-actions">
              {!pendingLoading && (
                <strong>
                  {
                    pendingTransfers.length
                  }{" "}
                  PENDING
                </strong>
              )}


              <button
                type="button"

                onClick={() => {
                  loadPendingTransfers({
                    moveToSection:
                      true,
                  });
                }}

                disabled={
                  pendingLoading
                }
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
            </div>
          </div>


          {/* LOADING */}

          {pendingLoading && (
            <div className="mooma-dash-pending-loading">
              <LoaderCircle
                size={24}

                className="mooma-spinner"
              />

              <strong>
                CHECKING TRANSFERS
              </strong>

              <span>
                Reading incoming MOOMA
                transfer queue...
              </span>
            </div>
          )}


          {/* ERROR */}

          {!pendingLoading &&
            pendingError && (
              <div className="mooma-dash-pending-error">
                <AlertCircle
                  size={21}
                />

                <div>
                  <strong>
                    TRANSFER CONNECTION FAILED
                  </strong>

                  <p>
                    {pendingError}
                  </p>
                </div>

                <button
                  type="button"

                  onClick={() => {
                    loadPendingTransfers({
                      moveToSection:
                        true,
                    });
                  }}
                >
                  RETRY
                </button>
              </div>
            )}


          {/* EMPTY */}

          {!pendingLoading &&
            !pendingError &&
            pendingTransfers.length ===
              0 && (
              <motion.div
                className="mooma-dash-pending-empty"

                initial={{
                  opacity: 0,
                  y: 10,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <CheckCircle2
                  size={29}
                />

                <strong>
                  NO PENDING TRANSFERS
                </strong>

                <p>
                  This branch has no
                  incoming stock waiting
                  for approval.
                </p>
              </motion.div>
            )}


          {/* TRANSFER LIST */}

          {!pendingLoading &&
            !pendingError &&
            pendingTransfers.length >
              0 && (
              <div className="mooma-dash-transfer-list">
                {pendingTransfers.map(
                  (
                    transfer,
                    index
                  ) => {
                    const id =
                      transferIdOf(
                        transfer
                      );

                    const active =
                      id ===
                      selectedTransferId;

                    const items =
                      transferItemsOf(
                        transfer
                      );


                    return (
                      <motion.button
                        type="button"

                        key={
                          id ||
                          index
                        }

                        className={
                          `mooma-dash-transfer-card ${
                            active
                              ? "active"
                              : ""
                          }`
                        }

                        onClick={() => {
                          openTransfer(
                            transfer
                          );
                        }}

                        initial={{
                          opacity: 0,
                          y: 12,
                        }}

                        animate={{
                          opacity: 1,
                          y: 0,
                        }}

                        transition={{
                          delay:
                            index *
                            0.05,
                        }}
                      >
                        <div className="mooma-dash-transfer-icon">
                          <ArrowLeftRight
                            size={18}
                          />
                        </div>


                        <div className="mooma-dash-transfer-main">
                          <small>
                            FROM
                          </small>

                          <strong>
                            {transferFromOf(
                              transfer
                            )}
                          </strong>

                          <span>
                            {transferFromCodeOf(
                              transfer
                            )}
                          </span>
                        </div>


                        <div className="mooma-dash-transfer-meta">
                          <div>
                            <span>
                              ITEMS
                            </span>

                            <strong>
                              {
                                items.length
                              }
                            </strong>
                          </div>


                          <div>
                            <span>
                              STATUS
                            </span>

                            <strong className="pending">
                              PENDING
                            </strong>
                          </div>
                        </div>


                        <div className="mooma-dash-transfer-open">
                          {active ? (
                            <ChevronUp
                              size={18}
                            />
                          ) : (
                            <ChevronDown
                              size={18}
                            />
                          )}
                        </div>
                      </motion.button>
                    );
                  }
                )}
              </div>
            )}


          {/* ==================================================
              SELECTED TRANSFER DETAILS
          ================================================== */}

          <AnimatePresence>
            {selectedTransfer && (
              <motion.div
                ref={
                  transferDetailRef
                }

                className="mooma-dash-transfer-detail"

                initial={{
                  opacity: 0,
                  y: 18,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                }}

                exit={{
                  opacity: 0,
                  y: 10,
                }}
              >
                <div className="mooma-dash-transfer-detail-head">
                  <div>
                    <span>
                      INCOMING TRANSFER
                    </span>

                    <h3>
                      {transferFromOf(
                        selectedTransfer
                      )}
                    </h3>

                    <p>
                      {transferIdOf(
                        selectedTransfer
                      )}
                    </p>
                  </div>


                  <button
                    type="button"

                    onClick={() => {
                      setSelectedTransferId(
                        ""
                      );

                      setConfirmAction(
                        null
                      );

                      setActionMessage(
                        null
                      );

                      activeScroll(
                        pendingRef,
                        {
                          block:
                            "start",
                        }
                      );
                    }}
                  >
                    <X
                      size={17}
                    />
                  </button>
                </div>


                {/* TRANSFER INFORMATION */}

                <div className="mooma-dash-transfer-info">
                  <div>
                    <small>
                      FROM BRANCH
                    </small>

                    <strong>
                      {transferFromOf(
                        selectedTransfer
                      )}
                    </strong>
                  </div>


                  <div>
                    <small>
                      BRANCH CODE
                    </small>

                    <strong>
                      {transferFromCodeOf(
                        selectedTransfer
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
                        selectedTransfer
                      ) ||
                        "—"}
                    </strong>
                  </div>


                  <div>
                    <small>
                      STATUS
                    </small>

                    <strong className="mooma-dash-status-pending">
                      PENDING
                    </strong>
                  </div>
                </div>


                {/* ITEMS */}

                <div className="mooma-dash-transfer-items">
                  <div className="mooma-dash-transfer-items-head">
                    <strong>
                      TRANSFER ITEMS
                    </strong>

                    <span>
                      {
                        transferItemsOf(
                          selectedTransfer
                        ).length
                      }{" "}
                      ITEMS
                    </span>
                  </div>


                  <div className="mooma-dash-transfer-table">
                    <div className="mooma-dash-transfer-table-head">
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


                    {transferItemsOf(
                      selectedTransfer
                    ).map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="mooma-dash-transfer-table-row"

                          key={
                            `${
                              itemSkuOf(
                                item
                              )
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
                            ) ||
                              "—"}
                          </span>

                          <strong>
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
                        </div>
                      )
                    )}
                  </div>
                </div>


                {/* ============================================
                    ACCEPT / REJECT
                ============================================ */}

                {!confirmAction && (
                  <div className="mooma-dash-transfer-actions">
                    <button
                      type="button"

                      className="mooma-dash-transfer-reject"

                      disabled={
                        Boolean(
                          actionBusy
                        )
                      }

                      onClick={() => {
                        askTransferAction(
                          "REJECT"
                        );
                      }}
                    >
                      <XCircle
                        size={17}
                      />

                      REJECT TRANSFER
                    </button>


                    <button
                      type="button"

                      className="mooma-dash-transfer-accept"

                      disabled={
                        Boolean(
                          actionBusy
                        )
                      }

                      onClick={() => {
                        askTransferAction(
                          "ACCEPT"
                        );
                      }}
                    >
                      <Check
                        size={17}
                      />

                      ACCEPT TRANSFER
                    </button>
                  </div>
                )}


                {/* ============================================
                    CONFIRMATION
                ============================================ */}

                <AnimatePresence>
                  {confirmAction && (
                    <motion.div
                      className={
                        `mooma-dash-transfer-confirm ${
                          confirmAction ===
                          "REJECT"
                            ? "reject"
                            : "accept"
                        }`
                      }

                      initial={{
                        opacity: 0,
                        y: 10,
                      }}

                      animate={{
                        opacity: 1,
                        y: 0,
                      }}

                      exit={{
                        opacity: 0,
                        y: 6,
                      }}
                    >
                      <div>
                        {confirmAction ===
                        "ACCEPT" ? (
                          <CheckCircle2
                            size={22}
                          />
                        ) : (
                          <AlertCircle
                            size={22}
                          />
                        )}


                        <div>
                          <strong>
                            {confirmAction ===
                            "ACCEPT"
                              ? "ACCEPT THIS TRANSFER?"
                              : "REJECT THIS TRANSFER?"}
                          </strong>

                          <p>
                            {confirmAction ===
                            "ACCEPT"
                              ? "Confirm that the branch has received the listed stock."
                              : "Confirm that this incoming stock transfer should be rejected."}
                          </p>
                        </div>
                      </div>


                      <div className="mooma-dash-confirm-buttons">
                        <button
                          type="button"

                          onClick={() => {
                            setConfirmAction(
                              null
                            );
                          }}

                          disabled={
                            Boolean(
                              actionBusy
                            )
                          }
                        >
                          CANCEL
                        </button>


                        <button
                          type="button"

                          className={
                            confirmAction ===
                            "ACCEPT"
                              ? "confirm-accept"
                              : "confirm-reject"
                          }

                          onClick={
                            executeTransferAction
                          }

                          disabled={
                            Boolean(
                              actionBusy
                            )
                          }
                        >
                          {actionBusy ? (
                            <>
                              <LoaderCircle
                                size={15}

                                className="mooma-spinner"
                              />

                              PROCESSING
                            </>
                          ) : (
                            <>
                              {confirmAction ===
                              "ACCEPT" ? (
                                <Check
                                  size={15}
                                />
                              ) : (
                                <X
                                  size={15}
                                />
                              )}

                              CONFIRM{" "}
                              {
                                confirmAction
                              }
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>


          {/* ==================================================
              ACTION RESULT
          ================================================== */}

          <AnimatePresence>
            {actionMessage && (
              <motion.div
                ref={
                  actionResultRef
                }

                className={
                  `mooma-dash-action-result ${
                    actionMessage.type
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
              >
                {actionMessage.type ===
                "success" ? (
                  <CheckCircle2
                    size={21}
                  />
                ) : (
                  <AlertCircle
                    size={21}
                  />
                )}


                <div>
                  <strong>
                    {actionMessage.type ===
                    "success"
                      ? actionMessage.action ===
                        "REJECT"
                        ? "TRANSFER REJECTED"
                        : "TRANSFER ACCEPTED"
                      : "ACTION FAILED"}
                  </strong>

                  <p>
                    {
                      actionMessage.text
                    }
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>


        {/* ====================================================
            FOOTER
        ==================================================== */}

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
  );
}
