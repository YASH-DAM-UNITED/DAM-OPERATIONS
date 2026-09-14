import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  RotateCcw,
  Save,
  ScanLine,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { PaddleOCR } from "@paddleocr/paddleocr-js";
import "./BartDeliveryNotes.css";

const ENABLE_BACKEND_SUBMIT = false;
const SUBMIT_ENDPOINT = "/api/staff/bart/delivery-note/submit";
const MAX_FILE_MB = 14;

const EMPTY_NOTE = {
  deliveryNoteNumber: "",
  shippingDate: "",
  sourceLocation: "",
  destinationLocation: "",
  supplier: "DAM UNITED",
  items: [],
};

const EMPTY_ITEM = () => ({
  id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  code: "",
  product: "",
  orderedQty: "",
  orderedUom: "",
  deliveredQty: "",
  deliveredUom: "",
  confidence: 0,
  needsReview: true,
  raw: "",
});

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

function stripArabicOnly(value = "") {
  return String(value)
    .replace(ARABIC_RE, " ")
    .replace(/[\u200f\u200e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value = "") {
  return stripArabicOnly(value)
    .replace(/[|¦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value = "") {
  const clean = cleanText(value).toUpperCase();
  const m = clean.match(/\[?\s*([A-Z]{1,4})\s*[-_.]?\s*(\d{2,4})\s*\]?/);
  return m ? `${m[1]}${m[2]}` : "";
}

function normalizeNumber(value = "") {
  const s = String(value)
    .replace(/[Oo]/g, "0")
    .replace(/[,]/g, ".")
    .replace(/[^0-9.]/g, "");
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}

function normalizeUom(value = "") {
  let s = cleanText(value).toUpperCase();
  s = s
    .replace(/\bP[CS5]{2,3}\b/g, "PCS")
    .replace(/\bPIECE(?:S)?\b/g, "PCS")
    .replace(/\bBOT(?:T|I|L|1)+E(?:S)?\b/g, "BOTTLE")
    .replace(/\bBTL\b/g, "BOTTLE")
    .replace(/\bGALL(?:O|0)N(?:S)?\b/g, "GALLON")
    .replace(/\bGR(?:A|4)M(?:S)?\b/g, "GRAM")
    .replace(/\bK(?:I|1)L(?:O|0)GRAM(?:S)?\b/g, "KG")
    .replace(/\bM[I1L][L1I]?[I1L]?\b/g, "ML")
    .replace(/\bL[I1]TRE(?:S)?\b/g, "L")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /BOTTLE\s*(\d+(?:\.\d+)?)\s*(ML|L)\b/,
    /GALLON\s*(\d+(?:\.\d+)?)\s*(ML|L)\b/,
    /\b(PCS|GRAM|KG|ML|L|BOTTLE|GALLON|PACK|BOX|BAG|CAN|CUP)\b/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return s.replace(/^\d+(?:\.\d+)?\s*/, "").trim();
}

function parseQtyUom(cellText = "") {
  const raw = cleanText(cellText);
  if (!raw) return { qty: "", uom: "", raw };
  const qty = normalizeNumber(raw);
  let remainder = raw;
  if (qty) {
    const idx = remainder.search(/\d/);
    if (idx >= 0) {
      const match = remainder.slice(idx).match(/^\d+(?:[.,]\d+)?/);
      if (match) remainder = `${remainder.slice(0, idx)} ${remainder.slice(idx + match[0].length)}`;
    }
  }
  return { qty, uom: normalizeUom(remainder), raw };
}

function polyBounds(poly = []) {
  const pts = Array.isArray(poly?.[0]) ? poly : [];
  const xs = pts.map((p) => Number(p?.[0])).filter(Number.isFinite);
  const ys = pts.map((p) => Number(p?.[1])).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function normalizeOcrItems(result) {
  return (result?.items || [])
    .map((item, index) => {
      const b = polyBounds(item.poly || item.box || item.points);
      if (!b) return null;
      const text = cleanText(item.text || "");
      if (!text) return null;
      return {
        id: index,
        text,
        rawText: item.text || "",
        score: Number(item.score ?? 0),
        ...b,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

function findHeader(items, imageWidth) {
  const productCandidates = items.filter((i) => /\bPRODUCT\b/i.test(i.text));
  const orderedCandidates = items.filter((i) => /\bORDERED\b/i.test(i.text));
  const deliveredCandidates = items.filter((i) => /\bDELIVERED\b/i.test(i.text));

  const combos = [];
  for (const p of productCandidates) {
    for (const o of orderedCandidates) {
      for (const d of deliveredCandidates) {
        const ySpread = Math.max(p.cy, o.cy, d.cy) - Math.min(p.cy, o.cy, d.cy);
        if (p.cx < o.cx && o.cx < d.cx && ySpread < Math.max(70, p.height * 3)) {
          combos.push({ p, o, d, ySpread });
        }
      }
    }
  }

  combos.sort((a, b) => a.ySpread - b.ySpread);
  if (combos[0]) {
    const { p, o, d } = combos[0];
    const orderedLeft = (p.maxX + o.minX) / 2;
    const deliveredLeft = (o.maxX + d.minX) / 2;
    return {
      headerY: Math.max(p.maxY, o.maxY, d.maxY),
      productLeft: 0,
      orderedLeft: Math.max(imageWidth * 0.55, orderedLeft),
      deliveredLeft: Math.max(imageWidth * 0.73, deliveredLeft),
      right: imageWidth,
      detected: true,
    };
  }

  return {
    headerY: 0,
    productLeft: 0,
    orderedLeft: imageWidth * 0.64,
    deliveredLeft: imageWidth * 0.82,
    right: imageWidth,
    detected: false,
  };
}

function groupPhysicalRows(items, headerY, imageHeight) {
  const tableItems = items.filter((i) => i.cy > headerY + 5 && i.cy < imageHeight * 0.97);
  if (!tableItems.length) return [];

  const medianHeight = [...tableItems]
    .map((i) => i.height)
    .sort((a, b) => a - b)[Math.floor(tableItems.length / 2)] || 20;
  const tolerance = Math.max(13, Math.min(38, medianHeight * 0.72));

  const rows = [];
  for (const item of tableItems) {
    let row = rows.find((r) => Math.abs(r.cy - item.cy) <= tolerance);
    if (!row) {
      row = { cy: item.cy, items: [] };
      rows.push(row);
    }
    row.items.push(item);
    row.cy = row.items.reduce((sum, x) => sum + x.cy, 0) / row.items.length;
  }

  rows.sort((a, b) => a.cy - b.cy);
  rows.forEach((r) => r.items.sort((a, b) => a.cx - b.cx));
  return rows;
}

function splitRowByColumns(row, columns) {
  const product = [];
  const ordered = [];
  const delivered = [];
  for (const item of row.items) {
    if (item.cx >= columns.deliveredLeft) delivered.push(item);
    else if (item.cx >= columns.orderedLeft) ordered.push(item);
    else product.push(item);
  }
  const join = (arr) => cleanText(arr.map((x) => x.text).join(" "));
  return {
    productText: join(product),
    orderedText: join(ordered),
    deliveredText: join(delivered),
    score: row.items.length ? row.items.reduce((s, i) => s + i.score, 0) / row.items.length : 0,
    cy: row.cy,
    allText: join(row.items),
  };
}

function isFooterOrNoise(text = "") {
  const s = text.toUpperCase();
  return /SIGNATURE|RECEIVED BY|PREPARED BY|PRINTED|PAGE\s*\d|EMAIL|@|TOTAL|NOTE\b|COMMENT|DRIVER/.test(s);
}

function buildProductRows(physicalRows, columns) {
  const rows = physicalRows.map((r) => splitRowByColumns(r, columns));
  const result = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const productClean = cleanText(current.productText);
    const code = normalizeCode(productClean);
    const product = cleanText(
      productClean
        .replace(/\[?\s*[A-Z]{1,4}\s*[-_.]?\s*\d{2,4}\s*\]?/i, " ")
        .replace(/^[-:–—\s]+/, " ")
    );
    const ordered = parseQtyUom(current.orderedText);
    const delivered = parseQtyUom(current.deliveredText);
    const needsReview = !code || !product || !ordered.qty || !delivered.qty || !delivered.uom;
    result.push({
      id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      code,
      product,
      orderedQty: ordered.qty,
      orderedUom: ordered.uom,
      deliveredQty: delivered.qty,
      deliveredUom: delivered.uom,
      confidence: current.score,
      needsReview,
      raw: current.allText,
    });
    current = null;
  };

  for (const row of rows) {
    if (/\bPRODUCT\b/i.test(row.allText) && /\bORDERED\b/i.test(row.allText)) continue;
    if (isFooterOrNoise(row.allText)) {
      pushCurrent();
      break;
    }

    const hasCode = Boolean(normalizeCode(row.productText));
    const hasQtyColumns = Boolean(normalizeNumber(row.orderedText) || normalizeNumber(row.deliveredText));

    if (hasCode) {
      pushCurrent();
      current = { ...row };
      continue;
    }

    if (current) {
      // OCR often splits one printed table row into two y-lines. Keep appending until next product code.
      current.productText = cleanText(`${current.productText} ${row.productText}`);
      current.orderedText = cleanText(`${current.orderedText} ${row.orderedText}`);
      current.deliveredText = cleanText(`${current.deliveredText} ${row.deliveredText}`);
      current.allText = cleanText(`${current.allText} ${row.allText}`);
      current.score = (current.score + row.score) / 2;
      continue;
    }

    // A line with quantities but a missed product code must still be kept for review.
    if (hasQtyColumns && row.productText) {
      current = { ...row };
    }
  }
  pushCurrent();
  return result.filter((r) => r.code || r.product || r.orderedQty || r.deliveredQty);
}

function findHeaderValue(items, labels) {
  const lines = items.map((i) => i.text);
  const joined = lines.join("\n");
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:#-]?\\s*([^\\n]+)`, "i");
    const m = joined.match(re);
    if (m?.[1]) return cleanText(m[1]);
  }
  return "";
}

function extractNoteMeta(items) {
  const text = items.map((i) => i.text).join("\n");
  const deliveryNote =
    text.match(/DELIVERY\s*NOTE\s*[:#-]?\s*([A-Z0-9\-/]+)/i)?.[1] ||
    text.match(/\b([A-Z]{2,6}\/[A-Z]{2,6}\/\d{3,})\b/i)?.[1] ||
    "";
  const shippingDate =
    text.match(/SHIPPING\s*DATE\s*[:#-]?\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?)/i)?.[1] ||
    "";
  const sourceLocation =
    text.match(/SOURCE\s*LOCATION\s*[:#-]?\s*([^\n]+)/i)?.[1] ||
    findHeaderValue(items, ["SOURCE"]);
  const destinationLocation =
    text.match(/DESTINATION\s*LOCATION\s*[:#-]?\s*([^\n]+)/i)?.[1] ||
    findHeaderValue(items, ["DESTINATION"]);

  return {
    deliveryNoteNumber: cleanText(deliveryNote),
    shippingDate: cleanText(shippingDate),
    sourceLocation: cleanText(sourceLocation),
    destinationLocation: cleanText(destinationLocation),
  };
}

function mismatchCount(items) {
  return items.filter((i) => {
    if (!i.orderedQty || !i.deliveredQty) return false;
    return Number(i.orderedQty) !== Number(i.deliveredQty);
  }).length;
}

function toDatetimeLocal(value = "") {
  const m = value.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return value;
  const [, mm, dd, yyyy, hh = "00", min = "00"] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}`;
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const inputRef = useRef(null);
  const ocrRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [phase, setPhase] = useState("capture");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("Ready to scan");
  const [note, setNote] = useState(EMPTY_NOTE);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [ocrDebug, setOcrDebug] = useState([]);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      try { ocrRef.current?.close?.(); } catch (_) {}
    };
  }, []);

  const stats = useMemo(() => {
    const review = note.items.filter((i) => i.needsReview).length;
    return {
      rows: note.items.length,
      review,
      mismatches: mismatchCount(note.items),
    };
  }, [note.items]);

  async function getOcr() {
    if (ocrRef.current) return ocrRef.current;
    setScanMessage("Loading PaddleOCR engine…");
    setScanProgress(8);
    // English recognition is intentional: Arabic text may exist on the note,
    // but we only retain English/numeric content for the DAM receiving workflow.
    ocrRef.current = await PaddleOCR.create({
      lang: "en",
      ocrVersion: "PP-OCRv5",
      worker: true,
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",
        numThreads: Math.max(1, Math.min(2, navigator.hardwareConcurrency || 2)),
        simd: true,
      },
    });
    return ocrRef.current;
  }

  function resetPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl("");
  }

  function clearAll() {
    resetPreview();
    setFile(null);
    setNote(EMPTY_NOTE);
    setConfirmed(false);
    setError("");
    setSubmissionId("");
    setOcrDebug([]);
    setPhase("capture");
    setScanProgress(0);
    setScanMessage("Ready to scan");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(event) {
    const next = event.target.files?.[0];
    if (!next) return;
    setError("");
    if (!next.type.startsWith("image/")) {
      setError("Please capture or select an image.");
      return;
    }
    if (next.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Image is too large. Maximum ${MAX_FILE_MB} MB.`);
      return;
    }
    resetPreview();
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(next);
    setPhase("preview");
  }

  async function scanDocument() {
    if (!file) return;
    setError("");
    setPhase("scanning");
    setScanProgress(3);
    setScanMessage("Starting document scanner…");

    try {
      const ocr = await getOcr();
      setScanProgress(20);
      setScanMessage("Finding text and table geometry…");
      const [result] = await ocr.predict(file, {
        textDetLimitSideLen: 1800,
        textDetLimitType: "max",
        textDetBoxThresh: 0.42,
        textDetUnclipRatio: 1.7,
        textRecScoreThresh: 0.35,
      });
      setScanProgress(74);
      setScanMessage("Following PRODUCT / ORDERED / DELIVERED rows…");

      const items = normalizeOcrItems(result);
      const imageWidth = result?.image?.width || 1200;
      const imageHeight = result?.image?.height || 1600;
      const columns = findHeader(items, imageWidth);
      const physicalRows = groupPhysicalRows(items, columns.headerY, imageHeight);
      const parsedItems = buildProductRows(physicalRows, columns);
      const meta = extractNoteMeta(items);

      setOcrDebug(items);
      setNote({
        ...EMPTY_NOTE,
        ...meta,
        shippingDate: toDatetimeLocal(meta.shippingDate),
        items: parsedItems,
      });
      setScanProgress(100);
      setScanMessage(`Found ${parsedItems.length} table row${parsedItems.length === 1 ? "" : "s"}`);
      setPhase("review");
    } catch (err) {
      console.error(err);
      setError(err?.message || "OCR failed. Please retake the photo in good light.");
      setPhase("preview");
    }
  }

  function updateMeta(key, value) {
    setNote((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(id, key, value) {
    setNote((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
              needsReview:
                key === "needsReview"
                  ? value
                  : !(key === "code" ? value : item.code) ||
                    !(key === "product" ? value : item.product) ||
                    !(key === "deliveredQty" ? value : item.deliveredQty) ||
                    !(key === "deliveredUom" ? value : item.deliveredUom),
            }
          : item
      ),
    }));
  }

  function removeItem(id) {
    setNote((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  }

  function addItem() {
    setNote((prev) => ({ ...prev, items: [...prev.items, EMPTY_ITEM()] }));
  }

  const canSubmit =
    confirmed &&
    Boolean(note.deliveryNoteNumber) &&
    note.items.length > 0 &&
    note.items.every((i) => i.code && i.product && i.deliveredQty && i.deliveredUom);

  async function submitNote() {
    if (!canSubmit) return;
    setError("");
    setPhase("submitting");
    const payload = {
      branchCode: branch?.code || "",
      branchName: branch?.name || "",
      deliveryNoteNumber: note.deliveryNoteNumber,
      shippingDate: note.shippingDate,
      sourceLocation: note.sourceLocation,
      destinationLocation: note.destinationLocation,
      supplier: note.supplier,
      items: note.items.map(({ id, confidence, needsReview, raw, ...rest }) => rest),
      mismatchCount: mismatchCount(note.items),
      submittedAt: new Date().toISOString(),
    };

    try {
      if (ENABLE_BACKEND_SUBMIT) {
        const res = await fetch(SUBMIT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) throw new Error(data?.message || "Submission failed");
        setSubmissionId(data?.id || data?.submissionId || note.deliveryNoteNumber);
      } else {
        console.log("DELIVERY NOTE PAYLOAD", payload);
        await new Promise((r) => setTimeout(r, 600));
        setSubmissionId(`LOCAL-${Date.now().toString().slice(-7)}`);
      }
      resetPreview();
      setFile(null);
      setPhase("success");
    } catch (err) {
      setError(err?.message || "Unable to submit delivery note.");
      setPhase("review");
    }
  }

  return (
    <div className="dn-shell">
      <div className="dn-grid" />
      <header className="dn-topbar">
        <button className="dn-icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="dn-brand">
          <div className="dn-brand-icon"><FileScan size={20} /></div>
          <div>
            <strong>Delivery Notes</strong>
            <span>LIVE TABLE SCANNER</span>
          </div>
        </div>
        <div className="dn-branch-pill">
          <span>{branch?.code || "BRANCH"}</span>
          <b>{branch?.name || "Receiving Branch"}</b>
        </div>
      </header>

      <main className="dn-main">
        <section className="dn-hero">
          <div>
            <div className="dn-kicker"><ScanLine size={15} /> DAM TABLE READER</div>
            <h1>Scan every delivery-note row.</h1>
            <p>
              PaddleOCR reads text with coordinates, then this page follows the printed
              <b> PRODUCT → ORDERED → DELIVERED </b> columns row-by-row. Arabic characters are removed only after reading each cell.
            </p>
          </div>
          <div className="dn-engine-badge">
            <span className="dn-live-dot" />
            <div><b>LOCAL OCR</b><small>No paid vision API</small></div>
          </div>
        </section>

        {error && (
          <div className="dn-alert dn-alert-danger"><TriangleAlert size={18} /><span>{error}</span></div>
        )}

        <AnimatePresence mode="wait">
          {phase === "capture" && (
            <motion.section key="capture" className="dn-panel dn-capture" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="dn-scan-frame">
                <span className="c tl" /><span className="c tr" /><span className="c bl" /><span className="c br" />
                <div className="dn-camera-orb"><Camera size={34} /></div>
                <h2>Photograph the complete note</h2>
                <p>Keep PRODUCT, ORDERED and DELIVERED columns fully visible. Avoid cutting the left product codes or right delivered column.</p>
                <button className="dn-primary" onClick={() => inputRef.current?.click()}><Camera size={18} /> Open Camera</button>
              </div>
              <input ref={inputRef} className="dn-hidden" type="file" accept="image/*" capture="environment" onChange={handleFile} />
            </motion.section>
          )}

          {phase === "preview" && (
            <motion.section key="preview" className="dn-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="dn-section-head"><div><span>STEP 01</span><h2>Check the photo</h2></div><button className="dn-ghost" onClick={clearAll}><RotateCcw size={16} /> Retake</button></div>
              <div className="dn-preview-wrap"><img src={previewUrl} alt="Delivery note preview" /></div>
              <div className="dn-photo-tips"><CheckCircle2 size={17} /><span>The full table should be sharp and straight enough to read every row.</span></div>
              <button className="dn-primary dn-wide" onClick={scanDocument}><ScanLine size={18} /> Scan Table Now</button>
            </motion.section>
          )}

          {phase === "scanning" && (
            <motion.section key="scanning" className="dn-panel dn-scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="dn-scanner-animation"><div className="dn-sheet"><div className="dn-beam" /></div><Loader2 className="dn-spin" size={30} /></div>
              <h2>{scanMessage}</h2>
              <p>Finding text coordinates and reconstructing physical table rows.</p>
              <div className="dn-progress"><motion.div animate={{ width: `${scanProgress}%` }} /></div>
              <strong>{scanProgress}%</strong>
            </motion.section>
          )}

          {(phase === "review" || phase === "submitting") && (
            <motion.section key="review" className="dn-review" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="dn-stats">
                <div><span>ROWS FOUND</span><b>{stats.rows}</b></div>
                <div><span>NEEDS REVIEW</span><b className={stats.review ? "warn" : "ok"}>{stats.review}</b></div>
                <div><span>QTY MISMATCH</span><b className={stats.mismatches ? "warn" : "ok"}>{stats.mismatches}</b></div>
              </div>

              <section className="dn-panel">
                <div className="dn-section-head"><div><span>STEP 02</span><h2>Delivery details</h2></div><button className="dn-ghost" onClick={() => setPhase("preview")}><RefreshCcw size={16} /> Rescan</button></div>
                <div className="dn-form-grid">
                  <label><span>Delivery Note No.</span><input value={note.deliveryNoteNumber} onChange={(e) => updateMeta("deliveryNoteNumber", e.target.value)} placeholder="CKWH/INT/46389" /></label>
                  <label><span>Shipping Date</span><input type="datetime-local" value={note.shippingDate} onChange={(e) => updateMeta("shippingDate", e.target.value)} /></label>
                  <label><span>Source Location</span><input value={note.sourceLocation} onChange={(e) => updateMeta("sourceLocation", e.target.value)} /></label>
                  <label><span>Destination Location</span><input value={note.destinationLocation} onChange={(e) => updateMeta("destinationLocation", e.target.value)} /></label>
                </div>
              </section>

              <section className="dn-panel">
                <div className="dn-section-head"><div><span>STEP 03</span><h2>PRODUCT / ORDERED / DELIVERED</h2></div><button className="dn-ghost" onClick={addItem}><Plus size={16} /> Add row</button></div>
                {!note.items.length ? (
                  <div className="dn-empty"><TriangleAlert size={24} /><h3>No product rows were confidently reconstructed</h3><p>Retake the photo with the entire table visible, or add a row manually.</p></div>
                ) : (
                  <div className="dn-table-wrap">
                    <table className="dn-table">
                      <thead><tr><th>#</th><th>CODE</th><th>PRODUCT</th><th>ORDERED</th><th>UOM</th><th>DELIVERED</th><th>UOM</th><th>STATUS</th><th /></tr></thead>
                      <tbody>
                        {note.items.map((item, idx) => (
                          <tr key={item.id} className={item.needsReview ? "needs-review" : ""}>
                            <td>{idx + 1}</td>
                            <td><input value={item.code} onChange={(e) => updateItem(item.id, "code", e.target.value.toUpperCase())} /></td>
                            <td><input className="product" value={item.product} onChange={(e) => updateItem(item.id, "product", e.target.value)} /></td>
                            <td><input inputMode="decimal" value={item.orderedQty} onChange={(e) => updateItem(item.id, "orderedQty", e.target.value)} /></td>
                            <td><input value={item.orderedUom} onChange={(e) => updateItem(item.id, "orderedUom", e.target.value.toUpperCase())} /></td>
                            <td><input inputMode="decimal" value={item.deliveredQty} onChange={(e) => updateItem(item.id, "deliveredQty", e.target.value)} /></td>
                            <td><input value={item.deliveredUom} onChange={(e) => updateItem(item.id, "deliveredUom", e.target.value.toUpperCase())} /></td>
                            <td>{item.needsReview ? <span className="dn-status warn">REVIEW</span> : <span className="dn-status ok">READY</span>}</td>
                            <td><button className="dn-trash" onClick={() => removeItem(item.id)}><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="dn-mobile-items">
                  {note.items.map((item, idx) => (
                    <article className={`dn-item-card ${item.needsReview ? "needs-review" : ""}`} key={`m-${item.id}`}>
                      <div className="dn-item-title"><b>Row {idx + 1}</b><button onClick={() => removeItem(item.id)}><X size={16} /></button></div>
                      <div className="dn-mobile-grid">
                        <label><span>Code</span><input value={item.code} onChange={(e) => updateItem(item.id, "code", e.target.value.toUpperCase())} /></label>
                        <label className="wide"><span>Product</span><input value={item.product} onChange={(e) => updateItem(item.id, "product", e.target.value)} /></label>
                        <label><span>Ordered</span><input value={item.orderedQty} onChange={(e) => updateItem(item.id, "orderedQty", e.target.value)} /></label>
                        <label><span>Ordered UOM</span><input value={item.orderedUom} onChange={(e) => updateItem(item.id, "orderedUom", e.target.value.toUpperCase())} /></label>
                        <label><span>Delivered</span><input value={item.deliveredQty} onChange={(e) => updateItem(item.id, "deliveredQty", e.target.value)} /></label>
                        <label><span>Delivered UOM</span><input value={item.deliveredUom} onChange={(e) => updateItem(item.id, "deliveredUom", e.target.value.toUpperCase())} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="dn-panel dn-confirm-panel">
                <label className="dn-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><CheckCircle2 size={20} /><b>I cross-checked every row with the physical delivery note.</b><small>Rows highlighted for review must be corrected before submission.</small></span></label>
                <button disabled={!canSubmit || phase === "submitting"} className="dn-primary dn-wide" onClick={submitNote}>{phase === "submitting" ? <Loader2 className="dn-spin" size={18} /> : <Save size={18} />}{phase === "submitting" ? "Submitting…" : "Confirm & Submit"}</button>
              </section>

              <section className="dn-debug">
                <button onClick={() => setShowDebug((v) => !v)}><ChevronDown size={16} className={showDebug ? "open" : ""} /> OCR debug ({ocrDebug.length} detected text boxes)</button>
                {showDebug && <pre>{ocrDebug.map((x) => `[${x.score.toFixed(2)}] x:${Math.round(x.cx)} y:${Math.round(x.cy)}  ${x.text}`).join("\n")}</pre>}
              </section>
            </motion.section>
          )}

          {phase === "success" && (
            <motion.section key="success" className="dn-panel dn-success" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="dn-success-icon"><CheckCircle2 size={44} /></div>
              <span>DELIVERY NOTE READY</span>
              <h2>{note.deliveryNoteNumber}</h2>
              <p>{ENABLE_BACKEND_SUBMIT ? "Verified data has been submitted." : "Live OCR is working. Backend storage is still disabled, so this test was not permanently saved."}</p>
              <small>Reference: {submissionId}</small>
              <button className="dn-primary" onClick={clearAll}><Camera size={18} /> Scan Another Note</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
