import { motion } from "framer-motion";

export default function MoomaLaunch({
  branch,
  label = "LAUNCHING MOOMA OPERATIONS",
}) {
  return (
    <div className="mooma-launch-screen">
      <div className="mooma-launch-grid" />

      <div className="mooma-launch-glow glow-one" />
      <div className="mooma-launch-glow glow-two" />

      <motion.div
        className="mooma-rocket-stage"
        initial={{
          opacity: 0,
          scale: 0.9,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: 0.35,
        }}
      >
        <motion.div
          className="mooma-rocket"
          initial={{
            y: 70,
            scale: 0.86,
          }}
          animate={{
            y: [70, 40, 15, -15, -60],
            scale: [0.86, 0.9, 0.96, 1, 1.05],
          }}
          transition={{
            duration: 1.65,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="rocket-head" />

          <div className="rocket-body">
            <span>M</span>
          </div>

          <div className="rocket-fin fin-left" />
          <div className="rocket-fin fin-right" />

          <motion.div
            className="rocket-flame flame-main"
            animate={{
              scaleY: [0.7, 1.2, 0.9, 1.4, 1.1],
              opacity: [0.8, 1, 0.9, 1, 0.9],
            }}
            transition={{
              duration: 0.45,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="rocket-flame flame-core"
            animate={{
              scaleY: [0.7, 1.4, 0.8, 1.2],
            }}
            transition={{
              duration: 0.28,
              repeat: Infinity,
            }}
          />
        </motion.div>

        <motion.div
          className="mooma-launch-smoke"
          initial={{
            opacity: 0,
            scale: 0.7,
          }}
          animate={{
            opacity: [0, 0.7, 0.9, 0.3, 0],
            scale: [0.7, 1, 1.4, 1.8, 2.1],
          }}
          transition={{
            duration: 1.65,
          }}
        >
          <i />
          <i />
          <i />
          <i />
        </motion.div>

        <motion.div
          className="mooma-launch-copy"
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.2,
          }}
        >
          <small>
            MOOMA / SECURE BRANCH LAUNCH
          </small>

          <h2>
            {branch?.name || "MOOMA"}
          </h2>

          <p>
            {branch?.code || ""}
          </p>

          <strong>
            {label}
          </strong>
        </motion.div>
      </motion.div>
    </div>
  );
}
