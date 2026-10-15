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

import GlorDashboard from "./GlorDashboard.jsx";
import BartDeliveryNotes from "../BartDeliveryNotes.jsx";
import BrandScheduleView from "../BrandScheduleView.jsx";
import GlorLaunch from "./GlorLaunch.jsx";
import GlorStockRecord from "./GlorStockRecord.jsx";
import GlorStockView from "./GlorStockView.jsx";
import GlorStockTransfer from "./GlorStockTransfer.jsx";

import "./Glor.css";


/* ============================================================
   GLOR API
============================================================ */

const API = {
  branches: "/api/glor/branches",
  login: "/api/glor/login",
};


/* ============================================================
   GLOR PORTAL
============================================================ */

export default function GlorPortal({
  onBack,
}) {

  /* ==========================================================
     STATE
  ========================================================== */

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

  const [
    launching,
    setLaunching,
  ] = useState(false);

  /*
   * Controls which GLOR module
   * is currently open.
   *
   * null = dashboard
   */
  const [
    activeModule,
    setActiveModule,
  ] = useState(null);


  const readyRef =
    useRef(null);


  /* ==========================================================
     LOAD GLOR BRANCHES
  ========================================================== */

  async function loadBranches() {

    setLoading(true);
    setError("");

    try {

      console.log(
        "[GLOR] Loading branches:",
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
        "[GLOR] Branch API HTTP:",
        response.status
      );


      const raw =
        await response.text();


      console.log(
        "[GLOR] Branch API RAW:",
        raw
      );


      let data;


      try {

        data =
          JSON.parse(raw);

      } catch (
        parseError
      ) {

        console.error(
          "[GLOR] Branch JSON error:",
          parseError
        );


        throw new Error(
          `GLOR API returned invalid data. HTTP ${response.status}`
        );
      }


      if (!response.ok) {

        throw new Error(
          data?.message ||
            `GLOR API failed. HTTP ${response.status}`
        );
      }


      if (!data?.success) {

        throw new Error(
          data?.message ||
            "GLOR backend returned success: false."
        );
      }


      if (
        !Array.isArray(
          data?.branches
        )
      ) {

        throw new Error(
          "GLOR branch list is missing from API response."
        );
      }


      setBranches(
        data.branches
      );


      console.log(
        `[GLOR] CONNECTED — ${data.branches.length} branches`
      );

    } catch (err) {

      console.error(
        "[GLOR] CONNECTION ERROR:",
        err
      );


      setBranches([]);


      setError(
        err?.message ||
          "Unable to connect to GLOR network."
      );

    } finally {

      setLoading(false);
    }
  }


  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {

    loadBranches();

  }, []);


  /* ==========================================================
     FILTER BRANCHES
  ========================================================== */

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
              branch?.code || ""
            ).toLowerCase();


          const name =
            String(
              branch?.name || ""
            ).toLowerCase();


          return (
            code.includes(query) ||
            name.includes(query)
          );
        }
      );

    }, [
      branches,
      search,
    ]);


  /* ==========================================================
     SELECT BRANCH
  ========================================================== */

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

            readyRef.current
              ?.scrollIntoView({
                behavior:
                  "smooth",

                block:
                  "center",
              });

          },
          150
        );
      }
    );
  }


  /* ==========================================================
     LOGIN
  ========================================================== */

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
        "[GLOR] Authenticating:",
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
              JSON.stringify({
                branchCode:
                  selected.code,

                password:
                  password.trim(),
              }),
          }
        );


      console.log(
        "[GLOR] Login HTTP:",
        response.status
      );


      const raw =
        await response.text();


      console.log(
        "[GLOR] Login RAW:",
        raw
      );


      let data;


      try {

        data =
          JSON.parse(raw);

      } catch (
        parseError
      ) {

        console.error(
          "[GLOR] Login JSON error:",
          parseError
        );


        throw new Error(
          `GLOR login returned invalid data. HTTP ${response.status}`
        );
      }


      if (!response.ok) {

        throw new Error(
          data?.message ||
            `GLOR login failed. HTTP ${response.status}`
        );
      }


      if (!data?.success) {

        throw new Error(
          data?.message ||
            "Incorrect branch password."
        );
      }


      /*
       * If backend gives us
       * verified branch information,
       * merge it with selected branch.
       */

      const verifiedBranch =
        data?.branch &&
        typeof data.branch ===
          "object"
          ? {
              ...selected,
              ...data.branch,
            }
          : selected;


      /*
       * Clear previous module.
       */

      setActiveModule(
        null
      );


      /*
       * Authenticate branch.
       */

      setAuthenticated(
        verifiedBranch
      );


      setPassword("");

      setLoginError("");


      /*
       * Start rocket animation.
       */

      setLaunching(
        true
      );


      /*
       * Rocket animation:
       * 2.2 seconds
       */

      window.setTimeout(
        () => {

          setLaunching(
            false
          );

        },
        2200
      );


      console.log(
        "[GLOR] AUTHENTICATED:",
        verifiedBranch
      );

    } catch (err) {

      console.error(
        "[GLOR] LOGIN ERROR:",
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


  /* ==========================================================
     LOGOUT / CHANGE BRANCH
  ========================================================== */

  function handleLogout() {

    setLaunching(
      false
    );

    /*
     * IMPORTANT:
     * Close any active module.
     */

    setActiveModule(
      null
    );


    setAuthenticated(
      null
    );


    setSelected(
      null
    );


    setPassword("");

    setLoginError("");

    setShowPassword(
      false
    );

    setSearch("");
  }


  /* ==========================================================
     OPEN MODULE
  ========================================================== */

  function handleModule(
    moduleId
  ) {

    console.log(
      "[GLOR] MODULE CLICK:",
      moduleId
    );


    if (moduleId === "delivery-notes") {
      setActiveModule("delivery-notes");
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }

    /*
     * STOCK RECORD
     */

    if (
      moduleId ===
      "stock-record"
    ) {

      setActiveModule(
        "stock-record"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }


    /*
     * STOCK VIEW
     */

    if (
      moduleId ===
      "stock-view"
    ) {

      setActiveModule(
        "stock-view"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }


    /*
     * STOCK TRANSFER
     *
     * Accept both IDs because some dashboard
     * versions send "transfer" while others
     * send "stock-transfer".
     */

    if (
      moduleId ===
        "stock-transfer" ||
      moduleId ===
        "transfer"
    ) {

      console.log(
        "[GLOR] OPENING STOCK TRANSFER"
      );

      setActiveModule(
        "stock-transfer"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }


    /*
     * STAFF SCHEDULE
     *
     * Accept both IDs now so the route is
     * ready when the page is connected.
     */

    if (moduleId === "staff-schedule" || moduleId === "schedule") {
      setActiveModule("staff-schedule");
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }

    console.log(
      "[GLOR] MODULE NOT CONNECTED YET:",
      moduleId
    );
  }


  /* ==========================================================
     RETURN TO DASHBOARD
  ========================================================== */

  function returnToDashboard() {

    setActiveModule(
      null
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  /* ==========================================================
     ROCKET LAUNCH SCREEN

     IMPORTANT:
     This stays BEFORE dashboard/modules.
  ========================================================== */

  if (
    authenticated &&
    launching
  ) {

    return (
      <GlorLaunch
        branch={
          authenticated
        }
      />
    );
  }


  if (authenticated && activeModule === "staff-schedule") {
    return <BrandScheduleView brand="glor" branch={authenticated} onBack={returnToDashboard} />;
  }

  if (authenticated && activeModule === "delivery-notes") {
    return <BartDeliveryNotes branch={authenticated} brand="glor" onBack={returnToDashboard} />;
  }

  /* ==========================================================
     STOCK RECORD
  ========================================================== */

  if (
    authenticated &&
    activeModule ===
      "stock-record"
  ) {

    return (
      <GlorStockRecord
        branch={
          authenticated
        }

        onBack={
          returnToDashboard
        }
      />
    );
  }


  /* ==========================================================
     STOCK VIEW
  ========================================================== */

  if (
    authenticated &&
    activeModule ===
      "stock-view"
  ) {

    return (
      <GlorStockView
        branch={
          authenticated
        }

        onBack={
          returnToDashboard
        }
      />
    );
  }


  /* ==========================================================
     STOCK TRANSFER
  ========================================================== */

  if (
    authenticated &&
    activeModule ===
      "stock-transfer"
  ) {

    return (
      <GlorStockTransfer
        branch={
          authenticated
        }

        onBack={
          returnToDashboard
        }
      />
    );
  }


  /* ==========================================================
     GLOR DASHBOARD
  ========================================================== */

  if (authenticated) {

    return (
      <GlorDashboard
        branch={
          authenticated
        }

        onLogout={
          handleLogout
        }

        onModule={
          handleModule
        }
      />
    );
  }


  /* ==========================================================
     MAIN GLOR BRANCH PORTAL
  ========================================================== */

  return (

    <motion.div
      className="glor-branch-world"

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

      <div className="glor-world-bg" />

      <div className="glor-world-grid" />

      <div className="glor-world-noise" />

      <div className="glor-red-glow glor-red-glow-one" />

      <div className="glor-red-glow glor-red-glow-two" />


      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <nav className="glor-branch-nav">

        <div className="glor-dam-logo">

          <div className="glor-dam-mark">
            M
          </div>


          <div className="glor-dam-copy">

            <strong>
              GLOR
            </strong>

            <span>
              DAM OPERATIONS
            </span>

          </div>

        </div>


        <div className="glor-network-status">

          <span />

          GLOR NETWORK

        </div>

      </nav>


      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <main className="glor-branch-main">


        {/* ====================================================
            BACK TO ALL BRANDS
        ==================================================== */}

        <motion.button
          type="button"

          className="glor-all-brands"

          onClick={() => {

            setSelected(
              null
            );

            setPassword("");

            setLoginError("");

            setActiveModule(
              null
            );

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
            HERO TITLE
        ==================================================== */}

        <motion.div
          className="glor-branch-title"

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
            GLOR / BRANCH ACCESS
          </span>


          <h1>

            Where are you

            <br />

            <em>
              operating?
            </em>

          </h1>


          <p>
            Select your GLOR branch
            to continue into the
            staff operations network.
          </p>

        </motion.div>


        {/* ====================================================
            BRANCH SELECTOR
        ==================================================== */}

        <motion.section
          className="glor-branch-selector"

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

          <div className="glor-search-row">

            <div className="glor-search-box">

              {loading ? (

                <LoaderCircle
                  size={18}
                  className="glor-spinner"
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
                    ? "Connecting GLOR network..."
                    : "Search GLOR branches"
                }

                onChange={(
                  event
                ) => {

                  setSearch(
                    event.target.value
                  );

                }}
              />


              <span>

                {loading
                  ? "CONNECTING"
                  : `${filteredBranches.length} LOCATIONS`}

              </span>

            </div>


            <button
              type="button"

              className="glor-refresh"

              onClick={
                loadBranches
              }

              disabled={
                loading
              }

              title="Refresh GLOR branches"
            >

              <RefreshCcw
                size={15}

                className={
                  loading
                    ? "glor-spinner"
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
                key="glor-loading"

                className="glor-loading-area"

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

                <div className="glor-loader-radar">

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
                  CONNECTING GLOR
                  NETWORK
                </strong>


                <p>
                  Reading live branch
                  directory from DAM
                  Operations.
                </p>


                <div className="glor-loader-line">

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
              className="glor-error-area"

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
              BRANCH LIST
          ================================================== */}

          {!loading &&
            !error && (

            <>

              <div className="glor-branch-items">

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

                        className={
                          `glor-branch-item ${
                            active
                              ? "selected"
                              : ""
                          }`
                        }

                        onClick={() => {

                          selectBranch(
                            branch
                          );

                        }}

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

                        <span className="glor-branch-index">

                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}

                        </span>


                        <div className="glor-location-icon">

                          <MapPin
                            size={17}
                          />

                        </div>


                        <div className="glor-branch-info">

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


              {/* ================================================
                  NO SEARCH RESULTS
              ================================================ */}

              {!filteredBranches.length && (

                <div className="glor-empty">
                  No GLOR branches
                  found.
                </div>

              )}


              {/* ================================================
                  LOGIN PANEL
              ================================================ */}

              <AnimatePresence>

                {selected && (

                  <motion.div
                    ref={
                      readyRef
                    }

                    className="glor-ready-panel"

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

                    {/* BRANCH */}

                    <div className="glor-ready-copy">

                      <small>
                        READY TO ENTER
                      </small>


                      <strong>

                        {selected.code}

                        {" • "}

                        {selected.name}

                      </strong>

                    </div>


                    {/* LOGIN */}

                    <div className="glor-login-area">


                      {/* PASSWORD */}

                      <div className="glor-password-box">

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

                          onClick={() => {

                            setShowPassword(
                              (
                                current
                              ) =>
                                !current
                            );

                          }}

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

                        className="glor-enter-button"

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
                              className="glor-spinner"
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
                        className="glor-login-error"

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
          BACKGROUND GLOR TEXT
      ====================================================== */}

      <div className="glor-giant-word">
        GLOR
      </div>

    </motion.div>
  );
}
