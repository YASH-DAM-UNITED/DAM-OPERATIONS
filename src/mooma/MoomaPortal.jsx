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
  Building2,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";

import "./MoomaPortal.css";


/* =========================================================
   MOOMA API
========================================================= */

const MOOMA_API_BASE =
  import.meta.env.VITE_MOOMA_API_URL ||
  "https://dam-mooma-operations.damunited.workers.dev";


/* =========================================================
   HELPERS
========================================================= */

function cleanBranch(branch) {
  return {
    code: String(
      branch?.code || ""
    )
      .trim()
      .toUpperCase(),

    name: String(
      branch?.name || ""
    ).trim(),
  };
}


/* =========================================================
   MOOMA LOGO
========================================================= */

function MoomaLogo() {
  return (
    <div className="mooma-logo">
      <div className="mooma-logo-mark">
        M
      </div>

      <div className="mooma-logo-text">
        <strong>MOOMA</strong>
        <span>DAM OPERATIONS</span>
      </div>
    </div>
  );
}


/* =========================================================
   MOOMA PORTAL
========================================================= */

export default function MoomaPortal({
  onBack,
}) {
  const [branches, setBranches] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  const [showAll, setShowAll] =
    useState(false);

  const [activeBranch, setActiveBranch] =
    useState(null);

  const readyRef =
    useRef(null);


  /* =======================================================
     LOAD MOOMA BRANCHES
  ======================================================= */

  async function loadBranches() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          `${MOOMA_API_BASE}/api/mooma/branches`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",
            },

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
          "Unable to load MOOMA branches."
        );
      }

      const clean =
        (
          Array.isArray(
            result.branches
          )
            ? result.branches
            : []
        )
          .map(cleanBranch)
          .filter(
            (branch) =>
              branch.code &&
              branch.name
          );

      setBranches(clean);

    } catch (err) {
      console.error(
        "MOOMA branch loading error:",
        err
      );

      setError(
        err?.message ||
        "Unable to connect to MOOMA network."
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadBranches();
  }, []);


  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredBranches =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return branches;
      }

      return branches.filter(
        (branch) =>
          `${branch.code} ${branch.name}`
            .toLowerCase()
            .includes(query)
      );
    }, [
      branches,
      search,
    ]);


  const visibleBranches =
    useMemo(() => {
      if (
        search.trim() ||
        showAll
      ) {
        return filteredBranches;
      }

      return filteredBranches.slice(
        0,
        8
      );
    }, [
      filteredBranches,
      search,
      showAll,
    ]);


  /* =======================================================
     SELECT BRANCH
  ======================================================= */

  function selectBranch(branch) {
    setSelected(branch);

    window.requestAnimationFrame(
      () => {
        window.setTimeout(
          () => {
            readyRef.current?.scrollIntoView(
              {
                behavior:
                  "smooth",

                block:
                  "center",
              }
            );
          },
          150
        );
      }
    );
  }


  /* =======================================================
     BRANCH HOME
  ======================================================= */

  if (activeBranch) {
    return (
      <div className="mooma-page mooma-active-page">
        <div className="mooma-bg-grid" />
        <div className="mooma-orb mooma-orb-one" />
        <div className="mooma-orb mooma-orb-two" />

        <header className="mooma-topbar">
          <MoomaLogo />

          <button
            type="button"
            className="mooma-back-button"
            onClick={() =>
              setActiveBranch(null)
            }
          >
            <ArrowLeft size={16} />
            CHANGE BRANCH
          </button>
        </header>

        <main className="mooma-active-main">
          <motion.div
            className="mooma-active-card"
            initial={{
              opacity: 0,
              scale: 0.94,
              y: 30,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >
            <div className="mooma-success-icon">
              <CheckCircle2
                size={34}
              />
            </div>

            <span className="mooma-kicker">
              MOOMA / BRANCH NETWORK
            </span>

            <h1>
              {activeBranch.name}
            </h1>

            <div className="mooma-active-code">
              <MapPin size={15} />

              {activeBranch.code}
            </div>

            <p>
              MOOMA branch access is connected.
              We can now build this brand's
              operations independently from BART.
            </p>

            <div className="mooma-ready-system">
              <span />

              MOOMA SYSTEM READY
            </div>
          </motion.div>
        </main>
      </div>
    );
  }


  /* =======================================================
     BRANCH SELECT
  ======================================================= */

  return (
    <div className="mooma-page">
      <div className="mooma-bg-grid" />
      <div className="mooma-orb mooma-orb-one" />
      <div className="mooma-orb mooma-orb-two" />

      <header className="mooma-topbar">
        <MoomaLogo />

        <div className="mooma-network-status">
          <span />

          MOOMA NETWORK
        </div>
      </header>

      <main className="mooma-main">
        <button
          type="button"
          className="mooma-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          ALL BRANDS
        </button>


        <section className="mooma-hero">
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="mooma-kicker">
              <Sparkles size={13} />

              MOOMA / BRANCH ACCESS
            </div>

            <h1>
              Where are you
              <br />

              <span>
                operating?
              </span>
            </h1>

            <p>
              Select your MOOMA branch to
              enter the staff network.
            </p>
          </motion.div>


          <motion.div
            className="mooma-network-card"
            initial={{
              opacity: 0,
              scale: 0.96,
              y: 20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >
            <Building2 size={24} />

            <small>
              LIVE DIRECTORY
            </small>

            <strong>
              {loading
                ? "..."
                : branches.length}
            </strong>

            <span>
              MOOMA LOCATIONS
            </span>
          </motion.div>
        </section>


        <motion.section
          className="mooma-selector"
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <div className="mooma-search">
            {loading ? (
              <LoaderCircle
                size={18}
                className="mooma-spin"
              />
            ) : (
              <Search size={18} />
            )}

            <input
              value={search}
              disabled={loading}
              placeholder={
                loading
                  ? "Connecting MOOMA network..."
                  : "Search MOOMA branches"
              }
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                if (
                  event.target.value
                    .trim()
                ) {
                  setShowAll(true);
                }
              }}
            />

            <span>
              {loading
                ? "CONNECTING"
                : `${filteredBranches.length} LOCATIONS`}
            </span>
          </div>


          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                className="mooma-loading"
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
                <div className="mooma-radar">
                  <motion.div
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 2,
                      repeat:
                        Infinity,
                      ease:
                        "linear",
                    }}
                  />

                  <strong>M</strong>
                </div>

                <h3>
                  CONNECTING MOOMA NETWORK
                </h3>

                <p>
                  Reading the live MOOMA
                  branch directory.
                </p>
              </motion.div>
            )}
          </AnimatePresence>


          {!loading &&
            error && (
              <div className="mooma-error">
                <AlertCircle size={25} />

                <strong>
                  CONNECTION FAILED
                </strong>

                <span>
                  {error}
                </span>

                <button
                  type="button"
                  onClick={
                    loadBranches
                  }
                >
                  <RefreshCcw
                    size={15}
                  />

                  RETRY
                </button>
              </div>
            )}


          {!loading &&
            !error && (
              <>
                <div className="mooma-branch-list">
                  {visibleBranches.map(
                    (
                      branch,
                      index
                    ) => {
                      const active =
                        selected?.code ===
                        branch.code;

                      return (
                        <motion.button
                          type="button"
                          key={
                            branch.code
                          }
                          className={`mooma-branch ${
                            active
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            selectBranch(
                              branch
                            )
                          }
                          initial={{
                            opacity: 0,
                            x: -15,
                          }}
                          animate={{
                            opacity: 1,
                            x: 0,
                          }}
                          transition={{
                            delay:
                              Math.min(
                                index *
                                  0.03,
                                0.35
                              ),
                          }}
                        >
                          <span className="mooma-number">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <div className="mooma-pin">
                            <MapPin
                              size={17}
                            />
                          </div>

                          <div className="mooma-branch-info">
                            <strong>
                              {branch.name}
                            </strong>

                            <small>
                              {branch.code}
                            </small>
                          </div>

                          <ChevronRight
                            size={18}
                          />
                        </motion.button>
                      );
                    }
                  )}
                </div>


                {filteredBranches.length >
                  8 &&
                  !search.trim() && (
                    <button
                      type="button"
                      className="mooma-view-more"
                      onClick={() =>
                        setShowAll(
                          (value) =>
                            !value
                        )
                      }
                    >
                      {showAll
                        ? "SHOW LESS"
                        : `VIEW ${
                            filteredBranches.length -
                            8
                          } MORE BRANCHES`}
                    </button>
                  )}


                {filteredBranches.length ===
                  0 && (
                    <div className="mooma-empty">
                      No MOOMA branches found.
                    </div>
                  )}


                <AnimatePresence>
                  {selected && (
                    <motion.div
                      ref={readyRef}
                      className="mooma-ready"
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
                      }}
                    >
                      <div>
                        <small>
                          READY TO ENTER
                        </small>

                        <strong>
                          {selected.code}
                          {" • "}
                          {selected.name}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveBranch(
                            selected
                          )
                        }
                      >
                        CONTINUE

                        <ArrowRight
                          size={17}
                        />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
        </motion.section>
      </main>


      <div className="mooma-giant-word">
        MOOMA
      </div>
    </div>
  );
}
