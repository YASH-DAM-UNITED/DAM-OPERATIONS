import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  prepareDNVisionImage,
  formatDNVisionBytes,
} from "./DNVisionImagePrep";


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
     OPEN CAMERA / GALLERY
  ============================================================ */

  function openCamera() {
    if (processing) return;

    inputRef.current?.click();
  }


  /* ============================================================
     IMAGE SELECTED
  ============================================================ */

  function handleImage(event) {
    const file =
      event.target.files?.[0];

    if (!file) return;

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
      URL.createObjectURL(file);

    setImageFile(file);

    setImagePreview(
      previewURL
    );

    setPreparedImage(
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
    if (processing) return;

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
     BACK TO DASHBOARD
  ============================================================ */

  function handleBack() {
    if (processing) {
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
            disabled={processing}
            style={styles.backButton}
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


        {/* MAIN CARD */}

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


          {/* EMPTY STATE */}

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
                style={
                  styles.primaryButton
                }
              >
                Take / Select Photo
              </button>

            </div>

          )}


          {/* IMAGE PREVIEW */}

          {imagePreview && (

            <>

              <div style={styles.sectionLabel}>
                DELIVERY NOTE PHOTO
              </div>

              <div style={styles.previewBox}>

                <img
                  src={imagePreview}
                  alt="Delivery note"
                  style={
                    styles.previewImage
                  }
                />

              </div>


              <div style={styles.buttonRow}>

                <button
                  type="button"
                  onClick={openCamera}
                  disabled={processing}
                  style={
                    styles.secondaryButton
                  }
                >
                  Change Photo
                </button>


                <button
                  type="button"
                  onClick={removeImage}
                  disabled={processing}
                  style={
                    styles.secondaryButton
                  }
                >
                  Remove
                </button>

              </div>


              <button
                type="button"
                onClick={prepareImage}
                disabled={processing}
                style={{
                  ...styles.primaryButton,

                  marginTop:
                    "14px",

                  opacity:
                    processing
                      ? 0.6
                      : 1,
                }}
              >

                {processing
                  ? "Preparing Image..."
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
                  processing
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


          {/* TEST RESULT */}

          {preparedImage && (

            <div style={styles.resultPanel}>

              <div style={styles.resultHeader}>

                <div>

                  <div
                    style={
                      styles.sectionLabel
                    }
                  >
                    DNVISION TEST
                  </div>

                  <h2
                    style={
                      styles.resultTitle
                    }
                  >
                    Image preparation
                    successful
                  </h2>

                </div>


                <div
                  style={
                    styles.successBadge
                  }
                >
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
                  style={
                    styles.previewImage
                  }
                />

              </div>

            </div>

          )}

        </div>

      </div>

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
    background:
      "#f5f7fa",
    padding:
      "24px 16px 50px",
    boxSizing:
      "border-box",
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
    justifyContent:
      "space-between",
    gap: "12px",
    marginBottom: "22px",
  },


  backButton: {
    border:
      "1px solid #dbe1e8",
    background:
      "#ffffff",
    borderRadius:
      "10px",
    padding:
      "10px 14px",
    cursor:
      "pointer",
    fontWeight:
      "700",
    color:
      "#334155",
  },


  branchBadge: {
    padding:
      "8px 12px",
    borderRadius:
      "9px",
    background:
      "#111827",
    color:
      "#ffffff",
    fontWeight:
      "800",
    fontSize:
      "12px",
    letterSpacing:
      "0.06em",
  },


  header: {
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "16px",
    marginBottom:
      "24px",
  },


  logo: {
    width:
      "58px",
    height:
      "58px",
    flex:
      "0 0 58px",
    borderRadius:
      "16px",
    background:
      "#111827",
    color:
      "#ffffff",
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    fontWeight:
      "900",
    fontSize:
      "18px",
  },


  eyebrow: {
    fontSize:
      "11px",
    fontWeight:
      "800",
    letterSpacing:
      "0.12em",
    color:
      "#64748b",
    marginBottom:
      "3px",
  },


  title: {
    margin:
      0,
    fontSize:
      "30px",
    color:
      "#0f172a",
  },


  subtitle: {
    margin:
      "5px 0 0",
    color:
      "#64748b",
    lineHeight:
      1.5,
  },


  card: {
    background:
      "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius:
      "20px",
    padding:
      "24px",
    boxShadow:
      "0 10px 35px rgba(15,23,42,0.06)",
  },


  emptyState: {
    textAlign:
      "center",
    padding:
      "45px 20px",
  },


  cameraIcon: {
    fontSize:
      "45px",
    marginBottom:
      "15px",
  },


  emptyTitle: {
    margin:
      0,
    color:
      "#0f172a",
    fontSize:
      "22px",
  },


  emptyText: {
    maxWidth:
      "500px",
    margin:
      "10px auto 22px",
    color:
      "#64748b",
    lineHeight:
      1.6,
  },


  primaryButton: {
    width:
      "100%",
    border:
      "none",
    borderRadius:
      "11px",
    padding:
      "15px 18px",
    background:
      "#111827",
    color:
      "#ffffff",
    fontSize:
      "15px",
    fontWeight:
      "800",
    cursor:
      "pointer",
  },


  secondaryButton: {
    flex:
      1,
    border:
      "1px solid #d7dde5",
    borderRadius:
      "10px",
    padding:
      "12px",
    background:
      "#ffffff",
    color:
      "#334155",
    fontWeight:
      "700",
    cursor:
      "pointer",
  },


  buttonRow: {
    display:
      "flex",
    gap:
      "10px",
    marginTop:
      "12px",
  },


  sectionLabel: {
    color:
      "#64748b",
    fontSize:
      "11px",
    fontWeight:
      "900",
    letterSpacing:
      "0.11em",
    marginBottom:
      "8px",
  },


  previewBox: {
    width:
      "100%",
    overflow:
      "hidden",
    borderRadius:
      "14px",
    border:
      "1px solid #e2e8f0",
    background:
      "#f8fafc",
  },


  previewImage: {
    display:
      "block",
    width:
      "100%",
    maxHeight:
      "600px",
    objectFit:
      "contain",
  },


  statusBox: {
    marginTop:
      "18px",
    padding:
      "12px 14px",
    background:
      "#f8fafc",
    border:
      "1px solid #edf0f4",
    borderRadius:
      "10px",
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "9px",
    color:
      "#475569",
    fontSize:
      "13px",
  },


  statusDot: {
    width:
      "8px",
    height:
      "8px",
    flex:
      "0 0 8px",
    borderRadius:
      "50%",
  },


  resultPanel: {
    marginTop:
      "24px",
    paddingTop:
      "22px",
    borderTop:
      "1px solid #e5e7eb",
  },


  resultHeader: {
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "15px",
    marginBottom:
      "18px",
  },


  resultTitle: {
    margin:
      0,
    fontSize:
      "19px",
    color:
      "#0f172a",
  },


  successBadge: {
    background:
      "#dcfce7",
    color:
      "#166534",
    borderRadius:
      "999px",
    padding:
      "7px 10px",
    fontWeight:
      "900",
    fontSize:
      "11px",
  },


  infoGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap:
      "10px",
  },


  infoCard: {
    padding:
      "13px",
    background:
      "#f8fafc",
    border:
      "1px solid #edf0f4",
    borderRadius:
      "10px",
  },


  infoLabel: {
    display:
      "block",
    color:
      "#64748b",
    fontSize:
      "11px",
    marginBottom:
      "5px",
  },


  infoValue: {
    color:
      "#0f172a",
    fontSize:
      "14px",
  },
};
