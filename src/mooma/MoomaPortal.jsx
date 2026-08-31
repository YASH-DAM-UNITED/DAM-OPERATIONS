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
  RefreshCcw,
  Search,
} from "lucide-react";

import "./Mooma.css";
import MoomaLaunch from "./MoomaLaunch.jsx";
import MoomaDashboard from "./MoomaDashboard.jsx";


const API = {
  branches:
    "/api/mooma/branches",

  login:
    "/api/mooma/login",
};


const [
  launching,
  setLaunching,
] = useState(false);

const [
  activeModule,
  setActiveModule,
] = useState(null);

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


  /* =========================================================
     LOAD BRANCHES
  ========================================================= */

  async function loadBranches() {
    setLoading(true);
    setError("");

    try {
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


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Unable to load MOOMA branches."
        );
      }


      setBranches(
        Array.isArray(
          data.branches
        )
          ? data.branches
          : []
      );
    } catch (err) {
      console.error(
        "MOOMA branch error:",
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


  /* =========================================================
     FILTER
  ========================================================= */

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


  /* =========================================================
     SELECT BRANCH
  ========================================================= */

  function selectBranch(
    branch
  ) {
    setSelected(
      branch
    );

    setPassword("");

    setLoginError("");


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


  /* =========================================================
     LOGIN
  ========================================================= */

  async function login() {
    if (
      !selected ||
      !password.trim() ||
      loginBusy
    ) {
      return;
    }


    setLoginBusy(true);

    setLoginError("");


    try {
      const response =
        await fetch(
          API.login,
          {
            method: "POST",

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

                  password,
                }
              ),
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
            "Unable to authenticate."
        );
      }


      setAuthenticated(
        data.branch
      );


      setLaunching(true);
      window.setTimeout(() => {
        setLaunching(false);

      }, 1800);
    } catch (err) {
      console.error(
        "MOOMA login error:",
        err
      );


      setLoginError(
        err?.message ||
          "Incorrect branch password."
      );


      setPassword("");
    } finally {
      setLoginBusy(false);
    }
  }


  /* =========================================================
     TEMP AUTH SUCCESS SCREEN

     Next step we replace this with MoomaDashboard.
  ========================================================= */

if (launching && authenticated) {
  return (
    <MoomaLaunch
      branch={authenticated}
    />
  );
}

if (authenticated) {
  return (
    <MoomaDashboard
      branch={authenticated}

      onBack={() => {
        setAuthenticated(null);
        setSelected(null);
        setPassword("");
      }}

      onModule={(module) => {
        setActiveModule(module);

        console.log(
          "MOOMA MODULE:",
          module
        );
      }}
    />
  );
}
  /* =========================================================
     PORTAL
  ========================================================= */

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
      {/* BACKGROUND */}

      <div className="mooma-world-bg" />

      <div className="mooma-world-grid" />

      <div className="mooma-world-noise" />

      <div className="mooma-red-glow mooma-red-glow-one" />

      <div className="mooma-red-glow mooma-red-glow-two" />


      {/* TOP NAV */}

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


      {/* MAIN */}

      <main className="mooma-branch-main">
        {/* BACK */}

        <motion.button
          type="button"
          className="mooma-all-brands"
          onClick={
            onBack
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
          <ArrowLeft
            size={15}
          />

          ALL BRANDS
        </motion.button>


        {/* HERO */}

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


        {/* SELECTOR */}

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
          {/* SEARCH */}

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
                value={
                  search
                }
                disabled={
                  loading
                }
                placeholder={
                  loading
                    ? "Loading MOOMA branches..."
                    : "Search MOOMA branches"
                }
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


              <span>
                {loading
                  ? "LOADING"
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


          {/* LOADING */}

          <AnimatePresence
            mode="wait"
          >
            {loading && (
              <motion.div
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
                      ease: "linear",
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


          {/* ERROR */}

          {!loading &&
            error && (
              <div className="mooma-error-area">
                <AlertCircle
                  size={26}
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

                  RETRY
                </button>
              </div>
            )}


          {/* BRANCHES */}

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
                            branch.code
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
                            opacity:
                              0,

                            x:
                              -14,
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
                              {
                                branch.name
                              }
                            </strong>

                            <small>
                              {
                                branch.code
                              }
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


                {!filteredBranches.length && (
                  <div className="mooma-empty">
                    No MOOMA branches
                    found.
                  </div>
                )}


                {/* LOGIN */}

                <AnimatePresence>
                  {selected && (
                    <motion.div
                      ref={
                        readyRef
                      }
                      className="mooma-ready-panel"
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
                      exit={{
                        opacity:
                          0,
                      }}
                    >
                      <div className="mooma-ready-copy">
                        <small>
                          READY TO ENTER
                        </small>

                        <strong>
                          {
                            selected.code
                          }
                          {" • "}
                          {
                            selected.name
                          }
                        </strong>
                      </div>


                      <div className="mooma-login-area">
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
                            placeholder="Branch password"
                            onChange={(
                              event
                            ) => {
                              setPassword(
                                event
                                  .target
                                  .value
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
                                !showPassword
                              )
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


                      {loginError && (
                        <div className="mooma-login-error">
                          <AlertCircle
                            size={14}
                          />

                          {
                            loginError
                          }
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
        </motion.section>
      </main>


      {/* GIANT WORD */}

      <div className="mooma-giant-word">
        MOOMA
      </div>
    </motion.div>
  );
}
