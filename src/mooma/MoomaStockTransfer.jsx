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

import "./Mooma.css";


/* ============================================================
   MOOMA STOCK TRANSFER
   ============================================================

   EXISTING BACKEND ROUTES:

   GET  /api/mooma/stock-transfer/init
   POST /api/mooma/stock-transfer/create
   GET  /api/mooma/stock-transfer/history

   Stock quantity source:
   GET  /api/mooma/stock-view

   Incoming processing remains in Dashboard:
   GET  /api/mooma/pending-transfers
   POST /api/mooma/transfer/respond
============================================================ */


const API = {
  init:
    "/api/mooma/stock-transfer/init",

  create:
    "/api/mooma/stock-transfer/create",

  history:
    "/api/mooma/stock-transfer/history",

  stock:
    "/api/mooma/stock-view",
};


/* ============================================================
   HELPERS
============================================================ */

function clean(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function numberValue(
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


function formatNumber(
  value
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits:
        3,
    }
  ).format(
    numberValue(
      value
    )
  );
}


function statusClass(
  value
) {
  return clean(
    value
  )
    .toLowerCase()
    .replace(
      /\s+/g,
      "-"
    );
}


/* ============================================================
   RIYADH YESTERDAY

   Backend transfer stock movement
   currently uses yesterday's stock.
============================================================ */

function getRiyadhYesterday() {

  const parts =
    Object.fromEntries(
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Riyadh",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      )
        .formatToParts(
          new Date()
        )
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );


  const date =
    new Date(
      `${parts.year}-${parts.month}-${parts.day}T12:00:00Z`
    );


  date.setUTCDate(
    date.getUTCDate() -
      1
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


/* ============================================================
   DATE DISPLAY
============================================================ */

function prettyDate(
  value
) {

  if (!value) {
    return "—";
  }


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {

    const [
      year,
      month,
      day,
    ] =
      value
        .split("-")
        .map(Number);


    return new Date(
      year,
      month - 1,
      day
    ).toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",
      }
    );
  }


  return value;
}


/* ============================================================
   SCROLL
============================================================ */

function activeScroll(
  ref,
  block = "start"
) {

  window.requestAnimationFrame(
    () => {

      window.setTimeout(
        () => {

          ref?.current
            ?.scrollIntoView({
              behavior:
                "smooth",

              block,
            });

        },
        90
      );

    }
  );
}


/* ============================================================
   FETCH JSON
============================================================ */

async function getJSON(
  url
) {

  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );


  const raw =
    await response.text();


  let data;


  try {

    data =
      raw
        ? JSON.parse(
            raw
          )
        : {};

  } catch {

    throw new Error(
      "MOOMA server returned invalid data."
    );
  }


  if (
    !response.ok ||
    data?.success === false
  ) {

    throw new Error(
      data?.message ||
        `Request failed. HTTP ${response.status}`
    );
  }


  return data;
}


async function postJSON(
  url,
  body
) {

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        cache:
          "no-store",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),
      }
    );


  const raw =
    await response.text();


  let data;


  try {

    data =
      raw
        ? JSON.parse(
            raw
          )
        : {};

  } catch {

    throw new Error(
      "MOOMA server returned invalid data."
    );
  }


  if (
    !response.ok ||
    data?.success === false
  ) {

    throw new Error(
      data?.message ||
        `Request failed. HTTP ${response.status}`
    );
  }


  return data;
}


/* ============================================================
   STOCK VIEW HELPERS

   Backend stock-view returns:
   {
     daily: [...],
     weekly: [...]
   }

   We use yesterday's column as AVAILABLE.
============================================================ */

function getStockItemName(
  row
) {

  return clean(
    row?.Item ||
      row?.ITEM ||
      row?.item ||
      row?.[
        "Item Name"
      ] ||
      ""
  );
}


function getStockSku(
  row
) {

  return clean(
    row?.SKU ||
      row?.Sku ||
      row?.sku ||
      row?.[
        "Item Code"
      ] ||
      ""
  );
}


function getStockUom(
  row
) {

  return clean(
    row?.[
      "DATE-> UOM"
    ] ||
      row?.[
        "DATE->UOM"
      ] ||
      row?.UOM ||
      row?.Uom ||
      row?.uom ||
      row?.Unit ||
      ""
  );
}


/* ============================================================
   BUILD AVAILABLE STOCK MAP
============================================================ */

function buildAvailableMap(
  stockData,
  targetDate
) {

  const map =
    new Map();


  const rows = [
    ...(
      stockData
        ?.daily ||
      []
    ),

    ...(
      stockData
        ?.weekly ||
      []
    ),
  ];


  for (
    const row of rows
  ) {

    const name =
      getStockItemName(
        row
      );


    const sku =
      getStockSku(
        row
      );


    const uom =
      getStockUom(
        row
      );


    const available =
      numberValue(
        row?.[
          targetDate
        ]
      );


    const entry = {
      name,
      sku,
      uom,
      available,
    };


    if (sku) {

      map.set(
        `sku:${sku.toUpperCase()}`,
        entry
      );
    }


    if (name) {

      map.set(
        `name:${name.toUpperCase()}`,
        entry
      );
    }
  }


  return map;
}


/* ============================================================
   TRANSFER LOADER

   MOOMA ANIMATION:
   package travels between branch nodes.
============================================================ */

function TransferLoader({
  branch,
}) {

  return (

    <div className="mst-loading-page">

      <div className="mst-loading-grid" />


      <motion.div
        className="mst-loading-system"

        initial={{
          opacity:
            0,

          scale:
            0.94,
        }}

        animate={{
          opacity:
            1,

          scale:
            1,
        }}
      >

        <span className="mst-loader-kicker">
          MOOMA INTERNAL NETWORK
        </span>


        <h2>
          Preparing Transfer Center
        </h2>


        <p>

          Verifying live inventory for{" "}

          <strong>

            {branch?.name ||
              branch?.code ||
              "MOOMA"}

          </strong>

        </p>


        <div className="mst-loader-route">


          <div className="mst-loader-node">

            <MapPin
              size={18}
            />

            <small>
              ORIGIN
            </small>

            <strong>

              {branch?.code ||
                "MOOMA"}

            </strong>

          </div>


          <div className="mst-loader-track">

            <span />


            <motion.div
              className="mst-loader-package"

              animate={{
                left: [
                  "0%",
                  "85%",
                  "0%",
                ],

                rotate: [
                  0,
                  8,
                  0,
                ],
              }}

              transition={{
                duration:
                  1.8,

                repeat:
                  Infinity,

                ease:
                  "easeInOut",
              }}
            >

              <Package
                size={18}
              />

            </motion.div>

          </div>


          <div className="mst-loader-node">

            <MapPin
              size={18}
            />

            <small>
              NETWORK
            </small>

            <strong>
              DEST.
            </strong>

          </div>

        </div>


        <motion.div
          className="mst-loader-status"

          animate={{
            opacity: [
              0.4,
              1,
              0.4,
            ],
          }}

          transition={{
            duration:
              0.8,

            repeat:
              Infinity,
          }}
        >

          <span />

          SYNCING STOCK DATA

        </motion.div>

      </motion.div>

    </div>
  );
}


/* ============================================================
   SUCCESS MODAL
============================================================ */

function TransferSuccess({
  transfer,
  origin,
  destination,
  onClose,
}) {

  if (!transfer) {
    return null;
  }


  return (

    <motion.div
      className="mst-modal-overlay"

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
        className="mst-success-modal"

        initial={{
          opacity:
            0,

          scale:
            0.86,

          y:
            35,
        }}

        animate={{
          opacity:
            1,

          scale:
            1,

          y:
            0,
        }}

        exit={{
          opacity:
            0,

          scale:
            0.94,
        }}

        transition={{
          type:
            "spring",

          stiffness:
            150,

          damping:
            16,
        }}
      >

        <div className="mst-success-route-animation">


          <div className="mst-success-node">

            <MapPin
              size={18}
            />

            <strong>
              {origin?.code}
            </strong>

          </div>


          <div className="mst-success-line">

            <span />


            <motion.div
              initial={{
                left:
                  "0%",

                scale:
                  0.7,
              }}

              animate={{
                left:
                  "82%",

                scale:
                  1,
              }}

              transition={{
                duration:
                  0.9,

                ease:
                  "easeInOut",
              }}
            >

              <Package
                size={20}
              />

            </motion.div>

          </div>


          <div className="mst-success-node destination">

            <Check
              size={18}
            />

            <strong>
              {destination?.code}
            </strong>

          </div>

        </div>


        <motion.div
          className="mst-success-check"

          initial={{
            scale: 0,
          }}

          animate={{
            scale: [
              0,
              1.2,
              1,
            ],
          }}

          transition={{
            delay:
              0.85,

            duration:
              0.4,
          }}
        >

          <Check
            size={30}
          />

        </motion.div>


        <span>
          MOOMA STOCK TRANSFER
        </span>


        <h2>
          Transfer Sent
        </h2>


        <p>
          Inventory has been moved and is now waiting for destination branch confirmation.
        </p>


        <div className="mst-success-id">

          <small>
            TRANSFER ID
          </small>


          <strong>

            {transfer?.id ||
              transfer?.transferId ||
              "TRANSFER CREATED"}

          </strong>

        </div>


        <div className="mst-success-route-text">

          <strong>

            {origin?.code}

          </strong>


          <ArrowRight
            size={15}
          />


          <strong>

            {destination?.code}

          </strong>

        </div>


        <button
          type="button"

          onClick={
            onClose
          }
        >

          RETURN TO TRANSFER CENTER

          <ArrowRight
            size={15}
          />

        </button>

      </motion.div>

    </motion.div>
  );
}


/* ============================================================
   HISTORY PANEL
============================================================ */

function HistoryPanel({
  rows,
  loading,
  onRefresh,
}) {

  return (

    <motion.section
      className="mst-history"

      initial={{
        opacity:
          0,

        y:
          -15,
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
          -10,
      }}
    >

      <div className="mst-history-head">

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

          disabled={
            loading
          }

          onClick={
            onRefresh
          }
        >

          <RefreshCcw
            size={14}

            className={
              loading
                ? "mst-spin"
                : ""
            }
          />


          REFRESH

        </button>

      </div>


      {loading &&
      rows.length ===
        0 ? (

        <div className="mst-history-empty">

          <LoaderCircle
            size={22}
            className="mst-spin"
          />

          LOADING HISTORY

        </div>

      ) : rows.length ===
        0 ? (

        <div className="mst-history-empty">

          <History
            size={27}
          />

          NO TRANSFERS FOUND

        </div>

      ) : (

        <div className="mst-history-list">

          {rows.map(
            (
              transfer,
              index
            ) => (

              <motion.div
                className="mst-history-row"

                key={
                  transfer?.id ||
                  index
                }

                initial={{
                  opacity:
                    0,

                  x:
                    -10,
                }}

                animate={{
                  opacity:
                    1,

                  x:
                    0,
                }}

                transition={{
                  delay:
                    Math.min(
                      index *
                        0.04,
                      0.25
                    ),
                }}
              >

                <div className="mst-history-index">

                  {String(
                    index +
                      1
                  ).padStart(
                    2,
                    "0"
                  )}

                </div>


                <div className="mst-history-info">

                  <strong>

                    {transfer?.id ||
                      "TRANSFER"}

                  </strong>


                  <span>

                    {transfer?.origin ||
                      "—"}

                    {" → "}

                    {transfer?.destination ||
                      "—"}

                  </span>


                  {transfer?.reason && (

                    <small>

                      {transfer.reason}

                    </small>

                  )}

                </div>


                <span
                  className={
                    `mst-history-status ${
                      statusClass(
                        transfer?.status
                      )
                    }`
                  }
                >

                  {transfer?.status ||
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

export default function MoomaStockTransfer({
  branch,
  onBack,
}) {

  const branchCode =
    clean(
      branch?.code ||
        branch?.branchCode
    ).toUpperCase();


  const branchName =
    clean(
      branch?.name ||
        branch?.branchName
    ) ||
    "MOOMA BRANCH";


  const targetDate =
    getRiyadhYesterday();


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
    stockData,
    setStockData,
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
     TOP ON OPEN
  ========================================================== */

  useEffect(
    () => {

      window.scrollTo({
        top:
          0,

        behavior:
          "auto",
      });

    },
    []
  );


  /* ==========================================================
     LOAD TRANSFER DATA
  ========================================================== */

  async function loadTransferData(
    force = false
  ) {

    if (!branchCode) {

      setMessage({
        type:
          "error",

        text:
          "MOOMA branch code is missing.",
      });

      setLoading(
        false
      );

      return;
    }


    try {

      if (force) {

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


      /*
       * Load transfer structure and
       * stock quantities together.
       */

      const [
        initResult,
        stockResult,
      ] =
        await Promise.all([
          getJSON(
            `${API.init}?branch=${encodeURIComponent(
              branchCode
            )}`
          ),

          getJSON(
            `${API.stock}?branch=${encodeURIComponent(
              branchCode
            )}`
          ),
        ]);


      setData(
        initResult
      );


      setStockData(
        stockResult?.stock ||
          {
            daily:
              [],

            weekly:
              [],
          }
      );


    } catch (
      error
    ) {

      console.error(
        "[MOOMA TRANSFER LOAD]",
        error
      );


      setMessage({
        type:
          "error",

        text:
          error?.message ||
          "Unable to load MOOMA transfer system.",
      });


      activeScroll(
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
      branchCode,
    ]
  );


  /* ==========================================================
     LIVE AVAILABLE MAP
  ========================================================== */

  const availableMap =
    useMemo(
      () =>
        buildAvailableMap(
          stockData,
          targetDate
        ),

      [
        stockData,
        targetDate,
      ]
    );


  /* ==========================================================
     INVENTORY WITH AVAILABLE QTY
  ========================================================== */

  const inventory =
    useMemo(
      () => {

        const source =
          category ===
          "weekly"
            ? data
                ?.items
                ?.weekly ||
              []
            : data
                ?.items
                ?.daily ||
              [];


        return source.map(
          (
            item
          ) => {

            const sku =
              clean(
                item?.sku
              );


            const name =
              clean(
                item?.name
              );


            const matched =
              (
                sku &&
                availableMap.get(
                  `sku:${sku.toUpperCase()}`
                )
              ) ||
              (
                name &&
                availableMap.get(
                  `name:${name.toUpperCase()}`
                )
              );


            return {
              ...item,

              name,

              sku,

              uom:
                clean(
                  item?.uom
                ) ||
                matched?.uom ||
                "",

              available:
                matched
                  ?.available ??
                0,
            };
          }
        );
      },

      [
        category,
        data,
        availableMap,
      ]
    );


  /* ==========================================================
     SEARCH
  ========================================================== */

  const visibleItems =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        if (!query) {

          return inventory;
        }


        return inventory.filter(
          (
            item
          ) =>
            `${item.name || ""} ${item.sku || ""} ${item.uom || ""}`
              .toLowerCase()
              .includes(
                query
              )
        );
      },

      [
        inventory,
        search,
      ]
    );


  /* ==========================================================
     CART LOOKUP
  ========================================================== */

  function cartEntryFor(
    item
  ) {

    return cart.find(
      (
        entry
      ) =>
        entry.key ===
        (
          item.sku ||
          item.name
        )
    );
  }


  /* ==========================================================
     ADD ITEM
  ========================================================== */

  function addItem(
    item
  ) {

    const available =
      numberValue(
        item.available
      );


    if (
      available <= 0
    ) {

      setMessage({
        type:
          "error",

        text:
          `${item.name} has no available stock for ${prettyDate(
            targetDate
          )}.`,
      });


      activeScroll(
        messageRef,
        "center"
      );


      return;
    }


    const key =
      item.sku ||
      item.name;


    setMessage(
      null
    );


    setCart(
      (
        current
      ) => {

        const existing =
          current.find(
            (
              entry
            ) =>
              entry.key ===
              key
          );


        if (existing) {

          return current.map(
            (
              entry
            ) =>
              entry.key ===
              key
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
            key,

            name:
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


    activeScroll(
      cartRef,
      "center"
    );
  }


  /* ==========================================================
     CHANGE QTY
  ========================================================== */

  function changeQty(
    key,
    nextQty
  ) {

    setCart(
      (
        current
      ) =>
        current
          .map(
            (
              entry
            ) => {

              if (
                entry.key !==
                key
              ) {

                return entry;
              }


              const qty =
                Math.max(
                  0,

                  Math.min(
                    numberValue(
                      nextQty
                    ),

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
            (
              entry
            ) =>
              entry.qty >
              0
          )
    );
  }


  /* ==========================================================
     REMOVE
  ========================================================== */

  function removeItem(
    key
  ) {

    setCart(
      (
        current
      ) =>
        current.filter(
          (
            entry
          ) =>
            entry.key !==
            key
        )
    );
  }


  /* ==========================================================
     CLEAR CART
  ========================================================== */

  function clearCart() {

    setCart([]);

    setDestination("");

    setReason("");

    setMessage(null);

    activeScroll(
      inventoryRef
    );
  }


  /* ==========================================================
     HISTORY
  ========================================================== */

  async function loadHistory() {

    if (!branchCode) {
      return;
    }


    try {

      setHistoryLoading(
        true
      );


      const result =
        await getJSON(
          `${API.history}?branch=${encodeURIComponent(
            branchCode
          )}&limit=10`
        );


      setHistory(
        result
          ?.transfers ||
          []
      );


    } catch (
      error
    ) {

      setMessage({
        type:
          "error",

        text:
          error?.message ||
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
     DESTINATION OBJECT
  ========================================================== */

  const destinationBranch =
    useMemo(
      () =>
        (
          data
            ?.destinations ||
          []
        ).find(
          (
            item
          ) =>
            item.code ===
            destination
        ) ||
        null,

      [
        data,
        destination,
      ]
    );


  /* ==========================================================
     SUBMIT
  ========================================================== */

  async function submitTransfer() {

    if (submitting) {
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


      activeScroll(
        inventoryRef
      );


      return;
    }


    if (!destination) {

      setMessage({
        type:
          "error",

        text:
          "Select the destination branch.",
      });


      activeScroll(
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
          "Enter the reason or reference for this transfer.",
      });


      activeScroll(
        cartRef,
        "center"
      );


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
          "Verifying live stock and transmitting inventory...",
      });


      activeScroll(
        messageRef,
        "center"
      );


      /*
       * IMPORTANT:
       *
       * MOOMA backend expects:
       *
       * originBranch
       * destinationBranch
       * items
       * reason
       *
       * NOT BART's "cart" property.
       */

      const result =
        await postJSON(
          API.create,
          {
            originBranch:
              branchCode,

            destinationBranch:
              destination,

            reason:
              reason.trim(),

            items:
              cart.map(
                (
                  entry
                ) => ({
                  name:
                    entry.name,

                  sku:
                    entry.sku,

                  uom:
                    entry.uom,

                  qty:
                    numberValue(
                      entry.qty
                    ),
                })
              ),
          }
        );


      setMessage(
        null
      );


      setSuccess(
        result
      );


      setCart([]);

      setDestination("");

      setReason("");

      setSearch("");


      await loadTransferData(
        true
      );


      if (
        showHistory
      ) {

        await loadHistory();
      }


      window.scrollTo({
        top:
          0,

        behavior:
          "smooth",
      });


    } catch (
      error
    ) {

      setMessage({
        type:
          "error",

        text:
          error?.message ||
          "Transfer failed.",
      });


      activeScroll(
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
     INITIAL LOADING
  ========================================================== */

  if (
    loading &&
    !data
  ) {

    return (

      <TransferLoader
        branch={
          branch
        }
      />

    );
  }


  /* ==========================================================
     PAGE
  ========================================================== */

  return (

    <div className="mst-page">

      <div className="mst-grid-bg" />

      <div className="mst-glow mst-glow-one" />

      <div className="mst-glow mst-glow-two" />


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="mst-header">


        <button
          type="button"

          className="mst-back"

          onClick={() => {

            window.scrollTo({
              top:
                0,

              behavior:
                "smooth",
            });


            onBack?.();

          }}
        >

          <ArrowLeft
            size={15}
          />

          DASHBOARD

        </button>


        <div className="mst-brand">

          <div>
            M
          </div>


          <span>

            <strong>
              MOOMA
            </strong>

            STOCK TRANSFER

          </span>

        </div>


        <button
          type="button"

          className={
            `mst-history-button ${
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


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="mst-main">


        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="mst-hero">


          <motion.div
            initial={{
              opacity:
                0,

              y:
                22,
            }}

            animate={{
              opacity:
                1,

              y:
                0,
            }}
          >

            <div className="mst-kicker">

              <Truck
                size={13}
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
              Select live MOOMA stock, build the transfer and transmit inventory securely to another branch.
            </p>

          </motion.div>


          <motion.div
            className="mst-origin-card"

            initial={{
              opacity:
                0,

              x:
                20,
            }}

            animate={{
              opacity:
                1,

              x:
                0,
            }}
          >

            <small>
              ORIGIN BRANCH
            </small>


            <div className="mst-origin-icon">

              <MapPin
                size={16}
              />

            </div>


            <h2>
              {data
                ?.branch
                ?.name ||
                branchName}
            </h2>


            <strong>
              {data
                ?.branch
                ?.code ||
                branchCode}
            </strong>


            <div className="mst-date">

              <Clock3
                size={13}
              />

              STOCK DATE

              <b>

                {prettyDate(
                  targetDate
                )}

              </b>

            </div>

          </motion.div>

        </section>


        {/* ====================================================
            MESSAGE
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
                  `mst-message ${
                    message.type
                  }`
                }

                initial={{
                  opacity:
                    0,

                  y:
                    -10,
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

                {message.type ===
                "error" ? (

                  <XCircle
                    size={17}
                  />

                ) : (

                  <LoaderCircle
                    size={17}

                    className={
                      message.type ===
                      "info"
                        ? "mst-spin"
                        : ""
                    }
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

          className="mst-inventory"

          initial={{
            opacity:
              0,

            y:
              18,
          }}

          animate={{
            opacity:
              1,

            y:
              0,
          }}
        >

          <div className="mst-inventory-toolbar">


            <div className="mst-tabs">


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

                  setSearch("");

                  activeScroll(
                    inventoryRef
                  );

                }}
              >

                DAILY ITEMS

                <span>

                  {data
                    ?.items
                    ?.daily
                    ?.length ||
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

                  setSearch("");

                  activeScroll(
                    inventoryRef
                  );

                }}
              >

                WEEKLY ITEMS

                <span>

                  {data
                    ?.items
                    ?.weekly
                    ?.length ||
                    0}

                </span>

              </button>

            </div>


            <button
              type="button"

              className="mst-live-button"

              disabled={
                refreshing
              }

              onClick={() =>
                loadTransferData(
                  true
                )
              }
            >

              <RefreshCcw
                size={15}

                className={
                  refreshing
                    ? "mst-spin"
                    : ""
                }
              />


              {refreshing
                ? "REFRESHING"
                : "LIVE STOCK"}

            </button>

          </div>


          {/* ==================================================
              SEARCH
          ================================================== */}

          <div className="mst-search">

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
                  event
                    .target
                    .value
                )
              }
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


          <div className="mst-section-title">

            <div>

              <span>
                01 / INVENTORY
              </span>


              <h2>
                Select stock items
              </h2>

            </div>


            <strong>

              {visibleItems.length}

              {" "}

              ITEMS

            </strong>

          </div>


          {/* ==================================================
              ITEMS
          ================================================== */}

          {visibleItems.length ===
          0 ? (

            <div className="mst-empty">

              No matching inventory items found.

            </div>

          ) : (

            <div className="mst-inventory-grid">

              {visibleItems.map(
                (
                  item,
                  index
                ) => {

                  const available =
                    numberValue(
                      item.available
                    );


                  const selected =
                    Boolean(
                      cartEntryFor(
                        item
                      )
                    );


                  return (

                    <motion.button
                      type="button"

                      key={
                        `${category}-${item.sku}-${item.name}-${index}`
                      }

                      className={
                        `mst-stock-card ${
                          selected
                            ? "selected"
                            : ""
                        } ${
                          available <=
                          0
                            ? "empty-stock"
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
                                -4,
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

                      <div className="mst-stock-top">

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


                      <div className="mst-stock-bottom">

                        <span>

                          {item.uom ||
                            "UNIT"}

                        </span>


                        <strong>

                          {formatNumber(
                            available
                          )}

                        </strong>


                        <small>

                          AVAILABLE

                        </small>

                      </div>


                      {selected && (

                        <div className="mst-selected-pill">

                          {
                            cartEntryFor(
                              item
                            )?.qty
                          }

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
            `mst-cart ${
              cart.length >
              0
                ? "active"
                : ""
            }`
          }

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
        >

          <div className="mst-cart-head">

            <div>

              <span>
                02 / TRANSFER CART
              </span>


              <h2>
                Build movement
              </h2>

            </div>


            <div className="mst-cart-count">

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

            <div className="mst-cart-empty">

              <Package
                size={31}
              />


              <strong>
                Transfer cart is empty
              </strong>


              <p>
                Select inventory items above to begin the movement.
              </p>

            </div>

          ) : (

            <>

              <div className="mst-cart-list">

                {cart.map(
                  (
                    entry,
                    index
                  ) => (

                    <motion.div
                      className="mst-cart-row"

                      key={
                        entry.key
                      }

                      initial={{
                        opacity:
                          0,

                        x:
                          -10,
                      }}

                      animate={{
                        opacity:
                          1,

                        x:
                          0,
                      }}
                    >

                      <div className="mst-cart-index">

                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}

                      </div>


                      <div className="mst-cart-product">

                        <small>

                          {entry.sku ||
                            "NO SKU"}

                        </small>


                        <strong>

                          {entry.name}

                        </strong>


                        <span>

                          {formatNumber(
                            entry.available
                          )}

                          {" "}

                          {entry.uom}

                          {" "}

                          AVAILABLE

                        </span>

                      </div>


                      <div className="mst-qty-control">

                        <button
                          type="button"

                          onClick={() =>
                            changeQty(
                              entry.key,

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
                              entry.key,

                              event
                                .target
                                .value
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
                              entry.key,

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


                      <span className="mst-cart-uom">

                        {entry.uom ||
                          "UNIT"}

                      </span>


                      <button
                        type="button"

                        className="mst-remove"

                        onClick={() =>
                          removeItem(
                            entry.key
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

                className="mst-clear"

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

        <AnimatePresence>

          {cart.length >
            0 && (

            <motion.section
              className="mst-finalize"

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

              exit={{
                opacity:
                  0,
              }}
            >

              <div className="mst-finalize-head">

                <div>

                  <span>
                    03 / DESTINATION
                  </span>


                  <h2>
                    Where is it going?
                  </h2>

                </div>


                <Boxes
                  size={23}
                />

              </div>


              <div className="mst-finalize-grid">


                <label className="mst-field">

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
                        event
                          .target
                          .value
                      )
                    }
                  >

                    <option value="">

                      Select destination branch

                    </option>


                    {(data
                      ?.destinations ||
                      []
                    ).map(
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

                          {
                            destinationBranch.code
                          }

                          {" - "}

                          {
                            destinationBranch.name
                          }

                        </option>

                      )
                    )}

                  </select>

                </label>


                <label className="mst-field full">

                  <span>
                    REASON / REFERENCE
                  </span>


                  <textarea
                    value={
                      reason
                    }

                    placeholder="Example: Stock support for weekend operation"

                    onChange={(
                      event
                    ) =>
                      setReason(
                        event
                          .target
                          .value
                      )
                    }
                  />

                </label>

              </div>


              {/* ==============================================
                  ROUTE VISUAL
              ============================================== */}

              <div className="mst-route-preview">

                <div>

                  <small>
                    FROM
                  </small>

                  <strong>
                    {branchCode}
                  </strong>

                </div>


                <div className="mst-route-line">

                  <span />


                  <motion.div
                    animate={{
                      x: [
                        0,
                        65,
                        0,
                      ],
                    }}

                    transition={{
                      duration:
                        2,

                      repeat:
                        Infinity,

                      ease:
                        "easeInOut",
                    }}
                  >

                    <Package
                      size={15}
                    />

                  </motion.div>

                </div>


                <div>

                  <small>
                    TO
                  </small>

                  <strong>

                    {destination ||
                      "—"}

                  </strong>

                </div>

              </div>


              {/* ==============================================
                  SUMMARY
              ============================================== */}

              <div className="mst-send-summary">


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

                    {formatNumber(
                      cart.reduce(
                        (
                          total,
                          entry
                        ) =>
                          total +
                          numberValue(
                            entry.qty
                          ),

                        0
                      )
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

                  className="mst-send"

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
                        className="mst-spin"
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

        </AnimatePresence>


        <div className="mst-security-note">

          <CheckCircle2
            size={15}
          />

          Quantities are checked against the active MOOMA branch stock before transfer.

        </div>

      </main>


      {/* ======================================================
          SUCCESS
      ====================================================== */}

      <AnimatePresence>

        {success && (

          <TransferSuccess
            transfer={
              success
            }

            origin={{
              code:
                branchCode,

              name:
                branchName,
            }}

            destination={
              destinationBranch ||
              {
                code:
                  success
                    ?.destination ||
                  "DEST",
              }
            }

            onClose={() => {

              setSuccess(
                null
              );


              window.scrollTo({
                top:
                  0,

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
