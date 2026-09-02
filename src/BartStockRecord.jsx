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
   LOCAL DRAFT STORAGE

   Drafts are stored only in this browser/device.

   Key format:
   bart-stock-draft:B001:2026-09-02:daily

   This gives every:
   - branch
   - reporting date
   - stock mode

   its own independent draft.

   IMPORTANT:
   This does NOT call Google Sheets.
   This does NOT call D1.
============================================================ */

const STOCK_DRAFT_PREFIX =
  "bart-stock-draft";


function stockDraftKey(
  branchCode,
  date,
  mode
) {
  return (
    `${STOCK_DRAFT_PREFIX}:` +
    `${String(
      branchCode || ""
    )
      .trim()
      .toUpperCase()}:` +
    `${String(
      date || ""
    ).trim()}:` +
    `${String(
      mode || ""
    )
      .trim()
      .toLowerCase()}`
  );
}


function readLocalDraft(
  branchCode,
  date,
  mode
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }


  try {
    const raw =
      window.localStorage.getItem(
        stockDraftKey(
          branchCode,
          date,
          mode
        )
      );


    if (!raw) {
      return null;
    }


    const parsed =
      JSON.parse(
        raw
      );


    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
      return null;
    }


    if (
      !parsed.values ||
      typeof parsed.values !==
        "object"
    ) {
      return null;
    }


    return parsed;

  } catch (error) {
    console.error(
      "Unable to read local stock draft:",
      error
    );

    return null;
  }
}


function writeLocalDraft(
  branchCode,
  date,
  mode,
  values
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }


  try {
    const draft = {
      branchCode:
        String(
          branchCode || ""
        )
          .trim()
          .toUpperCase(),

      date:
        String(
          date || ""
        ).trim(),

      mode:
        String(
          mode || ""
        )
          .trim()
          .toLowerCase(),

      values:
        values || {},

      updatedAt:
        Date.now(),
    };


    window.localStorage.setItem(
      stockDraftKey(
        branchCode,
        date,
        mode
      ),
      JSON.stringify(
        draft
      )
    );


    return draft;

  } catch (error) {
    console.error(
      "Unable to save local stock draft:",
      error
    );

    return null;
  }
}


function removeLocalDraft(
  branchCode,
  date,
  mode
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }


  try {
    window.localStorage.removeItem(
      stockDraftKey(
        branchCode,
        date,
        mode
      )
    );

  } catch (error) {
    console.error(
      "Unable to remove local stock draft:",
      error
    );
  }
}


function draftHasValues(
  draft
) {
  if (
    !draft?.values ||
    typeof draft.values !==
      "object"
  ) {
    return false;
  }


  return Object.values(
    draft.values
  ).some(
    (value) =>
      String(
        value ?? ""
      ).trim() !==
      ""
  );
}


function draftTimeLabel(
  timestamp
) {
  if (!timestamp) {
    return "";
  }


  const date =
    new Date(
      timestamp
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleTimeString(
    "en-US",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
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


  const [
    draftSavedAt,
    setDraftSavedAt,
  ] =
    useState(
      null
    );


  const [
    draftRevision,
    setDraftRevision,
  ] =
    useState(
      0
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
     LOCAL DRAFT FLAGS

     Used by the mode cards so staff can immediately see
     which mode has an unfinished draft on this device.
  ========================================================== */

  const localDraftFlags =
    useMemo(
      () => {
        const result = {
          daily:
            false,

          weekly:
            false,

          bakery:
            false,
        };


        if (
          !branch?.code ||
          !date
        ) {
          return result;
        }


        [
          "daily",
          "weekly",
          "bakery",
        ].forEach(
          (
            draftMode
          ) => {
            result[
              draftMode
            ] =
              draftHasValues(
                readLocalDraft(
                  branch.code,
                  date,
                  draftMode
                )
              );
          }
        );


        return result;
      },
      [
        branch?.code,
        date,
        draftRevision,
      ]
    );


  /* ==========================================================
     SAVE DRAFT LOCALLY

     This is intentionally synchronous browser LocalStorage.

     WHY:
     - no Google API calls while typing
     - no D1
     - survives refresh
     - survives accidental tab close
     - survives browser restart on the same device

     We save immediately on every valid quantity change so
     even a refresh directly after typing is protected.
  ========================================================== */

  function queueDraftSave(
    nextInputs
  ) {
    if (
      !mode ||
      !branch?.code ||
      !date
    ) {
      return;
    }


    const saved =
      writeLocalDraft(
        branch.code,
        date,
        mode,
        nextInputs
      );


    if (saved) {
      setDraftSavedAt(
        saved.updatedAt
      );


      setDraftRevision(
        (
          current
        ) =>
          current + 1
      );
    }
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


    /*
      LOCAL DRAFT FIRST.

      We keep the old backend draft as a fallback only so any
      older saved draft can still be restored during migration.
    */

    const localDraft =
      readLocalDraft(
        branch?.code,
        date,
        selectedMode
      );


    const serverDraft =
      initData.drafts?.[
        selectedMode
      ]?.values;


    const draft =
      localDraft?.values ||
      serverDraft ||
      null;


    if (
      localDraft?.updatedAt
    ) {
      setDraftSavedAt(
        localDraft.updatedAt
      );
    } else {
      setDraftSavedAt(
        null
      );
    }


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


    /*
      If an old backend draft was restored and there is no local
      copy yet, immediately migrate it into LocalStorage.
    */

    if (
      !localDraft &&
      serverDraft
    ) {
      const migrated =
        writeLocalDraft(
          branch?.code,
          date,
          selectedMode,
          starting
        );


      if (migrated) {
        setDraftSavedAt(
          migrated.updatedAt
        );


        setDraftRevision(
          (
            current
          ) =>
            current + 1
        );
      }
    }


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

  function clearDraft() {
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


    removeLocalDraft(
      branch?.code,
      date,
      mode
    );


    setDraftSavedAt(
      null
    );


    setDraftRevision(
      (
        current
      ) =>
        current + 1
    );
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


      /*
        FINAL GOOGLE SUBMISSION SUCCEEDED.

        Only now is it safe to delete the unfinished local draft.
      */

      removeLocalDraft(
        branch?.code,
        date,
        mode
      );


      setDraftSavedAt(
        null
      );


      setDraftRevision(
        (
          current
        ) =>
          current + 1
      );


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
              /*
                Make one final local snapshot before leaving
                the active entry screen.
              */

              if (
                mode &&
                branch?.code
              ) {
                writeLocalDraft(
                  branch.code,
                  date,
                  mode,
                  inputs
                );
              }


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


                    setDraftSavedAt(
                      null
                    );


                    setMode(
                      null
                    );


                    setPage(
                      "mode"
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
                  localDraftFlags.daily
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
                  localDraftFlags.weekly
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
                  localDraftFlags.bakery
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


                {draftSavedAt && (
                  <div className="bsr-draft-chip">
                    <FileClock
                      size={13}
                    />

                    DRAFT SAVED LOCALLY

                    {draftTimeLabel(
                      draftSavedAt
                    ) && (
                      <>
                        {" · "}

                        {draftTimeLabel(
                          draftSavedAt
                        )}
                      </>
                    )}
                  </div>
                )}
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
