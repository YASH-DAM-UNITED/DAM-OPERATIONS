import React, { useRef, useState } from "react";

import {
  prepareDNVisionImage,
  formatDNVisionBytes,
} from "./DNVisionImagePrep";

export default function DNVisionScanner() {
  const inputRef = useRef(null);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [preparedImage, setPreparedImage] = useState(null);

  const [status, setStatus] = useState(
    "Waiting for delivery note"
  );

  const [processing, setProcessing] = useState(false);

  function openCamera() {
    inputRef.current?.click();
  }

  function handleImage(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please select a valid image.");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewURL = URL.createObjectURL(file);

    setImageFile(file);
    setImagePreview(previewURL);

    // IMPORTANT:
    // Clear previous prepared image whenever
    // a new photo is selected.
    setPreparedImage(null);

    setStatus("Image ready");
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview("");
    setPreparedImage(null);

    setStatus("Waiting for delivery note");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function prepareImage() {
    if (!imageFile) {
      setStatus(
        "Take or select a delivery note first."
      );
      return;
    }

    try {
      setProcessing(true);
      setPreparedImage(null);

      setStatus(
        "Preparing delivery note image..."
      );

      const result =
        await prepareDNVisionImage(imageFile);

      setPreparedImage(result);

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
      setProcessing(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          DN
        </div>

        <h1 style={styles.title}>
          Delivery Note Vision
        </h1>

        <p style={styles.subtitle}>
          Capture a clear photo of the complete
          delivery note.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
          style={{ display: "none" }}
        />

        {!imagePreview && (
          <button
            type="button"
            onClick={openCamera}
            style={styles.cameraButton}
          >
            Take / Select Photo
          </button>
        )}

        {imagePreview && (
          <>
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
                disabled={processing}
                style={styles.secondaryButton}
              >
                Change Photo
              </button>

              <button
                type="button"
                onClick={removeImage}
                disabled={processing}
                style={styles.secondaryButton}
              >
                Remove
              </button>
            </div>

            <button
              type="button"
              onClick={prepareImage}
              disabled={processing}
              style={{
                ...styles.scanButton,
                opacity: processing ? 0.6 : 1,
              }}
            >
              {processing
                ? "Preparing Image..."
                : "Prepare Image"}
            </button>
          </>
        )}

        <div style={styles.statusBox}>
          <span style={styles.statusDot} />

          <span>{status}</span>
        </div>

        {preparedImage && (
          <div style={styles.testPanel}>
            <h2 style={styles.testTitle}>
              Image Preparation Test
            </h2>

            <div style={styles.successBox}>
              ✓ DNVision image preparation is working
            </div>

            <InfoRow
              label="Original resolution"
              value={`${preparedImage.originalWidth} × ${preparedImage.originalHeight}`}
            />

            <InfoRow
              label="Prepared resolution"
              value={`${preparedImage.width} × ${preparedImage.height}`}
            />

            <InfoRow
              label="Original size"
              value={formatDNVisionBytes(
                preparedImage.originalSize
              )}
            />

            <InfoRow
              label="Prepared size"
              value={formatDNVisionBytes(
                preparedImage.processedSize
              )}
            />

            <div style={styles.preparedPreviewTitle}>
              Prepared image
            </div>

            <div style={styles.previewBox}>
              <img
                src={preparedImage.dataUrl}
                alt="Prepared delivery note"
                style={styles.previewImage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}


const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "30px 16px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: "650px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    boxSizing: "border-box",
    boxShadow:
      "0 10px 35px rgba(0,0,0,0.08)",
  },

  logo: {
    width: "52px",
    height: "52px",
    borderRadius: "15px",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "18px",
    marginBottom: "18px",
  },

  title: {
    margin: 0,
    fontSize: "26px",
    color: "#111827",
  },

  subtitle: {
    marginTop: "8px",
    marginBottom: "25px",
    color: "#6b7280",
    lineHeight: 1.5,
  },

  cameraButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "16px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
  },

  previewBox: {
    width: "100%",
    background: "#f3f4f6",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  previewImage: {
    display: "block",
    width: "100%",
    maxHeight: "520px",
    objectFit: "contain",
  },

  buttonRow: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },

  secondaryButton: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "12px",
    background: "#ffffff",
    color: "#374151",
    fontWeight: "600",
    cursor: "pointer",
  },

  scanButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "16px",
    marginTop: "15px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
  },

  statusBox: {
    marginTop: "20px",
    padding: "12px 14px",
    background: "#f9fafb",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#4b5563",
    fontSize: "13px",
  },

  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
  },

  testPanel: {
    marginTop: "25px",
    borderTop: "1px solid #e5e7eb",
    paddingTop: "20px",
  },

  testTitle: {
    margin: "0 0 15px",
    fontSize: "18px",
  },

  successBox: {
    padding: "12px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "10px",
    marginBottom: "15px",
    fontWeight: "600",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    padding: "10px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
  },

  infoLabel: {
    color: "#6b7280",
  },

  preparedPreviewTitle: {
    marginTop: "20px",
    marginBottom: "8px",
    fontWeight: "700",
  },
};
