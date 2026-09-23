import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  ArrowUpRight,
  Coffee,
  Crown,
  Moon,
  Sparkles,
  Sun,
  Waves,
} from "lucide-react";

import "./AdminBrandGateway.css";


/* =========================================================
   DAM UNITED — ADMIN BRAND GATEWAY
   ---------------------------------------------------------
   This component ONLY handles the Admin brand selection UI.

   Expected props:
   onSelectBrand("bart")
   onSelectBrand("glor")
   onSelectBrand("mooma")
   onBack()
========================================================= */

const BRANDS = [
  {
    id: "bart",
    number: "01",
    name: "BART",
    eyebrow: "COFFEE OPERATIONS",
    description:
      "Inventory, branches, reporting, transfers and operational intelligence.",
    branchLabel: "30+ BRANCHES",
    icon: Coffee,
    className: "brand-bart",
    words: ["INVENTORY", "REPORTS", "BRANCHES", "CONTROL"],
  },
  {
    id: "glor",
    number: "02",
    name: "GLOR",
    eyebrow: "SPECIALTY OPERATIONS",
    description:
      "A focused command environment for GLOR branches and operational data.",
    branchLabel: "05 BRANCHES",
    icon: Crown,
    className: "brand-glor",
    words: ["STOCK", "TEAMS", "INSIGHTS", "OPERATIONS"],
  },
  {
    id: "mooma",
    number: "03",
    name: "MOOMA",
    eyebrow: "RETAIL OPERATIONS",
    description:
      "Branch operations, inventory visibility and management intelligence.",
    branchLabel: "02 BRANCHES",
    icon: Waves,
    className: "brand-mooma",
    words: ["BRANCHES", "STOCK", "CONTROL", "ANALYTICS"],
  },
];

const MARQUEE_TEXT = [
  "OPERATIONS",
  "INTELLIGENCE",
  "INVENTORY",
  "REPORTING",
  "CONTROL",
  "BRANCHES",
  "DAM UNITED",
];

/* =========================================================
   THEME
========================================================= */

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("dam-admin-theme");

    if (saved === "light" || saved === "dark") {
      return saved;
    }

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    // Ignore localStorage/browser errors.
  }

  return "dark";
}

/* =========================================================
   MAGNETIC BUTTON
========================================================= */

function MagneticButton({ children, onClick, className = "" }) {
  const ref = useRef(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, {
    stiffness: 260,
    damping: 18,
    mass: 0.4,
  });

  const springY = useSpring(y, {
    stiffness: 260,
    damping: 18,
    mass: 0.4,
  });

  function handleMove(event) {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((event.clientX - centerX) * 0.16);
    y.set((event.clientY - centerY) * 0.16);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`dam-magnetic-button ${className}`}
      style={{
        x: springX,
        y: springY,
      }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}

/* =========================================================
   BRAND CARD
========================================================= */

function BrandCard({
  brand,
  index,
  activeBrand,
  setActiveBrand,
  onOpen,
}) {
  const cardRef = useRef(null);

  const rotateXValue = useMotionValue(0);
  const rotateYValue = useMotionValue(0);

  const rotateX = useSpring(rotateXValue, {
    stiffness: 160,
    damping: 20,
  });

  const rotateY = useSpring(rotateYValue, {
    stiffness: 160,
    damping: 20,
  });

  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);

  const Icon = brand.icon;

  const active = activeBrand === brand.id;

  function handleMouseMove(event) {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();

    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    rotateYValue.set((px - 0.5) * 8);
    rotateXValue.set((0.5 - py) * 8);

    glowX.set(px * 100);
    glowY.set(py * 100);

    cardRef.current.style.setProperty("--mouse-x", `${px * 100}%`);
    cardRef.current.style.setProperty("--mouse-y", `${py * 100}%`);
  }

  function handleMouseLeave() {
    rotateXValue.set(0);
    rotateYValue.set(0);
    glowX.set(50);
    glowY.set(50);

    setActiveBrand(null);
  }

  function openBrand() {
    setActiveBrand(brand.id);

    window.setTimeout(() => {
      onOpen(brand.id);
    }, 420);
  }

  return (
    <motion.article
      ref={cardRef}
      className={[
        "dam-brand-card",
        brand.className,
        active ? "is-active" : "",
        activeBrand && !active ? "is-muted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      initial={{
        opacity: 0,
        y: 80,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: active ? 1.025 : 1,
      }}
      transition={{
        delay: 0.12 + index * 0.1,
        duration: 0.85,
        type: "spring",
        stiffness: 85,
        damping: 16,
      }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseEnter={() => setActiveBrand(brand.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={openBrand}
    >
      {/* Cursor-follow light */}
      <div className="dam-card-pointer-glow" />

      {/* Animated aurora */}
      <div className="dam-card-aurora dam-card-aurora-one" />
      <div className="dam-card-aurora dam-card-aurora-two" />

      {/* Decorative glass */}
      <div className="dam-card-glass-layer" />

      {/* Noise / shine */}
      <div className="dam-card-noise" />
      <div className="dam-card-shine" />

      {/* Large background brand word */}
      <div className="dam-card-background-word" aria-hidden="true">
        {brand.name}
      </div>

      <div
        className="dam-brand-card-inner"
        style={{
          transform: "translateZ(35px)",
        }}
      >
        <div className="dam-brand-card-top">
          <div className="dam-brand-number">
            <span>{brand.number}</span>
          </div>

          <motion.div
            className="dam-brand-icon-shell"
            animate={
              active
                ? {
                    rotate: [0, -7, 7, 0],
                    scale: [1, 1.08, 1],
                  }
                : {
                    rotate: 0,
                    scale: 1,
                  }
            }
            transition={{
              duration: 0.7,
            }}
          >
            <Icon size={24} strokeWidth={1.8} />
          </motion.div>
        </div>

        <div className="dam-brand-main">
          <motion.div
            className="dam-brand-eyebrow"
            animate={{
              x: active ? 8 : 0,
            }}
          >
            <Sparkles size={14} />
            <span>{brand.eyebrow}</span>
          </motion.div>

          <motion.h2
            className="dam-brand-title"
            animate={{
              x: active ? 10 : 0,
              letterSpacing: active ? "-0.06em" : "-0.075em",
            }}
            transition={{
              type: "spring",
              stiffness: 160,
              damping: 18,
            }}
          >
            {brand.name}
            <span className="dam-brand-title-dot">.</span>
          </motion.h2>

          <p className="dam-brand-description">{brand.description}</p>

          <div className="dam-brand-tags">
            {brand.words.map((word, wordIndex) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: active ? 1 : 0.68,
                  y: 0,
                }}
                transition={{
                  delay: wordIndex * 0.04,
                }}
              >
                {word}
              </motion.span>
            ))}
          </div>
        </div>

        <div className="dam-brand-card-bottom">
          <div className="dam-branch-count">
            <span className="dam-status-dot" />
            <span>{brand.branchLabel}</span>
          </div>

          <MagneticButton
            className="dam-enter-brand"
            onClick={(event) => {
              event.stopPropagation();
              openBrand();
            }}
          >
            <span>ENTER</span>

            <span className="dam-enter-arrow">
              <ArrowUpRight size={19} strokeWidth={2} />
            </span>
          </MagneticButton>
        </div>
      </div>

      <motion.div
        className="dam-card-active-line"
        animate={{
          scaleX: active ? 1 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 130,
          damping: 18,
        }}
      />
    </motion.article>
  );
}

/* =========================================================
   MARQUEE
========================================================= */

function GatewayMarquee() {
  const items = [...MARQUEE_TEXT, ...MARQUEE_TEXT];

  return (
    <div className="dam-gateway-marquee">
      <motion.div
        className="dam-gateway-marquee-track"
        animate={{
          x: ["0%", "-50%"],
        }}
        transition={{
          duration: 28,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={`${item}-${index}`}>
            <span>{item}</span>
            <i>✦</i>
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}

/* =========================================================
   FLOATING DECORATION
========================================================= */

function FloatingUniverse() {
  return (
    <div className="dam-floating-universe" aria-hidden="true">
      <motion.div
        className="dam-orb dam-orb-one"
        animate={{
          x: [0, 90, -30, 0],
          y: [0, -50, 70, 0],
          scale: [1, 1.18, 0.92, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="dam-orb dam-orb-two"
        animate={{
          x: [0, -80, 40, 0],
          y: [0, 60, -60, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="dam-orb dam-orb-three"
        animate={{
          x: [0, 60, -40, 0],
          y: [0, 80, 20, 0],
          rotate: [0, 120, 240, 360],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      <div className="dam-grid-overlay" />
      <div className="dam-vignette" />
    </div>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function AdminBrandGateway({
  onSelectBrand,
  onBack,
}) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeBrand, setActiveBrand] = useState(null);
  const [openingBrand, setOpeningBrand] = useState(null);

  const gatewayRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("dam-admin-theme", theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  useEffect(() => {
    function handleMouseMove(event) {
      if (!gatewayRef.current) return;

      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;

      gatewayRef.current.style.setProperty("--gateway-x", `${x}%`);
      gatewayRef.current.style.setProperty("--gateway-y", `${y}%`);
    }

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function openBrand(brandId) {
    if (openingBrand) return;

    setOpeningBrand(brandId);
    setActiveBrand(brandId);

    window.setTimeout(() => {
      if (typeof onSelectBrand === "function") {
        onSelectBrand(brandId);
        return;
      }

      console.log(`Admin brand selected: ${brandId}`);
      setOpeningBrand(null);
    }, 650);
  }

  return (
    <motion.main
      ref={gatewayRef}
      className={`dam-admin-gateway theme-${theme} ${
        openingBrand ? `is-opening opening-${openingBrand}` : ""
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      <FloatingUniverse />

      {/* Mouse ambient light */}
      <div className="dam-global-pointer-light" />

      {/* =====================================================
          TOP NAVIGATION
      ===================================================== */}

      <motion.header
        className="dam-gateway-header"
        initial={{
          opacity: 0,
          y: -30,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.7,
          delay: 0.05,
        }}
      >
        <div className="dam-gateway-logo">
          <div className="dam-logo-mark">
            <span>D</span>
          </div>

          <div className="dam-logo-copy">
            <strong>DAM UNITED</strong>
            <span>ADMINISTRATION</span>
          </div>
        </div>

        <div className="dam-gateway-header-actions">
          <div className="dam-system-status">
            <span className="dam-live-dot" />
            <span>SYSTEM ONLINE</span>
          </div>

          <button
            type="button"
            className="dam-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${
              theme === "dark" ? "light" : "dark"
            } mode`}
          >
            <motion.span
              className="dam-theme-toggle-track"
              animate={{
                rotate: theme === "dark" ? 0 : 180,
              }}
              transition={{
                type: "spring",
                stiffness: 160,
                damping: 18,
              }}
            >
              {theme === "dark" ? (
                <Moon size={18} />
              ) : (
                <Sun size={18} />
              )}
            </motion.span>

            <span className="dam-theme-text">
              {theme === "dark" ? "DARK" : "LIGHT"}
            </span>
          </button>

          {typeof onBack === "function" && (
            <button
              type="button"
              className="dam-gateway-back"
              onClick={onBack}
            >
              EXIT
            </button>
          )}
        </div>
      </motion.header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="dam-gateway-hero">
        <motion.div
          className="dam-hero-kicker"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
            duration: 0.65,
          }}
        >
          <span className="dam-kicker-line" />
          <Sparkles size={15} />
          <span>WELCOME TO THE CONTROL UNIVERSE</span>
        </motion.div>

        <div className="dam-hero-title-wrap">
          <motion.h1
            className="dam-gateway-title"
            initial={{
              opacity: 0,
              y: 70,
              filter: "blur(16px)",
            }}
            animate={{
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
            }}
            transition={{
              delay: 0.12,
              duration: 0.95,
              type: "spring",
              stiffness: 70,
              damping: 15,
            }}
          >
            ADMIN
            <span>UNIVERSE</span>
          </motion.h1>

          <motion.div
            className="dam-hero-badge"
            initial={{
              opacity: 0,
              scale: 0,
              rotate: -30,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 8,
            }}
            transition={{
              delay: 0.65,
              type: "spring",
              stiffness: 120,
              damping: 13,
            }}
          >
            <span>SELECT</span>
            <strong>YOUR</strong>
            <span>BRAND</span>
          </motion.div>
        </div>

        <motion.p
          className="dam-gateway-subtitle"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.48,
            duration: 0.7,
          }}
        >
          Three brands. One operational command system.
          <br />
          Choose an environment to enter.
        </motion.p>
      </section>

      <GatewayMarquee />

      {/* =====================================================
          BRAND GRID
      ===================================================== */}

      <section className="dam-brand-stage">
        <div className="dam-brand-stage-heading">
          <div>
            <span>03 ENVIRONMENTS</span>
            <strong>CHOOSE YOUR COMMAND CENTER</strong>
          </div>

          <span className="dam-stage-hint">
            HOVER • EXPLORE • ENTER
          </span>
        </div>

        <div
          className={`dam-brand-grid ${
            activeBrand ? "has-active-brand" : ""
          }`}
        >
          {BRANDS.map((brand, index) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              index={index}
              activeBrand={activeBrand}
              setActiveBrand={setActiveBrand}
              onOpen={openBrand}
            />
          ))}
        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <motion.footer
        className="dam-gateway-footer"
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          delay: 0.9,
          duration: 0.7,
        }}
      >
        <div className="dam-footer-left">
          <span>DAM UNITED</span>
          <i />
          <span>ADMIN CONTROL SYSTEM</span>
        </div>

        <div className="dam-footer-center">
          <span className="dam-footer-pulse" />
          SECURE ADMIN ENVIRONMENT
        </div>

        <div className="dam-footer-right">
          <span>2026</span>
          <span>V2.0</span>
        </div>
      </motion.footer>

      {/* =====================================================
          BRAND TAKEOVER TRANSITION
      ===================================================== */}

      {openingBrand && (
        <motion.div
          className={`dam-brand-takeover takeover-${openingBrand}`}
          initial={{
            scale: 0,
            opacity: 0,
            borderRadius: "50%",
          }}
          animate={{
            scale: 1,
            opacity: 1,
            borderRadius: "0%",
          }}
          transition={{
            duration: 0.62,
            ease: [0.76, 0, 0.24, 1],
          }}
        >
          <motion.div
            className="dam-takeover-content"
            initial={{
              opacity: 0,
              scale: 0.75,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              delay: 0.18,
              duration: 0.35,
            }}
          >
            <Sparkles size={24} />

            <span>ENTERING</span>

            <strong>
              {
                BRANDS.find(
                  (brand) => brand.id === openingBrand
                )?.name
              }
            </strong>

            <div className="dam-takeover-loader">
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 0.45,
                  delay: 0.12,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.main>
  );
}
