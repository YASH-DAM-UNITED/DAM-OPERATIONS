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
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Coffee,
  Eraser,
  FileClock,
  LoaderCircle,
  PackageCheck,
  RefreshCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";


/* ============================================================
   HELPERS
============================================================ */

function yesterdayISO() {
  const date =
    new Date();

  date.setDate(
    date.getDate() - 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function labelMode(
  mode
) {
  if (
    mode === "daily"
  ) {
    return "Daily";
  }

  if (
    mode === "weekly"
  ) {
    return "Weekly";
  }

  return "Bakery";
}


/* ============================================================
   STOCK RECORD
============================================================ */

export default function BartStockRecord({
  branch,
  onBack,
}) {
  const [
    page,
    setPage,
  ] =
    useState(
      "mode"
    );


  const [
    date,
    setDate,
  ] =
    useState(
      yesterdayISO()
    );


  const [
    mode,
    setMode,
  ] =
    useState(
      null
    );


  const [
    initData,
    setInitData,
  ] =
    useState(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    inputs,
    setInputs,
  ] =
    useState(
      {}
    );


  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const [
    review,
    setReview,
  ] =
    useState(
      false
    );


  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );


  const [
    success,
    setSuccess,
  ] =
    useState(
      null
    );


  const [
    validation,
    setValidation,
  ] =
    useState(
      null
    );


  const draftTimer =
    useRef(
      null
    );


  const reviewRef =
    useRef(
      null
    );


  /* ==========================================================
     LOAD STOCK STRUCTURE
  ========================================================== */

  async function loadData(
    selectedDate =
      date
  ) {
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
          `/api/staff/bart/stock-record/init?branch=${encodeURIComponent(
            branch.code
          )}&date=${encodeURIComponent(
            selectedDate
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
            "Unable to load Stock Record."
        );
      }


      setInitData(
        data
      );

    } catch (err) {
      setError(
        err.message ||
          "Unable to load Stock Record."
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(() => {
    loadData(
      date
    );
  }, [
    branch?.code,
    date,
  ]);


  /* ==========================================================
     MODE ITEMS
  ========================================================== */

  const items =
    useMemo(
      () => {
        if (
          !mode ||
          !initData
        ) {
          return [];
        }

        return (
          initData.items?.[
            mode
          ] || []
        );
      },
      [
        mode,
        initData,
      ]
    );


  /* ==========================================================
     FILTER
  ========================================================== */

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
            item.name
              .toLowerCase()
              .includes(q) ||

            String(
              item.uom || ""
            )
              .toLowerCase()
              .includes(q) ||

            String(
              item.sku || ""
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
     COMPLETION
  ========================================================== */

  const completion =
    useMemo(
      () => {
        if (
          !items.length
        ) {
          return 0;
        }


        const completed =
          items.filter(
            (item) =>
              String(
                inputs[
                  item.name
                ] ?? ""
              ).trim()
          ).length;


        return Math.round(
          (
            completed /
            items.length
          ) *
            100
        );
      },
      [
        items,
        inputs,
      ]
    );


  /* ==========================================================
     SAVE DRAFT

     Debounced so each keystroke does
     NOT immediately make a request.
  ========================================================== */

  function queueDraftSave(
    nextInputs
  ) {
    if (
      !mode
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


    draftTimer.current =
      setTimeout(
        async () => {
          try {
            await fetch(
              "/api/staff/bart/stock-record/draft",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    branchCode:
                      branch.code,

                    date,

                    mode,

                    values:
                      nextInputs,
                  }),
              }
            );
          } catch (
            err
          ) {
            console.error(
              "Draft save failed:",
              err
            );
          }
        },
        700
      );
  }


  /* ==========================================================
     MODE SELECT
  ========================================================== */

  function chooseMode(
    selectedMode
  ) {
    if (
      !initData
    ) {
      return;
    }


    /*
      Daily / Weekly duplicate
      protection.

      Bakery intentionally excluded.
    */

    if (
      selectedMode !==
        "bakery" &&
      initData.duplicate?.[
        selectedMode
      ]
    ) {
      setValidation({
        type:
          "duplicate",

        title:
          "Submission Restricted",

        message:
          "Data for this date has already been submitted. No rewrite is possible.",
      });

      return;
    }


    setMode(
      selectedMode
    );


    const draft =
      initData.drafts?.[
        selectedMode
      ]?.values;


    const starting =
      {};


    const modeItems =
      initData.items?.[
        selectedMode
      ] || [];


    modeItems.forEach(
      (item) => {
        starting[
          item.name
        ] =
          draft?.[
            item.name
          ] ?? "";
      }
    );


    setInputs(
      starting
    );

    setSearch(
      ""
    );

    setReview(
      false
    );

    setPage(
      "entry"
    );
  }


  /* ==========================================================
     INPUT
  ========================================================== */

  function updateInput(
    itemName,
    rawValue
  ) {
    /*
      Numeric only.
      Equivalent to mobile numeric
      keypad + old validation.
    */

    const value =
      rawValue.replace(
        /[^0-9]/g,
        ""
      );


    const next = {
      ...inputs,

      [itemName]:
        value,
    };


    setInputs(
      next
    );


    queueDraftSave(
      next
    );
  }


  /* ==========================================================
     CLEAR
  ========================================================== */

  async function clearDraft() {
    const empty = {};


    items.forEach(
      (item) => {
        empty[
          item.name
        ] = "";
      }
    );


    setInputs(
      empty
    );

    setReview(
      false
    );


    try {
      await fetch(
        "/api/staff/bart/stock-record/draft",
        {
          method:
            "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              branchCode:
                branch.code,

              date,

              mode,
            }),
        }
      );
    } catch {
      // UI still remains cleared
    }
  }


  /* ==========================================================
     REVIEW VALIDATION
  ========================================================== */

  function reviewStock() {
    const missing = [];

    const invalid = [];


    items.forEach(
      (item) => {
        const value =
          String(
            inputs[
              item.name
            ] ?? ""
          ).trim();


        if (!value) {
          missing.push(
            item.name
          );

          return;
        }


        if (
          !/^\d+$/.test(
            value
          )
        ) {
          invalid.push(
            item.name
          );
        }
      }
    );


    if (
      invalid.length
    ) {
      setValidation({
        type:
          "invalid",

        title:
          "Input Error",

        message:
          "Non-numeric quantities were detected.",

        items:
          invalid,
      });

      return;
    }


    if (
      missing.length
    ) {
      setValidation({
        type:
          "missing",

        title:
          "Pending Items",

        message:
          "Some items are still empty. Fill all quantities before reviewing.",

        items:
          missing,
      });

      return;
    }


    setReview(
      true
    );


    setTimeout(
      () => {
        reviewRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });
      },
      200
    );
  }


  /* ==========================================================
     FINAL SUBMIT
  ========================================================== */

  async function submitStock() {
    try {
      setSubmitting(
        true
      );


      const response =
        await fetch(
          "/api/staff/bart/stock-record/submit",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                branchCode:
                  branch.code,

                date,

                mode,

                values:
                  inputs,
              }),
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        if (
          data.duplicate
        ) {
          setValidation({
            type:
              "duplicate",

            title:
              "Submission Restricted",

            message:
              data.message,
          });

          return;
        }


        if (
          data.validation
        ) {
          setValidation({
            type:
              data.type,

            title:
              data.type ===
              "missing"
                ? "Pending Items"
                : "Input Error",

            message:
              data.message,

            items:
              data.items,
          });

          return;
        }


        throw new Error(
          data.message ||
            "Submission failed."
        );
      }


      setSuccess(
        data
      );


    } catch (err) {
      setValidation({
        type:
          "error",

        title:
          "Submission Error",

        message:
          err.message ||
          "Unable to submit stock.",
      });

    } finally {
      setSubmitting(
        false
      );
    }
  }


  /* ==========================================================
     SUCCESS RETURN
  ========================================================== */

  useEffect(() => {
    if (
      !success
    ) {
      return;
    }


    const timer =
      setTimeout(
        () => {
          onBack?.();
        },
        5000
      );


    return () =>
      clearTimeout(
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
    !initData
  ) {
    return (
      <div className="bart-stock-record">
        <div className="bsr-loading-screen">
          <motion.div
            animate={{
              rotate:
                360,
            }}
            transition={{
              repeat:
                Infinity,

              duration:
                1.3,

              ease:
                "linear",
            }}
          >
            <Coffee
              size={38}
            />
          </motion.div>

          <h2>
            Preparing Stock System
          </h2>

          <p>
            Loading branch inventory structure…
          </p>
        </div>
      </div>
    );
  }


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="bart-stock-record">

      <div className="bsr-grid-bg" />

      <div className="bsr-orb bsr-orb-one" />

      <div className="bsr-orb bsr-orb-two" />


      {/* HEADER */}

      <header className="bsr-header">
        <button
          className="bsr-back"
          onClick={() => {
            if (
              page ===
              "entry"
            ) {
              setPage(
                "mode"
              );

              setMode(
                null
              );

              setReview(
                false
              );

              return;
            }

            onBack?.();
          }}
        >
          <ArrowLeft
            size={17}
          />

          {page ===
          "entry"
            ? "MODE SELECT"
            : "STAFF DASHBOARD"}
        </button>


        <div className="bsr-brand">
          <Coffee
            size={17}
          />

          <span>
            <strong>
              BART
            </strong>

            STOCK SYSTEM
          </span>
        </div>


        <div className="bsr-branch-chip">
          {branch?.code}

          <span />

          {branch?.name}
        </div>
      </header>


      <main className="bsr-main">

        {/* ===================================================
            MODE SELECT
        =================================================== */}

        {page ===
          "mode" && (
          <motion.section
            className="bsr-mode-page"
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
            <div className="bsr-eyebrow">
              <Sparkles
                size={13}
              />

              STOCK CAPTURE SYSTEM
            </div>


            <h1>
              Record inventory
              <br />

              <span>
                with precision.
              </span>
            </h1>


            <p className="bsr-lead">
              Select your reporting
              date and stock operation.
            </p>


            <div className="bsr-date-panel">
              <CalendarDays
                size={20}
              />

              <div>
                <small>
                  REPORTING DATE
                </small>

                <input
                  type="date"
                  value={
                    date
                  }
                  onChange={(
                    event
                  ) => {
                    setDate(
                      event.target
                        .value
                    );
                  }}
                />
              </div>
            </div>


            {error && (
              <div className="bsr-error">
                <CircleAlert
                  size={17}
                />

                {error}
              </div>
            )}


            <div className="bsr-mode-grid">

              <ModeCard
                number="01"
                title="Daily"
                subtitle="DAILY STOCK"
                description="Capture stock quantities for all Daily Item products."
                disabled={
                  initData
                    ?.duplicate
                    ?.daily
                }
                draft={
                  initData
                    ?.drafts
                    ?.daily
                }
                onClick={() =>
                  chooseMode(
                    "daily"
                  )
                }
              />


              <ModeCard
                number="02"
                title="Weekly"
                subtitle="WEEKLY STOCK"
                description="Complete the scheduled weekly stock inventory."
                disabled={
                  initData
                    ?.duplicate
                    ?.weekly
                }
                draft={
                  initData
                    ?.drafts
                    ?.weekly
                }
                onClick={() =>
                  chooseMode(
                    "weekly"
                  )
                }
              />


              <ModeCard
                number="03"
                title="Bakery"
                subtitle="MORNING SHIFT"
                description="Record the dedicated bakery SKU group used by morning operations."
                draft={
                  initData
                    ?.drafts
                    ?.bakery
                }
                accent
                onClick={() =>
                  chooseMode(
                    "bakery"
                  )
                }
              />

            </div>
          </motion.section>
        )}


        {/* ===================================================
            STOCK ENTRY
        =================================================== */}

        {page ===
          "entry" &&
          mode && (
          <motion.section
            className="bsr-entry"
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
            <div className="bsr-entry-top">

              <div>
                <div className="bsr-eyebrow">
                  <PackageCheck
                    size={13}
                  />

                  {labelMode(
                    mode
                  ).toUpperCase()} STOCK
                </div>

                <h1>
                  Enter Stock
                </h1>

                <p>
                  {date} ·{" "}
                  {items.length} items
                </p>
              </div>


              <div className="bsr-progress-block">

                <div>
                  <span>
                    COMPLETION
                  </span>

                  <strong>
                    {completion}%
                  </strong>
                </div>


                <div className="bsr-progress">
                  <motion.div
                    animate={{
                      width:
                        `${completion}%`,
                    }}
                  />
                </div>
              </div>
            </div>


            {/* TOOLBAR */}

            <div className="bsr-toolbar">

              <div className="bsr-search">
                <Search
                  size={16}
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


              <button
                className="bsr-clear"
                onClick={
                  clearDraft
                }
              >
                <Eraser
                  size={15}
                />

                CLEAR
              </button>
            </div>


            {/* ITEMS */}

            <div className="bsr-item-grid">
              <AnimatePresence>
                {visibleItems.map(
                  (
                    item,
                    index
                  ) => {
                    const value =
                      inputs[
                        item.name
                      ] ?? "";

                    return (
                      <motion.div
                        className={
                          `bsr-item-card ${
                            value
                              ? "completed"
                              : ""
                          }`
                        }
                        key={
                          item.name
                        }
                        initial={{
                          opacity:
                            0,

                          y:
                            15,

                          scale:
                            0.98,
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

                          scale:
                            0.97,
                        }}
                        transition={{
                          delay:
                            Math.min(
                              index *
                                0.015,
                              0.3
                            ),
                        }}
                      >
                        <div className="bsr-item-head">
                          <div>
                            <small>
                              {item.sku ||
                                "ITEM"}
                            </small>

                            <strong>
                              {
                                item.name
                              }
                            </strong>
                          </div>

                          {value && (
                            <motion.span
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
                            </motion.span>
                          )}
                        </div>


                        <div className="bsr-qty-line">
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={
                              value
                            }
                            onChange={(
                              event
                            ) =>
                              updateInput(
                                item.name,
                                event
                                  .target
                                  .value
                              )
                            }
                          />

                          <span>
                            {item.uom ||
                              "QTY"}
                          </span>
                        </div>
                      </motion.div>
                    );
                  }
                )}
              </AnimatePresence>
            </div>


            {/* REVIEW BUTTON */}

            <motion.button
              className="bsr-review-btn"
              whileHover={{
                scale:
                  1.008,
              }}
              whileTap={{
                scale:
                  0.99,
              }}
              onClick={
                reviewStock
              }
            >
              <ClipboardCheck
                size={18}
              />

              REVIEW STOCK

              <ChevronRight
                size={17}
              />
            </motion.button>


            {/* =================================================
                REVIEW PANEL
            ================================================= */}

            <AnimatePresence>
              {review && (
                <motion.section
                  ref={
                    reviewRef
                  }
                  className="bsr-review"
                  initial={{
                    opacity:
                      0,

                    y:
                      35,
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
                  <div className="bsr-review-title">
                    <div>
                      <span>
                        FINAL CHECK
                      </span>

                      <h2>
                        Review Submission
                      </h2>

                      <p>
                        Verify every quantity before committing it to Google Sheets.
                      </p>
                    </div>


                    <div className="bsr-review-count">
                      {items.length}

                      <small>
                        ITEMS
                      </small>
                    </div>
                  </div>


                  <div className="bsr-review-grid">
                    {items.map(
                      (item) => (
                        <div
                          className="bsr-review-card"
                          key={
                            item.name
                          }
                        >
                          <span>
                            {item.name}
                          </span>

                          <strong>
                            {
                              inputs[
                                item.name
                              ]
                            }

                            {item.uom && (
                              <small>
                                {
                                  item.uom
                                }
                              </small>
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>


                  <div className="bsr-review-actions">

                    <button
                      className="bsr-edit"
                      onClick={() =>
                        setReview(
                          false
                        )
                      }
                    >
                      <ArrowLeft
                        size={16}
                      />

                      EDIT
                    </button>


                    <button
                      className="bsr-submit"
                      disabled={
                        submitting
                      }
                      onClick={
                        submitStock
                      }
                    >
                      {submitting ? (
                        <LoaderCircle
                          className="dam-spin"
                          size={17}
                        />
                      ) : (
                        <CheckCircle2
                          size={17}
                        />
                      )}

                      {submitting
                        ? "SAVING..."
                        : "SUBMIT STOCK"}
                    </button>

                  </div>
                </motion.section>
              )}
            </AnimatePresence>

          </motion.section>
        )}

      </main>


      {/* =====================================================
          VALIDATION POPUP
      ===================================================== */}

      <AnimatePresence>
        {validation && (
          <motion.div
            className="bsr-modal-overlay"
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
              className="bsr-validation-modal"
              initial={{
                scale:
                  0.92,

                opacity:
                  0,

                y:
                  20,
              }}
              animate={{
                scale:
                  1,

                opacity:
                  1,

                y:
                  0,
              }}
            >
              <div className="bsr-validation-icon">
                <CircleAlert
                  size={25}
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
                <div className="bsr-missing-items">

                  {validation.items
                    .slice(
                      0,
                      10
                    )
                    .map(
                      (item) => (
                        <span
                          key={
                            item
                          }
                        >
                          {item}
                        </span>
                      )
                    )}


                  {validation.items
                    .length >
                    10 && (
                    <span>
                      +
                      {validation
                        .items
                        .length -
                        10}{" "}
                      more
                    </span>
                  )}

                </div>
              )}


              <button
                onClick={() => {
                  setValidation(
                    null
                  );

                  setSearch(
                    ""
                  );
                }}
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* =====================================================
          SUCCESS
      ===================================================== */}

      <AnimatePresence>
        {success && (
          <motion.div
            className="bsr-success-overlay"
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
              className="bsr-success-card"
              initial={{
                opacity:
                  0,

                scale:
                  0.8,

                y:
                  40,
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
                  220,

                damping:
                  18,
              }}
            >
              <motion.div
                className="bsr-success-check"
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
                <Check
                  size={48}
                />
              </motion.div>


              <span>
                STOCK COMMITTED
              </span>

              <h1>
                Submitted
              </h1>

              <p>
                Stock saved successfully.
              </p>


              <div className="bsr-success-info">
                <div>
                  <small>
                    TRANSACTION
                  </small>

                  <strong>
                    {
                      success.transactionId
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    MODE
                  </small>

                  <strong>
                    {labelMode(
                      success.mode
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    DATE
                  </small>

                  <strong>
                    {
                      success.date
                    }
                  </strong>
                </div>
              </div>


              <div className="bsr-returning">
                Returning to Staff Dashboard…
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}


/* ============================================================
   MODE CARD
============================================================ */

function ModeCard({
  number,
  title,
  subtitle,
  description,
  disabled,
  draft,
  accent,
  onClick,
}) {
  return (
    <motion.button
      type="button"
      className={
        `bsr-mode-card ${
          accent
            ? "accent"
            : ""
        } ${
          disabled
            ? "disabled"
            : ""
        }`
      }
      whileHover={
        disabled
          ? {}
          : {
              y:
                -8,
            }
      }
      whileTap={
        disabled
          ? {}
          : {
              scale:
                0.985,
            }
      }
      onClick={
        onClick
      }
    >
      <div className="bsr-mode-number">
        {number}
      </div>


      <span className="bsr-mode-subtitle">
        {subtitle}
      </span>


      <h2>
        {title}
      </h2>


      <p>
        {description}
      </p>


      {draft && (
        <div className="bsr-draft-chip">
          <FileClock
            size={13}
          />

          SAVED DRAFT
        </div>
      )}


      {disabled ? (
        <div className="bsr-mode-status blocked">
          <Check
            size={14}
          />

          ALREADY SUBMITTED
        </div>
      ) : (
        <div className="bsr-mode-status">
          OPEN

          <ChevronRight
            size={15}
          />
        </div>
      )}
    </motion.button>
  );
}
