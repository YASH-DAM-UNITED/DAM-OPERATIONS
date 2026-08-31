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
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  RefreshCcw,
  Search,
} from "lucide-react";


import "./Mooma.css";
import MoomaDashboard from "./MoomaDashboard.jsx";

/* ============================================================
   MOOMA API
============================================================ */

const API = {
  branches: "/api/mooma/branches",
  login: "/api/mooma/login",
};


/* ============================================================
   MOOMA PORTAL
============================================================ */

export default function MoomaPortal({
  onBack,
}) {
  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */

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
    authenticated,
    setAuthenticated,
  ] = useState(null);


  const readyRef =
    useRef(null);


  /* ============================================================
     LOAD MOOMA BRANCHES
  ============================================================ */

  async function loadBranches() {
    setLoading(true);

    setError("");

    try {
      console.log(
        "[MOOMA] Loading branches:",
        API.branches
      );


      const response =
        await fetch(
          API.branches,
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


      console.log(
        "[MOOMA] Branch API HTTP:",
        response.status
      );


      const raw =
        await response.text();


      console.log(
        "[MOOMA] Branch API RAW:",
        raw
      );


      let data;


      try {
        data =
          JSON.parse(raw);
      } catch (parseError) {
        console.error(
          "[MOOMA] JSON PARSE ERROR:",
          parseError
        );


        throw new Error(
          `MOOMA API returned invalid data. HTTP ${response.status}`
        );
      }


      console.log(
        "[MOOMA] Branch API JSON:",
        data
      );


      if (!response.ok) {
        throw new Error(
          data?.message ||
            `MOOMA API failed. HTTP ${response.status}`
        );
      }


      if (!data?.success) {
        throw new Error(
          data?.message ||
            "MOOMA backend returned success: false."
        );
      }


      if (
        !Array.isArray(
          data.branches
        )
      ) {
        throw new Error(
          "MOOMA branch list is missing from API response."
        );
      }


      setBranches(
        data.branches
      );


      console.log(
        `[MOOMA] CONNECTED — ${data.branches.length} branches loaded`
      );
    } catch (err) {
      console.error(
        "[MOOMA] CONNECTION ERROR:",
        err
      );


      setBranches([]);


      setError(
        err?.message ||
          "Unable to connect to MOOMA network."
      );
    } finally {
      setLoading(false);
    }
  }


  /* ============================================================
     INITIAL CONNECTION
  ============================================================ */

  useEffect(() => {
    loadBranches();
  }, []);


  /* ============================================================
     SEARCH / FILTER
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
        (branch) => {
          const code =
            String(
              branch?.code ||
                ""
            ).toLowerCase();


          const name =
            String(
              branch?.name ||
                ""
            ).toLowerCase();


          return (
            code.includes(
              query
            ) ||
            name.includes(
              query
            )
          );
        }
      );
    }, [
      branches,
      search,
    ]);


  /* ============================================================
     SELECT BRANCH
  ============================================================ */

  function selectBranch(
    branch
  ) {
    setSelected(
      branch
    );


    setPassword("");


    setLoginError("");


    setShowPassword(
      false
    );


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


  /* ============================================================
     BRANCH LOGIN
  ============================================================ */

  async function login() {
    if (!selected) {
      setLoginError(
        "Please select a branch."
      );

      return;
    }


    if (
      !password.trim()
    ) {
      setLoginError(
        "Enter the branch password."
      );

      return;
    }


    if (loginBusy) {
      return;
    }


    setLoginBusy(true);

    setLoginError("");


    try {
      console.log(
        "[MOOMA] Authenticating:",
        selected.code
      );


      const response =
        await fetch(
          API.login,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  branchCode:
                    selected.code,

                  password:
                    password.trim(),
                }
              ),
          }
        );


      console.log(
        "[MOOMA] Login HTTP:",
        response.status
      );


      const raw =
        await response.text();


      console.log(
        "[MOOMA] Login RAW:",
        raw
      );


      let data;


      try {
        data =
          JSON.parse(raw);
      } catch (parseError) {
        console.error(
          "[MOOMA] LOGIN JSON ERROR:",
          parseError
        );


        throw new Error(
          `MOOMA login returned invalid data. HTTP ${response.status}`
        );
      }


      console.log(
        "[MOOMA] Login JSON:",
        data
      );


      if (!response.ok) {
        throw new Error(
          data?.message ||
            `MOOMA login failed. HTTP ${response.status}`
        );
      }


      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Incorrect branch password."
        );
      }


      /*
       * Some backend versions return:
       *
       * data.branch
       *
       * Other versions may only return success.
       *
       * So we safely fall back to the selected branch.
       */

      const verifiedBranch =
        data?.branch &&
        typeof data.branch ===
          "object"
          ? data.branch
          : selected;


      setAuthenticated(
        verifiedBranch
      );


      setPassword("");


      console.log(
        "[MOOMA] AUTHENTICATED:",
        verifiedBranch
      );
    } catch (err) {
      console.error(
        "[MOOMA] LOGIN ERROR:",
        err
      );


      setLoginError(
        err?.message ||
          "Unable to authenticate this branch."
      );


      setPassword("");
    } finally {
      setLoginBusy(false);
    }
  }


  /* ============================================================
     TEMPORARY LOGIN SUCCESS

     We keep this simple until branch connection is confirmed.

     Next:
     MoomaDashboard.jsx will replace this screen.
  ============================================================ */

if (authenticated) {
  return (
    <MoomaDashboard
      branch={authenticated}

      onLogout={() => {
        setAuthenticated(null);
        setSelected(null);
        setPassword("");
        setLoginError("");
        setShowPassword(false);
      }}

      onModule={(moduleId) => {
        console.log(
          "[MOOMA] MODULE CLICK:",
          moduleId
        );
      }}
    />
  );
}

  /* ============================================================
     MOOMA PORTAL
  ============================================================ */

  return (
    <motion.div
      className="mooma-branch-world"
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
        duration: 0.28,
      }}
    >
      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="mooma-world-bg" />

      <div className="mooma-world-grid" />

      <div className="mooma-world-noise" />

      <div className="mooma-red-glow mooma-red-glow-one" />

      <div className="mooma-red-glow mooma-red-glow-two" />


      {/* ======================================================
          TOP NAVIGATION
      ====================================================== */}

      <nav className="mooma-branch-nav">
        <div className="mooma-dam-logo">
          <div className="mooma-dam-mark">
            M
          </div>


          <div className="mooma-dam-copy">
            <strong>
              MOOMA
            </strong>

            <span>
              DAM OPERATIONS
            </span>
          </div>
        </div>


        <div className="mooma-network-status">
          <span />

          MOOMA NETWORK
        </div>
      </nav>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="mooma-branch-main">
        {/* ALL BRANDS */}

        <motion.button
          type="button"
          className="mooma-all-brands"
          onClick={() => {
            setSelected(
              null
            );

            setPassword("");

            setLoginError("");

            onBack?.();
          }}
          initial={{
            opacity: 0,
            x: -10,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          whileHover={{
            x: -3,
          }}
        >
          <ArrowLeft
            size={15}
          />

          ALL BRANDS
        </motion.button>


        {/* ====================================================
            TITLE
        ==================================================== */}

        <motion.div
          className="mooma-branch-title"
          initial={{
            opacity: 0,
            y: 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
          }}
        >
          <span>
            MOOMA / BRANCH ACCESS
          </span>


          <h1>
            Where are you
            <br />

            <em>
              operating?
            </em>
          </h1>


          <p>
            Select your MOOMA
            branch to continue into
            the staff network.
          </p>
        </motion.div>


        {/* ====================================================
            BRANCH SELECTOR
        ==================================================== */}

        <motion.section
          className="mooma-branch-selector"
          initial={{
            opacity: 0,
            y: 32,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.12,
            duration: 0.55,
          }}
        >
          {/* ==================================================
              SEARCH
          ================================================== */}

          <div className="mooma-search-row">
            <div className="mooma-search-box">
              {loading ? (
                <LoaderCircle
                  size={18}
                  className="mooma-spinner"
                />
              ) : (
                <Search
                  size={18}
                />
              )}


              <input
                value={search}
                disabled={loading}
                placeholder={
                  loading
                    ? "Connecting MOOMA network..."
                    : "Search MOOMA branches"
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
              />


              <span>
                {loading
                  ? "CONNECTING"
                  : `${filteredBranches.length} LOCATIONS`}
              </span>
            </div>


            <button
              type="button"
              className="mooma-refresh"
              onClick={
                loadBranches
              }
              disabled={
                loading
              }
              title="Refresh MOOMA branches"
            >
              <RefreshCcw
                size={15}
                className={
                  loading
                    ? "mooma-spinner"
                    : ""
                }
              />
            </button>
          </div>


          {/* ==================================================
              LOADING
          ================================================== */}

          <AnimatePresence
            mode="wait"
          >
            {loading && (
              <motion.div
                key="loading"
                className="mooma-loading-area"
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
                <div className="mooma-loader-radar">
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

                  <span>
                    M
                  </span>
                </div>


                <strong>
                  CONNECTING MOOMA
                  NETWORK
                </strong>


                <p>
                  Reading live branch
                  directory from DAM
                  Operations.
                </p>


                <div className="mooma-loader-line">
                  <motion.i
                    animate={{
                      x: [
                        "-100%",
                        "320%",
                      ],
                    }}
                    transition={{
                      repeat:
                        Infinity,

                      duration:
                        1.4,

                      ease:
                        "easeInOut",
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* ==================================================
              CONNECTION ERROR
          ================================================== */}

          {!loading &&
            error && (
              <motion.div
                className="mooma-error-area"
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <AlertCircle
                  size={27}
                />


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
                    size={14}
                  />

                  RETRY CONNECTION
                </button>
              </motion.div>
            )}


          {/* ==================================================
              BRANCHES
          ================================================== */}

          {!loading &&
            !error && (
              <>
                <div className="mooma-branch-items">
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
                            branch.code ||
                            index
                          }
                          className={`mooma-branch-item ${
                            active
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            selectBranch(
                              branch
                            )
                          }
                          initial={{
                            opacity: 0,
                            x: -14,
                          }}
                          animate={{
                            opacity: 1,
                            x: 0,
                          }}
                          transition={{
                            delay:
                              Math.min(
                                index *
                                  0.05,
                                0.3
                              ),
                          }}
                          whileHover={{
                            x: 5,
                          }}
                          whileTap={{
                            scale:
                              0.99,
                          }}
                        >
                          <span className="mooma-branch-index">
                            {String(
                              index +
                                1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>


                          <div className="mooma-location-icon">
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


                          <ArrowRight
                            size={17}
                          />
                        </motion.button>
                      );
                    }
                  )}
                </div>


                {/* NO RESULTS */}

                {!filteredBranches.length && (
                  <div className="mooma-empty">
                    No MOOMA branches
                    found.
                  </div>
                )}


                {/* ============================================
                    LOGIN PANEL
                ============================================ */}

                <AnimatePresence>
                  {selected && (
                    <motion.div
                      ref={
                        readyRef
                      }
                      className="mooma-ready-panel"
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
                      transition={{
                        duration: 0.25,
                      }}
                    >
                      <div className="mooma-ready-copy">
                        <small>
                          READY TO ENTER
                        </small>


                        <strong>
                          {selected.code}
                          {" • "}
                          {selected.name}
                        </strong>
                      </div>


                      <div className="mooma-login-area">
                        {/* PASSWORD */}

                        <div className="mooma-password-box">
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
                            autoComplete="off"
                            placeholder="Branch password"
                            onChange={(
                              event
                            ) => {
                              setPassword(
                                event.target.value
                              );

                              setLoginError(
                                ""
                              );
                            }}
                            onKeyDown={(
                              event
                            ) => {
                              if (
                                event.key ===
                                "Enter"
                              ) {
                                login();
                              }
                            }}
                          />


                          <button
                            type="button"
                            onClick={() =>
                              setShowPassword(
                                (
                                  current
                                ) =>
                                  !current
                              )
                            }
                            title={
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


                        {/* CONTINUE */}

                        <button
                          type="button"
                          className="mooma-enter-button"
                          disabled={
                            loginBusy ||
                            !password.trim()
                          }
                          onClick={
                            login
                          }
                        >
                          {loginBusy ? (
                            <>
                              <LoaderCircle
                                size={16}
                                className="mooma-spinner"
                              />

                              VERIFYING
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


                      {/* LOGIN ERROR */}

                      {loginError && (
                        <motion.div
                          className="mooma-login-error"
                          initial={{
                            opacity: 0,
                            y: -4,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                        >
                          <AlertCircle
                            size={14}
                          />

                          {loginError}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
        </motion.section>
      </main>


      {/* ======================================================
          GIANT BACKGROUND WORD
      ====================================================== */}

      <div className="mooma-giant-word">
        MOOMA
      </div>
    </motion.div>
  );
}
