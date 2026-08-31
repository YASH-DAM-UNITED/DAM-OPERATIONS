import {
  useEffect,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import MoomaPortal from "./MoomaPortal.jsx";


/* ============================================================
   INITIAL THEME
============================================================ */

function getInitialTheme() {
  const saved =
    localStorage.getItem(
      "dam-mooma-theme"
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
   MOOMA SHELL

   This is the ONLY component App.jsx needs to know about.
============================================================ */

export default function MoomaShell({
  onBack,
}) {
  const [
    theme,
    setTheme,
  ] = useState(
    getInitialTheme
  );


  /* ==========================================================
     LOAD MOOMA CSS ONLY WHEN MOOMA IS ACTIVE
  ========================================================== */

  useEffect(() => {
    const existing =
      document.querySelector(
        'link[data-mooma-css="true"]'
      );

    let link =
      existing;

    if (!link) {
      link =
        document.createElement(
          "link"
        );

      link.rel =
        "stylesheet";

      link.href =
        "/mooma.css";

      link.dataset.moomaCss =
        "true";

      document.head.appendChild(
        link
      );
    }


    return () => {
      /*
        We intentionally KEEP the stylesheet cached
        after leaving MOOMA.

        This means opening MOOMA a second time is
        almost instant.
      */
    };
  }, []);


  /* ==========================================================
     THEME
  ========================================================== */

  useEffect(() => {
    localStorage.setItem(
      "dam-mooma-theme",
      theme
    );
  }, [theme]);


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <AnimatePresence
      mode="wait"
    >
      <motion.div
        key="mooma-shell"
        className="mooma-app"
        data-mooma-theme={
          theme
        }
        initial={{
          opacity: 0,
          scale: 0.995,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          scale: 0.995,
        }}
        transition={{
          duration: 0.22,
          ease: [
            0.22,
            1,
            0.36,
            1,
          ],
        }}
      >
        <MoomaPortal
          theme={theme}
          setTheme={
            setTheme
          }
          onExit={
            onBack
          }
        />
      </motion.div>
    </AnimatePresence>
  );
}
