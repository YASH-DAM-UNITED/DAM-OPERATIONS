import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Coffee,
  History,
  LoaderCircle,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";


/* ============================================================
   HELPERS
============================================================ */

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
   STOCK TRANSFER
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
    error,
    setError,
  ] =
    useState("");


  const [
    data,
    setData,
  ] =
    useState(null);


  const [
    category,
    setCategory,
  ] =
    useState(
      "daily"
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    selectedItem,
    setSelectedItem,
  ] =
    useState(null);


  const [
    quantity,
    setQuantity,
  ] =
    useState(1);


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
    reviewOpen,
    setReviewOpen,
  ] =
    useState(false);


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    validation,
    setValidation,
  ] =
    useState(null);


  const [
    success,
    setSuccess,
  ] =
    useState(null);


  const [
    historyOpen,
    setHistoryOpen,
  ] =
    useState(false);


  const [
    history,
    setHistory,
  ] =
    useState([]);


  const [
    historyTotal,
    setHistoryTotal,
  ] =
    useState(0);


  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);


  /* ==========================================================
     INIT
  ========================================================== */

  async function loadTransferSystem() {
    if (
      !branch?.code
    ) {
      return;
    }


    try {
      setLoading(
        true
      );

      setError(
        ""
      );


      const response =
        await fetch(
          `/api/staff/bart/stock-transfer/init?branch=${encodeURIComponent(
            branch.code
          )}`,
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
            "Unable to load Stock Transfer."
        );
      }


      setData(
        result
      );


    } catch (err) {
      setError(
        err.message ||
          "Unable to load Stock Transfer."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(() => {
    loadTransferSystem();
  }, [
    branch?.code,
  ]);


  /* ==========================================================
     ITEMS
  ========================================================== */

  const items =
    useMemo(
      () =>
        data?.items?.[
          category
        ] || [],
      [
        data,
        category,
      ]
    );


  const visibleItems =
    useMemo(
      () => {
        const q =
          search
            .trim()
            .toLowerCase();


        if (!q) {
          return items;
        }


        return items.filter(
          (item) =>
            String(
              item.name || ""
            )
              .toLowerCase()
              .includes(q) ||

            String(
              item.sku || ""
            )
              .toLowerCase()
              .includes(q) ||

            String(
              item.uom || ""
            )
              .toLowerCase()
              .includes(q)
        );
      },
      [
        items,
        search,
      ]
    );


  /* ==========================================================
     ADD CART

     If same item is added twice,
     merge quantities safely.
  ========================================================== */

  function addToCart() {
    if (!selectedItem) {
      setValidation({
        title:
          "Select an Item",

        message:
          "Choose an inventory item before adding it.",
      });

      return;
    }


    if (
      !Number.isFinite(
        Number(quantity)
      ) ||
      Number(quantity) <
        1
    ) {
      setValidation({
        title:
          "Invalid Quantity",

        message:
          "Quantity must be at least 1.",
      });

      return;
    }


    const qty =
      Math.trunc(
        Number(
          quantity
        )
      );


    setCart(
      (current) => {
        const existing =
          current.find(
            (entry) =>
              entry.item ===
              selectedItem.name
          );


        if (existing) {
          return current.map(
            (entry) =>
              entry.item ===
              selectedItem.name
                ? {
                    ...entry,

                    qty:
                      entry.qty +
                      qty,
                  }
                : entry
          );
        }


        return [
          ...current,
          {
            item:
              selectedItem.name,

            sku:
              selectedItem.sku,

            uom:
              selectedItem.uom,

            qty,

            available:
              selectedItem.available,
          },
        ];
      }
    );


    setSelectedItem(
      null
    );

    setQuantity(
      1
    );
  }


  /* ==========================================================
     CART REMOVE
  ========================================================== */

  function removeCartItem(
    itemName
  ) {
    setCart(
      (current) =>
        current.filter(
          (entry) =>
            entry.item !==
            itemName
        )
    );
  }


  /* ==========================================================
     CART QUANTITY
  ========================================================== */

  function changeCartQty(
    itemName,
    delta
  ) {
    setCart(
      (current) =>
        current
          .map(
            (entry) => {
              if (
                entry.item !==
                itemName
              ) {
                return entry;
              }


              return {
                ...entry,

                qty:
                  Math.max(
                    1,
                    entry.qty +
                      delta
                  ),
              };
            }
          )
    );
  }


  /* ==========================================================
     REVIEW
  ========================================================== */

  function openReview() {
    if (
      cart.length ===
      0
    ) {
      setValidation({
        title:
          "Transfer Cart Empty",

        message:
          "Add at least one item before continuing.",
      });

      return;
    }


    if (!destination) {
      setValidation({
        title:
          "Destination Required",

        message:
          "Choose the branch receiving this transfer.",
      });

      return;
    }


    setReviewOpen(
      true
    );
  }


  /* ==========================================================
     SUBMIT
  ========================================================== */

  async function submitTransfer() {
    if (
      submitting
    ) {
      return;
    }


    try {
      setSubmitting(
        true
      );


      const response =
        await fetch(
          "/api/staff/bart/stock-transfer/create",
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

                reason,

                cart:
                  cart.map(
                    (entry) => ({
                      item:
                        entry.item,

                      sku:
                        entry.sku,

                      qty:
                        entry.qty,

                      uom:
                        entry.uom,
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
          result.insufficient
        ) {
          setValidation({
            title:
              "Insufficient Stock",

            message:
              "The origin branch does not have enough stock for some items.",

            items:
              result.items?.map(
                (item) =>
                  `${item.item}: have ${item.have}, need ${item.need}`
              ),
          });


          setReviewOpen(
            false
          );

          return;
        }


        if (
          result.missingItems
        ) {
          setValidation({
            title:
              "Item Mapping Error",

            message:
              "Some items are missing from one of the Stocks sheets.",

            items: [
              ...(
                result.originMissing ||
                []
              ).map(
                (item) =>
                  `Origin: ${item}`
              ),

              ...(
                result.destinationMissing ||
                []
              ).map(
                (item) =>
                  `Destination: ${item}`
              ),
            ],
          });


          setReviewOpen(
            false
          );

          return;
        }


        throw new Error(
          result.message ||
            "Transfer failed."
        );
      }


      setSuccess(
        result
      );


      setReviewOpen(
        false
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


    } catch (err) {
      setValidation({
        title:
          "Transfer Failed",

        message:
          err.message ||
          "Unable to complete transfer.",
      });

    } finally {
      setSubmitting(
        false
      );
    }
  }


  /* ==========================================================
     HISTORY
  ========================================================== */

  async function loadHistory(
    reset = false
  ) {
    if (
      historyLoading
    ) {
      return;
    }


    const offset =
      reset
        ? 0
        : history.length;


    try {
      setHistoryLoading(
        true
      );


      const response =
        await fetch(
          `/api/staff/bart/stock-transfer/history?branch=${encodeURIComponent(
            branch.code
          )}&limit=3&offset=${offset}`,
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
            "Unable to load transfer history."
        );
      }


      setHistoryTotal(
        result.total ||
        0
      );


      setHistory(
        (current) =>
          reset
            ? result.transfers ||
              []
            : [
                ...current,
                ...(
                  result.transfers ||
                  []
                ),
              ]
      );


    } catch (err) {
      setValidation({
        title:
          "History Error",

        message:
          err.message,
      });

    } finally {
      setHistoryLoading(
        false
      );
    }
  }


  async function openHistory() {
    setHistoryOpen(
      true
    );

    await loadHistory(
      true
    );
  }


  /* ==========================================================
     SUCCESS RETURN
  ========================================================== */

  useEffect(() => {
    if (!success) {
      return;
    }


    const timer =
      window.setTimeout(
        () => {
          onBack?.();
        },
        5000
      );


    return () =>
      window.clearTimeout(
        timer
      );

  }, [
    success,
    onBack,
  ]);


  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    loading &&
    !data
  ) {
    return (
      <div className="bst-page">
        <div className="bst-loading">

          <motion.div
            animate={{
              y: [
                0,
                -10,
                0,
              ],
            }}
            transition={{
              duration:
                1.2,

              repeat:
                Infinity,
            }}
          >
            <Truck
              size={44}
            />
          </motion.div>

          <h2>
            Preparing Transfer Network
          </h2>

          <p>
            Loading branches and inventory…
          </p>

        </div>
      </div>
    );
  }


  return (
    <div className="bst-page">

      <div className="bst-grid-bg" />

      <div className="bst-orb bst-orb-one" />

      <div className="bst-orb bst-orb-two" />


      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="bst-header">

        <button
          type="button"
          className="bst-back"
          onClick={
            onBack
          }
        >
          <ArrowLeft
            size={16}
          />

          STAFF DASHBOARD
        </button>


        <div className="bst-brand">

          <div>
            <Truck
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
          className="bst-history-button"
          onClick={
            openHistory
          }
        >
          <History
            size={15}
          />

          HISTORY
        </button>

      </header>


      <main className="bst-main">

        {/* ===================================================
            HERO
        =================================================== */}

        <motion.section
          className="bst-hero"
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
        >

          <div>

            <div className="bst-eyebrow">
              <Sparkles
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
              Build a transfer, verify stock and transmit inventory securely through the BART network.
            </p>

          </div>


          <div className="bst-origin-card">

            <small>
              ORIGIN BRANCH
            </small>


            <div className="bst-origin-icon">
              <MapPin
                size={17}
              />
            </div>


            <h2>
              {branch?.name}
            </h2>


            <strong>
              {branch?.code}
            </strong>


            <div className="bst-date-chip">

              <Clock3
                size={13}
              />

              STOCK DATE

              <b>
                {
                  data?.targetDate
                }
              </b>

            </div>

          </div>

        </motion.section>


        {!data?.dateAvailable && (

          <div className="bst-warning">

            <AlertTriangle
              size={18}
            />

            Yesterday's stock column ({data?.targetDate}) was not found. A transfer cannot be completed until that stock date exists.

          </div>

        )}


        {error && (

          <div className="bst-warning">

            <CircleAlert
              size={18}
            />

            {error}

          </div>

        )}


        {/* ===================================================
            CATEGORY / SEARCH
        =================================================== */}

        <section className="bst-toolbar">

          <div className="bst-category-switch">

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

                setSelectedItem(
                  null
                );

              }}
            >
              DAILY ITEMS
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

                setSelectedItem(
                  null
                );

              }}
            >
              WEEKLY ITEMS
            </button>

          </div>


          <div className="bst-search">

            <Search
              size={15}
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
                  event.target
                    .value
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
                  size={14}
                />
              </button>

            )}

          </div>

        </section>


        {/* ===================================================
            INVENTORY
        =================================================== */}

        <section className="bst-section">

          <div className="bst-section-title">

            <div>
              <span>
                01 / INVENTORY
              </span>

              <h2>
                Select an item
              </h2>
            </div>


            <strong>
              {visibleItems.length} ITEMS
            </strong>

          </div>


          <div className="bst-items-grid">

            <AnimatePresence>

              {visibleItems.map(
                (
                  item,
                  index
                ) => {

                  const selected =
                    selectedItem
                      ?.name ===
                    item.name;


                  return (

                    <motion.button
                      type="button"
                      key={
                        item.name
                      }
                      className={
                        `bst-item ${
                          selected
                            ? "selected"
                            : ""
                        }`
                      }
                      onClick={() => {

                        setSelectedItem(
                          item
                        );

                        setQuantity(
                          1
                        );

                      }}
                      initial={{
                        opacity:
                          0,

                        y:
                          14,
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
                      transition={{
                        delay:
                          Math.min(
                            index *
                              0.012,
                            0.25
                          ),
                      }}
                    >

                      <div className="bst-item-top">

                        <span>
                          {item.sku ||
                            "ITEM"}
                        </span>


                        {selected && (

                          <motion.div
                            initial={{
                              scale:
                                0,
                            }}
                            animate={{
                              scale:
                                1,
                            }}
                          >
                            <Check
                              size={13}
                            />
                          </motion.div>

                        )}

                      </div>


                      <h3>
                        {item.name}
                      </h3>


                      <div className="bst-item-bottom">

                        <span>
                          {item.uom ||
                            "UNITS"}
                        </span>


                        <strong>
                          {
                            item.available
                          }

                          <small>
                            AVAILABLE
                          </small>
                        </strong>

                      </div>

                    </motion.button>

                  );
                }
              )}

            </AnimatePresence>

          </div>

        </section>


        {/* ===================================================
            ADD ITEM
        =================================================== */}

        <AnimatePresence>

          {selectedItem && (

            <motion.section
              className="bst-add-panel"
              initial={{
                opacity:
                  0,

                y:
                  18,

                scale:
                  0.985,
              }}
              animate={{
                opacity:
                  1,

                y:
                  0,

                scale:
                  1,
              }}
              exit={{
                opacity:
                  0,

                y:
                  10,
              }}
            >

              <div className="bst-add-selected">

                <small>
                  SELECTED ITEM
                </small>

                <strong>
                  {
                    selectedItem.name
                  }
                </strong>

                <span>
                  {selectedItem.sku} ·{" "}
                  {selectedItem.uom}
                </span>

              </div>


              <div className="bst-quantity-control">

                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      (value) =>
                        Math.max(
                          1,
                          Number(
                            value
                          ) - 1
                        )
                    )
                  }
                >
                  <Minus
                    size={16}
                  />
                </button>


                <input
                  inputMode="numeric"
                  value={
                    quantity
                  }
                  onChange={(
                    event
                  ) => {

                    const value =
                      event.target.value
                        .replace(
                          /[^0-9]/g,
                          ""
                        );


                    setQuantity(
                      value
                        ? Number(
                            value
                          )
                        : 1
                    );

                  }}
                />


                <span>
                  {
                    selectedItem.uom
                  }
                </span>


                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      (value) =>
                        Number(
                          value
                        ) + 1
                    )
                  }
                >
                  <Plus
                    size={16}
                  />
                </button>

              </div>


              <motion.button
                type="button"
                className="bst-add-cart"
                whileTap={{
                  scale:
                    0.98,
                }}
                onClick={
                  addToCart
                }
              >

                <ShoppingCart
                  size={16}
                />

                ADD TO TRANSFER

              </motion.button>

            </motion.section>

          )}

        </AnimatePresence>


        {/* ===================================================
            CART
        =================================================== */}

        <section className="bst-section">

          <div className="bst-section-title">

            <div>
              <span>
                02 / TRANSFER CART
              </span>

              <h2>
                Current Transfer List
              </h2>
            </div>


            <strong>
              {cart.length} ITEMS
            </strong>

          </div>


          {cart.length ===
          0 ? (

            <div className="bst-empty-cart">

              <ShoppingCart
                size={24}
              />

              <strong>
                Your transfer is empty
              </strong>

              <span>
                Select stock items above to begin.
              </span>

            </div>

          ) : (

            <div className="bst-cart">

              {cart.map(
                (entry) => (

                  <motion.div
                    className="bst-cart-row"
                    key={
                      entry.item
                    }
                    layout
                  >

                    <div className="bst-cart-product">

                      <div>
                        <Package
                          size={16}
                        />
                      </div>


                      <span>

                        <small>
                          {
                            entry.sku
                          }
                        </small>

                        <strong>
                          {
                            entry.item
                          }
                        </strong>

                      </span>

                    </div>


                    <div className="bst-cart-quantity">

                      <button
                        type="button"
                        onClick={() =>
                          changeCartQty(
                            entry.item,
                            -1
                          )
                        }
                      >
                        <Minus
                          size={13}
                        />
                      </button>


                      <strong>
                        {
                          entry.qty
                        }

                        <small>
                          {
                            entry.uom
                          }
                        </small>
                      </strong>


                      <button
                        type="button"
                        onClick={() =>
                          changeCartQty(
                            entry.item,
                            1
                          )
                        }
                      >
                        <Plus
                          size={13}
                        />
                      </button>

                    </div>


                    <div className="bst-cart-available">

                      <small>
                        AVAILABLE
                      </small>

                      <strong>
                        {
                          entry.available
                        }
                      </strong>

                    </div>


                    <button
                      type="button"
                      className="bst-cart-delete"
                      onClick={() =>
                        removeCartItem(
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

          )}

        </section>


        {/* ===================================================
            DESTINATION
        =================================================== */}

        {cart.length >
          0 && (

          <section className="bst-finalize">

            <div className="bst-section-title">

              <div>
                <span>
                  03 / DESTINATION
                </span>

                <h2>
                  Finalize Transfer
                </h2>
              </div>

            </div>


            <div className="bst-route-panel">

              <div className="bst-route-node">

                <small>
                  ORIGIN
                </small>

                <strong>
                  {
                    data?.origin
                      ?.name
                  }
                </strong>

                <span>
                  {
                    data?.origin
                      ?.code
                  }
                </span>

              </div>


              <div className="bst-route-motion">

                <motion.div
                  animate={{
                    x: [
                      -8,
                      8,
                      -8,
                    ],
                  }}
                  transition={{
                    repeat:
                      Infinity,

                    duration:
                      2.2,
                  }}
                >
                  <ArrowRight
                    size={22}
                  />
                </motion.div>

              </div>


              <div className="bst-route-node destination">

                <small>
                  DESTINATION
                </small>


                <div className="bst-select-wrap">

                  <select
                    value={
                      destination
                    }
                    onChange={(
                      event
                    ) =>
                      setDestination(
                        event.target
                          .value
                      )
                    }
                  >

                    <option value="">
                      Choose a branch...
                    </option>


                    {data?.destinations
                      ?.map(
                        (target) => (

                          <option
                            value={
                              target.code
                            }
                            key={
                              target.code
                            }
                          >
                            {
                              target.label
                            }
                          </option>

                        )
                      )}

                  </select>


                  <ChevronDown
                    size={15}
                  />

                </div>

              </div>

            </div>


            <div className="bst-reason">

              <label>
                REASON / TRANSFER REFERENCE
              </label>


              <textarea
                value={
                  reason
                }
                placeholder="Example: 11 Aug 2026 Time: 02:52:00"
                onChange={(
                  event
                ) =>
                  setReason(
                    event.target
                      .value
                  )
                }
              />

            </div>


            <motion.button
              type="button"
              className="bst-review-button"
              disabled={
                !data
                  ?.dateAvailable
              }
              onClick={
                openReview
              }
              whileTap={{
                scale:
                  0.99,
              }}
            >

              REVIEW TRANSFER

              <ArrowRight
                size={17}
              />

            </motion.button>

          </section>

        )}

      </main>


      {/* =====================================================
          REVIEW MODAL
      ===================================================== */}

      <AnimatePresence>

        {reviewOpen && (

          <motion.div
            className="bst-modal-overlay"
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
              className="bst-review-modal"
              initial={{
                opacity:
                  0,

                scale:
                  0.92,

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
                type="button"
                className="bst-modal-x"
                disabled={
                  submitting
                }
                onClick={() =>
                  setReviewOpen(
                    false
                  )
                }
              >
                <X
                  size={18}
                />
              </button>


              <div className="bst-modal-icon">

                <Send
                  size={24}
                />

              </div>


              <span className="bst-modal-label">
                FINAL AUTHORIZATION
              </span>


              <h2>
                Review Transfer
              </h2>


              <div className="bst-review-route">

                <div>
                  <small>
                    FROM
                  </small>

                  <strong>
                    {
                      data?.origin
                        ?.label
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
                      data?.destinations
                        ?.find(
                          (item) =>
                            item.code ===
                            destination
                        )
                        ?.label
                    }
                  </strong>
                </div>

              </div>


              <div className="bst-review-items">

                {cart.map(
                  (entry) => (

                    <div
                      key={
                        entry.item
                      }
                    >

                      <span>
                        {
                          entry.item
                        }
                      </span>

                      <strong>
                        {
                          entry.qty
                        }{" "}
                        {
                          entry.uom
                        }
                      </strong>

                    </div>

                  )
                )}

              </div>


              <div className="bst-review-reason">

                <small>
                  REASON
                </small>

                <strong>
                  {
                    reason ||
                    "No reason entered"
                  }
                </strong>

              </div>


              <div className="bst-review-note">

                <AlertTriangle
                  size={15}
                />

                The backend will verify live Google stock again before any inventory is moved.

              </div>


              <div className="bst-review-actions">

                <button
                  type="button"
                  disabled={
                    submitting
                  }
                  onClick={() =>
                    setReviewOpen(
                      false
                    )
                  }
                >
                  EDIT
                </button>


                <button
                  type="button"
                  className="confirm"
                  disabled={
                    submitting
                  }
                  onClick={
                    submitTransfer
                  }
                >

                  {submitting ? (

                    <LoaderCircle
                      size={17}
                      className="dam-spin"
                    />

                  ) : (

                    <Send
                      size={17}
                    />

                  )}


                  {submitting
                    ? "TRANSMITTING..."
                    : "CONFIRM & SEND"}

                </button>

              </div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* =====================================================
          VALIDATION
      ===================================================== */}

      <AnimatePresence>

        {validation && (

          <motion.div
            className="bst-modal-overlay"
            initial={{
              opacity:
                0,
            }}
            animate={{
              opacity:
                1,
            }}
          >

            <motion.div
              className="bst-validation-modal"
              initial={{
                scale:
                  0.92,

                opacity:
                  0,
              }}
              animate={{
                scale:
                  1,

                opacity:
                  1,
              }}
            >

              <div className="bst-validation-icon">

                <CircleAlert
                  size={26}
                />

              </div>


              <h2>
                {
                  validation.title
                }
              </h2>


              <p>
                {
                  validation.message
                }
              </p>


              {validation.items
                ?.length >
                0 && (

                <div className="bst-validation-items">

                  {validation.items.map(
                    (
                      item,
                      index
                    ) => (

                      <span
                        key={
                          index
                        }
                      >
                        {item}
                      </span>

                    )
                  )}

                </div>

              )}


              <button
                type="button"
                onClick={() =>
                  setValidation(
                    null
                  )
                }
              >
                CLOSE
              </button>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* =====================================================
          HISTORY
      ===================================================== */}

      <AnimatePresence>

        {historyOpen && (

          <motion.div
            className="bst-history-panel"
            initial={{
              x:
                "100%",
            }}
            animate={{
              x:
                0,
            }}
            exit={{
              x:
                "100%",
            }}
            transition={{
              type:
                "spring",

              stiffness:
                240,

              damping:
                28,
            }}
          >

            <div className="bst-history-header">

              <div>
                <span>
                  TRANSFER NETWORK
                </span>

                <h2>
                  Transfer History
                </h2>
              </div>


              <button
                type="button"
                onClick={() =>
                  setHistoryOpen(
                    false
                  )
                }
              >
                <X
                  size={18}
                />
              </button>

            </div>


            {history.length ===
              0 &&
            !historyLoading ? (

              <div className="bst-history-empty">
                No transfer records found.
              </div>

            ) : (

              <div className="bst-history-list">

                {history.map(
                  (transfer) => (

                    <div
                      className="bst-history-card"
                      key={
                        transfer.id
                      }
                    >

                      <div className="bst-history-card-top">

                        <strong>
                          {
                            transfer.id
                          }
                        </strong>


                        <span
                          className={
                            `bst-status ${statusClass(
                              transfer.status
                            )}`
                          }
                        >
                          {
                            transfer.status
                          }
                        </span>

                      </div>


                      <div className="bst-history-route">

                        <span>
                          {
                            transfer.origin
                          }
                        </span>

                        <ArrowRight
                          size={13}
                        />

                        <span>
                          {
                            transfer.destination
                          }
                        </span>

                      </div>


                      <p>
                        {
                          String(
                            transfer.items ||
                            ""
                          )
                            .replace(
                              /â€¢/g,
                              "•"
                            )
                        }
                      </p>


                      <small>
                        {
                          transfer.updated_at
                        }
                      </small>

                    </div>

                  )
                )}

              </div>

            )}


            {history.length <
              historyTotal && (

              <button
                type="button"
                className="bst-load-more"
                disabled={
                  historyLoading
                }
                onClick={() =>
                  loadHistory(
                    false
                  )
                }
              >

                {historyLoading ? (

                  <LoaderCircle
                    size={15}
                    className="dam-spin"
                  />

                ) : (

                  <Plus
                    size={15}
                  />

                )}

                LOAD MORE

              </button>

            )}

          </motion.div>

        )}

      </AnimatePresence>


      {/* =====================================================
          SUCCESS
      ===================================================== */}

      <AnimatePresence>

        {success && (

          <motion.div
            className="bst-success-overlay"
            initial={{
              opacity:
                0,
            }}
            animate={{
              opacity:
                1,
            }}
          >

            <motion.div
              className="bst-success-card"
              initial={{
                opacity:
                  0,

                scale:
                  0.75,

                y:
                  45,
              }}
              animate={{
                opacity:
                  1,

                scale:
                  1,

                y:
                  0,
              }}
              transition={{
                type:
                  "spring",

                stiffness:
                  210,

                damping:
                  18,
              }}
            >

              <motion.div
                className="bst-success-icon"
                initial={{
                  scale:
                    0,
                }}
                animate={{
                  scale:
                    1,
                }}
                transition={{
                  delay:
                    0.15,

                  type:
                    "spring",
                }}
              >

                <CheckCircle2
                  size={54}
                />

              </motion.div>


              <span>
                TRANSFER TRANSMITTED
              </span>


              <h1>
                Transfer Successful
              </h1>


              <p>
                Stock movement completed and the receiving branch has been notified.
              </p>


              <div className="bst-success-id">

                <small>
                  TRANSFER ID
                </small>

                <strong>
                  {
                    success.transferId
                  }
                </strong>

              </div>


              <div className="bst-success-route">

                <span>
                  {
                    success.origin
                  }
                </span>

                <ArrowRight
                  size={16}
                />

                <span>
                  {
                    success.destination
                  }
                </span>

              </div>


              <small className="bst-success-return">
                Returning to Staff Dashboard…
              </small>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>

    </div>
  );
}
