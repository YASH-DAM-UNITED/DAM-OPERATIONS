import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Camera, CheckCircle2, FileScan, Image as ImageIcon,
  Loader2, Plus, RefreshCcw, Save, ScanLine, Trash2, TriangleAlert, Sun, Moon
} from "lucide-react";
import { createWorker } from "tesseract.js";
import "./BartDeliveryNotes.css";

/*
  BART DELIVERY NOTE SCANNER — browser OCR only
  ------------------------------------------------
  - No OpenCV
  - No paid OCR/Vision API
  - OCR runs in the browser with Tesseract.js
  - Image preprocessing uses the browser Canvas API
  - Staff must verify extracted data before submission
*/

const MAX_FILE_MB = 16;
const ENABLE_BACKEND_SUBMIT = false;
const SUBMIT_ENDPOINT = "/api/staff/bart/delivery-note/submit";
const LEARNING_KEY = "bart-delivery-note-ocr-learning-v1";

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

function uid() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function stripArabic(v = "") {
  // IMPORTANT:
  // Arabic characters are removed from the OCR text only.
  // The rest of the SAME physical/text row is preserved and parsed normally.
  // Example:
  //   "[B018] Code Red Syrup - كورد رد احمر"
  // becomes:
  //   "[B018] Code Red Syrup -"
  // and the row is NOT discarded.
  return String(v)
    .replace(ARABIC_RE, "")
    .replace(/[\u200e\u200f\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+-\s*$/gm, "")
    .trim();
}

function clean(v = "") {
  return stripArabic(v)
    .replace(/[¦│]/g, "|")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeSku(raw = "") {
  const s = clean(raw).toUpperCase()
    .replace(/[({]/g, "[")
    .replace(/[)}]/g, "]");

  const bracketed = s.match(/\[\s*([A-Z]{1,6})\s*[-_. ]?\s*([0-9O]{1,6})\s*\]/);
  if (bracketed) return `${bracketed[1]}${bracketed[2].replace(/O/g, "0")}`;

  const loose = s.match(/(?:^|\s)([A-Z]{1,6})\s*[-_. ]?\s*([0-9O]{2,6})(?=\s|$)/);
  if (loose) return `${loose[1]}${loose[2].replace(/O/g, "0")}`;
  return "";
}

function normalizeQty(raw = "") {
  const s = clean(raw).replace(/,/g, ".").replace(/[Oo]/g, "0");
  const m = s.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
  return m ? m[1] : "";
}

function normalizeUom(raw = "") {
  const s = clean(raw).toUpperCase().replace(/[^A-Z]/g, "");
  const map = {
    PC:"PCS", PCS:"PCS", PCE:"PCS", PCSS:"PCS", PIECE:"PCS", PIECES:"PCS",
    BTL:"BOTTLE", BOTLE:"BOTTLE", BOTTEL:"BOTTLE", BOTTIE:"BOTTLE",
    BOTTLE:"BOTTLE", BOTTLES:"BOTTLE", GALON:"GALLON", GALLON:"GALLON",
    GALLONS:"GALLON", G:"GRAM", GM:"GRAM", GRAM:"GRAM", GRAMS:"GRAM",
    KG:"KG", KGS:"KG", ML:"ML", L:"L", LTR:"L", LITER:"L", LITRE:"L",
    PACK:"PACK", PKT:"PACK", BOX:"BOX", BAG:"BAG", CAN:"CAN", CUP:"CUP",
    TRAY:"TRAY", TIN:"TIN", JAR:"JAR", ROLL:"ROLL"
  };
  if (map[s]) return map[s];
  if (/^P[COS5]{1,3}$/.test(s)) return "PCS";
  if (/^BOT+L?E?$/.test(s) || /^BOTT[A-Z]{0,3}$/.test(s)) return "BOTTLE";
  if (/^GAL+O?N?$/.test(s)) return "GALLON";
  if (/^GRA?M?S?$/.test(s)) return "GRAM";
  return "";
}

function normalizeSize(raw = "") {
  const s = clean(raw).toUpperCase().replace(/,/g, ".")
    .replace(/\bM[I1L]\b/g, "ML").replace(/\bL[I1]\b/g, "L");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(ML|L|G|GRAM|KG)\b/i);
  if (!m) return "";
  const unit = m[2].toUpperCase() === "G" ? "GRAM" : m[2].toUpperCase();
  return `${m[1]} ${unit}`;
}

function parseQtyCell(raw = "") {
  const text = clean(raw);
  if (!text) return { qty:"", uom:"", size:"" };
  const qty = normalizeQty(text);
  const words = text.split(/\s+/).filter(Boolean);
  let uom = "", idx = -1;
  for (let i = 0; i < words.length; i += 1) {
    const x = normalizeUom(words[i]);
    if (x) { uom = x; idx = i; break; }
  }
  return {
    qty,
    uom,
    size: normalizeSize(idx >= 0 ? words.slice(idx + 1).join(" ") : text),
  };
}

function productFromText(raw = "") {
  let text = clean(raw);
  const code = normalizeSku(text);
  text = text
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/(?:^|\s)[A-Z]{1,6}\s*[-_. ]?\s*[0-9O]{2,6}(?=\s|$)/i, " ")
    .split(/\s+-\s+/)[0]
    .replace(/\s+/g, " ")
    .replace(/[\s\-–—|:;,]+$/g, "")
    .trim();
  return { code, product: text };
}

function blankItem() {
  return {
    id: uid(), code:"", product:"",
    orderedQty:"", orderedUom:"", orderedSize:"",
    deliveredQty:"", deliveredUom:"", deliveredSize:"",
    needsReview:true, raw:""
  };
}

function readLearning() {
  try { return JSON.parse(localStorage.getItem(LEARNING_KEY) || "{}"); }
  catch { return {}; }
}

function applyLearning(item) {
  if (!item.code) return item;
  const x = readLearning()[item.code];
  if (!x) return item;
  return {
    ...item,
    product: item.product || x.product || "",
    orderedUom: item.orderedUom || x.orderedUom || "",
    orderedSize: item.orderedSize || x.orderedSize || "",
    deliveredUom: item.deliveredUom || x.deliveredUom || "",
    deliveredSize: item.deliveredSize || x.deliveredSize || "",
  };
}

function saveLearning(note) {
  try {
    const db = readLearning();
    (note.items || []).forEach((x) => {
      if (!x.code) return;
      db[x.code] = {
        product:x.product || "", orderedUom:x.orderedUom || "",
        orderedSize:x.orderedSize || "", deliveredUom:x.deliveredUom || "",
        deliveredSize:x.deliveredSize || ""
      };
    });
    localStorage.setItem(LEARNING_KEY, JSON.stringify(db));
  } catch {}
}

function parseHeader(text = "") {
  const flat = stripArabic(text).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return {
    deliveryNoteNumber:
      flat.match(/Delivery\s*Note(?:\s*(?:No|Number))?\s*[:#-]?\s*([A-Z0-9/_-]+)/i)?.[1] || "",
    shippingDate:
      flat.match(/Shipping\s*Date\s*[:#-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i)?.[1] || "",
    sourceLocation:
      flat.match(/Source\s*Location\s*[:#-]?\s*([A-Z0-9/_ -]+?)(?=\s+Destination\s*Location|\s+Shipping\s*Date|\s+PRODUCT|$)/i)?.[1]?.trim() || "",
    destinationLocation:
      flat.match(/Destination\s*Location\s*[:#-]?\s*([A-Z0-9/_ -]+?)(?=\s+Shipping\s*Date|\s+PRODUCT|\s+ORDERED|$)/i)?.[1]?.trim() || "",
  };
}

function looksLikeHeader(line) {
  return /\b(PRODUCT|ORDERED|DELIVERED|DELIVERY\s*NOTE|SOURCE\s*LOCATION|DESTINATION\s*LOCATION|SHIPPING\s*DATE)\b/i.test(line);
}

function parseLineItem(line) {
  const raw = clean(line);
  if (!raw || looksLikeHeader(raw)) return null;

  const sku = normalizeSku(raw);
  if (!sku) return null;

  // Quantities are normally at the right side. Find qty/UOM groups.
  const groups = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s+(PCS?|PCE|PIECES?|BOTT?L?E?S?|BTL|GALLONS?|GALON|GRAMS?|GM|KG|KGS|ML|LTR|LIT(?:ER|RE)|PACK|PKT|BOX|BAG|CAN|CUP|TRAY|TIN|JAR|ROLL)\b(?:\s+(\d+(?:[.,]\d+)?\s*(?:ML|L|G|GRAM|KG)))?/gi)];

  let ordered = {qty:"",uom:"",size:""};
  let delivered = {qty:"",uom:"",size:""};

  if (groups[0]) ordered = parseQtyCell(groups[0][0]);
  if (groups[1]) delivered = parseQtyCell(groups[1][0]);

  let productText = raw;
  const skuBracket = raw.match(/\[[^\]]+\]/)?.[0];
  if (skuBracket) productText = productText.replace(skuBracket, " ");
  else productText = productText.replace(new RegExp(`\\b${sku}\\b`, "i"), " ");
  if (groups[0]) productText = productText.slice(0, Math.max(0, productText.indexOf(groups[0][0])));
  productText = productText.split(/\s+-\s+/)[0].replace(/\s+/g, " ").trim();

  let item = {
    id:uid(), code:sku, product:productText,
    orderedQty:ordered.qty, orderedUom:ordered.uom, orderedSize:ordered.size,
    deliveredQty:delivered.qty, deliveredUom:delivered.uom, deliveredSize:delivered.size,
    raw, needsReview:false
  };
  item = applyLearning(item);
  item.needsReview = !(item.code && item.product && item.orderedQty &&
    item.orderedUom && item.deliveredQty && item.deliveredUom);
  return item;
}

function parseItems(text = "") {
  const lines = stripArabic(text)
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);

  const items = [];
  let pending = "";

  for (const line of lines) {
    const combined = pending ? `${pending} ${line}` : line;
    const item = parseLineItem(combined);
    if (item) {
      items.push(item);
      pending = "";
      continue;
    }
    // Keep a probable product line so wrapped OCR rows can be joined once.
    if (normalizeSku(line)) pending = line;
    else if (pending && !looksLikeHeader(line)) {
      const joined = parseLineItem(`${pending} ${line}`);
      if (joined) { items.push(joined); pending = ""; }
    }
  }

  // De-duplicate only identical OCR rows; preserve legitimate repeated SKUs.
  const seen = new Set();
  return items.filter((x) => {
    const k = `${x.code}|${x.product}|${x.orderedQty}|${x.deliveredQty}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({img, url});
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
    img.src = url;
  });
}

function buildCanvas(img, mode = "contrast") {
  const maxWidth = 2200;
  const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently:true });
  ctx.drawImage(img, 0, 0, w, h);

  if (mode === "original") return c;

  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  let sum = 0;
  for (let i=0; i<d.length; i+=4) sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
  const avg = sum / (d.length/4);
  const threshold = Math.max(135, Math.min(205, avg * 0.92));

  for (let i=0; i<d.length; i+=4) {
    const g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    let v;
    if (mode === "binary") v = g > threshold ? 255 : 0;
    else v = Math.max(0, Math.min(255, (g - 128) * 1.65 + 128));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}


function cropCanvas(source, x0, y0, x1, y1, scale = 1.45) {
  const sx = Math.max(0, Math.round(source.width * x0));
  const sy = Math.max(0, Math.round(source.height * y0));
  const sw = Math.max(1, Math.round(source.width * (x1 - x0)));
  const sh = Math.max(1, Math.round(source.height * (y1 - y0)));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height);

  // Strong grayscale/contrast pass. This keeps printed text while fading paper shadows.
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.9 + 150));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

function cleanOcrLines(text = "") {
  return stripArabic(text)
    .split(/\r?\n/)
    .map((x) => clean(x))
    .filter(Boolean)
    .filter((x) => !/^(PRODUCT|ORDERED|DELIVERED)$/i.test(x));
}

function parseProductLines(text = "") {
  const lines = cleanOcrLines(text);
  const rows = [];
  let pending = "";

  for (const line of lines) {
    // cleanOcrLines() has already removed Arabic characters only.
    // Never reject a row merely because its original OCR line contained Arabic.
    const sku = normalizeSku(line);
    if (sku) {
      if (pending && rows.length) {
        rows[rows.length - 1].product = `${rows[rows.length - 1].product} ${pending}`.trim();
        pending = "";
      }
      const p = productFromText(line);
      rows.push({ code: p.code || sku, product: p.product || "" });
    } else if (rows.length && !looksLikeHeader(line)) {
      // Product names can wrap onto a second OCR line.
      rows[rows.length - 1].product = `${rows[rows.length - 1].product} ${line}`.trim();
    }
  }
  return rows;
}

function parseQuantityLines(text = "") {
  const lines = cleanOcrLines(text);
  const rows = [];
  for (const line of lines) {
    const cell = parseQtyCell(line);
    if (cell.qty) rows.push(cell);
  }
  return rows;
}

function mergeColumnRows(products, ordered, delivered) {
  const count = Math.max(products.length, ordered.length, delivered.length);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const p = products[i] || { code: "", product: "" };
    const o = ordered[i] || { qty: "", uom: "", size: "" };
    const d = delivered[i] || { qty: "", uom: "", size: "" };
    let item = {
      id: uid(),
      code: p.code || "",
      product: p.product || "",
      orderedQty: o.qty || "",
      orderedUom: o.uom || "",
      orderedSize: o.size || "",
      deliveredQty: d.qty || "",
      deliveredUom: d.uom || "",
      deliveredSize: d.size || "",
      raw: "",
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
    // Never manufacture a row from quantities alone.
    if (item.code || item.product) out.push(item);
  }
  return out;
}

function scoreResult(text, items, header) {
  return (items.length * 20) +
    (header.deliveryNoteNumber ? 8 : 0) +
    (header.shippingDate ? 4 : 0) +
    (header.sourceLocation ? 3 : 0) +
    (header.destinationLocation ? 3 : 0) +
    Math.min(10, (text.match(/\[[A-Z0-9 _.-]+\]/gi) || []).length * 2);
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("bart-delivery-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  const inputRef = useRef(null);
  const previewRef = useRef("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [note, setNote] = useState(EMPTY_NOTE);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [successId, setSuccessId] = useState("");

  useEffect(() => {
    try { localStorage.setItem("bart-delivery-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const mismatchCount = useMemo(() => note.items.filter((x) => {
    const a = Number(x.orderedQty), b = Number(x.deliveredQty);
    return Number.isFinite(a) && Number.isFinite(b) && x.orderedQty !== "" &&
      x.deliveredQty !== "" && a !== b;
  }).length, [note.items]);

  const reviewCount = useMemo(
    () => note.items.filter((x) => x.needsReview).length,
    [note.items]
  );

  const reviewValid = Boolean(note.deliveryNoteNumber) &&
    note.items.length > 0 &&
    note.items.every((x) => x.code && x.product && x.orderedQty &&
      x.orderedUom && x.deliveredQty && x.deliveredUom) &&
    confirmed;

  function resetAll() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setFile(null); setPreview(""); setPhase("idle"); setProgress("");
    setProgressPct(0); setNote(EMPTY_NOTE); setError("");
    setConfirmed(false); setSuccessId("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    if (!f.type.startsWith("image/")) return setError("Please choose a delivery note photo.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`Maximum image size is ${MAX_FILE_MB} MB.`);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setFile(f); setPreview(url); setNote(EMPTY_NOTE);
    setConfirmed(false); setSuccessId(""); setPhase("ready");
  }

  async function scanNow() {
    if (!file) return;
    setError("");
    setConfirmed(false);
    setPhase("scanning");
    setProgress("Preparing document…");
    setProgressPct(2);

    let worker;
    let imageUrl = "";

    try {
      const loaded = await loadImage(file);
      imageUrl = loaded.url;

      setProgress("Loading OCR engine…");
      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m?.status === "recognizing text" && Number.isFinite(m.progress)) {
            setProgressPct((old) =>
              Math.max(old, Math.min(94, Math.round(8 + m.progress * 20)))
            );
          }
        },
      });

      const full = buildCanvas(loaded.img, "contrast");

      // 1) Header pass. Your DAM note has the document details above the item table.
      setProgress("Reading delivery note details…");
      setProgressPct(12);
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "6",
      });
      const headerCanvas = cropCanvas(full, 0.02, 0.25, 0.98, 0.56, 1.25);
      const headerResult = await worker.recognize(headerCanvas);
      let headerText = headerResult?.data?.text || "";
      let header = parseHeader(headerText);

      // If one header field is weak, use the full page as a second source.
      if (!header.deliveryNoteNumber || !header.sourceLocation || !header.destinationLocation) {
        const fullResult = await worker.recognize(full);
        const fullText = fullResult?.data?.text || "";
        const fallbackHeader = parseHeader(fullText);
        header = {
          deliveryNoteNumber: header.deliveryNoteNumber || fallbackHeader.deliveryNoteNumber,
          shippingDate: header.shippingDate || fallbackHeader.shippingDate,
          sourceLocation: header.sourceLocation || fallbackHeader.sourceLocation,
          destinationLocation: header.destinationLocation || fallbackHeader.destinationLocation,
        };
      }

      /*
        2) Table pass.
        The DAM delivery note is a stable 3-column form:
          PRODUCT | ORDERED | DELIVERED

        Whole-page OCR was the reason the previous build found zero rows:
        table borders caused Tesseract to merge/split columns unpredictably.

        This build reads each physical column independently. The crop is deliberately
        a little wider than the printed column so tilted phone photos still fit.
      */
      setProgress("Reading product rows…");
      setProgressPct(38);
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "6",
      });

      // The table occupies the middle/lower portion of this DAM form.
      // Product column ≈ left 62%; ordered ≈ middle 19%; delivered ≈ right 19%.
      const productCanvas = cropCanvas(full, 0.025, 0.47, 0.635, 0.83, 1.55);
      const orderedCanvas = cropCanvas(full, 0.59, 0.47, 0.825, 0.83, 1.65);
      const deliveredCanvas = cropCanvas(full, 0.775, 0.47, 0.985, 0.83, 1.65);

      const productResult = await worker.recognize(productCanvas);
      setProgress("Reading ordered quantities…");
      setProgressPct(57);
      const orderedResult = await worker.recognize(orderedCanvas);
      setProgress("Reading delivered quantities…");
      setProgressPct(76);
      const deliveredResult = await worker.recognize(deliveredCanvas);

      const productText = productResult?.data?.text || "";
      const orderedText = orderedResult?.data?.text || "";
      const deliveredText = deliveredResult?.data?.text || "";

      let products = parseProductLines(productText);
      let ordered = parseQuantityLines(orderedText);
      let delivered = parseQuantityLines(deliveredText);
      let finalItems = mergeColumnRows(products, ordered, delivered);

      // 3) Safety fallback for differently cropped/printed notes:
      // use normal full-page line parsing only if column OCR did not produce products.
      if (!finalItems.length) {
        setProgress("Running document fallback…");
        setProgressPct(88);
        const original = buildCanvas(loaded.img, "original");
        const fallback = await worker.recognize(original);
        const fallbackText = fallback?.data?.text || "";
        const fallbackHeader = parseHeader(fallbackText);
        header = {
          deliveryNoteNumber: header.deliveryNoteNumber || fallbackHeader.deliveryNoteNumber,
          shippingDate: header.shippingDate || fallbackHeader.shippingDate,
          sourceLocation: header.sourceLocation || fallbackHeader.sourceLocation,
          destinationLocation: header.destinationLocation || fallbackHeader.destinationLocation,
        };
        finalItems = parseItems(fallbackText);
      }

      finalItems = finalItems.map((x) => ({
        ...x,
        needsReview: !(
          x.code &&
          x.product &&
          x.orderedQty &&
          x.orderedUom &&
          x.deliveredQty &&
          x.deliveredUom
        ),
      }));

      setNote({
        ...EMPTY_NOTE,
        ...header,
        items: finalItems.length ? finalItems : [blankItem()],
      });

      if (!finalItems.length) {
        setError(
          "The document details were read, but the item table still needs manual review. Retake the photo straight above the complete page with the table sharp and well lit."
        );
      } else if (
        products.length !== ordered.length ||
        products.length !== delivered.length
      ) {
        setError(
          `Detected ${products.length} product rows, ${ordered.length} ordered rows and ${delivered.length} delivered rows. Please verify the highlighted rows before confirming.`
        );
      }

      setProgressPct(100);
      setProgress("Scan complete");
      setPhase("review");
    } catch (err) {
      setError(err?.message || "Could not read this delivery note.");
      setPhase("ready");
    } finally {
      try {
        await worker?.terminate();
      } catch {}
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    }
  }

  function setHeader(field, value) {
    setNote((p) => ({...p, [field]:value}));
  }

  function setItem(id, field, value) {
    setNote((p) => ({
      ...p,
      items:p.items.map((x) => {
        if (x.id !== id) return x;
        const y = {...x, [field]:value};
        y.needsReview = !(y.code && y.product && y.orderedQty &&
          y.orderedUom && y.deliveredQty && y.deliveredUom);
        return y;
      })
    }));
    setConfirmed(false);
  }

  function addItem() {
    setNote((p) => ({...p, items:[...p.items, blankItem()]}));
    setConfirmed(false);
  }

  function removeItem(id) {
    setNote((p) => ({...p, items:p.items.filter((x) => x.id !== id)}));
    setConfirmed(false);
  }

  async function submit() {
    if (!reviewValid) return;
    setPhase("submitting"); setError("");
    const payload = {
      branchCode:branch?.code || "",
      branchName:branch?.name || "",
      ...note,
      items:note.items.map(({id, needsReview, raw, ...x}) => x),
      submittedAt:new Date().toISOString(),
    };

    try {
      saveLearning(note);
      if (!ENABLE_BACKEND_SUBMIT) {
        console.log("Delivery note payload:", payload);
        await new Promise((r) => setTimeout(r, 650));
        setSuccessId(`DN-${Date.now().toString().slice(-7)}`);
      } else {
        const r = await fetch(SUBMIT_ENDPOINT, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        const data = await r.json();
        if (!r.ok || !data?.success) throw new Error(data?.message || "Submission failed.");
        setSuccessId(data.id || data.submissionId || "SAVED");
      }
      setPhase("success");
    } catch (e) {
      setError(e?.message || "Submission failed.");
      setPhase("review");
    }
  }

  return (
    <div className={`dn-page dn-theme-${theme}`}>
      <div className="dn-aurora dn-aurora-a" />
      <div className="dn-aurora dn-aurora-b" />
      <header className="dn-topbar">
        <button className="dn-icon-btn" type="button" onClick={onBack}><ArrowLeft size={20}/></button>
        <div className="dn-brand">
          <div className="dn-brand-icon"><FileScan size={20}/></div>
          <div><div className="dn-eyebrow">DAM OPERATIONS</div><div className="dn-brand-title">Delivery Notes</div></div>
        </div>
        <div className="dn-top-actions">
          <button
            className="dn-theme-toggle"
            type="button"
            onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="dn-theme-thumb">
              {theme === "dark" ? <Moon size={15}/> : <Sun size={15}/>}
            </span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <div className="dn-branch-pill">{branch?.code || "BRANCH"} · {branch?.name || "Unknown"}</div>
        </div>
      </header>

      <main className="dn-shell">
        <section className="dn-hero">
          <div>
            <div className="dn-kicker"><ScanLine size={15}/> DOCUMENT OCR</div>
            <h1>Scan. Verify. Receive.</h1>
            <p>Capture the delivery note, review every detected value, then confirm the receiving details.</p>
          </div>
          {phase !== "idle" && <button className="dn-secondary-btn" onClick={resetAll}><RefreshCcw size={17}/> New Scan</button>}
        </section>

        <input ref={inputRef} className="dn-hidden-input" type="file" accept="image/*" capture="environment" onChange={handleFile}/>

        {(phase === "idle" || phase === "ready" || phase === "scanning") && (
          <section className="dn-card dn-scan-card">
            <div className="dn-card-head">
              <div><div className="dn-section-label">DOCUMENT CAPTURE</div><h2>Photograph the complete delivery note</h2></div>
              <span className="dn-status-chip">{phase === "scanning" ? "SCANNING" : preview ? "PHOTO READY" : "READY"}</span>
            </div>

            {!preview ? (
              <button className="dn-capture-zone" type="button" onClick={() => inputRef.current?.click()}>
                <span className="dn-capture-icon"><Camera size={30}/></span>
                <strong>Take delivery note photo</strong>
                <span>Keep the complete page visible, flat and well lit.</span>
              </button>
            ) : (
              <div className="dn-preview-layout">
                <div className="dn-preview"><img src={preview} alt="Delivery note preview"/></div>
                <div className="dn-preview-actions">
                  <div className="dn-ready-icon"><ImageIcon size={24}/></div>
                  <h3>Photo ready</h3>
                  <p>The document will be read directly on this device.</p>
                  <button className="dn-primary-btn" disabled={phase === "scanning"} onClick={scanNow}>
                    {phase === "scanning" ? <><Loader2 className="dn-spin" size={18}/> Reading…</> : <><ScanLine size={18}/> Scan Document</>}
                  </button>
                  <button className="dn-text-btn" disabled={phase === "scanning"} onClick={() => inputRef.current?.click()}>Choose another photo</button>
                </div>
              </div>
            )}

            {phase === "scanning" && (
              <div className="dn-progress">
                <div className="dn-progress-top"><span>{progress}</span><b>{progressPct}%</b></div>
                <div className="dn-progress-track"><motion.div className="dn-progress-bar" animate={{width:`${progressPct}%`}}/></div>
                <small>Keep this page open while the document is being read.</small>
              </div>
            )}
            {error && phase !== "review" && <div className="dn-alert"><TriangleAlert size={18}/>{error}</div>}
          </section>
        )}

        <AnimatePresence mode="wait">
          {(phase === "review" || phase === "submitting") && (
            <motion.section className="dn-review" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
              <div className="dn-summary-row">
                <div className="dn-stat"><span>ITEMS</span><b>{note.items.length}</b></div>
                <div className="dn-stat"><span>NEEDS REVIEW</span><b>{reviewCount}</b></div>
                <div className="dn-stat"><span>QTY MISMATCH</span><b>{mismatchCount}</b></div>
              </div>

              {error && <div className="dn-alert"><TriangleAlert size={18}/>{error}</div>}

              <section className="dn-card">
                <div className="dn-card-head"><div><div className="dn-section-label">DOCUMENT DETAILS</div><h2>Verify header information</h2></div></div>
                <div className="dn-fields">
                  <label><span>Delivery Note No.</span><input value={note.deliveryNoteNumber} onChange={e=>setHeader("deliveryNoteNumber",e.target.value)}/></label>
                  <label><span>Shipping Date</span><input value={note.shippingDate} onChange={e=>setHeader("shippingDate",e.target.value)}/></label>
                  <label><span>Source Location</span><input value={note.sourceLocation} onChange={e=>setHeader("sourceLocation",e.target.value)}/></label>
                  <label><span>Destination Location</span><input value={note.destinationLocation} onChange={e=>setHeader("destinationLocation",e.target.value)}/></label>
                </div>
              </section>

              <section className="dn-card">
                <div className="dn-card-head">
                  <div><div className="dn-section-label">RECEIVING ITEMS</div><h2>Verify every detected row</h2></div>
                  <button className="dn-secondary-btn" onClick={addItem}><Plus size={17}/> Add Item</button>
                </div>

                <div className="dn-table-wrap">
                  <table className="dn-table">
                    <thead><tr><th>SKU</th><th>Product</th><th>Ordered Qty</th><th>UOM</th><th>Size</th><th>Delivered Qty</th><th>UOM</th><th>Size</th><th></th></tr></thead>
                    <tbody>
                      {note.items.map((x) => (
                        <tr key={x.id} className={x.needsReview ? "dn-row-review" : ""}>
                          <td><input value={x.code} onChange={e=>setItem(x.id,"code",e.target.value.toUpperCase())}/></td>
                          <td className="dn-product"><input value={x.product} onChange={e=>setItem(x.id,"product",e.target.value)}/></td>
                          <td><input inputMode="decimal" value={x.orderedQty} onChange={e=>setItem(x.id,"orderedQty",e.target.value)}/></td>
                          <td><input value={x.orderedUom} onChange={e=>setItem(x.id,"orderedUom",e.target.value.toUpperCase())}/></td>
                          <td><input value={x.orderedSize} onChange={e=>setItem(x.id,"orderedSize",e.target.value.toUpperCase())}/></td>
                          <td><input inputMode="decimal" value={x.deliveredQty} onChange={e=>setItem(x.id,"deliveredQty",e.target.value)}/></td>
                          <td><input value={x.deliveredUom} onChange={e=>setItem(x.id,"deliveredUom",e.target.value.toUpperCase())}/></td>
                          <td><input value={x.deliveredSize} onChange={e=>setItem(x.id,"deliveredSize",e.target.value.toUpperCase())}/></td>
                          <td><button className="dn-delete" onClick={()=>removeItem(x.id)} title="Remove item"><Trash2 size={17}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="dn-review-note"><TriangleAlert size={16}/> Highlighted rows have incomplete values and must be checked.</p>
              </section>

              <section className="dn-card dn-confirm-card">
                <label className="dn-confirm">
                  <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
                  <span><b>I checked the delivery note against the photo.</b><small>All item names, SKU codes, quantities and units are correct.</small></span>
                </label>
                <button className="dn-primary-btn" disabled={!reviewValid || phase==="submitting"} onClick={submit}>
                  {phase==="submitting" ? <><Loader2 className="dn-spin" size={18}/> Saving…</> : <><Save size={18}/> Confirm Delivery Note</>}
                </button>
              </section>
            </motion.section>
          )}

          {phase === "success" && (
            <motion.section className="dn-card dn-success" initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}}>
              <div className="dn-success-icon"><CheckCircle2 size={42}/></div>
              <div className="dn-section-label">COMPLETED</div>
              <h2>Delivery note verified</h2>
              <p>Reference: <b>{successId}</b></p>
              <button className="dn-primary-btn" onClick={resetAll}><Camera size={18}/> Scan Another Note</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
