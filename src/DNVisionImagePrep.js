// DNVisionImagePrep.js
// ---------------------------------------------------------
// Purpose:
// Prepare delivery-note photos before sending them
// to the DNVision AI engine.
//
// This does NOT perform OCR.
// This does NOT perform AI extraction.
// ---------------------------------------------------------

const DNVISION_MAX_DIMENSION = 2200;
const DNVISION_JPEG_QUALITY = 0.92;


/**
 * Main function
 *
 * Input:
 *   Browser File object
 *
 * Output:
 * {
 *   blob,
 *   dataUrl,
 *   width,
 *   height,
 *   originalWidth,
 *   originalHeight,
 *   originalSize,
 *   processedSize
 * }
 */
export async function prepareDNVisionImage(file) {
  if (!file) {
    throw new Error("No image supplied.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const sourceURL = URL.createObjectURL(file);

  try {
    const image = await loadDNVisionImage(sourceURL);

    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to read image dimensions.");
    }

    const {
      width,
      height,
    } = calculateDNVisionSize(
      originalWidth,
      originalHeight
    );

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      alpha: false,
    });

    if (!ctx) {
      throw new Error(
        "Unable to create image processing canvas."
      );
    }

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // High-quality resizing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      0,
      0,
      originalWidth,
      originalHeight,
      0,
      0,
      width,
      height
    );

    const blob = await canvasToDNVisionBlob(
      canvas,
      "image/jpeg",
      DNVISION_JPEG_QUALITY
    );

    const dataUrl =
      await blobToDNVisionDataURL(blob);

    return {
      blob,
      dataUrl,

      width,
      height,

      originalWidth,
      originalHeight,

      originalSize: file.size,
      processedSize: blob.size,
    };
  } finally {
    URL.revokeObjectURL(sourceURL);
  }
}


/**
 * Load image into browser memory.
 */
function loadDNVisionImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error(
          "The selected image could not be loaded."
        )
      );
    };

    image.src = url;
  });
}


/**
 * Resize while preserving aspect ratio.
 *
 * We don't enlarge smaller images.
 */
function calculateDNVisionSize(
  originalWidth,
  originalHeight
) {
  const longestSide = Math.max(
    originalWidth,
    originalHeight
  );

  if (
    longestSide <= DNVISION_MAX_DIMENSION
  ) {
    return {
      width: originalWidth,
      height: originalHeight,
    };
  }

  const scale =
    DNVISION_MAX_DIMENSION / longestSide;

  return {
    width: Math.round(
      originalWidth * scale
    ),

    height: Math.round(
      originalHeight * scale
    ),
  };
}


/**
 * Canvas -> JPEG Blob
 */
function canvasToDNVisionBlob(
  canvas,
  type,
  quality
) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Image conversion failed."
            )
          );

          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}


/**
 * Blob -> Base64 Data URL
 *
 * We will use this later when passing
 * the image to our vision engine.
 */
function blobToDNVisionDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Unable to encode processed image."
        )
      );
    };

    reader.readAsDataURL(blob);
  });
}


/**
 * Utility for displaying file sizes.
 */
export function formatDNVisionBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}
