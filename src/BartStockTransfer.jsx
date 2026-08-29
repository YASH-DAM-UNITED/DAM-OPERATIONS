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
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  History,
  LoaderCircle,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  X,
  XCircle,
} from "lucide-react";


/* ============================================================
   API
============================================================ */

const API = {
  init:
    "/api/staff/bart/stock-transfer/init",

  create:
    "/api/staff/bart/stock-transfer/create",

  history:
    "/api/staff/bart/stock-transfer/history",
};


/* ============================================================
   HELPERS
============================================================ */

function scrollToRef(
  ref,
  block = "start"
) {
  window.requestAnimationFrame(
    () => {
      window.setTimeout(
        () => {
          ref?.current?.scrollIntoView({
            behavior:
              "smooth",

            block,
          });
        },
        80
      );
    }
  );
}


function normalizeNumber(
  value
) {
  const number =
    Number(
      String(
        value ?? 0
      )
        .replace(
          /,/g,
          ""
        )
        .trim()
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function statusClass(
  status
) {
  return String(
    status || ""
  )
    .trim()
    .toLowerCase();
}


/* ============================================================
   LOADING SCREEN
============================================================ */

function LoadingScreen({
  branch,
}) {
  return (
    <div className="bst-page bst-loading-page">

      <div className="bst-grid-bg" />

      <div className="bst-orb bst-orb-one" />

      <div className="bst-orb bst-orb-two" />


      <motion.div
        className="bst-cinematic-loader"
        initial={{
          opacity: 0,
          scale: 0.94,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
      >
        <motion.div
          className="bst-loader-icon"
          animate={{
            rotate: [
              0,
              -7,
              7,
              0,
            ],

            scale: [
              1,
              1.08,
              1,
            ],
          }}
          transition={{
            duration: 1.3,
            repeat: Infinity,
          }}
        >
          <Truck
            size={29}
          />
        </motion.div>

        <span>
          BART INTERNAL MOVEMENT
        </span>

        <h2>
          Preparing Stock Transfer
        </h2>

        <p>
          Loading live inventory for{" "}
          <strong>
            {branch?.name ||
              branch?.code ||
              "your branch"}
          </strong>
        </p>

        <div className="bst-loader-line">
          <motion.div
            initial={{
              x: "-120%",
            }}
            animate={{
              x: "300%",
            }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}


/* ============================================================
   SUCCESS MODAL
============================================================ */

function SuccessModal({
  transfer,
  onClose,
}) {
  if (!transfer) {
    return null;
  }

  return (
    <motion.div
      className="bst-modal-overlay"
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
        className="bst-success-modal"
        initial={{
          opacity: 0,
          y: 30,
          scale: 0.92,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          scale: 0.95,
        }}
      >
        <motion.div
          className="bst-success-icon"
          initial={{
            scale: 0,
          }}
          animate={{
            scale: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 230,
            damping: 16,
          }}
        >
          <Check
            size={40}
          />
        </motion.div>

        <span>
          TRANSFER CREATED
        </span>

        <h2>
          Stock is on the move.
        </h2>

        <p>
          The inventory movement was completed and the transfer is now waiting for destination confirmation.
        </p>

        <div className="bst-success-id">
          <small>
            TRANSFER ID
          </small>

          <strong>
            {transfer.transferId}
          </strong>
        </div>

        <div className="bst-success-route">
          <div>
            <small>
              FROM
            </small>

            <strong>
              {transfer.origin}
            </strong>
          </div>

          <ArrowRight
            size={17}
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

        <button
          type="button"
          onClick={onClose}
        >
          RETURN TO TRANSFER CENTER
        </button>
      </motion.div>
    </motion.div>
  );
}


/* ============================================================
   HISTORY
============================================================ */

function HistoryPanel({
  rows,
  loading,
  onRefresh,
}) {
  return (
    <motion.section
      className="bst-history-panel"
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
    >
      <div className="bst-history-head">
        <div>
          <span>
            MOVEMENT LOG
          </span>

          <h2>
            Transfer History
          </h2>
        </div>

        <button
          type="button"
          className="bst-refresh"
          disabled={loading}
          onClick={
            onRefresh
          }
        >
          {loading ? (
            <LoaderCircle
              size={15}
              className="dam-spin"
            />
          ) : (
            <RefreshCcw
              size={15}
            />
          )}

          REFRESH
        </button>
      </div>

      {loading &&
      rows.length === 0 ? (
        <div className="bst-history-loading">
          <LoaderCircle
            size={22}
            className="dam-spin"
          />

          Loading transfer history...
        </div>
      ) : rows.length ===
        0 ? (
        <div className="bst-empty">
          No transfers found for this branch.
        </div>
      ) : (
        <div className="bst-history-list">
          {rows.map(
            (
              transfer,
              index
            ) => (
              <motion.div
                className="bst-history-card"
                key={
                  transfer.id ||
                  index
                }
                initial={{
                  opacity: 0,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay:
                    index *
                    0.04,
                }}
              >
                <div>
                  <strong>
                    {transfer.id ||
                      "TRANSFER"}
                  </strong>

                  <small>
                    {transfer.origin}
                  </small>

                  <small>
                    →
                    {" "}
                    {transfer.destination}
                  </small>

                  {transfer.reason && (
                    <small>
                      {transfer.reason}
                    </small>
                  )}
                </div>

                <span
                  className={
                    `bst-status ${statusClass(
                      transfer.status
                    )}`
                  }
                >
                  {transfer.status ||
                    "Pending"}
                </span>
              </motion.div>
            )
          )}
        </div>
      )}
    </motion.section>
  );
}


/* ============================================================
   MAIN
============================================================ */

export default function BartStockTransfer({
  branch,
  onBack,
}) {
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
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    data,
    setData,
  ] =
    useState(null);

  const [
    category,
    setCategory,
  ] =
    useState("daily");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    cart,
    setCart,
  ] =
    useState([]);

  const [
    destination,
    setDestination,
  ] =
    useState("");

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    history,
    setHistory,
  ] =
    useState([]);

  const [
    showHistory,
    setShowHistory,
  ] =
    useState(false);

  const [
    success,
    setSuccess,
  ] =
    useState(null);


  const inventoryRef =
    useRef(null);

  const cartRef =
    useRef(null);

  const messageRef =
    useRef(null);


  /* ==========================================================
     ENTER PAGE AT TOP
  ========================================================== */

  useEffect(
    () => {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });
    },
    []
  );


  /* ==========================================================
     LOAD INIT
  ========================================================== */

  async function loadTransferData(
    force =
      false
  ) {
    if (
      !branch?.code
    ) {
      return;
    }

    try {
      if (
        force
      ) {
        setRefreshing(
          true
        );
      } else {
        setLoading(
          true
        );
      }

      setMessage(
        null
      );

      const response =
        await fetch(
          `${API.init}?branch=${encodeURIComponent(
            branch.code
          )}${
            force
              ? "&refresh=1"
              : ""
          }`,
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
          "Unable to load stock transfer."
        );
      }

      setData(
        result
      );
    } catch (
      error
    ) {
      setMessage({
        type:
          "error",

        text:
          error.message ||
          "Unable to load transfer system.",
      });

      scrollToRef(
        messageRef,
        "center"
      );
    } finally {
      setLoading(
        false
      );

      setRefreshing(
        false
      );
    }
  }


  useEffect(
    () => {
      loadTransferData(
        false
      );
    },
    [
      branch?.code,
    ]
  );


  /* ==========================================================
     HISTORY
  ========================================================== */

  async function loadHistory() {
    if (
      !branch?.code
    ) {
      return;
    }

    try {
      setHistoryLoading(
        true
      );

      const response =
        await fetch(
          `${API.history}?branch=${encodeURIComponent(
            branch.code
          )}&limit=10`,
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
          "Unable to load history."
        );
      }

      setHistory(
        result.transfers ||
        result.history ||
        []
      );
    } catch (
      error
    ) {
      setMessage({
        type:
          "error",

        text:
          error.message ||
          "Unable to load transfer history.",
      });
    } finally {
      setHistoryLoading(
        false
      );
    }
  }


  async function toggleHistory() {
    const next =
      !showHistory;

    setShowHistory(
      next
    );

    if (
      next &&
      history.length ===
        0
    ) {
      await loadHistory();
    }
  }


  /* ==========================================================
     INVENTORY
  ========================================================== */

  const allItems =
    useMemo(
      () => {
        if (
          !data?.items
        ) {
          return [];
        }

        return category ===
          "weekly"
          ? data.items.weekly ||
              []
          : data.items.daily ||
              [];
      },
      [
        data,
        category,
      ]
    );


  const visibleItems =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return allItems;
        }

        return allItems.filter(
          (item) =>
            `${item.name || ""} ${item.sku || ""} ${item.uom || ""}`
              .toLowerCase()
              .includes(
                query
              )
        );
      },
      [
        allItems,
        search,
      ]
    );


  /* ==========================================================
     CART
  ========================================================== */

  function cartEntryFor(
    item
  ) {
    return cart.find(
      (entry) =>
        entry.item ===
        item.name
    );
  }


  function addItem(
    item
  ) {
    const available =
      normalizeNumber(
        item.available
      );

    if (
      available <= 0
    ) {
      setMessage({
        type:
          "error",

        text:
          `${item.name} has no available stock.`,
      });

      scrollToRef(
        messageRef,
        "center"
      );

      return;
    }

    setMessage(
      null
    );

    setCart(
      (
        current
      ) => {
        const existing =
          current.find(
            (entry) =>
              entry.item ===
              item.name
          );

        if (
          existing
        ) {
          return current.map(
            (entry) =>
              entry.item ===
              item.name
                ? {
                    ...entry,

                    qty:
                      Math.min(
                        entry.qty +
                          1,

                        available
                      ),
                  }
                : entry
          );
        }

        return [
          ...current,

          {
            item:
              item.name,

            sku:
              item.sku ||
              "",

            uom:
              item.uom ||
              "",

            qty:
              1,

            available,
          },
        ];
      }
    );

    scrollToRef(
      cartRef,
      "center"
    );
  }


  function changeQty(
    itemName,
    nextQty
  ) {
    setCart(
      (
        current
      ) =>
        current
          .map(
            (entry) => {
              if (
                entry.item !==
                itemName
              ) {
                return entry;
              }

              const qty =
                Math.max(
                  0,

                  Math.min(
                    Number(
                      nextQty
                    ) ||
                      0,

                    entry.available
                  )
                );

              return {
                ...entry,
                qty,
              };
            }
          )
          .filter(
            (entry) =>
              entry.qty >
              0
          )
    );
  }


  function removeItem(
    itemName
  ) {
    setCart(
      (
        current
      ) =>
        current.filter(
          (entry) =>
            entry.item !==
            itemName
        )
    );
  }


  function clearCart() {
    if (
      cart.length ===
      0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Clear all items from this transfer?"
      );

    if (!confirmed) {
      return;
    }

    setCart(
      []
    );

    setDestination(
      ""
    );

    setReason(
      ""
    );
  }


  /* ==========================================================
     CREATE TRANSFER
  ========================================================== */

  async function submitTransfer() {
    if (
      submitting
    ) {
      return;
    }

    if (
      cart.length ===
      0
    ) {
      setMessage({
        type:
          "error",

        text:
          "Add at least one stock item before continuing.",
      });

      scrollToRef(
        inventoryRef
      );

      return;
    }

    if (
      !destination
    ) {
      setMessage({
        type:
          "error",

        text:
          "Select the destination branch.",
      });

      scrollToRef(
        cartRef,
        "center"
      );

      return;
    }

    if (
      !reason.trim()
    ) {
      setMessage({
        type:
          "error",

        text:
          "Enter the reason/reference for this transfer.",
      });

      scrollToRef(
        cartRef,
        "center"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Send ${cart.length} stock item${
          cart.length ===
          1
            ? ""
            : "s"
        } from ${
          data?.origin?.name ||
          branch?.name
        } to ${
          data?.destinations?.find(
            (item) =>
              item.code ===
              destination
          )?.name ||
          destination
        }?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(
        true
      );

      setMessage({
        type:
          "info",

        text:
          "Verifying live stock and creating transfer...",
      });

      scrollToRef(
        messageRef,
        "center"
      );

      const response =
        await fetch(
          API.create,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                originBranch:
                  branch.code,

                destinationBranch:
                  destination,

                reason:
                  reason.trim(),

                cart:
                  cart.map(
                    (
                      entry
                    ) => ({
                      item:
                        entry.item,

                      sku:
                        entry.sku,

                      uom:
                        entry.uom,

                      qty:
                        Number(
                          entry.qty
                        ),
                    })
                  ),
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        if (
          result.insufficient &&
          Array.isArray(
            result.items
          )
        ) {
          throw new Error(
            `Insufficient stock: ${result.items
              .map(
                (
                  entry
                ) =>
                  `${entry.item} (${entry.have} available / ${entry.need} requested)`
              )
              .join(
                ", "
              )}`
          );
        }

        if (
          result.missingItems
        ) {
          throw new Error(
            result.message ||
            "Some items are missing in one of the branch stock sheets."
          );
        }

        throw new Error(
          result.message ||
          "Transfer could not be created."
        );
      }

      setMessage(
        null
      );

      setSuccess(
        result
      );

      setCart(
        []
      );

      setDestination(
        ""
      );

      setReason(
        ""
      );

      setSearch(
        ""
      );

      await loadTransferData(
        true
      );

      if (
        showHistory
      ) {
        await loadHistory();
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (
      error
    ) {
      setMessage({
        type:
          "error",

        text:
          error.message ||
          "Transfer failed.",
      });

      scrollToRef(
        messageRef,
        "center"
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }


  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loading &&
    !data
  ) {
    return (
      <LoadingScreen
        branch={branch}
      />
    );
  }


  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="bst-page">

      <div className="bst-grid-bg" />

      <div className="bst-orb bst-orb-one" />

      <div className="bst-orb bst-orb-two" />


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="bst-header">

        <button
          type="button"
          className="bst-back"
          onClick={() => {
            window.scrollTo({
              top: 0,
              behavior:
                "smooth",
            });

            onBack?.();
          }}
        >
          <ArrowLeft
            size={15}
          />

          STAFF DASHBOARD
        </button>


        <div className="bst-brand">
          <div>
            <Coffee
              size={17}
            />
          </div>

          <span>
            <strong>
              BART
            </strong>

            STOCK TRANSFER
          </span>
        </div>


        <button
          type="button"
          className={
            `bst-history-button ${
              showHistory
                ? "active"
                : ""
            }`
          }
          onClick={
            toggleHistory
          }
        >
          <History
            size={15}
          />

          HISTORY
        </button>

      </header>


      <main className="bst-main">

        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="bst-hero">

          <motion.div
            initial={{
              opacity: 0,
              y: 24,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="bst-kicker">
              <Truck
                size={12}
              />

              INTERNAL MOVEMENT NETWORK
            </div>

            <h1>
              Move stock,
              <br />

              <span>
                branch to branch.
              </span>
            </h1>

            <p>
              Build a transfer, verify live stock and transmit inventory securely through the BART branch network.
            </p>
          </motion.div>


          <motion.div
            className="bst-branch-card"
            initial={{
              opacity: 0,
              y: 24,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay:
                0.08,
            }}
          >
            <small>
              ORIGIN BRANCH
            </small>

            <div className="bst-origin-pin">
              <MapPin
                size={15}
              />
            </div>

            <h2>
              {data?.origin?.name ||
                branch?.name}
            </h2>

            <strong>
              {data?.origin?.code ||
                branch?.code}
            </strong>

            <div className="bst-stock-date">
              <Clock3
                size={13}
              />

              STOCK DATE

              <b>
                {data?.targetDate ||
                  "-"}
              </b>
            </div>
          </motion.div>
        </section>


        {/* ====================================================
            ERROR / STATUS
        ==================================================== */}

        <div
          ref={
            messageRef
          }
        >
          <AnimatePresence>
            {message && (
              <motion.div
                className={
                  `bst-message ${message.type}`
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
                {message.type ===
                "error" ? (
                  <XCircle
                    size={17}
                  />
                ) : message.type ===
                  "success" ? (
                  <CheckCircle2
                    size={17}
                  />
                ) : (
                  <LoaderCircle
                    size={17}
                    className="dam-spin"
                  />
                )}

                <span>
                  {message.text}
                </span>

                {message.type !==
                  "info" && (
                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        null
                      )
                    }
                  >
                    <X
                      size={14}
                    />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        {/* ====================================================
            HISTORY
        ==================================================== */}

        <AnimatePresence>
          {showHistory && (
            <HistoryPanel
              rows={
                history
              }
              loading={
                historyLoading
              }
              onRefresh={
                loadHistory
              }
            />
          )}
        </AnimatePresence>


        {/* ====================================================
            INVENTORY
        ==================================================== */}

        <motion.section
          ref={
            inventoryRef
          }
          className="bst-inventory-section"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay:
              0.12,
          }}
        >
          <div className="bst-inventory-toolbar">

            <div className="bst-category-tabs">

              <button
                type="button"
                className={
                  category ===
                  "daily"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setCategory(
                    "daily"
                  );

                  setSearch(
                    ""
                  );

                  scrollToRef(
                    inventoryRef
                  );
                }}
              >
                DAILY ITEMS

                <span>
                  {data?.items?.daily?.length ||
                    0}
                </span>
              </button>


              <button
                type="button"
                className={
                  category ===
                  "weekly"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setCategory(
                    "weekly"
                  );

                  setSearch(
                    ""
                  );

                  scrollToRef(
                    inventoryRef
                  );
                }}
              >
                WEEKLY ITEMS

                <span>
                  {data?.items?.weekly?.length ||
                    0}
                </span>
              </button>

            </div>


            <button
              type="button"
              className="bst-live-refresh"
              disabled={
                refreshing
              }
              onClick={() =>
                loadTransferData(
                  true
                )
              }
            >
              {refreshing ? (
                <LoaderCircle
                  size={15}
                  className="dam-spin"
                />
              ) : (
                <RefreshCcw
                  size={15}
                />
              )}

              {refreshing
                ? "REFRESHING"
                : "LIVE STOCK"}
            </button>

          </div>


          <div className="bst-search">

            <Search
              size={17}
            />

            <input
              type="text"
              value={
                search
              }
              placeholder="Search item, SKU or UOM..."
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch(
                    ""
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            )}

          </div>


          <div className="bst-inventory-heading">

            <div>
              <span>
                01 / INVENTORY
              </span>

              <h2>
                Select an item
              </h2>
            </div>

            <strong>
              {visibleItems.length}
              {" "}
              ITEMS
            </strong>

          </div>


          {visibleItems.length ===
          0 ? (
            <div className="bst-empty bst-inventory-empty">
              No matching inventory items found.
            </div>
          ) : (
            <div className="bst-inventory-grid">

              {visibleItems.map(
                (
                  item,
                  index
                ) => {
                  const available =
                    normalizeNumber(
                      item.available
                    );

                  const cartEntry =
                    cartEntryFor(
                      item
                    );

                  const selected =
                    Boolean(
                      cartEntry
                    );

                  return (
                    <motion.button
                      type="button"
                      key={
                        `${category}-${item.sku}-${item.name}`
                      }
                      className={
                        `bst-stock-card ${
                          selected
                            ? "selected"
                            : ""
                        } ${
                          available <=
                          0
                            ? "out-of-stock"
                            : ""
                        }`
                      }
                      disabled={
                        available <=
                        0
                      }
                      onClick={() =>
                        addItem(
                          item
                        )
                      }
                      initial={{
                        opacity: 0,
                        y: 14,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay:
                          Math.min(
                            index *
                              0.015,

                            0.25
                          ),
                      }}
                      whileHover={
                        available >
                        0
                          ? {
                              y:
                                -5,
                            }
                          : undefined
                      }
                      whileTap={
                        available >
                        0
                          ? {
                              scale:
                                0.985,
                            }
                          : undefined
                      }
                    >
                      <div className="bst-stock-card-top">

                        <span>
                          {item.sku ||
                            "NO SKU"}
                        </span>

                        {selected && (
                          <div>
                            <Check
                              size={13}
                            />
                          </div>
                        )}

                      </div>


                      <h3>
                        {item.name}
                      </h3>


                      <div className="bst-stock-card-bottom">

                        <span>
                          {item.uom ||
                            "UNIT"}
                        </span>

                        <strong>
                          {available}
                        </strong>

                        <small>
                          AVAILABLE
                        </small>

                      </div>


                      {selected && (
                        <div className="bst-card-cart-count">
                          {cartEntry.qty}
                        </div>
                      )}

                    </motion.button>
                  );
                }
              )}

            </div>
          )}
        </motion.section>


        {/* ====================================================
            CART
        ==================================================== */}

        <motion.section
          ref={
            cartRef
          }
          className={
            `bst-cart-section ${
              cart.length >
              0
                ? "has-items"
                : ""
            }`
          }
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div className="bst-cart-head">

            <div>
              <span>
                02 / TRANSFER CART
              </span>

              <h2>
                Build movement
              </h2>
            </div>

            <div className="bst-cart-counter">
              <ShoppingCart
                size={16}
              />

              {cart.length}
              {" "}
              ITEMS
            </div>

          </div>


          {cart.length ===
          0 ? (
            <div className="bst-cart-empty">

              <Package
                size={29}
              />

              <strong>
                Your transfer is empty
              </strong>

              <p>
                Select an inventory item above to begin building the stock movement.
              </p>

            </div>
          ) : (
            <>
              <div className="bst-cart-list">

                {cart.map(
                  (
                    entry,
                    index
                  ) => (
                    <motion.div
                      className="bst-cart-row"
                      key={
                        entry.item
                      }
                      initial={{
                        opacity: 0,
                        x: -10,
                      }}
                      animate={{
                        opacity: 1,
                        x: 0,
                      }}
                    >
                      <div className="bst-cart-number">
                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>


                      <div className="bst-cart-product">

                        <small>
                          {entry.sku ||
                            "NO SKU"}
                        </small>

                        <strong>
                          {entry.item}
                        </strong>

                        <span>
                          {entry.available}
                          {" "}
                          {entry.uom}
                          {" "}
                          AVAILABLE
                        </span>

                      </div>


                      <div className="bst-qty-control">

                        <button
                          type="button"
                          onClick={() =>
                            changeQty(
                              entry.item,

                              entry.qty -
                                1
                            )
                          }
                        >
                          <Minus
                            size={14}
                          />
                        </button>


                        <input
                          type="number"
                          min="1"
                          max={
                            entry.available
                          }
                          value={
                            entry.qty
                          }
                          onChange={(
                            event
                          ) =>
                            changeQty(
                              entry.item,

                              event.target.value
                            )
                          }
                        />


                        <button
                          type="button"
                          disabled={
                            entry.qty >=
                            entry.available
                          }
                          onClick={() =>
                            changeQty(
                              entry.item,

                              entry.qty +
                                1
                            )
                          }
                        >
                          <Plus
                            size={14}
                          />
                        </button>

                      </div>


                      <span className="bst-cart-uom">
                        {entry.uom}
                      </span>


                      <button
                        type="button"
                        className="bst-cart-remove"
                        onClick={() =>
                          removeItem(
                            entry.item
                          )
                        }
                      >
                        <Trash2
                          size={15}
                        />
                      </button>

                    </motion.div>
                  )
                )}

              </div>


              <button
                type="button"
                className="bst-clear-cart"
                onClick={
                  clearCart
                }
              >
                <Trash2
                  size={14}
                />

                CLEAR TRANSFER
              </button>
            </>
          )}
        </motion.section>


        {/* ====================================================
            DESTINATION
        ==================================================== */}

        {cart.length >
          0 && (
          <motion.section
            className="bst-finalize-section"
            initial={{
              opacity: 0,
              y: 18,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="bst-finalize-head">

              <div>
                <span>
                  03 / DESTINATION
                </span>

                <h2>
                  Where is it going?
                </h2>
              </div>

              <Boxes
                size={22}
              />

            </div>


            <div className="bst-finalize-grid">

              <label className="bst-final-field">
                <span>
                  DESTINATION BRANCH
                </span>

                <select
                  value={
                    destination
                  }
                  onChange={(
                    event
                  ) =>
                    setDestination(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select destination branch
                  </option>

                  {(data?.destinations ||
                    []).map(
                    (
                      destinationBranch
                    ) => (
                      <option
                        key={
                          destinationBranch.code
                        }
                        value={
                          destinationBranch.code
                        }
                      >
                        {destinationBranch.code}
                        {" - "}
                        {destinationBranch.name}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="bst-final-field full">
                <span>
                  REASON / REFERENCE
                </span>

                <textarea
                  value={
                    reason
                  }
                  placeholder="Example: Stock support for weekend operation - 29 Aug 2026"
                  onChange={(
                    event
                  ) =>
                    setReason(
                      event.target.value
                    )
                  }
                />
              </label>

            </div>


            <div className="bst-send-summary">

              <div>
                <small>
                  ITEMS
                </small>

                <strong>
                  {cart.length}
                </strong>
              </div>


              <div>
                <small>
                  TOTAL QTY
                </small>

                <strong>
                  {cart.reduce(
                    (
                      total,
                      entry
                    ) =>
                      total +
                      Number(
                        entry.qty ||
                        0
                      ),

                    0
                  )}
                </strong>
              </div>


              <div>
                <small>
                  DESTINATION
                </small>

                <strong>
                  {destination ||
                    "NOT SELECTED"}
                </strong>
              </div>


              <button
                type="button"
                className="bst-send-button"
                disabled={
                  submitting ||
                  !destination ||
                  !reason.trim()
                }
                onClick={
                  submitTransfer
                }
              >
                {submitting ? (
                  <>
                    <LoaderCircle
                      size={17}
                      className="dam-spin"
                    />

                    VERIFYING STOCK...
                  </>
                ) : (
                  <>
                    SEND TRANSFER

                    <Send
                      size={16}
                    />
                  </>
                )}
              </button>

            </div>

          </motion.section>
        )}


        <div className="bst-security-note">
          <CheckCircle2
            size={15}
          />

          Transfer quantities are verified against live Google Sheet stock before movement.
        </div>

      </main>


      <AnimatePresence>
        {success && (
          <SuccessModal
            transfer={
              success
            }
            onClose={() => {
              setSuccess(
                null
              );

              window.scrollTo({
                top: 0,
                behavior:
                  "smooth",
              });
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
