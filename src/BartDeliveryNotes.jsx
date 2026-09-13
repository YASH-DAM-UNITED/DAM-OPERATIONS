import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileScan,
  Image as ImageIcon,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import { createWorker } from "tesseract.js";

import "./BartDeliveryNotes.css";


/* ============================================================
   CONFIG
============================================================ */

/*
  LIVE OCR
  --------
  OCR runs directly in the staff browser using Tesseract.js.
  No paid OCR API is required for scanning. The image is not sent
  to our backend by this component.

  Submission storage is intentionally OFF until your backend route
  is ready. When ENABLE_BACKEND_SUBMIT is false, the verified payload
  is only logged locally and the UI shows a local success state.
*/
const ENABLE_BACKEND_SUBMIT = false;

const SUBMIT_ENDPOINT =
  "/api/staff/bart/delivery-note/submit";

const OCR_LANGUAGE = "eng";
const OCR_MAX_DIMENSION = 2200;


/* ============================================================
   HELPERS
============================================================ */

function sleep(ms) {
  return new Promise((resolve) =>
    window.setTimeout(resolve, ms)
  );
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `dn-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function stripArabic(value) {
  return String(value ?? "")
    // Arabic + Arabic presentation-form blocks. DAM notes can be bilingual,
    // but this scanner intentionally extracts the English side only.
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, " ");
}

function normaliseLine(value) {
  return stripArabic(value)
    .replace(/[|¦]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseOcrText(value) {
  return stripArabic(value)
    .replace(/\r/g, "")
    .replace(/[|¦]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    // Common OCR substitutions in units. Keep these conservative so product
    // names are not aggressively rewritten.
    .replace(/\bP[\s.]?C[\s.]?S\b/gi, "PCS")
    .replace(/\bP[\s.]?C\b/gi, "PC")
    .replace(/\bBott[Il1]e\b/gi, "Bottle")
    .replace(/\bGa[Il1]{2}on\b/gi, "Gallon")
    .replace(/\b([0-9]+(?:[.,][0-9]+)?)\s*m[I1]\b/gi, "$1 ml")
    .replace(/\b([0-9]+(?:[.,][0-9]+)?)\s*[Il1](?=\s|$)/gi, "$1 L")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toLocalDateTimeValue(raw) {
  const value = normaliseLine(raw);
  if (!value) return "";

  // MM/DD/YYYY HH:MM[:SS] — common on DAM delivery notes.
  const us = value.match(
    /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (us) {
    const [, mm, dd, yyyy, hh, min, sec = "00"] = us;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:${sec}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${parsed.getFullYear()}-${p(parsed.getMonth() + 1)}-${p(parsed.getDate())}T${p(parsed.getHours())}:${p(parsed.getMinutes())}:${p(parsed.getSeconds())}`;
  }

  return value;
}

function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normaliseLine(match[1]);
  }
  return "";
}

function normalizeNumber(value) {
  const cleaned = String(value ?? "")
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "")
    .replace(/\.{2,}/g, ".");

  if (!cleaned) return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return cleaned;
  return Number.isInteger(n) ? String(n) : String(n);
}

function normalizeUom(value) {
  let u = normaliseLine(value)
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!u) return "";

  // Repair very common OCR confusions before canonicalizing.
  u = u
    .replace(/Bott[Il1]e/gi, "Bottle")
    .replace(/Ga[Il1]{2}on/gi, "Gallon")
    .replace(/\bm[I1]\b/gi, "ML")
    .replace(/\bLtr\b/gi, "LTR");

  const size = u.match(/(\d+(?:[.,]\d+)?)\s*(ML|L|LTR|LITER|LITRE)\b/i);
  const sizeText = size
    ? `${normalizeNumber(size[1])} ${/^m/i.test(size[2]) ? "ML" : "L"}`
    : "";

  if (/\b(?:PCS?|PIECES?)\b/i.test(u)) return "PCS";
  if (/\bBOTTLE\b/i.test(u)) return sizeText ? `BOTTLE ${sizeText}` : "BOTTLE";
  if (/\bGALLON\b/i.test(u)) return sizeText ? `GALLON ${sizeText}` : "GALLON";
  if (/\b(?:GRAM|GRAMS|GM|GMS)\b/i.test(u)) return "GRAM";
  if (/\b(?:KG|KGS|KILOGRAM|KILOGRAMS)\b/i.test(u)) return "KG";
  if (/\b(?:ML|MILLILITER|MILLILITRE)\b/i.test(u)) return "ML";
  if (/\b(?:LTR|LITER|LITRE|LITERS|LITRES)\b/i.test(u)) return "L";
  if (/\bBOX(?:ES)?\b/i.test(u)) return "BOX";
  if (/\bPACK(?:S)?\b/i.test(u)) return "PACK";
  if (/\bBAG(?:S)?\b/i.test(u)) return "BAG";
  if (/\bCAN(?:S)?\b/i.test(u)) return "CAN";
  if (/\bJAR(?:S)?\b/i.test(u)) return "JAR";

  return u.toUpperCase();
}

const UOM_WORD = String.raw`(?:P[\s.]?C[\s.]?S?|PIECES?|BOTT(?:LE|IE)|GALLON|GRAMS?|GMS?|GM|KGS?|KG|M[LI1]|ML|LTR|LITER|LITRE|BOX(?:ES)?|PACKS?|BAGS?|CANS?|JARS?)`;
const UOM_SIZE = String.raw`(?:\s+\d+(?:[.,]\d+)?\s*(?:ML|M[LI1]|L|LTR|LITER|LITRE))?`;

function parseQtyUomPairs(value) {
  const pairs = [];
  const regex = new RegExp(
    String.raw`(?:^|\s)(\d+(?:[.,]\d+)?)\s*(${UOM_WORD}${UOM_SIZE})\b`,
    "gi"
  );

  let match;
  while ((match = regex.exec(value)) !== null) {
    const rawUom = normaliseLine(match[2]);
    pairs.push({
      qty: normalizeNumber(match[1]),
      uom: normalizeUom(rawUom),
      index: match.index + (match[0].length - match[0].trimStart().length),
      end: regex.lastIndex,
    });
  }
  return pairs;
}

function repairProductName(value) {
  return normaliseLine(value)
    .replace(/^[-:–—]+\s*/, "")
    .replace(/\b(?:PRODUCT|ORDERED|DELIVERED)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemBlock(block) {
  const line = normaliseLine(block);
  const codeMatch = line.match(/(?:\[\s*)?\b([A-Z]{1,3})\s*[- ]?\s*(\d{3,4})\b(?:\s*\])?/i);
  if (!codeMatch) return null;

  const code = `${codeMatch[1]}${codeMatch[2]}`.toUpperCase();
  const afterCode = normaliseLine(
    line.slice((codeMatch.index || 0) + codeMatch[0].length)
  );
  const pairs = parseQtyUomPairs(afterCode);

  if (!pairs.length) {
    return {
      code,
      product: repairProductName(afterCode),
      orderedQty: "",
      orderedUom: "",
      deliveredQty: "",
      deliveredUom: "",
    };
  }

  // DAM notes place ORDERED and DELIVERED at the right side of each product
  // row. Product names may contain sizes such as "600ml", so always take the
  // LAST two quantity/UOM pairs rather than the first two numeric-looking parts.
  const chosen = pairs.slice(-2);
  const firstPair = chosen[0];
  const product = repairProductName(afterCode.slice(0, firstPair.index));

  if (chosen.length === 1) {
    return {
      code,
      product,
      orderedQty: chosen[0].qty,
      orderedUom: chosen[0].uom,
      deliveredQty: chosen[0].qty,
      deliveredUom: chosen[0].uom,
    };
  }

  return {
    code,
    product,
    orderedQty: chosen[0].qty,
    orderedUom: chosen[0].uom,
    deliveredQty: chosen[1].qty,
    deliveredUom: chosen[1].uom,
  };
}

function buildItemBlocks(text) {
  // Work on a flattened English-only stream. This survives Tesseract wrapping a
  // single product row over 2-3 lines and survives Arabic text between columns.
  const flat = normaliseLine(text.replace(/\n/g, " "));
  const codeRegex = /(?:\[\s*)?\b[A-Z]{1,3}\s*[- ]?\s*\d{3,4}\b(?:\s*\])?/gi;
  const matches = [...flat.matchAll(codeRegex)];
  const blocks = [];

  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0;
    const next = matches[i + 1]?.index ?? flat.length;
    let block = flat.slice(start, next).trim();

    block = block.split(/\b(?:TOTAL|SIGNATURE|RECEIVED BY|PREPARED BY|EMAIL|PAGE\s+\d+)\b/i)[0].trim();
    if (block) blocks.push(block);
  }

  return blocks;
}

function dedupeItems(items) {
  const map = new Map();

  for (const item of items) {
    if (!item?.code) continue;
    const key = item.code.toUpperCase();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    // Prefer whichever duplicate has more complete OCR information.
    const score = (x) => [x.product, x.orderedQty, x.orderedUom, x.deliveredQty, x.deliveredUom]
      .filter(Boolean).length;
    if (score(item) > score(existing)) map.set(key, item);
  }

  return [...map.values()];
}

function parseDeliveryNoteText(rawText) {
  const text = normaliseOcrText(rawText);
  const lines = text
    .split("\n")
    .map(normaliseLine)
    .filter(Boolean);

  const flattened = lines.join("\n");

  const deliveryNoteNumber = extractField(flattened, [
    /Delivery\s*Note(?:\s*(?:No\.?|Number|#))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{4,})/i,
    /(?:DN|D\.?N\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{4,})/i,
  ]);

  const shippingDateRaw = extractField(flattened, [
    /Shipping\s*Date\s*[:#-]?\s*([^\n]+)/i,
    /Date\s*[:#-]?\s*((?:\d{1,2}[\/.-]){2}\d{4}[^\n]*)/i,
  ]);

  const sourceLocation = extractField(flattened, [
    /Source\s*Location\s*[:#-]?\s*([^\n]+)/i,
    /Source\s*[:#-]?\s*([^\n]+)/i,
  ]);

  const destinationLocation = extractField(flattened, [
    /Destination\s*Location\s*[:#-]?\s*([^\n]+)/i,
    /Destination\s*[:#-]?\s*([^\n]+)/i,
  ]);

  const itemBlocks = buildItemBlocks(text);
  const items = dedupeItems(
    itemBlocks
      .map(parseItemBlock)
      .filter((item) => item && item.code && item.product)
  );

  return {
    deliveryNoteNumber,
    shippingDate: toLocalDateTimeValue(shippingDateRaw),
    sourceLocation,
    destinationLocation,
    supplier: /\bDAM\b/i.test(flattened) ? "DAM" : "",
    items,
  };
}

async function preprocessImage(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Unable to read the captured image."));
    });

    const largest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largest > OCR_MAX_DIMENSION ? OCR_MAX_DIMENSION / largest : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image processing is not supported on this device.");

    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    const data = pixels.data;

    // Grayscale + gentle contrast boost. This usually helps printed delivery notes.
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
      data[i] = contrast;
      data[i + 1] = contrast;
      data[i + 2] = contrast;
    }

    ctx.putImageData(pixels, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Unable to prepare the image for OCR."))),
        "image/jpeg",
        0.92
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normaliseItem(item = {}) {
  return {
    id: item.id || createId(),
    code: cleanText(item.code),
    product: cleanText(item.product),
    orderedQty: cleanText(item.orderedQty),
    orderedUom: cleanText(item.orderedUom),
    deliveredQty: cleanText(item.deliveredQty),
    deliveredUom: cleanText(item.deliveredUom),
  };
}

function normaliseResult(data = {}) {
  return {
    deliveryNoteNumber: cleanText(
      data.deliveryNoteNumber
    ),
    shippingDate: cleanText(data.shippingDate),
    sourceLocation: cleanText(
      data.sourceLocation
    ),
    destinationLocation: cleanText(
      data.destinationLocation
    ),
    supplier: cleanText(data.supplier || "DAM"),
    items: Array.isArray(data.items)
      ? data.items.map(normaliseItem)
      : [],
  };
}

function isMismatch(item) {
  const a = cleanText(item.orderedQty)
    .replace(/,/g, "");
  const b = cleanText(item.deliveredQty)
    .replace(/,/g, "");

  if (!a || !b) {
    return false;
  }

  const ordered = Number(a);
  const delivered = Number(b);

  if (
    Number.isFinite(ordered) &&
    Number.isFinite(delivered)
  ) {
    return ordered !== delivered;
  }

  return a !== b;
}

function displayDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/* ============================================================
   SMALL COMPONENTS
============================================================ */

function Step({
  number,
  label,
  active,
  complete,
}) {
  return (
    <div
      className={`dn-step ${
        active ? "is-active" : ""
      } ${complete ? "is-complete" : ""}`}
    >
      <div className="dn-step-dot">
        {complete ? (
          <Check size={14} />
        ) : (
          number
        )}
      </div>

      <span>{label}</span>
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <label className="dn-field">
      <span>{label}</span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}


function EmptyState() {
  return (
    <div className="dn-empty-state">
      <div className="dn-empty-icon">
        <ScanLine size={26} />
      </div>

      <strong>No delivery note scanned yet</strong>

      <p>
        Use the camera or select a clear image of
        the complete delivery note.
      </p>
    </div>
  );
}


/* ============================================================
   MAIN PAGE
============================================================ */

export default function BartDeliveryNotes({
  branch,
  onBack,
}) {
  const fileInputRef = useRef(null);

  const [step, setStep] =
    useState("capture");

  const [file, setFile] =
    useState(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [scanError, setScanError] =
    useState("");

  const [submitError, setSubmitError] =
    useState("");

  const [form, setForm] =
    useState(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [submissionId, setSubmissionId] =
    useState("");

  const [confirmed, setConfirmed] =
    useState(false);

  const [ocrProgress, setOcrProgress] =
    useState(0);

  const [ocrStatus, setOcrStatus] =
    useState("Ready");

  const [rawOcrText, setRawOcrText] =
    useState("");


  /* ==========================================================
     IMAGE MEMORY CLEANUP
  ========================================================== */

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);


  /* ==========================================================
     DERIVED VALUES
  ========================================================== */

  const mismatchCount =
    useMemo(() => {
      if (!form?.items) {
        return 0;
      }

      return form.items.filter(
        isMismatch
      ).length;
    }, [form]);

  const completeItemCount =
    useMemo(() => {
      if (!form?.items) {
        return 0;
      }

      return form.items.filter(
        (item) =>
          cleanText(item.code) &&
          cleanText(item.product) &&
          cleanText(item.deliveredQty)
      ).length;
    }, [form]);

  const reviewValid =
    Boolean(
      cleanText(
        form?.deliveryNoteNumber
      ) &&
        cleanText(form?.shippingDate) &&
        form?.items?.length > 0 &&
        completeItemCount ===
          form?.items?.length &&
        confirmed
    );


  /* ==========================================================
     IMAGE SELECT / CAMERA
  ========================================================== */

  function handleImage(event) {
    const selected =
      event.target.files?.[0];

    if (!selected) {
      return;
    }

    if (
      !selected.type.startsWith(
        "image/"
      )
    ) {
      setScanError(
        "Please select an image file."
      );

      return;
    }

    const maxBytes =
      12 * 1024 * 1024;

    if (selected.size > maxBytes) {
      setScanError(
        "Image is too large. Maximum size is 12 MB."
      );

      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(
        previewUrl
      );
    }

    const objectUrl =
      URL.createObjectURL(
        selected
      );

    setFile(selected);
    setPreviewUrl(objectUrl);
    setForm(null);
    setConfirmed(false);
    setRawOcrText("");
    setOcrProgress(0);
    setOcrStatus("Ready");
    setScanError("");
    setSubmitError("");
    setStep("preview");
  }


  function retake() {
    setFile(null);
    setForm(null);
    setConfirmed(false);
    setScanError("");
    setSubmitError("");
    setStep("capture");

    if (previewUrl) {
      URL.revokeObjectURL(
        previewUrl
      );

      setPreviewUrl("");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }


  /* ==========================================================
     OCR SCAN
  ========================================================== */

  async function scanDocument() {
    if (!file) {
      setScanError(
        "Capture or select a delivery note first."
      );
      return;
    }

    setStep("scanning");
    setScanError("");
    setSubmitError("");
    setConfirmed(false);
    setOcrProgress(0);
    setOcrStatus("Preparing image");
    setRawOcrText("");

    let worker;

    try {
      const preparedImage = await preprocessImage(file);

      setOcrStatus("Loading OCR engine");

      worker = await createWorker(OCR_LANGUAGE, 1, {
        logger: (message) => {
          if (typeof message?.progress === "number") {
            setOcrProgress(Math.max(0, Math.min(100, Math.round(message.progress * 100))));
          }

          if (message?.status) {
            setOcrStatus(message.status);
          }
        },
      });

      // DAM delivery notes are dense printed tables. Preserve spaces so the
      // quantity/UOM columns are easier to reconstruct, and use automatic page
      // segmentation for the full paper. OCR language stays English-only, so
      // Arabic print is intentionally ignored.
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "3",
      });

      setOcrStatus("Reading delivery note");

      const result = await worker.recognize(preparedImage);
      const rawText = result?.data?.text || "";
      setRawOcrText(rawText);
      setOcrProgress(100);
      setOcrStatus("Parsing fields");

      if (!rawText.trim()) {
        throw new Error(
          "No readable text was detected. Retake the photo with the full paper visible and better lighting."
        );
      }

      const parsed = parseDeliveryNoteText(rawText);
      const normalized = normaliseResult(parsed);

      // We allow review even if some fields are missed so staff can correct them manually.
      setForm(normalized);
      setStep("review");
    } catch (error) {
      console.error("DELIVERY NOTE OCR ERROR", error);
      setScanError(
        error?.message ||
          "Unable to read this image. Please retake the delivery note clearly."
      );
      setStep("preview");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // Nothing else to do.
        }
      }
    }
  }


  /* ==========================================================
     FORM EDITING
  ========================================================== */

  function updateField(
    key,
    value
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setConfirmed(false);
  }


  function updateItem(
    id,
    key,
    value
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                [key]: value,
              }
            : item
      ),
    }));

    setConfirmed(false);
  }


  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        normaliseItem({
          code: "",
          product: "",
          orderedQty: "",
          orderedUom: "",
          deliveredQty: "",
          deliveredUom: "",
        }),
      ],
    }));

    setConfirmed(false);
  }


  function removeItem(id) {
    setForm((current) => ({
      ...current,
      items: current.items.filter(
        (item) =>
          item.id !== id
      ),
    }));

    setConfirmed(false);
  }


  /* ==========================================================
     FINAL SUBMISSION
  ========================================================== */

  async function submitDeliveryNote() {
    if (!reviewValid) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      /*
        IMPORTANT:
        We do NOT include the image here.
        Only the staff-confirmed text/data is submitted.
      */
      const payload = {
        branchCode:
          branch?.code || "",
        branchName:
          branch?.name || "",
        deliveryNoteNumber:
          cleanText(
            form.deliveryNoteNumber
          ),
        shippingDate:
          cleanText(
            form.shippingDate
          ),
        sourceLocation:
          cleanText(
            form.sourceLocation
          ),
        destinationLocation:
          cleanText(
            form.destinationLocation
          ),
        supplier:
          cleanText(form.supplier),
        items: form.items.map(
          (item) => ({
            code: cleanText(
              item.code
            ),
            product: cleanText(
              item.product
            ),
            orderedQty:
              cleanText(
                item.orderedQty
              ),
            orderedUom:
              cleanText(
                item.orderedUom
              ),
            deliveredQty:
              cleanText(
                item.deliveredQty
              ),
            deliveredUom:
              cleanText(
                item.deliveredUom
              ),
          })
        ),
        mismatchCount,
        submittedAt:
          new Date().toISOString(),
      };

      let result;

      if (!ENABLE_BACKEND_SUBMIT) {
        await sleep(900);

        console.log(
          "DELIVERY NOTE VERIFIED PAYLOAD",
          payload
        );

        result = {
          success: true,
          submissionId:
            `DN-${Date.now()
              .toString()
              .slice(-8)}`,
        };
      } else {
        const response =
          await fetch(
            SUBMIT_ENDPOINT,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                payload
              ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to submit delivery note."
          );
        }

        result = data;
      }

      setSubmissionId(
        result.submissionId ||
          result.id ||
          "SUBMITTED"
      );

      /*
        Image no longer needed after successful submission.
      */
      setFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );

        setPreviewUrl("");
      }

      setStep("success");
    } catch (error) {
      setSubmitError(
        error?.message ||
          "Unable to submit delivery note."
      );
    } finally {
      setSubmitting(false);
    }
  }


  /* ==========================================================
     RESET
  ========================================================== */

  function newDeliveryNote() {
    setFile(null);
    setPreviewUrl("");
    setForm(null);
    setConfirmed(false);
    setSubmissionId("");
    setScanError("");
    setSubmitError("");
    setStep("capture");

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="dn-page">
      <div className="dn-grid-bg" />
      <div className="dn-orb dn-orb-one" />
      <div className="dn-orb dn-orb-two" />

      <input
        ref={fileInputRef}
        className="dn-hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImage}
      />

      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="dn-topbar">
        <div className="dn-brand">
          <div className="dn-brand-icon">
            <FileScan size={20} />
          </div>

          <div>
            <strong>
              DELIVERY NOTES
            </strong>

            <span>
              BART STAFF OPERATIONS
            </span>
          </div>
        </div>

        <div className="dn-top-actions">
          <div className="dn-secure-badge">
            <ShieldCheck size={14} />
            TEXT-ONLY STORAGE
          </div>

          <button
            type="button"
            className="dn-close-button"
            onClick={onBack}
            title="Back to dashboard"
          >
            <X size={18} />
          </button>
        </div>
      </header>


      <main className="dn-main">

        {/* ====================================================
            BACK / HERO
        ==================================================== */}

        <motion.button
          type="button"
          className="dn-back-button"
          onClick={onBack}
          initial={{
            opacity: 0,
            x: -10,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
        >
          <ArrowLeft size={15} />
          BACK TO STAFF DASHBOARD
        </motion.button>


        <section className="dn-hero">
          <motion.div
            className="dn-hero-copy"
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="dn-eyebrow">
              <Sparkles size={13} />
              SMART DOCUMENT CAPTURE
            </div>

            <h1>
              Scan. Verify.
              <span> Submit.</span>
            </h1>

            <p>
              Capture a delivery note,
              review every detected value,
              and submit only the
              staff-confirmed data.
            </p>
          </motion.div>


          <motion.div
            className="dn-branch-card"
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
          >
            <span>
              RECEIVING BRANCH
            </span>

            <strong>
              {branch?.name ||
                "BART Branch"}
            </strong>

            <div>
              <small>
                {branch?.code ||
                  "B000"}
              </small>

              <small className="dn-live">
                <i />
                ACTIVE
              </small>
            </div>
          </motion.div>
        </section>


        {/* ====================================================
            STEPS
        ==================================================== */}

        <section className="dn-stepper">
          <Step
            number="1"
            label="CAPTURE"
            active={
              step === "capture" ||
              step === "preview"
            }
            complete={[
              "scanning",
              "review",
              "success",
            ].includes(step)}
          />

          <div className="dn-step-line" />

          <Step
            number="2"
            label="SCAN"
            active={
              step === "scanning"
            }
            complete={[
              "review",
              "success",
            ].includes(step)}
          />

          <div className="dn-step-line" />

          <Step
            number="3"
            label="VERIFY"
            active={
              step === "review"
            }
            complete={
              step === "success"
            }
          />

          <div className="dn-step-line" />

          <Step
            number="4"
            label="SUBMIT"
            active={
              step === "success"
            }
            complete={
              step === "success"
            }
          />
        </section>


        {/* ====================================================
            DEMO BADGE
        ==================================================== */}

        <div className="dn-demo-banner">
          <Sparkles size={15} />

          <span>
            LIVE OCR — this photo is read on the staff device using Tesseract.js.
            No sample delivery-note data is used.
            {!ENABLE_BACKEND_SUBMIT && " Verified submission storage is still local until the backend submit route is connected."}
          </span>
        </div>


        {/* ====================================================
            ERROR
        ==================================================== */}

        <AnimatePresence>
          {(scanError ||
            submitError) && (
            <motion.div
              className="dn-error-banner"
              initial={{
                opacity: 0,
                y: -8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
              }}
            >
              <XCircle size={17} />

              <span>
                {scanError ||
                  submitError}
              </span>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ====================================================
            CAPTURE
        ==================================================== */}

        {step === "capture" && (
          <motion.section
            className="dn-capture-layout"
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div
              className="dn-capture-card"
              onClick={() =>
                fileInputRef.current?.click()
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key === " "
                ) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <div className="dn-scan-frame">
                <span className="c1" />
                <span className="c2" />
                <span className="c3" />
                <span className="c4" />

                <div className="dn-camera-circle">
                  <Camera size={34} />
                </div>

                <strong>
                  Capture Delivery Note
                </strong>

                <p>
                  Keep the complete
                  document inside the
                  frame and make sure the
                  text is readable.
                </p>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Camera size={17} />
                  OPEN CAMERA
                </button>
              </div>
            </div>


            <aside className="dn-guide-card">
              <div className="dn-guide-head">
                <div>
                  <ScanLine size={21} />
                </div>

                <span>
                  SCAN QUALITY
                </span>
              </div>

              <h3>
                Get a clean scan
              </h3>

              <div className="dn-guide-list">
                <div>
                  <CheckCircle2
                    size={16}
                  />

                  <span>
                    Capture the complete
                    page
                  </span>
                </div>

                <div>
                  <CheckCircle2
                    size={16}
                  />

                  <span>
                    Use good lighting
                  </span>
                </div>

                <div>
                  <CheckCircle2
                    size={16}
                  />

                  <span>
                    Avoid blur and heavy
                    shadows
                  </span>
                </div>

                <div>
                  <CheckCircle2
                    size={16}
                  />

                  <span>
                    Keep product table
                    straight
                  </span>
                </div>
              </div>

              <div className="dn-privacy-note">
                <ShieldCheck
                  size={17}
                />

                <p>
                  <strong>
                    Privacy
                  </strong>

                  The final submission
                  contains text/data only.
                  The captured image is
                  not included in the
                  submission payload.
                </p>
              </div>
            </aside>
          </motion.section>
        )}


        {/* ====================================================
            PREVIEW
        ==================================================== */}

        {step === "preview" && (
          <motion.section
            className="dn-preview-layout"
            initial={{
              opacity: 0,
              y: 24,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <div className="dn-photo-card">
              <div className="dn-card-head">
                <div>
                  <span>
                    DOCUMENT PREVIEW
                  </span>

                  <h2>
                    Ready to scan
                  </h2>
                </div>

                <div className="dn-file-pill">
                  <ImageIcon size={14} />
                  {file?.name ||
                    "Captured image"}
                </div>
              </div>

              <div className="dn-image-stage">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Delivery note preview"
                  />
                ) : (
                  <EmptyState />
                )}

                <div className="dn-scan-line" />
              </div>
            </div>


            <aside className="dn-action-card">
              <div className="dn-action-icon">
                <FileScan size={24} />
              </div>

              <span>
                NEXT STEP
              </span>

              <h2>
                Read this delivery note
              </h2>

              <p>
                The scanner will detect
                the note number, date,
                locations, item codes,
                product names and
                delivered quantities.
              </p>

              <button
                type="button"
                className="dn-primary-btn"
                onClick={
                  scanDocument
                }
              >
                <ScanLine size={18} />
                SCAN DOCUMENT
                <ChevronRight
                  size={17}
                />
              </button>

              <button
                type="button"
                className="dn-secondary-btn"
                onClick={retake}
              >
                <RefreshCcw
                  size={16}
                />
                RETAKE / CHANGE PHOTO
              </button>
            </aside>
          </motion.section>
        )}


        {/* ====================================================
            SCANNING
        ==================================================== */}

        {step === "scanning" && (
          <motion.section
            className="dn-scanning-card"
            initial={{
              opacity: 0,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
          >
            <div className="dn-scanner-visual">
              <FileScan size={52} />

              <motion.div
                className="dn-scanner-beam"
                animate={{
                  y: [
                    -66,
                    66,
                    -66,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            <div className="dn-scanning-copy">
              <span>
                DOCUMENT INTELLIGENCE
              </span>

              <h2>
                Reading delivery note...
              </h2>

              <p>
                {ocrStatus || "Reading document"} · {ocrProgress}%
                <br />
                Detecting header details, product codes and delivered quantities.
              </p>

              <div className="dn-loading-line">
                <motion.i
                  animate={{
                    x: [
                      "-100%",
                      "340%",
                    ],
                  }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          </motion.section>
        )}


        {/* ====================================================
            REVIEW
        ==================================================== */}

        {step === "review" &&
          form && (
            <motion.section
              className="dn-review-wrap"
              initial={{
                opacity: 0,
                y: 25,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <div className="dn-review-heading">
                <div>
                  <div className="dn-eyebrow">
                    <ClipboardCheck
                      size={13}
                    />
                    STAFF VERIFICATION
                  </div>

                  <h2>
                    Cross-check before
                    submission
                  </h2>

                  <p>
                    Every field below is
                    editable. Compare it
                    with the physical
                    delivery note.
                  </p>
                </div>

                <div className="dn-review-stats">
                  <div>
                    <small>
                      ITEMS
                    </small>

                    <strong>
                      {
                        form.items
                          .length
                      }
                    </strong>
                  </div>

                  <div
                    className={
                      mismatchCount
                        ? "warn"
                        : ""
                    }
                  >
                    <small>
                      QTY DIFFERENCE
                    </small>

                    <strong>
                      {
                        mismatchCount
                      }
                    </strong>
                  </div>
                </div>
              </div>


              <div className="dn-meta-card">
                <div className="dn-card-head">
                  <div>
                    <span>
                      DOCUMENT DETAILS
                    </span>

                    <h3>
                      Detected header
                    </h3>
                  </div>

                  <Pencil size={17} />
                </div>

                <div className="dn-fields-grid">
                  <Field
                    label="Delivery Note No."
                    value={
                      form.deliveryNoteNumber
                    }
                    onChange={(value) =>
                      updateField(
                        "deliveryNoteNumber",
                        value
                      )
                    }
                    placeholder="Example: CKWH/INT/46389"
                  />

                  <Field
                    label="Shipping Date"
                    type="datetime-local"
                    value={
                      form.shippingDate
                        ? String(
                            form.shippingDate
                          ).slice(
                            0,
                            16
                          )
                        : ""
                    }
                    onChange={(value) =>
                      updateField(
                        "shippingDate",
                        value
                      )
                    }
                  />

                  <Field
                    label="Supplier"
                    value={
                      form.supplier
                    }
                    onChange={(value) =>
                      updateField(
                        "supplier",
                        value
                      )
                    }
                    placeholder="Supplier"
                  />

                  <Field
                    label="Source Location"
                    value={
                      form.sourceLocation
                    }
                    onChange={(value) =>
                      updateField(
                        "sourceLocation",
                        value
                      )
                    }
                    placeholder="Source"
                  />

                  <Field
                    label="Destination Location"
                    value={
                      form.destinationLocation
                    }
                    onChange={(value) =>
                      updateField(
                        "destinationLocation",
                        value
                      )
                    }
                    placeholder="Destination"
                  />

                  <div className="dn-field dn-readonly-field">
                    <span>
                      Receiving Branch
                    </span>

                    <div>
                      {branch?.code ||
                        "B000"}{" "}
                      —{" "}
                      {branch?.name ||
                        "BART Branch"}
                    </div>
                  </div>
                </div>
              </div>


              <div className="dn-items-card">
                <div className="dn-card-head dn-items-head">
                  <div>
                    <span>
                      DETECTED PRODUCTS
                    </span>

                    <h3>
                      Delivered items
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="dn-add-item"
                    onClick={addItem}
                  >
                    <Plus size={15} />
                    ADD ITEM
                  </button>
                </div>


                <div className="dn-desktop-table-wrap">
                  <table className="dn-items-table">
                    <thead>
                      <tr>
                        <th>
                          CODE
                        </th>

                        <th>
                          PRODUCT
                        </th>

                        <th>
                          ORDERED
                        </th>

                        <th>
                          DELIVERED
                        </th>

                        <th>
                          UOM
                        </th>

                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {form.items.map(
                        (item) => {
                          const mismatch =
                            isMismatch(
                              item
                            );

                          return (
                            <tr
                              key={
                                item.id
                              }
                              className={
                                mismatch
                                  ? "has-mismatch"
                                  : ""
                              }
                            >
                              <td>
                                <input
                                  value={
                                    item.code
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      item.id,
                                      "code",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td className="dn-product-cell">
                                <input
                                  value={
                                    item.product
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      item.id,
                                      "product",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  value={
                                    item.orderedQty
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      item.id,
                                      "orderedQty",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  inputMode="decimal"
                                />
                              </td>

                              <td>
                                <div className="dn-delivered-cell">
                                  <input
                                    value={
                                      item.deliveredQty
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateItem(
                                        item.id,
                                        "deliveredQty",
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    inputMode="decimal"
                                  />

                                  {mismatch && (
                                    <AlertTriangle
                                      size={
                                        14
                                      }
                                    />
                                  )}
                                </div>
                              </td>

                              <td>
                                <input
                                  value={
                                    item.deliveredUom
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      item.id,
                                      "deliveredUom",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="dn-row-delete"
                                  onClick={() =>
                                    removeItem(
                                      item.id
                                    )
                                  }
                                  title="Remove item"
                                >
                                  <Trash2
                                    size={
                                      15
                                    }
                                  />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>


                <div className="dn-mobile-items">
                  {form.items.map(
                    (item, index) => {
                      const mismatch =
                        isMismatch(
                          item
                        );

                      return (
                        <article
                          key={
                            item.id
                          }
                          className={`dn-mobile-item ${
                            mismatch
                              ? "has-mismatch"
                              : ""
                          }`}
                        >
                          <div className="dn-mobile-item-head">
                            <span>
                              ITEM{" "}
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item.id
                                )
                              }
                            >
                              <Trash2
                                size={
                                  15
                                }
                              />
                            </button>
                          </div>

                          <Field
                            label="Code"
                            value={
                              item.code
                            }
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.id,
                                "code",
                                value
                              )
                            }
                          />

                          <Field
                            label="Product"
                            value={
                              item.product
                            }
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.id,
                                "product",
                                value
                              )
                            }
                          />

                          <div className="dn-mobile-two">
                            <Field
                              label="Ordered"
                              value={
                                item.orderedQty
                              }
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  item.id,
                                  "orderedQty",
                                  value
                                )
                              }
                            />

                            <Field
                              label="Delivered"
                              value={
                                item.deliveredQty
                              }
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  item.id,
                                  "deliveredQty",
                                  value
                                )
                              }
                            />
                          </div>

                          <Field
                            label="Delivered UOM"
                            value={
                              item.deliveredUom
                            }
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.id,
                                "deliveredUom",
                                value
                              )
                            }
                          />

                          {mismatch && (
                            <div className="dn-mobile-warning">
                              <AlertTriangle
                                size={
                                  14
                                }
                              />

                              Ordered and
                              delivered
                              quantity are
                              different.
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              </div>


              {mismatchCount >
                0 && (
                <div className="dn-warning-banner">
                  <AlertTriangle
                    size={18}
                  />

                  <div>
                    <strong>
                      Quantity difference
                      detected
                    </strong>

                    <span>
                      {
                        mismatchCount
                      }{" "}
                      item
                      {mismatchCount >
                      1
                        ? "s"
                        : ""}{" "}
                      have different
                      ordered and
                      delivered
                      quantities.
                      Cross-check them
                      before confirming.
                    </span>
                  </div>
                </div>
              )}


              <div className="dn-confirm-card">
                <label className="dn-confirm-check">
                  <input
                    type="checkbox"
                    checked={
                      confirmed
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmed(
                        event
                          .target
                          .checked
                      )
                    }
                  />

                  <span className="dn-custom-checkbox">
                    <Check size={14} />
                  </span>

                  <span>
                    <strong>
                      I cross-checked
                      this information
                      with the physical
                      delivery note.
                    </strong>

                    <small>
                      I confirm the
                      delivery note
                      number, items and
                      delivered
                      quantities are
                      correct.
                    </small>
                  </span>
                </label>


                <div className="dn-review-actions">
                  <button
                    type="button"
                    className="dn-secondary-btn"
                    onClick={retake}
                    disabled={
                      submitting
                    }
                  >
                    <Camera size={16} />
                    RETAKE PHOTO
                  </button>

                  <button
                    type="button"
                    className="dn-submit-btn"
                    disabled={
                      !reviewValid ||
                      submitting
                    }
                    onClick={
                      submitDeliveryNote
                    }
                  >
                    {submitting ? (
                      <LoaderCircle
                        size={18}
                        className="dn-spin"
                      />
                    ) : (
                      <PackageCheck
                        size={18}
                      />
                    )}

                    {submitting
                      ? "SUBMITTING..."
                      : "CONFIRM & SUBMIT"}

                    {!submitting && (
                      <ChevronRight
                        size={17}
                      />
                    )}
                  </button>
                </div>
              </div>
            </motion.section>
          )}


        {/* ====================================================
            SUCCESS
        ==================================================== */}

        {step === "success" && (
          <motion.section
            className="dn-success-card"
            initial={{
              opacity: 0,
              scale: 0.96,
              y: 18,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >
            <motion.div
              className="dn-success-icon"
              initial={{
                scale: 0.5,
              }}
              animate={{
                scale: 1,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 18,
              }}
            >
              <CheckCircle2
                size={40}
              />
            </motion.div>

            <span>
              DELIVERY NOTE RECORDED
            </span>

            <h2>
              Submission complete
            </h2>

            <p>
              The verified delivery-note
              data has been prepared for
              storage. The captured photo
              is no longer retained by
              this page.
            </p>

            <div className="dn-success-meta">
              <div>
                <small>
                  DELIVERY NOTE
                </small>

                <strong>
                  {form?.deliveryNoteNumber ||
                    "—"}
                </strong>
              </div>

              <div>
                <small>
                  SUBMISSION ID
                </small>

                <strong>
                  {submissionId}
                </strong>
              </div>

              <div>
                <small>
                  ITEMS
                </small>

                <strong>
                  {form?.items
                    ?.length || 0}
                </strong>
              </div>

              <div>
                <small>
                  SHIPPING DATE
                </small>

                <strong>
                  {displayDate(
                    form?.shippingDate
                  )}
                </strong>
              </div>
            </div>

            <div className="dn-success-actions">
              <button
                type="button"
                className="dn-primary-btn"
                onClick={
                  newDeliveryNote
                }
              >
                <Plus size={17} />
                SCAN ANOTHER NOTE
              </button>

              <button
                type="button"
                className="dn-secondary-btn"
                onClick={onBack}
              >
                <ArrowLeft size={16} />
                BACK TO DASHBOARD
              </button>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}
