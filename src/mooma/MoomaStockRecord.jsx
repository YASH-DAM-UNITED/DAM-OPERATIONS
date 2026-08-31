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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  PackageCheck,
  RefreshCcw,
  Save,
  Sparkles,
  Warehouse,
  X,
} from "lucide-react";


/* ============================================================
   MOOMA STOCK RECORD
   ------------------------------------------------------------
   Backend routes:
   GET    /api/mooma/stock-record/init
   POST   /api/mooma/stock-record/draft
   DELETE /api/mooma/stock-record/draft
   POST   /api/mooma/stock-record/submit
============================================================ */


const MODES = [
  {
    id: "daily",
    number: "01",
    title: "Daily Stock",
    label: "DAILY INVENTORY",
    description:
      "Record the branch daily stock quantities.",
    icon: PackageCheck,
  },

  {
    id: "weekly",
    number: "02",
    title: "Weekly Stock",
    label: "WEEKLY INVENTORY",
    description:
      "Complete the scheduled weekly inventory record.",
    icon: Warehouse,
  },

  {
    id: "bakery",
    number: "03",
    title: "Bakery Stock",
    label: "BAKERY INVENTORY",
    description:
      "Record bakery and production stock quantities.",
    icon: Boxes,
  },
];


/* ============================================================
   DATE
============================================================ */

function getRiyadhYesterday() {
  const formatter =
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
    );

  const parts =
    Object.fromEntries(
      formatter
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
    date.getUTCDate() - 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function prettyDate(
  value
) {
  if (!value) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] =
    value
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

      year:
        "numeric",
    }
  );
}


/* ============================================================
   REQUEST
============================================================ */

async function request(
  url,
  options = {}
) {
  let response;

  try {
    response =
      await fetch(
        url,
        {
          cache:
            "no-store",

          ...options,

          headers: {
            Accept:
              "application/json",

            ...(options.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),

            ...(options.headers ||
              {}),
          },
        }
      );
  } catch {
    throw new Error(
      "Unable to connect to MOOMA network."
    );
  }

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
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
        `MOOMA request failed. HTTP ${response.status}`
    );
  }

  return data;
}


/* ============================================================
   COMPONENT
============================================================ */

export default function MoomaStockRecord({
  branch,
  onBack,
}) {

  const branchCode =
    branch?.code ||
    branch?.branchCode ||
    "";

  const branchName =
    branch?.name ||
    branch?.branchName ||
    "MOOMA BRANCH";


  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getRiyadhYesterday()
  );


  const [
    mode,
    setMode,
  ] =
    useState(null);


  const [
    initData,
    setInitData,
  ] =
    useState(null);


  const [
    values,
    setValues,
  ] =
    useState({});


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
    reviewing,
    setReviewing,
  ] =
    useState(false);


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    success,
    setSuccess,
  ] =
    useState(null);


  const [
    validation,
    setValidation,
  ] =
    useState(null);


  const [
    draftState,
    setDraftState,
  ] =
    useState("");


  const [
    initialAnimation,
    setInitialAnimation,
  ] =
    useState(true);


  const workspaceRef =
    useRef(null);

  const reviewRef =
    useRef(null);

  const draftTimer =
    useRef(null);

  const loadedDraftRef =
    useRef(false);


  /* ==========================================================
     ACTIVE ITEMS
  ========================================================== */

  const items =
    useMemo(() => {

      if (
        !mode ||
        !initData?.items
      ) {
        return [];
      }

      return (
        initData.items[
          mode
        ] || []
      );

    }, [
      mode,
      initData,
    ]);


  /* ==========================================================
     DUPLICATE
  ========================================================== */

  const duplicate =
    mode
      ? Boolean(
          initData
            ?.duplicate?.[
              mode
            ]
        )
      : false;


  /* ==========================================================
     COMPLETION
  ========================================================== */

  const completedCount =
    useMemo(() => {

      return items.filter(
        (item) => {

          const value =
            values[
              item.row
            ];

          return (
            value !==
              undefined &&
            value !==
              null &&
            String(
              value
            ).trim() !==
              ""
          );
        }
      ).length;

    }, [
      items,
      values,
    ]);


  const progress =
    items.length
      ? Math.round(
          (
            completedCount /
            items.length
          ) *
            100
        )
      : 0;


  /* ==========================================================
     LOAD
  ========================================================== */

  async function loadStock({
    preserveMode = true,
  } = {}) {

    if (!branchCode) {
      setError(
        "MOOMA branch information is missing."
      );

      setLoading(false);

      return;
    }

    setLoading(true);

    setError("");

    loadedDraftRef.current =
      false;

    try {

      const query =
        new URLSearchParams({
          branch:
            branchCode,

          date:
            selectedDate,
        });


      const data =
        await request(
          `/api/mooma/stock-record/init?${query.toString()}`
        );


      setInitData(
        data
      );


      if (
        !preserveMode
      ) {
        setMode(null);

        setValues({});

        setReviewing(false);
      }

    } catch (err) {

      console.error(
        "[MOOMA STOCK RECORD]",
        err
      );

      setError(
        err?.message ||
          "Unable to load stock record."
      );

    } finally {

      setLoading(false);

      window.setTimeout(
        () => {
          setInitialAnimation(
            false
          );
        },
        500
      );
    }
  }


  useEffect(() => {

    loadStock({
      preserveMode:
        false,
    });

  }, [
    branchCode,
    selectedDate,
  ]);


  /* ==========================================================
     LOAD DRAFT WHEN MODE CHANGES
  ========================================================== */

  useEffect(() => {

    if (
      !mode ||
      !initData
    ) {
      return;
    }


    const saved =
      initData
        ?.drafts?.[
          mode
        ];


    const draftValues =
      saved?.values &&
      typeof saved.values ===
        "object"
        ? saved.values
        : {};


    setValues(
      draftValues
    );


    loadedDraftRef.current =
      true;


    setReviewing(false);


    window.setTimeout(
      () => {

        workspaceRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });

      },
      180
    );

  }, [
    mode,
    initData,
  ]);


  /* ==========================================================
     DRAFT AUTO SAVE
  ========================================================== */

  useEffect(() => {

    if (
      !mode ||
      !loadedDraftRef.current ||
      duplicate ||
      submitting
    ) {
      return;
    }


    if (
      draftTimer.current
    ) {
      clearTimeout(
        draftTimer.current
      );
    }


    setDraftState(
      "waiting"
    );


    draftTimer.current =
      setTimeout(
        async () => {

          try {

            setDraftState(
              "saving"
            );


            await request(
              "/api/mooma/stock-record/draft",
              {
                method:
                  "POST",

                body:
                  JSON.stringify({
                    branchCode,

                    date:
                      selectedDate,

                    mode,

                    values,
                  }),
              }
            );


            setDraftState(
              "saved"
            );


            window.setTimeout(
              () => {

                setDraftState(
                  ""
                );

              },
              1800
            );

          } catch (
            err
          ) {

            console.error(
              "[MOOMA DRAFT]",
              err
            );

            setDraftState(
              "error"
            );
          }

        },
        700
      );


    return () => {

      if (
        draftTimer.current
      ) {
        clearTimeout(
          draftTimer.current
        );
      }

    };

  }, [
    values,
    mode,
    duplicate,
    submitting,
    branchCode,
    selectedDate,
  ]);


  /* ==========================================================
     MODE
  ========================================================== */

  function openMode(
    nextMode
  ) {

    const isDuplicate =
      Boolean(
        initData
          ?.duplicate?.[
            nextMode
          ]
      );


    /*
     * Daily + Weekly duplicates
     * are blocked.
     *
     * Bakery remains available.
     */

    if (
      isDuplicate &&
      nextMode !==
        "bakery"
    ) {

      setValidation({
        type:
          "duplicate",

        title:
          "STOCK ALREADY SUBMITTED",

        message:
          `${nextMode.toUpperCase()} stock has already been submitted for ${prettyDate(
            selectedDate
          )}.`,
      });

      return;
    }


    setMode(
      nextMode
    );

    setReviewing(
      false
    );

    setValidation(
      null
    );
  }


  /* ==========================================================
     INPUT
  ========================================================== */

  function updateValue(
    row,
    value
  ) {

    if (
      value !== "" &&
      !/^\d*\.?\d*$/.test(
        value
      )
    ) {
      return;
    }


    setValues(
      (current) => ({
        ...current,

        [row]:
          value,
      })
    );
  }


  /* ==========================================================
     REVIEW
  ========================================================== */

  function startReview() {

    const missing =
      items.filter(
        (item) => {

          const value =
            values[
              item.row
            ];

          return (
            value ===
              undefined ||
            value ===
              null ||
            String(
              value
            ).trim() ===
              ""
          );
        }
      );


    if (
      missing.length
    ) {

      setValidation({
        type:
          "missing",

        title:
          "INCOMPLETE STOCK",

        message:
          `${missing.length} item${
            missing.length >
            1
              ? "s are"
              : " is"
          } still missing.`,

        items:
          missing
            .slice(
              0,
              8
            )
            .map(
              (item) =>
                item.name
            ),
      });

      return;
    }


    setReviewing(
      true
    );


    window.setTimeout(
      () => {

        reviewRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });

      },
      150
    );
  }


  /* ==========================================================
     SUBMIT
  ========================================================== */

  async function submitStock() {

    if (
      submitting ||
      !mode
    ) {
      return;
    }


    setSubmitting(
      true
    );

    setValidation(
      null
    );


    try {

      /*
       * IMPORTANT:
       *
       * MOOMA backend expects:
       *
       * values[item.row]
       *
       * NOT values[item.name].
       */

      const cleanValues =
        {};


      items.forEach(
        (item) => {

          cleanValues[
            item.row
          ] =
            Number(
              values[
                item.row
              ]
            ) || 0;

        }
      );


      const data =
        await request(
          "/api/mooma/stock-record/submit",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                branchCode,

                date:
                  selectedDate,

                mode,

                values:
                  cleanValues,
              }),
          }
        );


      /*
       * Clear D1 draft.
       */

      try {

        await request(
          "/api/mooma/stock-record/draft",
          {
            method:
              "DELETE",

            body:
              JSON.stringify({
                branchCode,

                date:
                  selectedDate,

                mode,
              }),
          }
        );

      } catch {
        /*
         * Backend submit also
         * removes the draft.
         */
      }


      setSuccess({
        title:
          "STOCK SEALED",

        message:
          data?.message ||
          `${mode.toUpperCase()} stock submitted successfully.`,

        mode,
      });


      setReviewing(
        false
      );


    } catch (
      err
    ) {

      setValidation({
        type:
          "error",

        title:
          "SUBMISSION FAILED",

        message:
          err?.message ||
          "Unable to submit stock record.",
      });

    } finally {

      setSubmitting(
        false
      );
    }
  }


  /* ==========================================================
     SUCCESS CONTINUE
  ========================================================== */

  async function finishSuccess() {

    setSuccess(
      null
    );

    setMode(
      null
    );

    setValues(
      {}
    );

    setReviewing(
      false
    );

    await loadStock({
      preserveMode:
        false,
    });


    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  }


  /* ==========================================================
     LOADING SCREEN
  ========================================================== */

  if (
    loading ||
    initialAnimation
  ) {

    return (
      <div className="mooma-stock-loading">

        <div className="mooma-stock-loading-grid" />


        <motion.div
          className="mooma-stock-crate-loader"

          initial={{
            opacity:
              0,

            scale:
              0.7,
          }}

          animate={{
            opacity:
              1,

            scale:
              1,
          }}
        >

          <div className="mooma-stock-loader-boxes">

            {[0, 1, 2, 3].map(
              (
                box,
                index
              ) => (

                <motion.div
                  key={
                    box
                  }

                  className={
                    `mooma-stock-loader-box box-${index + 1}`
                  }

                  initial={{
                    x:
                      index %
                        2 ===
                      0
                        ? -130
                        : 130,

                    y:
                      index <
                      2
                        ? -80
                        : 80,

                    rotate:
                      index %
                        2 ===
                      0
                        ? -30
                        : 30,

                    opacity:
                      0,
                  }}

                  animate={{
                    x:
                      0,

                    y:
                      0,

                    rotate:
                      0,

                    opacity:
                      1,
                  }}

                  transition={{
                    delay:
                      index *
                      0.12,

                    type:
                      "spring",

                    stiffness:
                      130,

                    damping:
                      12,
                  }}
                >

                  M

                </motion.div>

              )
            )}

          </div>


          <motion.div
            className="mooma-stock-loader-scan"

            animate={{
              y: [
                -40,
                85,
                -40,
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
          />


          <div className="mooma-stock-loader-copy">

            <span>
              MOOMA INVENTORY
            </span>

            <h2>
              Building Stock Workspace
            </h2>

            <p>
              Connecting{" "}
              {branchCode}
              ...
            </p>

          </div>

        </motion.div>

      </div>
    );
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  if (
    error
  ) {

    return (
      <div className="mooma-stock-page">

        <div className="mooma-stock-error-page">

          <motion.div
            initial={{
              scale:
                0,
            }}

            animate={{
              scale: [
                0,
                1.15,
                1,
              ],
            }}
          >

            <AlertTriangle
              size={38}
            />

          </motion.div>


          <span>
            MOOMA INVENTORY NETWORK
          </span>

          <h2>
            Connection Failed
          </h2>

          <p>
            {error}
          </p>


          <button
            type="button"
            onClick={() =>
              loadStock()
            }
          >

            <RefreshCcw
              size={16}
            />

            RETRY

          </button>

        </div>

      </div>
    );
  }


  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="mooma-stock-page">

      <div className="mooma-stock-bg" />

      <div className="mooma-stock-grid-bg" />


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="mooma-stock-header">

        <button
          type="button"

          className="mooma-stock-back"

          onClick={
            onBack
          }
        >

          <ArrowLeft
            size={17}
          />

          DASHBOARD

        </button>


        <div className="mooma-stock-header-title">

          <span>
            MOOMA / INVENTORY
          </span>

          <strong>
            STOCK RECORD
          </strong>

        </div>


        <div className="mooma-stock-header-branch">

          <small>
            ACTIVE BRANCH
          </small>

          <strong>
            {branchCode}
          </strong>

        </div>

      </header>


      <main className="mooma-stock-main">


        {/* ====================================================
            HERO
        ==================================================== */}

        <motion.section
          className="mooma-stock-hero"

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

            <span className="mooma-stock-eyebrow">
              INVENTORY CONTROL SYSTEM
            </span>


            <h1>
              Record Stock
            </h1>


            <p>
              {branchName}
            </p>

          </div>


          <div className="mooma-stock-date-card">

            <CalendarDays
              size={20}
            />

            <div>

              <small>
                REPORTING DATE
              </small>

              <strong>
                {prettyDate(
                  selectedDate
                )}
              </strong>

            </div>


            <input
              type="date"

              value={
                selectedDate
              }

              onChange={(
                event
              ) =>
                setSelectedDate(
                  event
                    .target
                    .value
                )
              }
            />

          </div>

        </motion.section>


        {/* ====================================================
            MODE CARDS
        ==================================================== */}

        <section className="mooma-stock-modes">

          <div className="mooma-stock-section-heading">

            <div>

              <span>
                SELECT RECORD TYPE
              </span>

              <h2>
                Inventory Mode
              </h2>

            </div>

          </div>


          <div className="mooma-stock-mode-grid">

            {MODES.map(
              (
                option,
                index
              ) => {

                const Icon =
                  option.icon;

                const submitted =
                  Boolean(
                    initData
                      ?.duplicate?.[
                        option.id
                      ]
                  );


                return (

                  <motion.button
                    type="button"

                    key={
                      option.id
                    }

                    className={
                      `mooma-stock-mode-card ${
                        mode ===
                        option.id
                          ? "active"
                          : ""
                      } ${
                        submitted &&
                        option.id !==
                          "bakery"
                          ? "submitted"
                          : ""
                      }`
                    }

                    onClick={() =>
                      openMode(
                        option.id
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
                        0.08,
                    }}

                    whileHover={{
                      y:
                        -4,
                    }}

                    whileTap={{
                      scale:
                        0.985,
                    }}
                  >

                    <div className="mooma-stock-mode-top">

                      <div className="mooma-stock-mode-icon">

                        <Icon
                          size={22}
                        />

                      </div>


                      <span>
                        {
                          option.number
                        }
                      </span>

                    </div>


                    <small>
                      {
                        option.label
                      }
                    </small>


                    <h3>
                      {
                        option.title
                      }
                    </h3>


                    <p>
                      {
                        option.description
                      }
                    </p>


                    <div className="mooma-stock-mode-bottom">

                      {submitted &&
                      option.id !==
                        "bakery" ? (

                        <>

                          <CheckCircle2
                            size={15}
                          />

                          SUBMITTED

                        </>

                      ) : (

                        <>

                          OPEN RECORD

                          <ChevronRight
                            size={15}
                          />

                        </>

                      )}

                    </div>

                  </motion.button>

                );
              }
            )}

          </div>

        </section>


        {/* ====================================================
            WORKSPACE
        ==================================================== */}

        <AnimatePresence>

          {mode && (

            <motion.section
              ref={
                workspaceRef
              }

              className="mooma-stock-workspace"

              initial={{
                opacity:
                  0,

                y:
                  35,

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
                  20,
              }}
            >

              <div className="mooma-stock-workspace-head">

                <div>

                  <span>
                    {mode.toUpperCase()} INVENTORY
                  </span>

                  <h2>
                    Enter Stock Quantities
                  </h2>

                  <p>
                    Complete every item before review.
                  </p>

                </div>


                <div className="mooma-stock-progress">

                  <strong>
                    {progress}%
                  </strong>

                  <small>
                    {completedCount}
                    {" / "}
                    {items.length}
                  </small>

                </div>

              </div>


              <div className="mooma-stock-progress-track">

                <motion.div
                  animate={{
                    width:
                      `${progress}%`,
                  }}
                />

              </div>


              {/* ================================================
                  DRAFT
              ================================================ */}

              <AnimatePresence>

                {draftState && (

                  <motion.div
                    className={
                      `mooma-stock-draft-state ${draftState}`
                    }

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

                    exit={{
                      opacity:
                        0,
                    }}
                  >

                    {draftState ===
                    "saving" ? (

                      <LoaderCircle
                        className="mooma-stock-spin"
                        size={14}
                      />

                    ) : (

                      <Save
                        size={14}
                      />

                    )}


                    {draftState ===
                    "waiting"
                      ? "CHANGES DETECTED"
                      : draftState ===
                          "saving"
                        ? "SAVING DRAFT"
                        : draftState ===
                            "saved"
                          ? "DRAFT SAVED"
                          : "DRAFT SAVE FAILED"}

                  </motion.div>

                )}

              </AnimatePresence>


              {/* ================================================
                  ITEMS
              ================================================ */}

              <div className="mooma-stock-items">

                {items.map(
                  (
                    item,
                    index
                  ) => (

                    <motion.div
                      className="mooma-stock-item"

                      key={
                        `${item.row}-${item.sku}`
                      }

                      initial={{
                        opacity:
                          0,

                        x:
                          index %
                            2 ===
                          0
                            ? -18
                            : 18,
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
                              0.025,
                            0.5
                          ),
                      }}
                    >

                      <div className="mooma-stock-item-number">

                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}

                      </div>


                      <div className="mooma-stock-item-info">

                        <strong>
                          {item.name}
                        </strong>

                        <div>

                          <span>
                            {item.sku ||
                              "NO SKU"}
                          </span>

                          <span>
                            {item.uom ||
                              "UNIT"}
                          </span>

                        </div>

                      </div>


                      <div className="mooma-stock-item-input">

                        <input
                          inputMode="decimal"

                          placeholder="0"

                          value={
                            values[
                              item.row
                            ] ??
                            ""
                          }

                          onChange={(
                            event
                          ) =>
                            updateValue(
                              item.row,

                              event
                                .target
                                .value
                            )
                          }
                        />


                        <span>
                          {item.uom ||
                            ""}
                        </span>

                      </div>

                    </motion.div>

                  )
                )}

              </div>


              {/* ================================================
                  REVIEW BUTTON
              ================================================ */}

              {!reviewing && (

                <motion.button
                  type="button"

                  className="mooma-stock-review-button"

                  onClick={
                    startReview
                  }

                  whileHover={{
                    y:
                      -2,
                  }}

                  whileTap={{
                    scale:
                      0.99,
                  }}
                >

                  <div>

                    <small>
                      NEXT STEP
                    </small>

                    <strong>
                      REVIEW STOCK RECORD
                    </strong>

                  </div>


                  <ArrowRight
                    size={19}
                  />

                </motion.button>

              )}

            </motion.section>

          )}

        </AnimatePresence>


        {/* ====================================================
            REVIEW
        ==================================================== */}

        <AnimatePresence>

          {reviewing &&
            mode && (

            <motion.section
              ref={
                reviewRef
              }

              className="mooma-stock-review"

              initial={{
                opacity:
                  0,

                scale:
                  0.92,

                y:
                  50,
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
                  120,

                damping:
                  16,
              }}
            >

              <div className="mooma-stock-review-stamp">

                <motion.div
                  initial={{
                    rotate:
                      -30,

                    scale:
                      1.8,

                    opacity:
                      0,
                  }}

                  animate={{
                    rotate:
                      -8,

                    scale:
                      1,

                    opacity:
                      1,
                  }}

                  transition={{
                    delay:
                      0.25,

                    type:
                      "spring",
                  }}
                >

                  REVIEW

                </motion.div>

              </div>


              <div className="mooma-stock-review-head">

                <div>

                  <span>
                    FINAL CHECK
                  </span>

                  <h2>
                    Review Stock
                  </h2>

                  <p>
                    Check all quantities before submission.
                  </p>

                </div>


                <div>

                  <small>
                    {branchCode}
                  </small>

                  <strong>
                    {prettyDate(
                      selectedDate
                    )}
                  </strong>

                </div>

              </div>


              <div className="mooma-stock-review-list">

                {items.map(
                  (
                    item,
                    index
                  ) => (

                    <motion.div
                      key={
                        item.row
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
                              0.025,
                            0.45
                          ),
                      }}
                    >

                      <div>

                        <strong>
                          {item.name}
                        </strong>

                        <small>
                          {item.sku}
                        </small>

                      </div>


                      <span>

                        {values[
                          item.row
                        ]}

                        {" "}

                        {item.uom}

                      </span>

                    </motion.div>

                  )
                )}

              </div>


              <div className="mooma-stock-review-actions">

                <button
                  type="button"

                  onClick={() => {

                    setReviewing(
                      false
                    );

                    window.setTimeout(
                      () => {

                        workspaceRef.current
                          ?.scrollIntoView({
                            behavior:
                              "smooth",

                            block:
                              "start",
                          });

                      },
                      100
                    );

                  }}
                >

                  <ArrowLeft
                    size={16}
                  />

                  EDIT RECORD

                </button>


                <button
                  type="button"

                  className="submit"

                  disabled={
                    submitting
                  }

                  onClick={
                    submitStock
                  }
                >

                  {submitting ? (

                    <>

                      <LoaderCircle
                        size={17}
                        className="mooma-stock-spin"
                      />

                      SEALING STOCK...

                    </>

                  ) : (

                    <>

                      <Check
                        size={17}
                      />

                      SUBMIT STOCK

                    </>

                  )}

                </button>

              </div>

            </motion.section>

          )}

        </AnimatePresence>

      </main>


      {/* ======================================================
          VALIDATION POPUP
      ====================================================== */}

      <AnimatePresence>

        {validation && (

          <motion.div
            className="mooma-stock-modal-overlay"

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
              className="mooma-stock-alert-orb"

              initial={{
                x:
                  "55vw",

                y:
                  -180,

                scale:
                  0.05,

                borderRadius:
                  "50%",
              }}

              animate={{
                x: [
                  "55vw",
                  "25vw",
                  "10vw",
                  0,
                ],

                y: [
                  -180,
                  80,
                  -35,
                  0,
                ],

                scale: [
                  0.05,
                  0.09,
                  0.18,
                  1,
                ],

                borderRadius: [
                  "50%",
                  "50%",
                  "40%",
                  "22px",
                ],
              }}

              transition={{
                duration:
                  1.1,

                ease:
                  "easeOut",
              }}
            >

              <motion.div
                className="mooma-stock-alert-content"

                initial={{
                  opacity:
                    0,
                }}

                animate={{
                  opacity:
                    1,
                }}

                transition={{
                  delay:
                    0.8,
                }}
              >

                <div className="mooma-stock-alert-icon">

                  <AlertTriangle
                    size={27}
                  />

                </div>


                <span>
                  MOOMA INVENTORY
                </span>


                <h3>
                  {
                    validation.title
                  }
                </h3>


                <p>
                  {
                    validation.message
                  }
                </p>


                {validation.items
                  ?.length >
                  0 && (

                  <div className="mooma-stock-missing-list">

                    {validation.items.map(
                      (
                        item
                      ) => (

                        <div
                          key={
                            item
                          }
                        >

                          <span />

                          {item}

                        </div>

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

                  <X
                    size={15}
                  />

                  CLOSE

                </button>

              </motion.div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>


      {/* ======================================================
          SUCCESS — CRATE SEAL ANIMATION
      ====================================================== */}

      <AnimatePresence>

        {success && (

          <motion.div
            className="mooma-stock-success-overlay"

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
              className="mooma-stock-success-crate"

              initial={{
                scale:
                  0.6,

                y:
                  100,

                opacity:
                  0,
              }}

              animate={{
                scale:
                  1,

                y:
                  0,

                opacity:
                  1,
              }}

              transition={{
                type:
                  "spring",

                stiffness:
                  120,

                damping:
                  14,
              }}
            >

              <div className="mooma-stock-success-box">

                <motion.div
                  className="mooma-stock-success-lid"

                  initial={{
                    rotateX:
                      -110,
                  }}

                  animate={{
                    rotateX:
                      0,
                  }}

                  transition={{
                    delay:
                      0.35,

                    duration:
                      0.5,
                  }}
                />


                <span>
                  M
                </span>

              </div>


              <motion.div
                className="mooma-stock-success-stamp"

                initial={{
                  scale:
                    2.5,

                  rotate:
                    -25,

                  opacity:
                    0,
                }}

                animate={{
                  scale:
                    1,

                  rotate:
                    -8,

                  opacity:
                    1,
                }}

                transition={{
                  delay:
                    0.85,

                  type:
                    "spring",

                  stiffness:
                    180,
                }}
              >

                <Check
                  size={20}
                />

                RECORDED

              </motion.div>


              <motion.div
                className="mooma-stock-success-copy"

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

                transition={{
                  delay:
                    1,
                }}
              >

                <Sparkles
                  size={18}
                />


                <span>
                  MOOMA INVENTORY
                </span>


                <h2>
                  {
                    success.title
                  }
                </h2>


                <p>
                  {
                    success.message
                  }
                </p>


                <div>

                  <Clock3
                    size={14}
                  />

                  {prettyDate(
                    selectedDate
                  )}

                </div>


                <button
                  type="button"

                  onClick={
                    finishSuccess
                  }
                >

                  CONTINUE

                  <ArrowRight
                    size={16}
                  />

                </button>

              </motion.div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>

    </div>
  );
}
