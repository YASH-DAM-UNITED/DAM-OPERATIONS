import { motion } from "framer-motion";

export default function MoomaLaunch({ branch }) {
  return (
    <div className="mooma-launch-root">
      <div className="mooma-launch-background" />
      <div className="mooma-launch-grid" />

      {/* SPEED LINES */}

      <div className="mooma-launch-speed-lines">
        {Array.from({ length: 14 }).map((_, index) => (
          <motion.i
            key={index}
            style={{
              left: `${6 + index * 7}%`,
            }}
            initial={{
              y: "110vh",
              opacity: 0,
            }}
            animate={{
              y: "-120vh",
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: 0.7 + (index % 4) * 0.12,
              delay: 0.65 + (index % 5) * 0.04,
              repeat: 1,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* LAUNCH SYSTEM */}

      <div className="mooma-launch-stage">
        <motion.div
          className="mooma-launch-status"
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <span>MOOMA / LAUNCH SEQUENCE</span>

          <strong>
            {branch?.code || "MOOMA"}
          </strong>
        </motion.div>

        {/* ROCKET */}

        <motion.div
          className="mooma-launch-rocket-wrap"
          initial={{
            y: 120,
            scale: 0.85,
          }}
          animate={{
            y: [
              120,
              100,
              85,
              40,
              -20,
              -450,
            ],

            scale: [
              0.85,
              0.87,
              0.9,
              0.94,
              1,
              1.12,
            ],
          }}
          transition={{
            duration: 1.8,
            times: [
              0,
              0.18,
              0.35,
              0.55,
              0.72,
              1,
            ],
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <motion.div
            className="mooma-launch-rocket"
            animate={{
              x: [
                0,
                -1,
                2,
                -2,
                1,
                0,
              ],
            }}
            transition={{
              duration: 0.16,
              repeat: Infinity,
            }}
          >
            <div className="mooma-launch-rocket-nose" />

            <div className="mooma-launch-rocket-body">
              <div className="mooma-launch-rocket-window">
                M
              </div>
            </div>

            <div className="mooma-launch-rocket-fin-left" />

            <div className="mooma-launch-rocket-fin-right" />

            {/* ENGINE */}

            <div className="mooma-launch-engine">
              <motion.div
                className="mooma-launch-flame-outer"
                animate={{
                  scaleY: [
                    0.8,
                    1.3,
                    0.95,
                    1.5,
                    1,
                  ],
                }}
                transition={{
                  duration: 0.18,
                  repeat: Infinity,
                }}
              />

              <motion.div
                className="mooma-launch-flame-inner"
                animate={{
                  scaleY: [
                    1,
                    1.5,
                    0.9,
                    1.3,
                  ],
                }}
                transition={{
                  duration: 0.13,
                  repeat: Infinity,
                }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* GROUND GLOW */}

        <motion.div
          className="mooma-launch-ground"
          initial={{
            opacity: 0,
            scale: 0.5,
          }}
          animate={{
            opacity: [0, 0.4, 1, 0],
            scale: [0.5, 1, 1.6, 2.3],
          }}
          transition={{
            duration: 1.7,
          }}
        />

        {/* TEXT */}

        <motion.div
          className="mooma-launch-copy"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2,
            times: [0, 0.15, 0.75, 1],
          }}
        >
          <small>
            BRANCH AUTHENTICATED
          </small>

          <h1>
            Launching
            <span> operations.</span>
          </h1>

          <p>
            {branch?.name || "MOOMA OPERATIONS"}
          </p>

          <div className="mooma-launch-progress">
            <motion.div
              initial={{
                width: "0%",
              }}
              animate={{
                width: "100%",
              }}
              transition={{
                duration: 1.8,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
