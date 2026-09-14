import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileScan,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import "./BartDeliveryNotes.css";

/*
  BART / DAM DELIVERY NOTE SCANNER
  ------------------------------------------------------------
  Strategy:
  1) English OCR only (Arabic is ignored, never used for parsing).
  2) Use OCR word positions (TSV) to locate PRODUCT / ORDERED / DELIVERED.
  3) A SKU inside [ ... ] is the anchor that starts each physical product row.
  4) Product name = English text after SKU, preferably until " - ".
  5) ORDERED / DELIVERED = first decimal number is Qty,
     next word is UOM, optional trailing text is Size/Pack.
  6) Never silently drop a row once a SKU is detected.
  7) Staff corrections are remembered locally by SKU for future scans.
*/

const ENABLE_BACKEND_SUBMIT = false;
const SUBMIT_ENDPOINT = "/api/staff/bart/delivery-note/submit";
const MAX_FILE_MB = 14;
const LEARNING_KEY = "bart-delivery-note-learning-v2";

const EMPTY_NOTE = {
  deliveryNoteNumber: "",
  shippingDate: "",
  sourceLocation: "",
  destinationLocation: "",
  supplier: "DAM UNITED",
  items: [],
};

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

const COMMON_UOMS = [
  "PCS",
  "PC",
  "PIECE",
  "PIECES",
  "BOTTLE",
  "BTL",
  "GALLON",
  "GRAM",
  "G",
  "KG",
  "ML",
  "L",
  "LITER",
  "LITRE",
  "PACK",
  "BOX",
  "BAG",
  "CAN",
  "CUP",
  "TRAY",
  "TIN",
  "JAR",
  "ROLL",
];

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
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
    confidence: 0,
    rawProduct: "",
    rawOrdered: "",
    rawDelivered: "",
  };
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

function cleanProductText(value = "") {
  let text = clean(value)
    .replace(/\bPRODUCT\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Product name should end at a separator dash if it exists.
  // We only use a spaced dash so hyphens inside genuine names are preserved.
  const dashIndex = text.search(/\s[-–—]\s/);
  if (dashIndex > 0) text = text.slice(0, dashIndex).trim();

  return text.replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, "").trim();
}

function normalizeSku(raw = "") {
  const s = clean(raw)
    .toUpperCase()
    .replace(/[(){}]/g, "[")
    .replace(/\]/g, "]")
    .replace(/\s+/g, " ");

  // Primary DAM rule: SKU is inside brackets.
  const bracket = s.match(/\[\s*([A-Z]{1,5})\s*[-_. ]?\s*([0-9O]{2,5})\s*\]/);
  if (bracket) return `${bracket[1]}${bracket[2].replace(/O/g, "0")}`;

  // OCR sometimes loses one/both brackets. Keep this as recovery only.
  const loose = s.match(/(?:^|\s)([A-Z]{1,5})\s*[-_. ]?\s*([0-9O]{2,5})(?=\s|$)/);
  if (loose) return `${loose[1]}${loose[2].replace(/O/g, "0")}`;

  return "";
}

function hasBracketSku(raw = "") {
  const s = clean(raw).toUpperCase();
  return /\[[^\]]{2,12}\]/.test(s) && Boolean(normalizeSku(s));
}

function normalizeQty(raw = "") {
  const s = String(raw)
    .replace(/,/g, ".")
    .replace(/[Oo]/g, "0")
    .replace(/[^0-9.]/g, "");
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}

function normalizeUomWord(raw = "") {
  let s = clean(raw).toUpperCase();
  s = s
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/[^A-Z]/g, "");

  const corrections = {
    PCS: "PCS",
    PC: "PCS",
    PCE: "PCS",
    PCSS: "PCS",
    PIECE: "PCS",
    PIECES: "PCS",
    BOTLE: "BOTTLE",
    BOTTIE: "BOTTLE",
    BOTTEL: "BOTTLE",
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

  if (corrections[s]) return corrections[s];

  // Fuzzy-ish recoveries for common OCR errors.
  if (/^P[COS5]{1,3}$/.test(s)) return "PCS";
  if (/^BOT+L?E?$/.test(s) || /^BOTT[A-Z]{0,3}$/.test(s)) return "BOTTLE";
  if (/^GAL+O?N?$/.test(s)) return "GALLON";
  if (/^GRA?M?S?$/.test(s)) return "GRAM";

  return COMMON_UOMS.includes(s) ? s : "";
}

function normalizeSize(raw = "") {
  let s = clean(raw).toUpperCase();
  s = s
    .replace(/,/g, ".")
    .replace(/\bM[I1][L1]\b/g, "ML")
    .replace(/\bM[L1]\b/g, "ML")
    .replace(/\bL[I1]TR(?:E|ER)?\b/g, "L")
    .replace(/\s+/g, " ")
    .trim();

  const m = s.match(/(\d+(?:\.\d+)?)\s*(ML|L|G|GRAM|KG)\b/);
  if (!m) return "";

  let unit = m[2];
  if (unit === "G") unit = "GRAM";
  return `${m[1]} ${unit}`;
}

function parseQtyUomSize(raw = "") {
  const text = clean(raw);
  if (!text) return { qty: "", uom: "", size: "", raw: text };

  const tokens = text.split(/\s+/).filter(Boolean);

  // Qty is the first numeric token / decimal number in the cell.
  let qtyIndex = -1;
  let qty = "";
  for (let i = 0; i < tokens.length; i += 1) {
    const n = normalizeQty(tokens[i]);
    if (n) {
      qty = n;
      qtyIndex = i;
      break;
    }
  }

  if (qtyIndex < 0) return { qty: "", uom: "", size: "", raw: text };

  // UOM is the first reliable word after Qty.
  let uom = "";
  let uomIndex = -1;
  for (let i = qtyIndex + 1; i < Math.min(tokens.length, qtyIndex + 5); i += 1) {
    const candidate = normalizeUomWord(tokens[i]);
    if (candidate) {
      uom = candidate;
      uomIndex = i;
      break;
    }
  }

  // Anything meaningful after UOM can describe the pack/size.
  const sizeSource = uomIndex >= 0 ? tokens.slice(uomIndex + 1).join(" ") : "";
  const size = normalizeSize(sizeSource);

  return { qty, uom, size, raw: text };
}

function loadLearning() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEARNING_KEY) || "{}");
    return {
      products: parsed.products || {},
      uoms: parsed.uoms || {},
    };
  } catch {
    return { products: {}, uoms: {} };
  }
}

function saveLearningFromItems(items) {
  try {
    const learning = loadLearning();
    for (const item of items) {
      const code = normalizeSku(`[${item.code}]`) || item.code.trim().toUpperCase();
      if (code && item.product.trim()) {
        learning.products[code] = item.product.trim();
      }
      if (item.rawOrdered && item.orderedUom) {
        learning.uoms[clean(item.rawOrdered).toUpperCase()] = {
          uom: item.orderedUom,
          size: item.orderedSize || "",
        };
      }
      if (item.rawDelivered && item.deliveredUom) {
        learning.uoms[clean(item.rawDelivered).toUpperCase()] = {
          uom: item.deliveredUom,
          size: item.deliveredSize || "",
        };
      }
    }
    localStorage.setItem(LEARNING_KEY, JSON.stringify(learning));
  } catch {
    // Learning is a convenience only. Never block submission if storage is unavailable.
  }
}

function applyLearning(item) {
  const learning = loadLearning();
  const code = item.code?.toUpperCase();
  const learnedProduct = code ? learning.products[code] : "";

  const next = {
    ...item,
    product: learnedProduct || item.product,
  };

  const orderedLearned = learning.uoms[clean(item.rawOrdered).toUpperCase()];
  if (orderedLearned) {
    next.orderedUom = orderedLearned.uom || next.orderedUom;
    next.orderedSize = orderedLearned.size || next.orderedSize;
  }

  const deliveredLearned = learning.uoms[clean(item.rawDelivered).toUpperCase()];
  if (deliveredLearned) {
    next.deliveredUom = deliveredLearned.uom || next.deliveredUom;
    next.deliveredSize = deliveredLearned.size || next.deliveredSize;
  }

  return next;
}

function parseTsv(tsv = "") {
  const lines = String(tsv).split(/\r?\n/);
  const words = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const [
      level,
      pageNum,
      blockNum,
      parNum,
      lineNum,
      wordNum,
      left,
      top,
      width,
      height,
      conf,
      ...textParts
    ] = parts;

    if (Number(level) !== 5) continue;

    const rawText = textParts.join("\t");
    const text = clean(rawText);
    if (!text) continue;

    words.push({
      pageNum: Number(pageNum),
      blockNum: Number(blockNum),
      parNum: Number(parNum),
      lineNum: Number(lineNum),
      wordNum: Number(wordNum),
      left: Number(left),
      top: Number(top),
      width: Number(width),
      height: Number(height),
      right: Number(left) + Number(width),
      bottom: Number(top) + Number(height),
      cx: Number(left) + Number(width) / 2,
      cy: Number(top) + Number(height) / 2,
      conf: Number(conf),
      text,
      rawText,
    });
  }

  return words;
}

function groupOcrLines(words) {
  const map = new Map();
  for (const w of words) {
    const key = `${w.pageNum}:${w.blockNum}:${w.parNum}:${w.lineNum}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(w);
  }

  return [...map.values()]
    .map((items) => {
      items.sort((a, b) => a.left - b.left);
      const left = Math.min(...items.map((x) => x.left));
      const right = Math.max(...items.map((x) => x.right));
      const top = Math.min(...items.map((x) => x.top));
      const bottom = Math.max(...items.map((x) => x.bottom));
      return {
        items,
        left,
        right,
        top,
        bottom,
        cx: (left + right) / 2,
        cy: (top + bottom) / 2,
        text: clean(items.map((x) => x.text).join(" ")),
        confidence: items.reduce((s, x) => s + Math.max(0, x.conf), 0) / Math.max(1, items.length),
      };
    })
    .filter((x) => x.text)
    .sort((a, b) => a.cy - b.cy || a.left - b.left);
}

function detectColumns(words, imageWidth) {
  const product = words.find((w) => /^PRODUCT$/i.test(w.text));
  const ordered = words.find((w) => /^ORDERED$/i.test(w.text));
  const delivered = words.find((w) => /^DELIVERED$/i.test(w.text));

  if (product && ordered && delivered && product.left < ordered.left && ordered.left < delivered.left) {
    return {
      tableTop: Math.max(product.bottom, ordered.bottom, delivered.bottom),
      orderedLeft: Math.max(product.right + 8, (product.right + ordered.left) / 2),
      deliveredLeft: Math.max(ordered.right + 8, (ordered.right + delivered.left) / 2),
      detected: true,
    };
  }

  // Fallback based on the DAM note layout shown by the user.
  return {
    tableTop: 0,
    orderedLeft: imageWidth * 0.64,
    deliveredLeft: imageWidth * 0.82,
    detected: false,
  };
}

function wordsInRange(words, { top, bottom, left = -Infinity, right = Infinity }) {
  return words.filter(
    (w) => w.cy >= top && w.cy < bottom && w.cx >= left && w.cx < right
  );
}

function joinWords(words) {
  return clean([...words].sort((a, b) => a.top - b.top || a.left - b.left).map((w) => w.text).join(" "));
}

function findSkuAnchors(lines, columns, imageWidth) {
  const productRight = columns.orderedLeft || imageWidth * 0.64;
  const candidates = lines.filter((line) => line.cy > columns.tableTop && line.left < productRight);
  const anchors = [];

  for (const line of candidates) {
    if (!hasBracketSku(line.text)) continue;
    const code = normalizeSku(line.text);
    if (!code) continue;
    anchors.push({ ...line, code });
  }

  // De-duplicate same SKU accidentally repeated by OCR.
  const unique = [];
  for (const anchor of anchors) {
    const prev = unique[unique.length - 1];
    if (prev && prev.code === anchor.code && Math.abs(prev.cy - anchor.cy) < 28) continue;
    unique.push(anchor);
  }

  return unique;
}

function extractProduct(anchorText, code) {
  let text = cleanProductText(anchorText);

  // Remove bracketed SKU first.
  text = text.replace(/\[[^\]]{1,16}\]/, " ").replace(/\s+/g, " ").trim();

  // Recovery if brackets were noisy but code survived.
  if (code) {
    const spaced = code.replace(/^([A-Z]+)(\d+)$/, "$1\\s*[-_. ]?\\s*$2");
    try {
      text = text.replace(new RegExp(spaced, "i"), " ").replace(/\s+/g, " ").trim();
    } catch {
      // no-op
    }
  }

  return cleanProductText(text);
}

function parseTable(words, lines, columns, imageWidth, imageHeight) {
  const anchors = findSkuAnchors(lines, columns, imageWidth);
  const results = [];

  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    const next = anchors[i + 1];

    // Use a little margin above/below the anchor. This allows wrapped English names.
    const rowTop = Math.max(columns.tableTop, anchor.top - 8);
    const rowBottom = next
      ? Math.max(anchor.bottom + 12, next.top - 6)
      : Math.min(imageHeight, anchor.bottom + Math.max(70, anchor.height * 4.5));

    const productWords = wordsInRange(words, {
      top: rowTop,
      bottom: rowBottom,
      left: 0,
      right: columns.orderedLeft,
    });

    const orderedWords = wordsInRange(words, {
      top: rowTop,
      bottom: rowBottom,
      left: columns.orderedLeft,
      right: columns.deliveredLeft,
    });

    const deliveredWords = wordsInRange(words, {
      top: rowTop,
      bottom: rowBottom,
      left: columns.deliveredLeft,
      right: imageWidth + 1,
    });

    const rawProduct = joinWords(productWords);
    const rawOrdered = joinWords(orderedWords);
    const rawDelivered = joinWords(deliveredWords);

    const product = extractProduct(rawProduct || anchor.text, anchor.code);
    const ordered = parseQtyUomSize(rawOrdered);
    const delivered = parseQtyUomSize(rawDelivered);

    const qualityChecks = [
      Boolean(anchor.code),
      Boolean(product),
      Boolean(ordered.qty),
      Boolean(ordered.uom),
      Boolean(delivered.qty),
      Boolean(delivered.uom),
    ];
    const confidence = Math.round((qualityChecks.filter(Boolean).length / qualityChecks.length) * 100);

    const item = applyLearning({
      id: makeId(),
      code: anchor.code,
      product,
      orderedQty: ordered.qty,
      orderedUom: ordered.uom,
      orderedSize: ordered.size,
      deliveredQty: delivered.qty,
      deliveredUom: delivered.uom,
      deliveredSize: delivered.size,
      confidence,
      needsReview: confidence < 100,
      rawProduct,
      rawOrdered,
      rawDelivered,
    });

    // SKU anchor means this row must NEVER be silently dropped.
    results.push(item);
  }

  return results;
}

function parseHeader(text = "") {
  const english = stripArabic(text);

  const deliveryNote =
    english.match(/Delivery\s*Note\s*[:#-]?\s*([A-Z0-9/_-]+)/i)?.[1] || "";

  const shippingDate =
    english.match(/Shipping\s*Date\s*[:#-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?)/i)?.[1] || "";

  const sourceLocation =
    english.match(/Source\s*Location\s*[:#-]?\s*([^\n\r]+)/i)?.[1]?.trim() || "";

  const destinationLocation =
    english.match(/Destination\s*Location\s*[:#-]?\s*([^\n\r]+)/i)?.[1]?.trim() || "";

  return {
    deliveryNoteNumber: clean(deliveryNote),
    shippingDate: clean(shippingDate),
    sourceLocation: clean(sourceLocation).split(/\s{2,}/)[0],
    destinationLocation: clean(destinationLocation).split(/\s{2,}/)[0],
  };
}

async function imageToCanvas(file, variant = "balanced") {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 2200;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    let value = gray;

    if (variant === "high-contrast") {
      // Strong but not destructive threshold for printed paper.
      value = gray > 178 ? 255 : Math.max(0, Math.min(255, (gray - 105) * 2.05 + 105));
    } else {
      value = Math.max(0, Math.min(255, (gray - 128) * 1.38 + 128));
    }

    d[i] = value;
    d[i + 1] = value;
    d[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function chooseBestItems(a = [], b = []) {
  if (!a.length) return b;
  if (!b.length) return a;

  const score = (arr) =>
    arr.reduce(
      (sum, x) =>
        sum +
        (x.code ? 4 : 0) +
        (x.product ? 2 : 0) +
        (x.orderedQty ? 2 : 0) +
        (x.orderedUom ? 2 : 0) +
        (x.deliveredQty ? 2 : 0) +
        (x.deliveredUom ? 2 : 0),
      0
    );

  return score(b) > score(a) ? b : a;
}

function mismatch(item) {
  if (!item.orderedQty || !item.deliveredQty) return false;
  return Number(item.orderedQty) !== Number(item.deliveredQty);
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [stage, setStage] = useState("capture");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState(EMPTY_NOTE);
  const [confirmed, setConfirmed] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [submissionId, setSubmissionId] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const stats = useMemo(() => {
    const review = note.items.filter((x) => x.needsReview).length;
    const mismatches = note.items.filter(mismatch).length;
    return { total: note.items.length, review, mismatches };
  }, [note.items]);

  const validForSubmit = useMemo(() => {
    if (!confirmed || !note.deliveryNoteNumber || note.items.length === 0) return false;
    return note.items.every(
      (x) =>
        x.code.trim() &&
        x.product.trim() &&
        x.orderedQty !== "" &&
        x.orderedUom.trim() &&
        x.deliveredQty !== "" &&
        x.deliveredUom.trim()
    );
  }, [confirmed, note]);

  function resetPhoto() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreview("");
    setFile(null);
    setNote(EMPTY_NOTE);
    setConfirmed(false);
    setError("");
    setDebugText("");
    setStage("capture");
    setProgress(0);
  }

  function selectFile(nextFile) {
    setError("");
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("Please choose a photo/image file.");
      return;
    }
    if (nextFile.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Image is too large. Maximum ${MAX_FILE_MB} MB.`);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setPreview(url);
    setFile(nextFile);
    setNote(EMPTY_NOTE);
    setConfirmed(false);
    setDebugText("");
    setStage("preview");
  }

  async function runPass(worker, canvas, label, startProgress, endProgress) {
    setStatus(label);
    setProgress(startProgress);

    const result = await worker.recognize(
      canvas,
      {},
      {
        text: true,
        tsv: true,
      }
    );

    setProgress(endProgress);
    const text = result?.data?.text || "";
    const tsv = result?.data?.tsv || "";
    const words = parseTsv(tsv);
    const lines = groupOcrLines(words);
    const columns = detectColumns(words, canvas.width);
    const items = parseTable(words, lines, columns, canvas.width, canvas.height);

    return { text, tsv, words, lines, columns, items, width: canvas.width, height: canvas.height };
  }

  async function scanNow() {
    if (!file) return;

    setStage("scanning");
    setError("");
    setProgress(3);
    setStatus("Preparing delivery note…");

    let worker;
    try {
      const balanced = await imageToCanvas(file, "balanced");
      const highContrast = await imageToCanvas(file, "high-contrast");

      setStatus("Loading English OCR engine…");
      setProgress(8);

      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setProgress((p) => Math.max(p, Math.min(88, 10 + Math.round(m.progress * 70))));
          }
        },
      });

      // Preserve spacing because ORDERED / DELIVERED are table columns.
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "6",
      });

      const first = await runPass(worker, balanced, "Reading table rows…", 12, 56);
      let bestItems = first.items;
      let second = null;

      // If the first pass looks incomplete, run a stronger pass.
      const firstQuality = first.items.filter((x) => x.confidence === 100).length;
      if (first.items.length === 0 || firstQuality < first.items.length) {
        await worker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: "11",
        });
        second = await runPass(worker, highContrast, "Double-checking missed rows and UOM…", 58, 90);
        bestItems = chooseBestItems(first.items, second.items);
      }

      setStatus("Applying DAM table rules…");
      setProgress(94);

      const header = parseHeader(`${first.text}\n${second?.text || ""}`);

      setNote({
        ...EMPTY_NOTE,
        ...header,
        items: bestItems,
      });

      setDebugText(
        [
          "=== PASS 1 RAW TEXT ===",
          first.text,
          "",
          `=== PASS 1 TABLE === detectedHeader=${first.columns.detected} rows=${first.items.length}`,
          ...first.items.map(
            (x, i) =>
              `${i + 1}. [${x.code}] ${x.product} | ORD: ${x.rawOrdered} | DEL: ${x.rawDelivered}`
          ),
          ...(second
            ? [
                "",
                "=== PASS 2 RAW TEXT ===",
                second.text,
                "",
                `=== PASS 2 TABLE === detectedHeader=${second.columns.detected} rows=${second.items.length}`,
                ...second.items.map(
                  (x, i) =>
                    `${i + 1}. [${x.code}] ${x.product} | ORD: ${x.rawOrdered} | DEL: ${x.rawDelivered}`
                ),
              ]
            : []),
        ].join("\n")
      );

      setProgress(100);
      setStatus(bestItems.length ? `Found ${bestItems.length} product row${bestItems.length === 1 ? "" : "s"}.` : "No SKU rows found.");
      setStage("review");
    } catch (e) {
      console.error(e);
      setError(
        e?.message ||
          "The scan could not be completed. Retake the photo straight, fill the frame with the page and try again."
      );
      setStage("preview");
    } finally {
      try {
        await worker?.terminate();
      } catch {
        // no-op
      }
    }
  }

  function updateNote(field, value) {
    setNote((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(id, field, value) {
    setNote((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        next.needsReview = !(
          next.code &&
          next.product &&
          next.orderedQty !== "" &&
          next.orderedUom &&
          next.deliveredQty !== "" &&
          next.deliveredUom
        );
        return next;
      }),
    }));
  }

  function removeItem(id) {
    setNote((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  function addItem() {
    setNote((prev) => ({ ...prev, items: [...prev.items, blankItem()] }));
  }

  async function submitNote() {
    if (!validForSubmit) return;
    setError("");
    setStage("submitting");

    const payload = {
      branchCode: branch?.code || "",
      branchName: branch?.name || "",
      deliveryNoteNumber: note.deliveryNoteNumber.trim(),
      shippingDate: note.shippingDate.trim(),
      sourceLocation: note.sourceLocation.trim(),
      destinationLocation: note.destinationLocation.trim(),
      supplier: note.supplier.trim(),
      items: note.items.map((x, index) => ({
        line: index + 1,
        sku: x.code.trim().toUpperCase(),
        productName: x.product.trim(),
        orderedQty: Number(x.orderedQty),
        orderedUom: x.orderedUom.trim().toUpperCase(),
        orderedSize: x.orderedSize.trim().toUpperCase(),
        deliveredQty: Number(x.deliveredQty),
        deliveredUom: x.deliveredUom.trim().toUpperCase(),
        deliveredSize: x.deliveredSize.trim().toUpperCase(),
      })),
      mismatchCount: stats.mismatches,
      submittedAt: new Date().toISOString(),
    };

    try {
      // The "learning" is entirely local and free. It remembers verified staff corrections.
      saveLearningFromItems(note.items);

      if (ENABLE_BACKEND_SUBMIT) {
        const response = await fetch(SUBMIT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Submission failed.");
        }
        setSubmissionId(data.id || data.submissionId || "SUBMITTED");
      } else {
        console.log("Delivery Note verified payload:", payload);
        await new Promise((resolve) => setTimeout(resolve, 650));
        setSubmissionId(`LOCAL-${Date.now().toString().slice(-7)}`);
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
      setPreview("");
      setFile(null);
      setStage("success");
    } catch (e) {
      setError(e?.message || "Could not submit the delivery note.");
      setStage("review");
    }
  }

  return (
    <div className="dn-shell">
      <div className="dn-grid" />

      <header className="dn-topbar">
        <button className="dn-icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={19} />
        </button>

        <div className="dn-brand">
          <div className="dn-brand-icon">
            <FileScan size={20} />
          </div>
          <div>
            <strong>Delivery Notes</strong>
            <span>DAM RECEIVING CONTROL</span>
          </div>
        </div>

        <div className="dn-branch-pill">
          <span>RECEIVING BRANCH</span>
          <b>{branch?.name || branch?.code || "BART"}</b>
        </div>
      </header>

      <main className="dn-main">
        <section className="dn-hero">
          <div>
            <div className="dn-kicker">
              <Sparkles size={14} /> DAM TABLE READER
            </div>
            <h1>Scan the table. Verify every row.</h1>
            <p>
              SKU brackets start each product row. Arabic text is ignored while English product text,
              quantities, UOM and pack size are kept separately for staff verification.
            </p>
          </div>

          <div className="dn-engine-badge">
            <span className="dn-live-dot" />
            <div>
              <b>Local OCR</b>
              <small>No paid vision API</small>
            </div>
          </div>
        </section>

        {error && (
          <div className="dn-alert dn-alert-danger">
            <TriangleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {stage === "capture" && (
            <motion.section
              key="capture"
              className="dn-panel dn-capture"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="dn-scan-frame">
                <span className="c tl" />
                <span className="c tr" />
                <span className="c bl" />
                <span className="c br" />
                <div className="dn-camera-orb"><Camera size={34} /></div>
                <h2>Capture the full delivery note</h2>
                <p>
                  Keep the paper straight and make sure PRODUCT, ORDERED and DELIVERED are clearly visible.
                </p>
                <button className="dn-primary" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={18} /> Open Camera
                </button>
                <input
                  ref={fileInputRef}
                  className="dn-hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => selectFile(e.target.files?.[0])}
                />
              </div>
            </motion.section>
          )}

          {stage === "preview" && (
            <motion.section
              key="preview"
              className="dn-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="dn-section-head">
                <div>
                  <span>PHOTO CHECK</span>
                  <h2>Is the entire table readable?</h2>
                </div>
                <button className="dn-ghost" onClick={resetPhoto}>
                  <RefreshCcw size={16} /> Retake
                </button>
              </div>

              <div className="dn-preview-wrap">
                {preview ? <img src={preview} alt="Delivery note preview" /> : <ImageIcon size={34} />}
              </div>

              <div className="dn-photo-tips">
                <ScanLine size={17} />
                Keep all product rows and both quantity columns inside the photo.
              </div>

              <button className="dn-primary dn-wide" onClick={scanNow}>
                <ScanLine size={18} /> Scan Table Row by Row
              </button>
            </motion.section>
          )}

          {stage === "scanning" && (
            <motion.section
              key="scanning"
              className="dn-panel dn-scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="dn-scanner-animation">
                <div className="dn-sheet"><div className="dn-beam" /></div>
                <Loader2 className="dn-spin" size={28} />
              </div>
              <h2>Reading DAM delivery note</h2>
              <p>{status}</p>
              <div className="dn-progress"><div style={{ width: `${progress}%` }} /></div>
              <b>{progress}%</b>
            </motion.section>
          )}

          {stage === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="dn-stats">
                <div><span>ROWS FOUND</span><b>{stats.total}</b></div>
                <div><span>NEEDS REVIEW</span><b className={stats.review ? "warn" : "ok"}>{stats.review}</b></div>
                <div><span>QTY MISMATCH</span><b className={stats.mismatches ? "warn" : "ok"}>{stats.mismatches}</b></div>
              </div>

              <section className="dn-panel">
                <div className="dn-section-head">
                  <div>
                    <span>DOCUMENT HEADER</span>
                    <h2>Delivery note details</h2>
                  </div>
                  <button className="dn-ghost" onClick={resetPhoto}>
                    <RefreshCcw size={16} /> New Scan
                  </button>
                </div>

                <div className="dn-form-grid">
                  <label>
                    <span>Delivery Note No.</span>
                    <input value={note.deliveryNoteNumber} onChange={(e) => updateNote("deliveryNoteNumber", e.target.value)} />
                  </label>
                  <label>
                    <span>Shipping Date</span>
                    <input value={note.shippingDate} onChange={(e) => updateNote("shippingDate", e.target.value)} />
                  </label>
                  <label>
                    <span>Source Location</span>
                    <input value={note.sourceLocation} onChange={(e) => updateNote("sourceLocation", e.target.value)} />
                  </label>
                  <label>
                    <span>Destination Location</span>
                    <input value={note.destinationLocation} onChange={(e) => updateNote("destinationLocation", e.target.value)} />
                  </label>
                  <label>
                    <span>Supplier</span>
                    <input value={note.supplier} onChange={(e) => updateNote("supplier", e.target.value)} />
                  </label>
                  <label>
                    <span>Receiving Branch</span>
                    <input value={branch?.name || branch?.code || ""} readOnly />
                  </label>
                </div>
              </section>

              <section className="dn-panel">
                <div className="dn-section-head">
                  <div>
                    <span>TABLE EXTRACTION</span>
                    <h2>PRODUCT → ORDERED → DELIVERED</h2>
                  </div>
                  <button className="dn-ghost" onClick={addItem}>
                    <Plus size={16} /> Add Row
                  </button>
                </div>

                {note.items.length === 0 ? (
                  <div className="dn-empty">
                    <TriangleAlert size={34} />
                    <h3>No SKU row was detected</h3>
                    <p>
                      The scanner only creates product rows when it finds a SKU such as [CB134]. Retake a sharper photo or add rows manually.
                    </p>
                    <button className="dn-primary" onClick={addItem}><Plus size={17} /> Add First Row</button>
                  </div>
                ) : (
                  <>
                    <div className="dn-table-wrap">
                      <table className="dn-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>SKU</th>
                            <th>PRODUCT</th>
                            <th>ORD. QTY</th>
                            <th>ORD. UOM</th>
                            <th>ORD. SIZE</th>
                            <th>DEL. QTY</th>
                            <th>DEL. UOM</th>
                            <th>DEL. SIZE</th>
                            <th>STATUS</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {note.items.map((item, index) => (
                            <tr key={item.id} className={item.needsReview || mismatch(item) ? "needs-review" : ""}>
                              <td>{index + 1}</td>
                              <td><input value={item.code} onChange={(e) => updateItem(item.id, "code", e.target.value.toUpperCase())} /></td>
                              <td><input className="product" value={item.product} onChange={(e) => updateItem(item.id, "product", e.target.value)} /></td>
                              <td><input value={item.orderedQty} onChange={(e) => updateItem(item.id, "orderedQty", e.target.value)} /></td>
                              <td><input value={item.orderedUom} onChange={(e) => updateItem(item.id, "orderedUom", e.target.value.toUpperCase())} /></td>
                              <td><input value={item.orderedSize} onChange={(e) => updateItem(item.id, "orderedSize", e.target.value.toUpperCase())} /></td>
                              <td><input value={item.deliveredQty} onChange={(e) => updateItem(item.id, "deliveredQty", e.target.value)} /></td>
                              <td><input value={item.deliveredUom} onChange={(e) => updateItem(item.id, "deliveredUom", e.target.value.toUpperCase())} /></td>
                              <td><input value={item.deliveredSize} onChange={(e) => updateItem(item.id, "deliveredSize", e.target.value.toUpperCase())} /></td>
                              <td>
                                <span className={`dn-status ${item.needsReview || mismatch(item) ? "warn" : "ok"}`}>
                                  {mismatch(item) ? "MISMATCH" : item.needsReview ? "REVIEW" : "OK"}
                                </span>
                              </td>
                              <td><button className="dn-trash" onClick={() => removeItem(item.id)} aria-label="Delete row"><Trash2 size={16} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="dn-mobile-items">
                      {note.items.map((item, index) => (
                        <div key={item.id} className={`dn-item-card ${item.needsReview || mismatch(item) ? "needs-review" : ""}`}>
                          <div className="dn-item-title">
                            <div><span>ROW {index + 1}</span><b>{item.code || "SKU missing"}</b></div>
                            <button onClick={() => removeItem(item.id)}><Trash2 size={16} /></button>
                          </div>

                          <div className="dn-mobile-grid">
                            <label><span>SKU</span><input value={item.code} onChange={(e) => updateItem(item.id, "code", e.target.value.toUpperCase())} /></label>
                            <label className="wide"><span>Product</span><input value={item.product} onChange={(e) => updateItem(item.id, "product", e.target.value)} /></label>

                            <div className="dn-mobile-subhead">ORDERED</div>
                            <label><span>Qty</span><input value={item.orderedQty} onChange={(e) => updateItem(item.id, "orderedQty", e.target.value)} /></label>
                            <label><span>UOM</span><input value={item.orderedUom} onChange={(e) => updateItem(item.id, "orderedUom", e.target.value.toUpperCase())} /></label>
                            <label className="wide"><span>Size / Pack</span><input value={item.orderedSize} onChange={(e) => updateItem(item.id, "orderedSize", e.target.value.toUpperCase())} /></label>

                            <div className="dn-mobile-subhead">DELIVERED</div>
                            <label><span>Qty</span><input value={item.deliveredQty} onChange={(e) => updateItem(item.id, "deliveredQty", e.target.value)} /></label>
                            <label><span>UOM</span><input value={item.deliveredUom} onChange={(e) => updateItem(item.id, "deliveredUom", e.target.value.toUpperCase())} /></label>
                            <label className="wide"><span>Size / Pack</span><input value={item.deliveredSize} onChange={(e) => updateItem(item.id, "deliveredSize", e.target.value.toUpperCase())} /></label>
                          </div>

                          <div className="dn-mobile-status-row">
                            <span className={`dn-status ${item.needsReview || mismatch(item) ? "warn" : "ok"}`}>
                              {mismatch(item) ? "QTY MISMATCH" : item.needsReview ? "CHECK ROW" : "VERIFIED"}
                            </span>
                            <small>OCR confidence {item.confidence}%</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="dn-panel dn-learning-panel">
                <div className="dn-learning-icon"><Sparkles size={20} /></div>
                <div>
                  <b>Correction learning is ON</b>
                  <p>
                    When staff verifies a SKU/product or fixes a UOM, this browser remembers the correction and reuses it on future scans.
                  </p>
                </div>
              </section>

              <section className="dn-panel">
                <label className="dn-check">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span>
                    <b>I cross-checked every row with the physical delivery note.</b>
                    <small>Only verified structured data is submitted. The photo is not part of the payload.</small>
                  </span>
                </label>

                <button className="dn-primary dn-wide" disabled={!validForSubmit} onClick={submitNote}>
                  <Save size={18} /> Confirm & Submit Delivery Note
                </button>
              </section>

              <section className="dn-debug">
                <button onClick={() => setDebugOpen((v) => !v)}>
                  <ChevronDown size={16} className={debugOpen ? "open" : ""} /> OCR Debug / Raw Detection
                </button>
                {debugOpen && <pre>{debugText || "No debug text."}</pre>}
              </section>
            </motion.div>
          )}

          {stage === "submitting" && (
            <motion.section key="submitting" className="dn-panel dn-scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Loader2 className="dn-spin" size={38} />
              <h2>Saving verified delivery note</h2>
              <p>Remembering corrections and preparing the structured record…</p>
            </motion.section>
          )}

          {stage === "success" && (
            <motion.section key="success" className="dn-panel dn-success" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="dn-success-icon"><CheckCircle2 size={44} /></div>
              <span>DELIVERY NOTE VERIFIED</span>
              <h2>Receiving data is ready.</h2>
              <p>{note.items.length} product row{note.items.length === 1 ? "" : "s"} verified for {branch?.name || branch?.code || "this branch"}.</p>
              <small>Reference: {submissionId}</small>
              <button className="dn-primary" onClick={resetPhoto}><Camera size={18} /> Scan Another Note</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
