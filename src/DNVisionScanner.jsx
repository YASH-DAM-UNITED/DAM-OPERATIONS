import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  prepareDNVisionImage,
  formatDNVisionBytes,
} from "./DNVisionImagePrep";

import {
  checkDNVisionDevice,
  getDNVisionDeviceSummary,
} from "./DNVisionDeviceCheck";

import {
  askDNVision,
} from "./DNVisionEngine";


export default function DNVisionScanner({
  branch,
  onBack,
}) {
  const inputRef = useRef(null);

  const [imageFile, setImageFile] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState("");

  const [preparedImage, setPreparedImage] =
    useState(null);

  const [processing, setProcessing] =
    useState(false);

  const [status, setStatus] =
    useState("Waiting for delivery note");

  const [deviceChecking, setDeviceChecking] =
    useState(false);

  const [deviceResult, setDeviceResult] =
    useState(null);

  const [deviceError, setDeviceError] =
    useState("");

  const [aiRunning, setAiRunning] =
    useState(false);

  const [aiProgress, setAiProgress] =
    useState(null);

  const [aiAnswer, setAiAnswer] =
    useState("");

  const [aiError, setAiError] =
    useState("");


  /* ============================================================
     CLEANUP
  ============================================================ */

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [imagePreview]);


  /* ============================================================
     DEVICE CHECK
  ============================================================ */

  async function runDeviceCheck() {
    if (
      deviceChecking ||
      aiRunning
    ) {
      return;
    }

    try {
      setDeviceChecking(true);

      setDeviceResult(null);

      setDeviceError("");

      setStatus(
        "Checking device AI capabilities..."
      );


      const result =
        await checkDNVisionDevice();


      const summary =
        getDNVisionDeviceSummary(
          result
        );


      console.log(
        "DNVision device result:",
        result
      );


      console.log(
        "DNVision device summary:",
        summary
      );


      setDeviceResult(
        summary
      );


      if (
        summary?.mode ===
        "WEBGPU"
      ) {
        setStatus(
          "Device check complete — WebGPU available"
        );
      }

      else if (
        summary?.mode ===
        "WASM"
      ) {
        setStatus(
          "Device check complete — WASM fallback available"
        );
      }

      else {
        setStatus(
          "Device check complete — local AI unsupported"
        );
      }

    } catch (error) {
      console.error(
        "DNVision device check error:",
        error
      );

      setDeviceError(
        error?.message ||
          "Device check failed"
      );

      setStatus(
        "Device check failed"
      );

    } finally {
      setDeviceChecking(false);
    }
  }


  /* ============================================================
     OPEN CAMERA
  ============================================================ */

  function openCamera() {
    if (
      processing ||
      deviceChecking ||
      aiRunning
    ) {
      return;
    }

    inputRef.current?.click();
  }


  /* ============================================================
     IMAGE SELECTED
  ============================================================ */

  function handleImage(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }


    if (
      !file.type?.startsWith(
        "image/"
      )
    ) {
      setStatus(
        "Please select a valid image."
      );

      return;
    }


    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }


    const previewURL =
      URL.createObjectURL(
        file
      );


    setImageFile(
      file
    );

    setImagePreview(
      previewURL
    );

    setPreparedImage(
      null
    );

    setAiAnswer(
      ""
    );

    setAiError(
      ""
    );

    setAiProgress(
      null
    );

    setStatus(
      "Delivery note image ready"
    );
  }


  /* ============================================================
     REMOVE IMAGE
  ============================================================ */

  function removeImage() {
    if (
      processing ||
      deviceChecking ||
      aiRunning
    ) {
      return;
    }


    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }


    setImageFile(
      null
    );

    setImagePreview(
      ""
    );

    setPreparedImage(
      null
    );

    setAiAnswer(
      ""
    );

    setAiError(
      ""
    );

    setAiProgress(
      null
    );

    setStatus(
      "Waiting for delivery note"
    );


    if (inputRef.current) {
      inputRef.current.value =
        "";
    }
  }


  /* ============================================================
     PREPARE IMAGE
  ============================================================ */

  async function prepareImage() {
    if (!imageFile) {
      setStatus(
        "Take or select a delivery note first."
      );

      return;
    }


    try {
      setProcessing(
        true
      );

      setPreparedImage(
        null
      );

      setAiAnswer(
        ""
      );

      setAiError(
        ""
      );

      setAiProgress(
        null
      );

      setStatus(
        "Preparing delivery note image..."
      );


      const result =
        await prepareDNVisionImage(
          imageFile
        );


      setPreparedImage(
        result
      );


      console.log(
        "DNVision prepared image:",
        result
      );


      setStatus(
        "Image preparation successful"
      );

    } catch (error) {
      console.error(
        "DNVision preparation error:",
        error
      );


      setStatus(
        error?.message ||
          "Image preparation failed"
      );

    } finally {
      setProcessing(
        false
      );
    }
  }


  /* ============================================================
     RUN DNVISION AI
  ============================================================ */

  async function testDNVision() {
    if (!preparedImage?.blob) {
      setAiError(
        "Prepare the delivery note image first."
      );

      return;
    }


    if (
      aiRunning ||
      processing
    ) {
      return;
    }


    if (
      deviceResult &&
      deviceResult.mode !==
        "WEBGPU"
    ) {
      setAiError(
        "This test requires WebGPU."
      );

      return;
    }


    try {
      setAiRunning(
        true
      );

      setAiAnswer(
        ""
      );

      setAiError(
        ""
      );

      setAiProgress(
        null
      );

      setStatus(
        "Starting DNVision WebGPU..."
      );


      const result =
        await askDNVision(
          preparedImage.blob,

          [
            "Look carefully at this delivery note.",
            "Find the delivery note number.",
            "Return only the delivery note number.",
            "Do not explain anything.",
          ].join(" "),

          (progressInfo) => {
            console.log(
              "DNVision progress:",
              progressInfo
            );


            if (
              typeof progressInfo?.progress ===
              "number"
            ) {
              setAiProgress(
                progressInfo.progress
              );
            }


            if (
              progressInfo?.message
            ) {
              setStatus(
                progressInfo.message
              );
            }
          }
        );


      console.log(
        "DNVision result:",
        result
      );


      const answer =
        result?.answer?.trim();


      setAiAnswer(
        answer ||
          "No delivery note number detected"
      );


      setStatus(
        "DNVision scan complete"
      );

    } catch (error) {
      console.error(
        "DNVision AI error:",
        error
      );


      setAiError(
        error?.message ||
          "DNVision scan failed"
      );


      setStatus(
        "DNVision scan failed"
      );

    } finally {
      setAiRunning(
        false
      );
    }
  }


  /* ============================================================
     BACK
  ============================================================ */

  function handleBack() {
    if (
      processing ||
      deviceChecking ||
      aiRunning
    ) {
      return;
    }

    onBack?.();
  }


  /* ============================================================
     UI
  ============================================================ */

  return (
    <div style={styles.page}>

      <div style={styles.container}>

        {/* TOP BAR */}

        <div style={styles.topBar}>

          <button
            type="button"
            onClick={handleBack}
            disabled={
              processing ||
              deviceChecking ||
              aiRunning
            }
            style={{
              ...styles.backButton,

              opacity:
                processing ||
                deviceChecking ||
                aiRunning
                  ? 0.5
                  : 1,
            }}
          >
            ← Back to Dashboard
          </button>


          <div style={styles.branchBadge}>
            {branch?.code ||
              "BART"}
          </div>

        </div>


        {/* HEADER */}

        <div style={styles.header}>

          <div style={styles.logo}>
            DN
          </div>


          <div>

            <div style={styles.eyebrow}>
              DELIVERY NOTE SYSTEM
            </div>


            <h1 style={styles.title}>
              DNVision
            </h1>


            <p style={styles.subtitle}>
              Scan and verify delivery
              notes for{" "}

              <strong>
                {branch?.name ||
                  "BART Branch"}
              </strong>
            </p>

          </div>

        </div>


        {/* ====================================================
            DEVICE CHECK
        ==================================================== */}

        <div style={styles.deviceCard}>

          <div style={styles.deviceHeader}>

            <div>

              <div style={styles.sectionLabel}>
                LOCAL AI
              </div>


              <h2 style={styles.deviceTitle}>
                Device Capability
              </h2>


              <p style={styles.deviceDescription}>
                DNVision runs locally
                on this device using
                browser AI acceleration.
              </p>

            </div>


            {deviceResult && (

              <div
                style={{
                  ...styles.modeBadge,

                  background:
                    deviceResult.mode ===
                    "WEBGPU"
                      ? "#dcfce7"
                      : deviceResult.mode ===
                        "WASM"
                      ? "#fef3c7"
                      : "#fee2e2",

                  color:
                    deviceResult.mode ===
                    "WEBGPU"
                      ? "#166534"
                      : deviceResult.mode ===
                        "WASM"
                      ? "#92400e"
                      : "#991b1b",
                }}
              >
                {deviceResult.mode}
              </div>

            )}

          </div>


          <button
            type="button"
            onClick={runDeviceCheck}
            disabled={
              deviceChecking ||
              aiRunning
            }
            style={{
              ...styles.secondaryFullButton,

              opacity:
                deviceChecking ||
                aiRunning
                  ? 0.6
                  : 1,
            }}
          >

            {deviceChecking
              ? "Checking Device..."
              : deviceResult
              ? "Check Device Again"
              : "Run Device Check"}

          </button>


          {deviceResult && (

            <div style={styles.deviceResults}>

              <DeviceRow
                label="Browser"
                value={
                  deviceResult.browser
                }
              />


              <DeviceRow
                label="WebGPU"
                value={
                  deviceResult.webGPU
                }
                good={
                  deviceResult.webGPU ===
                  "YES"
                }
              />


              <DeviceRow
                label="GPU Adapter"
                value={
                  deviceResult.gpuAdapter
                }
                good={
                  deviceResult.gpuAdapter ===
                  "AVAILABLE"
                }
              />


              <DeviceRow
                label="WebAssembly"
                value={
                  deviceResult.wasm
                }
                good={
                  deviceResult.wasm ===
                  "YES"
                }
              />


              <DeviceRow
                label="CPU Threads"
                value={
                  deviceResult.cpuThreads
                }
              />


              <DeviceRow
                label="Device Memory"
                value={
                  deviceResult.memory
                }
              />


              <DeviceRow
                label="Recommended Mode"
                value={
                  deviceResult.mode
                }
                good={
                  deviceResult.mode ===
                  "WEBGPU"
                }
              />

            </div>

          )}


          {deviceError && (

            <div style={styles.errorBox}>
              {deviceError}
            </div>

          )}

        </div>


        {/* ====================================================
            SCANNER
        ==================================================== */}

        <div style={styles.card}>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
            style={{
              display: "none",
            }}
          />


          {!imagePreview && (

            <div style={styles.emptyState}>

              <div style={styles.cameraIcon}>
                📄
              </div>


              <h2 style={styles.emptyTitle}>
                Scan Delivery Note
              </h2>


              <p style={styles.emptyText}>
                Capture the complete
                delivery note clearly.
                Make sure all item rows,
                quantities and document
                details are visible.
              </p>


              <button
                type="button"
                onClick={openCamera}
                style={styles.primaryButton}
              >
                Take / Select Photo
              </button>

            </div>

          )}


          {imagePreview && (

            <>

              <div style={styles.sectionLabel}>
                DELIVERY NOTE PHOTO
              </div>


              <div style={styles.previewBox}>

                <img
                  src={imagePreview}
                  alt="Delivery note"
                  style={styles.previewImage}
                />

              </div>


              <div style={styles.buttonRow}>

                <button
                  type="button"
                  onClick={openCamera}
                  disabled={
                    processing ||
                    aiRunning
                  }
                  style={styles.secondaryButton}
                >
                  Change Photo
                </button>


                <button
                  type="button"
                  onClick={removeImage}
                  disabled={
                    processing ||
                    aiRunning
                  }
                  style={styles.secondaryButton}
                >
                  Remove
                </button>

              </div>


              <button
                type="button"
                onClick={prepareImage}
                disabled={
                  processing ||
                  aiRunning
                }
                style={{
                  ...styles.primaryButton,

                  marginTop:
                    "14px",

                  opacity:
                    processing ||
                    aiRunning
                      ? 0.6
                      : 1,
                }}
              >

                {processing
                  ? "Preparing Image..."
                  : preparedImage
                  ? "Prepare Again"
                  : "Prepare Image"}

              </button>

            </>

          )}


          {/* STATUS */}

          <div style={styles.statusBox}>

            <span
              style={{
                ...styles.statusDot,

                background:
                  processing ||
                  deviceChecking ||
                  aiRunning
                    ? "#f59e0b"
                    : preparedImage
                    ? "#22c55e"
                    : "#94a3b8",
              }}
            />


            <span>
              {status}
            </span>

          </div>


          {/* ==================================================
              PREPARED IMAGE
          ================================================== */}

          {preparedImage && (

            <div style={styles.resultPanel}>

              <div style={styles.resultHeader}>

                <div>

                  <div style={styles.sectionLabel}>
                    DNVISION IMAGE
                  </div>


                  <h2 style={styles.resultTitle}>
                    Image preparation
                    successful
                  </h2>

                </div>


                <div style={styles.successBadge}>
                  READY
                </div>

              </div>


              <div style={styles.infoGrid}>

                <InfoCard
                  label="Original"
                  value={`${preparedImage.originalWidth} × ${preparedImage.originalHeight}`}
                />


                <InfoCard
                  label="Prepared"
                  value={`${preparedImage.width} × ${preparedImage.height}`}
                />


                <InfoCard
                  label="Original Size"
                  value={formatDNVisionBytes(
                    preparedImage.originalSize
                  )}
                />


                <InfoCard
                  label="Prepared Size"
                  value={formatDNVisionBytes(
                    preparedImage.processedSize
                  )}
                />

              </div>


              <div
                style={{
                  ...styles.sectionLabel,

                  marginTop:
                    "22px",
                }}
              >
                PREPARED IMAGE
              </div>


              <div style={styles.previewBox}>

                <img
                  src={
                    preparedImage.dataUrl
                  }
                  alt="Prepared delivery note"
                  style={styles.previewImage}
                />

              </div>


              {/* ==============================================
                  DNVISION WEBGPU TEST
              ============================================== */}

              <div style={styles.aiSection}>

                <div style={styles.sectionLabel}>
                  DNVISION WEBGPU
                </div>


                <h2 style={styles.aiTitle}>
                  Test Vision Reading
                </h2>


                <p style={styles.aiDescription}>
                  DNVision will analyze
                  this image locally and
                  attempt to read the
                  delivery note number.
                </p>


                <button
                  type="button"
                  onClick={testDNVision}
                  disabled={
                    aiRunning ||
                    processing
                  }
                  style={{
                    ...styles.aiButton,

                    opacity:
                      aiRunning ||
                      processing
                        ? 0.6
                        : 1,
                  }}
                >

                  {aiRunning
                    ? "DNVision Reading..."
                    : "Read With DNVision"}

                </button>


                {/* PROGRESS */}

                {aiRunning &&
                  aiProgress !== null && (

                    <div style={styles.progressArea}>

                      <div style={styles.progressTrack}>

                        <div
                          style={{
                            ...styles.progressBar,

                            width:
                              `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  aiProgress
                                )
                              )}%`,
                          }}
                        />

                      </div>


                      <div style={styles.progressText}>
                        {Math.max(
                          0,
                          Math.min(
                            100,
                            aiProgress
                          )
                        )}
                        %
                      </div>

                    </div>

                  )}


                {/* ANSWER */}

                {aiAnswer && (

                  <div style={styles.answerBox}>

                    <div style={styles.answerLabel}>
                      DETECTED DELIVERY NOTE NUMBER
                    </div>


                    <div style={styles.answerValue}>
                      {aiAnswer}
                    </div>

                  </div>

                )}


                {/* ERROR */}

                {aiError && (

                  <div style={styles.errorBox}>
                    {aiError}
                  </div>

                )}

              </div>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}


/* ============================================================
   DEVICE ROW
============================================================ */

function DeviceRow({
  label,
  value,
  good = false,
}) {
  return (
    <div style={styles.deviceRow}>

      <span style={styles.deviceRowLabel}>
        {label}
      </span>


      <strong
        style={{
          ...styles.deviceRowValue,

          color:
            good
              ? "#15803d"
              : "#0f172a",
        }}
      >
        {value}
      </strong>

    </div>
  );
}


/* ============================================================
   INFO CARD
============================================================ */

function InfoCard({
  label,
  value,
}) {
  return (
    <div style={styles.infoCard}>

      <span style={styles.infoLabel}>
        {label}
      </span>


      <strong style={styles.infoValue}>
        {value}
      </strong>

    </div>
  );
}


/* ============================================================
   STYLES
============================================================ */

const styles = {

  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "24px 16px 50px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "850px",
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "22px",
  },

  backButton: {
    border: "1px solid #dbe1e8",
    background: "#ffffff",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "700",
    color: "#334155",
  },

  branchBadge: {
    padding: "8px 12px",
    borderRadius: "9px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "12px",
    letterSpacing: "0.06em",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },

  logo: {
    width: "58px",
    height: "58px",
    flex: "0 0 58px",
    borderRadius: "16px",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "18px",
  },

  eyebrow: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.12em",
    color: "#64748b",
    marginBottom: "3px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    color: "#0f172a",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    lineHeight: 1.5,
  },


  /* DEVICE */

  deviceCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "22px",
    marginBottom: "18px",
    boxShadow:
      "0 10px 35px rgba(15,23,42,0.05)",
  },

  deviceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    marginBottom: "18px",
  },

  deviceTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#0f172a",
  },

  deviceDescription: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  modeBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "900",
  },

  secondaryFullButton: {
    width: "100%",
    border: "1px solid #d7dde5",
    borderRadius: "10px",
    padding: "12px 14px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: "800",
    cursor: "pointer",
  },

  deviceResults: {
    marginTop: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
  },

  deviceRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
  },

  deviceRowLabel: {
    color: "#64748b",
    fontSize: "13px",
  },

  deviceRowValue: {
    textAlign: "right",
    fontSize: "13px",
  },


  /* SCANNER */

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    boxShadow:
      "0 10px 35px rgba(15,23,42,0.06)",
  },

  emptyState: {
    textAlign: "center",
    padding: "45px 20px",
  },

  cameraIcon: {
    fontSize: "45px",
    marginBottom: "15px",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
  },

  emptyText: {
    maxWidth: "500px",
    margin: "10px auto 22px",
    color: "#64748b",
    lineHeight: 1.6,
  },

  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "11px",
    padding: "15px 18px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
    cursor: "pointer",
  },

  secondaryButton: {
    flex: 1,
    border: "1px solid #d7dde5",
    borderRadius: "10px",
    padding: "12px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: "700",
    cursor: "pointer",
  },

  buttonRow: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },

  sectionLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.11em",
    marginBottom: "8px",
  },

  previewBox: {
    width: "100%",
    overflow: "hidden",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: "600px",
    objectFit: "contain",
  },

  statusBox: {
    marginTop: "18px",
    padding: "12px 14px",
    background: "#f8fafc",
    border: "1px solid #edf0f4",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#475569",
    fontSize: "13px",
  },

  statusDot: {
    width: "8px",
    height: "8px",
    flex: "0 0 8px",
    borderRadius: "50%",
  },

  resultPanel: {
    marginTop: "24px",
    paddingTop: "22px",
    borderTop: "1px solid #e5e7eb",
  },

  resultHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "18px",
  },

  resultTitle: {
    margin: 0,
    fontSize: "19px",
    color: "#0f172a",
  },

  successBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "7px 10px",
    fontWeight: "900",
    fontSize: "11px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
  },

  infoCard: {
    padding: "13px",
    background: "#f8fafc",
    border: "1px solid #edf0f4",
    borderRadius: "10px",
  },

  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "5px",
  },

  infoValue: {
    color: "#0f172a",
    fontSize: "14px",
  },


  /* AI */

  aiSection: {
    marginTop: "26px",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
  },

  aiTitle: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: "20px",
  },

  aiDescription: {
    margin: "0 0 17px",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.55,
  },

  aiButton: {
    width: "100%",
    border: "none",
    borderRadius: "11px",
    padding: "15px 18px",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "900",
    cursor: "pointer",
  },

  progressArea: {
    marginTop: "15px",
  },

  progressTrack: {
    width: "100%",
    height: "8px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    background: "#111827",
    transition: "width 0.2s ease",
  },

  progressText: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
  },

  answerBox: {
    marginTop: "17px",
    padding: "17px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "12px",
  },

  answerLabel: {
    color: "#047857",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.08em",
    marginBottom: "7px",
  },

  answerValue: {
    color: "#064e3b",
    fontSize: "22px",
    fontWeight: "900",
    wordBreak: "break-word",
  },

  errorBox: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "10px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: "600",
  },
};
