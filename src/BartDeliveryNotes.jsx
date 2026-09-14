import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileScan,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ScanLine,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { loadOpenCV } from "./opencv-loader";
import "./BartDeliveryNotes.css";

/*
  DAM / BART DELIVERY NOTE SCANNER - OpenCV + Tesseract
  -------------------------------------------------------
  IMPORTANT DESIGN CHANGE:
  1) OpenCV detects the actual ruled table first.
  2) OpenCV detects physical horizontal rows and vertical columns.
  3) Every detected table row is kept, even if OCR is weak.
  4) Each cell is cropped and OCR'd separately:
       PRODUCT | ORDERED | DELIVERED
  5) Product rule:
       [SKU] Product Name - Arabic/other
     SKU is text inside [ ].
     Product name is English text after ] and before " - " when present.
  6) Quantity rule:
       1.00 Bottle 500 ml
     => qty=1.00, uom=BOTTLE, size=500 ML
  7) Arabic characters are removed only; the English text from the same cell remains.
*/

const MAX_FILE_MB = 16;
const ENABLE_BACKEND_SUBMIT = false;
const SUBMIT_ENDPOINT = "/api/staff/bart/delivery-note/submit";
const LEARNING_KEY = "bart-delivery-note-learning-opencv-v3";

const EMPTY_NOTE = {
  deliveryNoteNumber: "",
  shippingDate: "",
  sourceLocation: "",
  destinationLocation: "",
  supplier: "DAM UNITED",
  items: [],
};

const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function stripArabic(value = "") {
  return String(value)
    .replace(ARABIC_RE, " ")
    .replace(/[\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value = "") {
  return stripArabic(value)
    .replace(/[¦|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSku(raw = "") {
  const s = clean(raw)
    .toUpperCase()
    .replace(/[({]/g, "[")
    .replace(/[)}]/g, "]")
    .replace(/\s+/g, " ");

  const strict = s.match(/\[\s*([A-Z]{1,5})\s*[-_. ]?\s*([0-9O]{2,5})\s*\]/);
  if (strict) return `${strict[1]}${strict[2].replace(/O/g, "0")}`;

  // Recovery when OCR loses one bracket.
  const loose = s.match(/(?:^|\s)([A-Z]{1,5})\s*[-_. ]?\s*([0-9O]{2,5})(?=\s|$)/);
  if (loose) return `${loose[1]}${loose[2].replace(/O/g, "0")}`;

  return "";
}

function productFromCell(raw = "") {
  const text = clean(raw);
  const code = normalizeSku(text);

  let product = text;
  const closeBracket = Math.max(product.indexOf("]"), product.indexOf(")"));
  if (closeBracket >= 0) {
    product = product.slice(closeBracket + 1).trim();
  } else if (code) {
    const codeRegex = new RegExp(code.replace(/([A-Z]+)(\d+)/, "$1\\s*$2"), "i");
    product = product.replace(codeRegex, " ").trim();
  }

  // Product ends at a spaced dash if present.
  const dash = product.search(/\s[-–—]\s/);
  if (dash > 0) product = product.slice(0, dash);

  product = product
    .replace(/\b(PRODUCT|ORDERED|DELIVERED)\b/gi, " ")
    .replace(/^[\s:;,.\-]+|[\s:;,.\-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { code, product };
}

function normalizeQty(raw = "") {
  const s = String(raw)
    .replace(/,/g, ".")
    .replace(/[Oo]/g, "0")
    .replace(/[Il]/g, "1");
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}

function normalizeUom(raw = "") {
  const s = clean(raw)
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/[^A-Z]/g, "");

  const map = {
    PC: "PCS",
    PCS: "PCS",
    PCE: "PCS",
    PCSS: "PCS",
    PIECE: "PCS",
    PIECES: "PCS",
    BOTLE: "BOTTLE",
    BOTTEL: "BOTTLE",
    BOTTIE: "BOTTLE",
    BOTTLE: "BOTTLE",
    BOTTLES: "BOTTLE",
    BTL: "BOTTLE",
    GALON: "GALLON",
    GALLON: "GALLON",
    GALLONS: "GALLON",
    GRAM: "GRAM",
    GRAMS: "GRAM",
    GM: "GRAM",
    G: "GRAM",
    KG: "KG",
    KGS: "KG",
    ML: "ML",
    L: "L",
    LTR: "L",
    LITRE: "L",
    LITER: "L",
    PACK: "PACK",
    PKT: "PACK",
    BOX: "BOX",
    BAG: "BAG",
    CAN: "CAN",
    CUP: "CUP",
    TRAY: "TRAY",
    TIN: "TIN",
    JAR: "JAR",
    ROLL: "ROLL",
  };

  if (map[s]) return map[s];
  if (/^P[COS5]{1,3}$/.test(s)) return "PCS";
  if (/^BOT+L?E?$/.test(s) || /^BOTT[A-Z]{0,3}$/.test(s)) return "BOTTLE";
  if (/^GAL+O?N?$/.test(s)) return "GALLON";
  if (/^GRA?M?S?$/.test(s)) return "GRAM";
  return "";
}

function normalizeSize(raw = "") {
  const s = clean(raw)
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\bM[I1L]\b/g, "ML")
    .replace(/\bL[I1]\b/g, "L")
    .replace(/\s+/g, " ")
    .trim();

  const m = s.match(/(\d+(?:\.\d+)?)\s*(ML|L|G|GRAM|KG)\b/i);
  if (!m) return "";
  let unit = m[2].toUpperCase();
  if (unit === "G") unit = "GRAM";
  return `${m[1]} ${unit}`;
}

function parseQtyCell(raw = "") {
  const text = clean(raw);
  if (!text) return { qty: "", uom: "", size: "" };

  const qty = normalizeQty(text);

  const words = text.split(/\s+/).filter(Boolean);
  let uom = "";
  let uomIndex = -1;

  for (let i = 0; i < words.length; i += 1) {
    const candidate = normalizeUom(words[i]);
    if (candidate) {
      uom = candidate;
      uomIndex = i;
      break;
    }
  }

  let size = "";
  if (uomIndex >= 0) {
    size = normalizeSize(words.slice(uomIndex + 1).join(" "));
  } else {
    size = normalizeSize(text);
  }

  return { qty, uom, size };
}

function blankItem() {
  return {
    id: makeId(),
    code: "",
    product: "",
    orderedQty: "",
    orderedUom: "",
    orderedSize: "",
    deliveredQty: "",
    deliveredUom: "",
    deliveredSize: "",
    needsReview: true,
    rawProduct: "",
    rawOrdered: "",
    rawDelivered: "",
    rowNumber: null,
  };
}

function safeReadLearning() {
  try {
    return JSON.parse(localStorage.getItem(LEARNING_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLearning(note) {
  try {
    const learning = safeReadLearning();
    for (const item of note.items || []) {
      if (!item.code) continue;
      learning[item.code] = {
        product: item.product || "",
        orderedUom: item.orderedUom || "",
        orderedSize: item.orderedSize || "",
        deliveredUom: item.deliveredUom || "",
        deliveredSize: item.deliveredSize || "",
      };
    }
    localStorage.setItem(LEARNING_KEY, JSON.stringify(learning));
  } catch {
    // localStorage may be unavailable in private/restricted mode.
  }
}

function applyLearning(item) {
  if (!item.code) return item;
  const learned = safeReadLearning()[item.code];
  if (!learned) return item;
  return {
    ...item,
    product: item.product || learned.product || "",
    orderedUom: item.orderedUom || learned.orderedUom || "",
    orderedSize: item.orderedSize || learned.orderedSize || "",
    deliveredUom: item.deliveredUom || learned.deliveredUom || "",
    deliveredSize: item.deliveredSize || learned.deliveredSize || "",
  };
}

function parseHeaderText(raw = "") {
  const text = stripArabic(raw).replace(/\r/g, "\n");
  const flat = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

  const delivery =
    flat.match(/Delivery\s*Note\s*[:#-]?\s*([A-Z0-9/_-]+)/i)?.[1] || "";

  const date =
    flat.match(
      /Shipping\s*Date\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i
    )?.[1] || "";

  const source =
    flat.match(
      /Source\s*Location\s*[:#-]?\s*([A-Z0-9/_-]+)(?=\s+Destination\s*Location|\s+Shipping\s*Date|$)/i
    )?.[1] || "";

  const destination =
    flat.match(
      /Destination\s*Location\s*[:#-]?\s*([A-Z0-9/_-]+)(?=\s+Shipping\s*Date|\s+PRODUCT|$)/i
    )?.[1] || "";

  return {
    deliveryNoteNumber: delivery,
    shippingDate: date,
    sourceLocation: source,
    destinationLocation: destination,
  };
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ img, url });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the selected image."));
    };
    img.src = url;
  });
}

function matToCanvas(cv, mat, scale = 1) {
  const canvas = document.createElement("canvas");
  if (scale === 1) {
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    cv.imshow(canvas, mat);
    return canvas;
  }

  const resized = new cv.Mat();
  cv.resize(
    mat,
    resized,
    new cv.Size(Math.round(mat.cols * scale), Math.round(mat.rows * scale)),
    0,
    0,
    cv.INTER_CUBIC
  );
  canvas.width = resized.cols;
  canvas.height = resized.rows;
  cv.imshow(canvas, resized);
  resized.delete();
  return canvas;
}

function mergeBands(indices, gap = 3) {
  if (!indices.length) return [];
  const bands = [];
  let start = indices[0];
  let prev = indices[0];

  for (let i = 1; i < indices.length; i += 1) {
    const current = indices[i];
    if (current - prev > gap) {
      bands.push([start, prev]);
      start = current;
    }
    prev = current;
  }
  bands.push([start, prev]);
  return bands.map(([a, b]) => Math.round((a + b) / 2));
}

function linePositionsFromMask(mask, orientation) {
  const positions = [];
  const rows = mask.rows;
  const cols = mask.cols;

  if (orientation === "horizontal") {
    for (let y = 0; y < rows; y += 1) {
      let count = 0;
      for (let x = 0; x < cols; x += 1) {
        if (mask.ucharPtr(y, x)[0] > 0) count += 1;
      }
      if (count >= cols * 0.45) positions.push(y);
    }
  } else {
    for (let x = 0; x < cols; x += 1) {
      let count = 0;
      for (let y = 0; y < rows; y += 1) {
        if (mask.ucharPtr(y, x)[0] > 0) count += 1;
      }
      if (count >= rows * 0.45) positions.push(x);
    }
  }

  return mergeBands(positions, 4);
}

function chooseFourColumnLines(lines, width) {
  if (lines.length >= 4) {
    // Keep candidate lines close to the expected table layout:
    // left edge ~0%, product/order divider ~60%, order/deliver divider ~80%, right edge ~100%.
    const targets = [0, 0.60 * width, 0.80 * width, width - 1];
    const chosen = targets.map((target) => {
      return lines.reduce((best, value) =>
        Math.abs(value - target) < Math.abs(best - target) ? value : best
      , lines[0]);
    });

    const unique = [...new Set(chosen)].sort((a, b) => a - b);
    if (unique.length === 4) return unique;
  }

  // Reliable fallback for this DAM template.
  return [0, Math.round(width * 0.60), Math.round(width * 0.80), width - 1];
}

function findLargestTableRect(cv, src) {
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const horizontal = new cv.Mat();
  const vertical = new cv.Mat();
  const grid = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.adaptiveThreshold(
    gray,
    binary,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    31,
    15
  );

  const hKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(Math.max(25, Math.floor(src.cols / 20)), 1)
  );
  const vKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(1, Math.max(20, Math.floor(src.rows / 30)))
  );

  cv.morphologyEx(binary, horizontal, cv.MORPH_OPEN, hKernel);
  cv.morphologyEx(binary, vertical, cv.MORPH_OPEN, vKernel);
  cv.add(horizontal, vertical, grid);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    grid,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  let best = null;
  let bestScore = 0;
  const imageArea = src.cols * src.rows;

  for (let i = 0; i < contours.size(); i += 1) {
    const rect = cv.boundingRect(contours.get(i));
    const area = rect.width * rect.height;
    const aspect = rect.width / Math.max(1, rect.height);

    // DAM table is a wide rectangle in the lower half of the document.
    if (
      area > imageArea * 0.12 &&
      aspect > 1.2 &&
      rect.width > src.cols * 0.55 &&
      rect.height > src.rows * 0.20
    ) {
      const score = area * (1 + rect.y / src.rows);
      if (score > bestScore) {
        bestScore = score;
        best = rect;
      }
    }
  }

  // Fallback: lower ~60% of document if grid contour detection is weak.
  if (!best) {
    best = {
      x: Math.round(src.cols * 0.04),
      y: Math.round(src.rows * 0.33),
      width: Math.round(src.cols * 0.92),
      height: Math.round(src.rows * 0.62),
    };
  }

  // Clamp.
  best.x = Math.max(0, best.x);
  best.y = Math.max(0, best.y);
  best.width = Math.min(src.cols - best.x, best.width);
  best.height = Math.min(src.rows - best.y, best.height);

  hKernel.delete();
  vKernel.delete();
  gray.delete();
  binary.delete();
  contours.delete();
  hierarchy.delete();

  return { rect: best, horizontal, vertical, grid };
}

function preprocessCell(cv, cellMat) {
  const gray = new cv.Mat();
  const enlarged = new cv.Mat();
  const cleaned = new cv.Mat();

  cv.cvtColor(cellMat, gray, cv.COLOR_RGBA2GRAY);
  cv.resize(
    gray,
    enlarged,
    new cv.Size(gray.cols * 2, gray.rows * 2),
    0,
    0,
    cv.INTER_CUBIC
  );

  cv.adaptiveThreshold(
    enlarged,
    cleaned,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    31,
    13
  );

  gray.delete();
  enlarged.delete();

  return cleaned;
}

async function ocrCanvas(worker, canvas, psm = "6") {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
  });
  const result = await worker.recognize(canvas);
  return result?.data?.text?.trim() || "";
}

function createRowItem(rowNumber, productRaw, orderedRaw, deliveredRaw) {
  const { code, product } = productFromCell(productRaw);
  const ordered = parseQtyCell(orderedRaw);
  const delivered = parseQtyCell(deliveredRaw);

  let item = {
    id: makeId(),
    code,
    product,
    orderedQty: ordered.qty,
    orderedUom: ordered.uom,
    orderedSize: ordered.size,
    deliveredQty: delivered.qty,
    deliveredUom: delivered.uom,
    deliveredSize: delivered.size,
    rawProduct: clean(productRaw),
    rawOrdered: clean(orderedRaw),
    rawDelivered: clean(deliveredRaw),
    rowNumber,
    needsReview: false,
  };

  item = applyLearning(item);

  item.needsReview = !(
    item.code &&
    item.product &&
    item.orderedQty &&
    item.orderedUom &&
    item.deliveredQty &&
    item.deliveredUom
  );

  return item;
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [note, setNote] = useState(EMPTY_NOTE);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [debug, setDebug] = useState("");
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const mismatchCount = useMemo(
    () =>
      note.items.filter((item) => {
        const oq = Number(item.orderedQty);
        const dq = Number(item.deliveredQty);
        return Number.isFinite(oq) && Number.isFinite(dq) && oq !== dq;
      }).length,
    [note.items]
  );

  const reviewCount = useMemo(
    () => note.items.filter((x) => x.needsReview).length,
    [note.items]
  );

  const reviewValid =
    Boolean(note.deliveryNoteNumber) &&
    note.items.length > 0 &&
    note.items.every(
      (item) =>
        item.code &&
        item.product &&
        item.orderedQty &&
        item.orderedUom &&
        item.deliveredQty &&
        item.deliveredUom
    ) &&
    confirmed;

  function resetAll() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
    setFile(null);
    setNote(EMPTY_NOTE);
    setPhase("idle");
    setProgress("");
    setError("");
    setConfirmed(false);
    setDebug("");
    setSuccessId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setError("");
    if (!selected.type.startsWith("image/")) {
      setError("Please select a photo/image file.");
      return;
    }

    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Image is too large. Maximum ${MAX_FILE_MB} MB.`);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(selected);
    previewUrlRef.current = url;

    setFile(selected);
    setPreviewUrl(url);
    setNote(EMPTY_NOTE);
    setConfirmed(false);
    setPhase("ready");
    setDebug("");
  }

  async function scanNow() {
    if (!file) return;

    setError("");
    setPhase("scanning");
    setProgress("Loading OpenCV…");

    let cv;
    let worker;
    let objectUrl = "";

    try {
      cv = await loadOpenCV();

      setProgress("Loading OCR engine…");
      worker = await createWorker("eng");

      const loaded = await loadImageElement(file);
      objectUrl = loaded.url;

      const original = cv.imread(loaded.img);

      // Resize once for predictable computer-vision performance.
      const src = new cv.Mat();
      const maxWidth = 2200;
      const scale = original.cols > maxWidth ? maxWidth / original.cols : 1;
      cv.resize(
        original,
        src,
        new cv.Size(
          Math.round(original.cols * scale),
          Math.round(original.rows * scale)
        ),
        0,
        0,
        cv.INTER_AREA
      );
      original.delete();

      // Header OCR is separate from table OCR.
      setProgress("Reading document header…");
      const headerHeight = Math.max(1, Math.round(src.rows * 0.40));
      const headerRoi = src.roi(new cv.Rect(0, 0, src.cols, headerHeight));
      const headerPrep = preprocessCell(cv, headerRoi);
      const headerCanvas = matToCanvas(cv, headerPrep);
      const headerText = await ocrCanvas(worker, headerCanvas, "6");
      const header = parseHeaderText(headerText);
      headerRoi.delete();
      headerPrep.delete();

      setProgress("Detecting the physical table grid…");
      const { rect, horizontal, vertical, grid } = findLargestTableRect(cv, src);

      const table = src.roi(new cv.Rect(rect.x, rect.y, rect.width, rect.height));

      // Convert full-image line masks to table coordinates by ROI.
      const hTable = horizontal.roi(
        new cv.Rect(rect.x, rect.y, rect.width, rect.height)
      );
      const vTable = vertical.roi(
        new cv.Rect(rect.x, rect.y, rect.width, rect.height)
      );

      let yLines = linePositionsFromMask(hTable, "horizontal");
      const xLinesRaw = linePositionsFromMask(vTable, "vertical");
      const xLines = chooseFourColumnLines(xLinesRaw, table.cols);

      // Remove ultra-close line duplicates.
      yLines = yLines.filter(
        (value, index, array) => index === 0 || value - array[index - 1] > 8
      );

      // We need at least: top, header bottom, and 2+ row boundaries.
      if (yLines.length < 4) {
        throw new Error(
          "OpenCV could not detect enough horizontal table lines. Retake the photo straight above the paper with the complete table visible."
        );
      }

      // Sort / clamp.
      yLines = [...new Set(yLines)]
        .map((y) => Math.max(0, Math.min(table.rows - 1, y)))
        .sort((a, b) => a - b);

      // Usually row 0 is table header: PRODUCT | ORDERED | DELIVERED.
      // OCR header-cell product to confirm; if not detected, still skip first physical band.
      const items = [];
      const debugRows = [];

      const rowBands = [];
      for (let i = 0; i < yLines.length - 1; i += 1) {
        const y1 = yLines[i];
        const y2 = yLines[i + 1];
        const height = y2 - y1;
        if (height >= 20) rowBands.push({ y1, y2, height });
      }

      if (rowBands.length < 2) {
        throw new Error("The table rows could not be separated reliably.");
      }

      // First band is the column header. Every band after it is a physical item row.
      const dataBands = rowBands.slice(1);

      for (let i = 0; i < dataBands.length; i += 1) {
        const band = dataBands[i];
        const rowNo = i + 1;
        setProgress(`Reading table row ${rowNo} of ${dataBands.length}…`);

        const padX = 4;
        const padY = 3;

        const cellRects = [
          {
            name: "product",
            x1: xLines[0] + padX,
            x2: xLines[1] - padX,
          },
          {
            name: "ordered",
            x1: xLines[1] + padX,
            x2: xLines[2] - padX,
          },
          {
            name: "delivered",
            x1: xLines[2] + padX,
            x2: xLines[3] - padX,
          },
        ];

        const texts = {};

        for (const cell of cellRects) {
          const x = Math.max(0, cell.x1);
          const y = Math.max(0, band.y1 + padY);
          const w = Math.max(5, Math.min(table.cols - x, cell.x2 - cell.x1));
          const h = Math.max(
            5,
            Math.min(table.rows - y, band.height - padY * 2)
          );

          const roi = table.roi(new cv.Rect(x, y, w, h));
          const prep = preprocessCell(cv, roi);
          const canvas = matToCanvas(cv, prep);
          const text = await ocrCanvas(
            worker,
            canvas,
            cell.name === "product" ? "7" : "7"
          );
          texts[cell.name] = text;

          roi.delete();
          prep.delete();
        }

        // Keep EVERY physical row. Never filter it out just because SKU OCR failed.
        const item = createRowItem(
          rowNo,
          texts.product || "",
          texts.ordered || "",
          texts.delivered || ""
        );

        items.push(item);
        debugRows.push({
          row: rowNo,
          product: texts.product,
          ordered: texts.ordered,
          delivered: texts.delivered,
        });
      }

      // Remove only completely empty false-positive bands at the very bottom/top.
      // We NEVER remove a row if any of its 3 cells contains OCR text.
      const keptItems = items.filter((item) => {
        return Boolean(
          item.rawProduct ||
            item.rawOrdered ||
            item.rawDelivered ||
            item.code ||
            item.product
        );
      });

      setNote({
        ...EMPTY_NOTE,
        ...header,
        items: keptItems,
      });

      setDebug(
        JSON.stringify(
          {
            tableRect: rect,
            xLines,
            yLines,
            physicalRowsDetected: dataBands.length,
            keptRows: keptItems.length,
            headerOCR: headerText,
            rows: debugRows,
          },
          null,
          2
        )
      );

      table.delete();
      hTable.delete();
      vTable.delete();
      horizontal.delete();
      vertical.delete();
      grid.delete();
      src.delete();

      setPhase("review");
      setProgress("");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Scanning failed.");
      setPhase("ready");
      setProgress("");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore
        }
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function patchHeader(key, value) {
    setNote((prev) => ({ ...prev, [key]: value }));
  }

  function patchItem(id, key, value) {
    setNote((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [key]: value };
        next.needsReview = !(
          next.code &&
          next.product &&
          next.orderedQty &&
          next.orderedUom &&
          next.deliveredQty &&
          next.deliveredUom
        );
        return next;
      }),
    }));
  }

  function addRow() {
    setNote((prev) => ({
      ...prev,
      items: [...prev.items, blankItem()],
    }));
  }

  function removeRow(id) {
    setNote((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.id !== id),
    }));
  }

  async function submitNote() {
    if (!reviewValid) return;

    saveLearning(note);

    const payload = {
      branchCode: branch?.code || "",
      branchName: branch?.name || "",
      deliveryNoteNumber: note.deliveryNoteNumber,
      shippingDate: note.shippingDate,
      sourceLocation: note.sourceLocation,
      destinationLocation: note.destinationLocation,
      supplier: note.supplier,
      mismatchCount,
      submittedAt: new Date().toISOString(),
      items: note.items.map((item, index) => ({
        lineNo: index + 1,
        code: item.code,
        product: item.product,
        orderedQty: item.orderedQty,
        orderedUom: item.orderedUom,
        orderedSize: item.orderedSize,
        deliveredQty: item.deliveredQty,
        deliveredUom: item.deliveredUom,
        deliveredSize: item.deliveredSize,
      })),
    };

    setPhase("submitting");
    setError("");

    try {
      if (!ENABLE_BACKEND_SUBMIT) {
        console.log("Delivery note payload:", payload);
        await new Promise((resolve) => setTimeout(resolve, 700));
        setSuccessId(`DN-${Date.now().toString().slice(-7)}`);
      } else {
        const response = await fetch(SUBMIT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Submission failed.");
        }
        setSuccessId(data.id || data.submissionId || "SAVED");
      }

      setPhase("success");
    } catch (err) {
      setError(err?.message || "Submission failed.");
      setPhase("review");
    }
  }

  return (
    <div className="dn-page">
      <div className="dn-grid-bg" />

      <header className="dn-topbar">
        <button className="dn-icon-btn" type="button" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>

        <div className="dn-brand">
          <div className="dn-brand-icon">
            <FileScan size={20} />
          </div>
          <div>
            <div className="dn-eyebrow">DAM OPERATIONS</div>
            <div className="dn-brand-title">Delivery Notes</div>
          </div>
        </div>

        <div className="dn-branch-pill">
          {branch?.code || "BRANCH"} · {branch?.name || "Unknown"}
        </div>
      </header>

      <main className="dn-shell">
        <section className="dn-hero">
          <div>
            <div className="dn-kicker">
              <ScanLine size={15} />
              OpenCV grid scanner + cell-by-cell OCR
            </div>
            <h1>Scan the actual table, not a wall of text.</h1>
            <p>
              OpenCV finds the physical PRODUCT / ORDERED / DELIVERED grid first.
              Then each table cell is OCR'd separately so a missed SKU cannot make
              a whole physical row disappear.
            </p>
          </div>

          {phase !== "idle" && (
            <button className="dn-secondary-btn" onClick={resetAll} type="button">
              <RefreshCcw size={17} />
              New Scan
            </button>
          )}
        </section>

        <input
          ref={fileInputRef}
          className="dn-hidden-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
        />

        {(phase === "idle" || phase === "ready" || phase === "scanning") && (
          <section className="dn-card dn-scan-card">
            <div className="dn-card-head">
              <div>
                <div className="dn-section-label">DOCUMENT CAPTURE</div>
                <h2>Photograph the complete delivery note</h2>
              </div>
              <div className="dn-status-chip">
                {phase === "scanning" ? "SCANNING" : "READY"}
              </div>
            </div>

            {!previewUrl ? (
              <button
                type="button"
                className="dn-capture-zone"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dn-capture-icon">
                  <Camera size={30} />
                </div>
                <strong>Take delivery note photo</strong>
                <span>
                  Keep all 4 table edges visible and photograph from directly above.
                </span>
              </button>
            ) : (
              <div className="dn-preview-wrap">
                <img
                  className="dn-preview"
                  src={previewUrl}
                  alt="Delivery note preview"
                />
                <div className="dn-preview-actions">
                  <button
                    type="button"
                    className="dn-secondary-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={phase === "scanning"}
                  >
                    <ImageIcon size={17} />
                    Retake
                  </button>
                  <button
                    type="button"
                    className="dn-primary-btn"
                    onClick={scanNow}
                    disabled={phase === "scanning"}
                  >
                    {phase === "scanning" ? (
                      <>
                        <Loader2 className="dn-spin" size={18} />
                        {progress || "Scanning…"}
                      </>
                    ) : (
                      <>
                        <ScanLine size={18} />
                        Scan Table
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {phase === "scanning" && (
              <div className="dn-progress">
                <div className="dn-progress-track">
                  <motion.div
                    className="dn-progress-bar"
                    initial={{ width: "10%" }}
                    animate={{ width: ["18%", "50%", "78%", "92%"] }}
                    transition={{
                      duration: 10,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  />
                </div>
                <span>{progress}</span>
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="dn-alert dn-alert-error">
            <TriangleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {(phase === "review" || phase === "submitting") && (
          <>
            <section className="dn-card">
              <div className="dn-card-head">
                <div>
                  <div className="dn-section-label">DOCUMENT HEADER</div>
                  <h2>Delivery note details</h2>
                </div>
                <button className="dn-secondary-btn" onClick={resetAll} type="button">
                  <RefreshCcw size={16} />
                  New Scan
                </button>
              </div>

              <div className="dn-form-grid">
                <label className="dn-field">
                  <span>Delivery Note No.</span>
                  <input
                    value={note.deliveryNoteNumber}
                    onChange={(e) =>
                      patchHeader("deliveryNoteNumber", e.target.value)
                    }
                  />
                </label>

                <label className="dn-field">
                  <span>Shipping Date</span>
                  <input
                    value={note.shippingDate}
                    onChange={(e) => patchHeader("shippingDate", e.target.value)}
                  />
                </label>

                <label className="dn-field">
                  <span>Source Location</span>
                  <input
                    value={note.sourceLocation}
                    onChange={(e) =>
                      patchHeader("sourceLocation", e.target.value)
                    }
                  />
                </label>

                <label className="dn-field">
                  <span>Destination Location</span>
                  <input
                    value={note.destinationLocation}
                    onChange={(e) =>
                      patchHeader("destinationLocation", e.target.value)
                    }
                  />
                </label>

                <label className="dn-field">
                  <span>Supplier</span>
                  <input
                    value={note.supplier}
                    onChange={(e) => patchHeader("supplier", e.target.value)}
                  />
                </label>

                <label className="dn-field">
                  <span>Receiving Branch</span>
                  <input
                    value={branch?.name || branch?.code || ""}
                    readOnly
                  />
                </label>
              </div>
            </section>

            <section className="dn-card">
              <div className="dn-card-head">
                <div>
                  <div className="dn-section-label">TABLE EXTRACTION</div>
                  <h2>PRODUCT → ORDERED → DELIVERED</h2>
                </div>
                <button className="dn-secondary-btn" onClick={addRow} type="button">
                  <Plus size={16} />
                  Add Row
                </button>
              </div>

              <div className="dn-summary-row">
                <div className="dn-stat">
                  <span>Physical rows</span>
                  <strong>{note.items.length}</strong>
                </div>
                <div className="dn-stat">
                  <span>Need review</span>
                  <strong>{reviewCount}</strong>
                </div>
                <div className="dn-stat">
                  <span>Qty mismatch</span>
                  <strong>{mismatchCount}</strong>
                </div>
              </div>

              <div className="dn-table-scroll">
                <table className="dn-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Ord. Qty</th>
                      <th>Ord. UOM</th>
                      <th>Ord. Size</th>
                      <th>Del. Qty</th>
                      <th>Del. UOM</th>
                      <th>Del. Size</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {note.items.map((item, index) => (
                      <tr key={item.id} className={item.needsReview ? "dn-row-review" : ""}>
                        <td className="dn-row-number">{index + 1}</td>
                        <td>
                          <input
                            value={item.code}
                            onChange={(e) =>
                              patchItem(item.id, "code", e.target.value.toUpperCase())
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="dn-product-input"
                            value={item.product}
                            onChange={(e) =>
                              patchItem(item.id, "product", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.orderedQty}
                            onChange={(e) =>
                              patchItem(item.id, "orderedQty", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.orderedUom}
                            onChange={(e) =>
                              patchItem(
                                item.id,
                                "orderedUom",
                                e.target.value.toUpperCase()
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.orderedSize}
                            onChange={(e) =>
                              patchItem(
                                item.id,
                                "orderedSize",
                                e.target.value.toUpperCase()
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.deliveredQty}
                            onChange={(e) =>
                              patchItem(item.id, "deliveredQty", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.deliveredUom}
                            onChange={(e) =>
                              patchItem(
                                item.id,
                                "deliveredUom",
                                e.target.value.toUpperCase()
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.deliveredSize}
                            onChange={(e) =>
                              patchItem(
                                item.id,
                                "deliveredSize",
                                e.target.value.toUpperCase()
                              )
                            }
                          />
                        </td>
                        <td>
                          <span
                            className={
                              item.needsReview
                                ? "dn-badge dn-badge-warn"
                                : "dn-badge dn-badge-ok"
                            }
                          >
                            {item.needsReview ? "REVIEW" : "OK"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="dn-trash-btn"
                            type="button"
                            onClick={() => removeRow(item.id)}
                            aria-label={`Delete row ${index + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dn-mobile-items">
                {note.items.map((item, index) => (
                  <article className="dn-mobile-item" key={`m-${item.id}`}>
                    <div className="dn-mobile-item-head">
                      <strong>Row {index + 1}</strong>
                      <span
                        className={
                          item.needsReview
                            ? "dn-badge dn-badge-warn"
                            : "dn-badge dn-badge-ok"
                        }
                      >
                        {item.needsReview ? "REVIEW" : "OK"}
                      </span>
                    </div>

                    <label className="dn-field">
                      <span>SKU</span>
                      <input
                        value={item.code}
                        onChange={(e) =>
                          patchItem(item.id, "code", e.target.value.toUpperCase())
                        }
                      />
                    </label>

                    <label className="dn-field">
                      <span>Product</span>
                      <input
                        value={item.product}
                        onChange={(e) =>
                          patchItem(item.id, "product", e.target.value)
                        }
                      />
                    </label>

                    <div className="dn-mini-grid">
                      <label className="dn-field">
                        <span>Ordered Qty</span>
                        <input
                          value={item.orderedQty}
                          onChange={(e) =>
                            patchItem(item.id, "orderedQty", e.target.value)
                          }
                        />
                      </label>
                      <label className="dn-field">
                        <span>Ordered UOM</span>
                        <input
                          value={item.orderedUom}
                          onChange={(e) =>
                            patchItem(item.id, "orderedUom", e.target.value.toUpperCase())
                          }
                        />
                      </label>
                      <label className="dn-field">
                        <span>Ordered Size</span>
                        <input
                          value={item.orderedSize}
                          onChange={(e) =>
                            patchItem(item.id, "orderedSize", e.target.value.toUpperCase())
                          }
                        />
                      </label>
                    </div>

                    <div className="dn-mini-grid">
                      <label className="dn-field">
                        <span>Delivered Qty</span>
                        <input
                          value={item.deliveredQty}
                          onChange={(e) =>
                            patchItem(item.id, "deliveredQty", e.target.value)
                          }
                        />
                      </label>
                      <label className="dn-field">
                        <span>Delivered UOM</span>
                        <input
                          value={item.deliveredUom}
                          onChange={(e) =>
                            patchItem(item.id, "deliveredUom", e.target.value.toUpperCase())
                          }
                        />
                      </label>
                      <label className="dn-field">
                        <span>Delivered Size</span>
                        <input
                          value={item.deliveredSize}
                          onChange={(e) =>
                            patchItem(item.id, "deliveredSize", e.target.value.toUpperCase())
                          }
                        />
                      </label>
                    </div>

                    <button
                      className="dn-danger-link"
                      type="button"
                      onClick={() => removeRow(item.id)}
                    >
                      <Trash2 size={15} />
                      Remove row
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="dn-learning-card">
              <CheckCircle2 size={19} />
              <div>
                <strong>Correction learning is ON</strong>
                <span>
                  When staff fixes a SKU/product/UOM/size and submits, that browser
                  remembers the correction and reuses it on later scans.
                </span>
              </div>
            </section>

            <details className="dn-debug">
              <summary>Scanner debug details</summary>
              <pre>{debug}</pre>
            </details>

            <section className="dn-submit-card">
              <label className="dn-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I cross-checked every table row against the physical delivery note.
                </span>
              </label>

              <button
                className="dn-primary-btn dn-submit-btn"
                type="button"
                disabled={!reviewValid || phase === "submitting"}
                onClick={submitNote}
              >
                {phase === "submitting" ? (
                  <>
                    <Loader2 className="dn-spin" size={18} />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Confirm & Submit
                  </>
                )}
              </button>
            </section>
          </>
        )}

        <AnimatePresence>
          {phase === "success" && (
            <motion.section
              className="dn-card dn-success-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="dn-success-icon">
                <CheckCircle2 size={32} />
              </div>
              <div className="dn-section-label">SUBMISSION COMPLETE</div>
              <h2>Delivery note verified</h2>
              <p>
                Verified structured text is ready. The photographed image is not
                included in the submission payload.
              </p>
              <div className="dn-success-id">{successId}</div>
              <button className="dn-primary-btn" onClick={resetAll} type="button">
                Scan Another Note
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
