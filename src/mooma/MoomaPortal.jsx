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
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Moon,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import {
  moomaFetch,
} from "./moomaApi.js";

import MoomaDashboard from "./MoomaDashboard.jsx";
import MoomaLoading from "./MoomaLoading.jsx";

import "./MoomaPortal.css";

import "./MoomaPortalTEST.css";
console.log("MOOMA PORTAL V2026-08-30-TEST");


/* ============================================================
   THEME
============================================================ */

function getInitialTheme() {
  const saved =
    localStorage.getItem(
      "mooma-theme"
    );

  if (
    saved === "light" ||
    saved === "dark"
  ) {
    return saved;
  }

  if (
    window.matchMedia &&
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
  ) {
    return "dark";
  }

  return "light";
}


/* ============================================================
   ACTIVE SCROLL
============================================================ */

function scrollToActive(
  ref,
  block = "center",
  delay = 120
) {
  window.requestAnimationFrame(
    () => {
      window.setTimeout(
        () => {
          ref?.current?.scrollIntoView({
            behavior: "smooth",
            block,
          });
        },
        delay
      );
    }
  );
}


/* ============================================================
   PORTAL
============================================================ */

export default function MoomaPortal({
  onBack,
}) {
  const [
    branches,
    setBranches,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    authenticated,
    setAuthenticated,
  ] = useState(null);

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loginBusy,
    setLoginBusy,
  ] = useState(false);

  const [
    loginError,
    setLoginError,
  ] = useState("");

  const [
    theme,
    setTheme,
  ] = useState(
    getInitialTheme
  );

  const [
    entranceDone,
    setEntranceDone,
  ] = useState(false);

  const readyRef =
    useRef(null);

  const errorRef =
    useRef(null);

  const branchListRef =
    useRef(null);


  /* ============================================================
     THEME
  ============================================================ */

  useEffect(() => {
    localStorage.setItem(
      "mooma-theme",
      theme
    );
  }, [theme]);


  function toggleTheme() {
    setTheme(
      (current) =>
        current === "dark"
          ? "light"
          : "dark"
    );
  }


  /* ============================================================
     INITIAL ENTRANCE
  ============================================================ */

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setEntranceDone(true);
        },
        900
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, []);


  /* ============================================================
     LOAD BRANCHES
  ============================================================ */

  async function loadBranches() {
    try {
      setLoading(true);
      setError("");
      setLoginError("");

      const result =
        await moomaFetch(
          "/api/mooma/branches"
        );

      const clean =
        Array.isArray(
          result?.branches
        )
          ? result.branches
              .map(
                (branch) => ({
                  code:
                    String(
                      branch?.code ||
                        ""
                    )
                      .trim()
                      .toUpperCase(),

                  name:
                    String(
                      branch?.name ||
                        ""
                    ).trim(),
                })
              )
              .filter(
                (branch) =>
                  branch.code &&
                  branch.name
              )
          : [];

      setBranches(clean);

      window.setTimeout(
        () => {
          scrollToActive(
            branchListRef,
            "start",
            50
          );
        },
        200
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to connect to the MOOMA branch network."
      );

      window.setTimeout(
        () => {
          scrollToActive(
            errorRef,
            "center"
          );
        },
        100
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadBranches();
  }, []);


  /* ============================================================
     SEARCH
  ============================================================ */

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


  /* ============================================================
     SELECT BRANCH
  ============================================================ */

  function chooseBranch(
    branch
  ) {
    setSelected(branch);
    setPassword("");
    setLoginError("");

    scrollToActive(
      readyRef,
      "center",
      150
    );
  }


  /* ============================================================
     LOGIN
  ============================================================ */

  async function loginBranch() {
    if (
      !selected?.code ||
      !password.trim() ||
      loginBusy
    ) {
      return;
    }

    try {
      setLoginBusy(true);
      setLoginError("");

      const result =
        await moomaFetch(
          "/api/mooma/login",
          {
            method: "POST",

            body:
              JSON.stringify({
                branchCode:
                  selected.code,

                password,
              }),
          }
        );

      if (
        !result?.success ||
        !result?.branch
      ) {
        throw new Error(
          result?.message ||
            "Unable to access this branch."
        );
      }

      setAuthenticated(
        result.branch
      );
    } catch (err) {
      setLoginError(
        err?.message ||
          "Incorrect password or branch access failed."
      );

      scrollToActive(
        readyRef,
        "center"
      );
    } finally {
      setLoginBusy(false);
    }
  }


  function handlePasswordKeyDown(
    event
  ) {
    if (
      event.key === "Enter"
    ) {
      loginBranch();
    }
  }


  /* ============================================================
     DASHBOARD
  ============================================================ */

  if (authenticated) {
    return (
      <div
        data-mooma-theme={
          theme
        }
      >
        <MoomaDashboard
          branch={
            authenticated
          }
          onBack={() => {
            setAuthenticated(
              null
            );

            setPassword("");
            setLoginError("");

            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
          onLogout={() => {
            setAuthenticated(
              null
            );

            setSelected(null);
            setPassword("");
            setLoginError("");

            onBack?.();
          }}
        />
      </div>
    );
  }


  /* ============================================================
     PORTAL UI
  ============================================================ */

  return (
    <div
      className="mooma-portal"
      data-mooma-theme={theme}
      
    >
      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="mp-grid" />

      <div className="mp-glow mp-glow-one" />

      <div className="mp-glow mp-glow-two" />

      <div className="mp-glow mp-glow-three" />

      <div className="mp-background-word">
        MOOMA
      </div>


      {/* ======================================================
          STARTUP ANIMATION
      ====================================================== */}

      <AnimatePresence>
        {!entranceDone && (
          <motion.div
            className="mp-entry-overlay"
            initial={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.45,
            }}
          >
            <motion.div
              className="mp-entry-core"
              initial={{
                scale: 0.82,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                duration: 0.65,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
            >
              <div className="mp-entry-rings">
                <i />
                <i />
                <i />

                <span>
                  M
                </span>
              </div>

              <small>
                DAM OPERATIONS
              </small>

              <strong>
                MOOMA
              </strong>

              <p>
                Connecting branch
                network...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="mp-header">
        <button
          type="button"
          className="mp-back-button"
          onClick={onBack}
        >
          <ArrowLeft
            size={16}
          />

          <span>
            ALL BRANDS
          </span>
        </button>


        <motion.div
          className="mp-brand"
          initial={{
            opacity: 0,
            y: -12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
          }}
        >
          <div className="mp-brand-mark">
            M
          </div>

          <div className="mp-brand-copy">
            <strong>
              MOOMA
            </strong>

            <span>
              STAFF OPERATIONS
            </span>
          </div>
        </motion.div>


        <div className="mp-header-actions">
          <button
            type="button"
            className="mp-theme-button"
            onClick={
              toggleTheme
            }
            title={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            <AnimatePresence
              mode="wait"
            >
              {theme === "dark" ? (
                <motion.span
                  key="sun"
                  initial={{
                    rotate: -90,
                    opacity: 0,
                  }}
                  animate={{
                    rotate: 0,
                    opacity: 1,
                  }}
                  exit={{
                    rotate: 90,
                    opacity: 0,
                  }}
                >
                  <Sun
                    size={17}
                  />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{
                    rotate: 90,
                    opacity: 0,
                  }}
                  animate={{
                    rotate: 0,
                    opacity: 1,
                  }}
                  exit={{
                    rotate: -90,
                    opacity: 0,
                  }}
                >
                  <Moon
                    size={17}
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </button>


          <div className="mp-network-status">
            <i />

            <span>
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="mp-main">
        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="mp-hero">
          <motion.div
            className="mp-hero-copy"
            initial={{
              opacity: 0,
              x: -25,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              duration: 0.75,
              delay: 0.2,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
          >
            <div className="mp-kicker">
              <Sparkles
                size={13}
              />

              MOOMA / BRANCH ACCESS
            </div>


            <h1>
              Choose your
              <br />

              <span>
                branch.
              </span>
            </h1>


            <p>
              Select the MOOMA
              location you are
              operating from, then
              authenticate to open
              your branch workspace.
            </p>


            <div className="mp-security-line">
              <ShieldCheck
                size={15}
              />

              SECURE BRANCH ACCESS
            </div>
          </motion.div>


          <motion.div
            className="mp-directory-card"
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.75,
              delay: 0.35,
            }}
          >
            <div className="mp-directory-icon">
              <MapPin
                size={22}
              />
            </div>

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

            <div className="mp-directory-line">
              <i />

              GOOGLE SHEETS CONNECTED
            </div>
          </motion.div>
        </section>


        {/* ====================================================
            BRANCH DIRECTORY
        ==================================================== */}

        <motion.section
          ref={branchListRef}
          className="mp-branch-section"
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            delay: 0.45,
          }}
        >
          <div className="mp-branch-toolbar">
            <div className="mp-search-box">
              {loading ? (
                <LoaderCircle
                  size={17}
                  className="mp-spin"
                />
              ) : (
                <Search
                  size={17}
                />
              )}

              <input
                type="text"
                value={search}
                placeholder="Search branch name or code"
                disabled={
                  loading
                }
                onChange={(
                  event
                ) => {
                  setSearch(
                    event.target
                      .value
                  );
                }}
              />

              <span>
                {
                  filteredBranches.length
                }{" "}
                LOCATIONS
              </span>
            </div>


            <button
              type="button"
              className="mp-refresh-button"
              onClick={
                loadBranches
              }
              disabled={
                loading
              }
            >
              <RefreshCcw
                size={15}
                className={
                  loading
                    ? "mp-spin"
                    : ""
                }
              />

              <span>
                REFRESH
              </span>
            </button>
          </div>


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading && (
            <div className="mp-loading-area">
              <MoomaLoading
                label="Loading MOOMA branches"
              />
            </div>
          )}


          {/* ==================================================
              ERROR
          ================================================== */}

          {!loading &&
            error && (
              <motion.div
                ref={errorRef}
                className="mp-error-card"
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <div className="mp-error-icon">
                  <AlertCircle
                    size={25}
                  />
                </div>

                <strong>
                  CONNECTION FAILED
                </strong>

                <p>
                  {error}
                </p>

                <button
                  type="button"
                  onClick={
                    loadBranches
                  }
                >
                  <RefreshCcw
                    size={15}
                  />

                  TRY AGAIN
                </button>
              </motion.div>
            )}


          {/* ==================================================
              BRANCHES
          ================================================== */}

          {!loading &&
            !error && (
              <>
                {filteredBranches.length >
                0 ? (
                  <div className="mp-branch-grid">
                    {filteredBranches.map(
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
                            className={`mp-branch-card ${
                              active
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              chooseBranch(
                                branch
                              )
                            }
                            initial={{
                              opacity: 0,
                              y: 18,
                              scale:
                                0.97,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              scale: 1,
                            }}
                            transition={{
                              duration:
                                0.42,

                              delay:
                                Math.min(
                                  index *
                                    0.05,
                                  0.4
                                ),
                            }}
                            whileHover={{
                              y: -5,
                            }}
                            whileTap={{
                              scale:
                                0.985,
                            }}
                          >
                            <div className="mp-branch-top">
                              <span className="mp-branch-index">
                                {String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              {active && (
                                <motion.span
                                  className="mp-selected-badge"
                                  initial={{
                                    scale: 0,
                                  }}
                                  animate={{
                                    scale: 1,
                                  }}
                                >
                                  <CheckCircle2
                                    size={15}
                                  />
                                </motion.span>
                              )}
                            </div>


                            <div className="mp-branch-icon">
                              <MapPin
                                size={18}
                              />
                            </div>


                            <div className="mp-branch-content">
                              <small>
                                {
                                  branch.code
                                }
                              </small>

                              <strong>
                                {
                                  branch.name
                                }
                              </strong>
                            </div>


                            <div className="mp-branch-open">
                              SELECT BRANCH

                              <ArrowRight
                                size={15}
                              />
                            </div>
                          </motion.button>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="mp-empty-state">
                    <Search
                      size={23}
                    />

                    <strong>
                      No branches
                      found
                    </strong>

                    <p>
                      Try another
                      branch name or
                      code.
                    </p>
                  </div>
                )}
              </>
            )}


          {/* ==================================================
              LOGIN / READY TO ENTER
          ================================================== */}

          <AnimatePresence>
            {selected &&
              !loading &&
              !error && (
                <motion.div
                  ref={
                    readyRef
                  }
                  className="mp-ready-panel"
                  initial={{
                    opacity: 0,
                    y: 30,
                    scale:
                      0.97,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: 20,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                >
                  <div className="mp-ready-left">
                    <div className="mp-ready-check">
                      <CheckCircle2
                        size={21}
                      />
                    </div>

                    <div>
                      <small>
                        READY TO
                        ENTER
                      </small>

                      <strong>
                        {
                          selected.code
                        }{" "}
                        •{" "}
                        {
                          selected.name
                        }
                      </strong>

                      <p>
                        Enter this
                        branch's
                        password to
                        continue.
                      </p>
                    </div>
                  </div>


                  <div className="mp-login-area">
                    <div className="mp-password-wrap">
                      <LockKeyhole
                        size={16}
                      />

                      <input
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          password
                        }
                        placeholder="Branch password"
                        autoComplete="current-password"
                        onChange={(
                          event
                        ) => {
                          setPassword(
                            event.target
                              .value
                          );

                          if (
                            loginError
                          ) {
                            setLoginError(
                              ""
                            );
                          }
                        }}
                        onKeyDown={
                          handlePasswordKeyDown
                        }
                      />

                      <button
                        type="button"
                        className="mp-password-toggle"
                        onClick={() =>
                          setShowPassword(
                            (
                              current
                            ) =>
                              !current
                          )
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff
                            size={16}
                          />
                        ) : (
                          <Eye
                            size={16}
                          />
                        )}
                      </button>
                    </div>


                    <button
                      type="button"
                      className="mp-continue-button"
                      disabled={
                        !password.trim() ||
                        loginBusy
                      }
                      onClick={
                        loginBranch
                      }
                    >
                      {loginBusy ? (
                        <>
                          <LoaderCircle
                            size={16}
                            className="mp-spin"
                          />

                          CHECKING
                        </>
                      ) : (
                        <>
                          CONTINUE

                          <ArrowRight
                            size={16}
                          />
                        </>
                      )}
                    </button>
                  </div>


                  <AnimatePresence>
                    {loginError && (
                      <motion.div
                        className="mp-login-error"
                        initial={{
                          opacity: 0,
                          y: -6,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                        }}
                      >
                        <AlertCircle
                          size={14}
                        />

                        {
                          loginError
                        }
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
          </AnimatePresence>
        </motion.section>
      </main>
    </div>
  );
}
