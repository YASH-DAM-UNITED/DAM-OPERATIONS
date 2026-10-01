import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, FileDown, FileImage,
  LoaderCircle, Plus, RefreshCcw, ScanLine, Send, ShieldCheck, Trash2, Upload,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { jsPDF } from "jspdf";
import "./DNVisionScanner.css";

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const UOMS = ["PCS","PC","PIECE","PIECES","BOTTLE","BOTTLES","BTL","BOX","BOXES","PACK","PACKS","PKT","KG","G","GM","ML","L","LTR","CAN","CANS","BAG","BAGS","CTN","CARTON","CARTONS"];
const NAME_ACCEPT = 0.84;
const NAME_STRONG = 0.92;
const AMBIGUITY_GAP = 0.035;
const ROW_MIN_HEIGHT = 24;
const ROW_MAX_HEIGHT = 260;

function cleanText(v) {
  return String(v ?? "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(ARABIC, " ").replace(/[^a-zA-Z0-9.&()/'\- ]+/g, " ").replace(/\s+/g, " ").trim();
}
function norm(v) { return cleanText(v).toUpperCase(); }
function normSku(v) { return norm(v).replace(/\s+/g, "").replace(/[^A-Z0-9()\-]/g, ""); }
function clamp(n, a = 0, b = 100) { return Math.max(a, Math.min(b, n)); }
function levenshtein(a, b) {
  a = norm(a); b = norm(b);
  if (!a) return b.length; if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}
function similarity(a, b) {
  a = norm(a); b = norm(b); const max = Math.max(a.length, b.length);
  return max ? 1 - levenshtein(a, b) / max : 0;
}
function makeId(branch) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5).toUpperCase();
  return `DN-${String(branch || "BART").toUpperCase()}-${stamp}-${rand}`;
}

async function imageToCanvas(file, variant = "contrast") {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 2400;
  const scale = Math.min(2, maxWidth / bitmap.width);
  const width = Math.max(bitmap.width, Math.round(bitmap.width * scale));
  const height = Math.round(bitmap.height * (width / bitmap.width));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height); const p = image.data;
  for (let i = 0; i < p.length; i += 4) {
    let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    if (variant === "threshold") {
      g = g > 174 ? 255 : g < 105 ? 0 : clamp((g - 128) * 2.05 + 128, 0, 255);
    } else {
      g = clamp((g - 128) * 1.58 + 132, 0, 255);
    }
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function parseRowText(text) {
  const raw = String(text || "").replace(ARABIC, " ").replace(/\s+/g, " ").trim();
  const bracket = raw.match(/\[\s*([A-Za-z0-9()\-]+)\s*\]/);
  const deliverySku = bracket ? normSku(bracket[1]) : "";
  let tail = bracket ? raw.slice((bracket.index || 0) + bracket[0].length).trim() : raw;

  const qtyMatches = [...tail.matchAll(new RegExp(`(?:^|\\s|-)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UOMS.join("|")})\\b`, "gi"))];
  const q = qtyMatches.length ? qtyMatches[qtyMatches.length - 1] : null;
  const qty = q ? Number(q[1].replace(",", ".")) : 0;
  const uom = q ? norm(q[2]) : ""; // DELIVERY NOTE is authoritative for UOM.

  let item = q ? tail.slice(0, q.index).replace(/\s*-\s*$/, "").trim() : tail;
  item = item.replace(/^(ITEMS?|DESCRIPTION|PRODUCTS?)\s*[:\-]?\s*/i, "");
  item = cleanText(item);

  return { deliverySku, scannedItem: item, qty, uom, raw };
}

function detectHorizontalGridLines(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const x0 = Math.floor(width * 0.03);
  const x1 = Math.floor(width * 0.97);
  const span = Math.max(1, x1 - x0);
  const scores = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    let dark = 0;
    const row = y * width * 4;
    for (let x = x0; x < x1; x += 2) {
      if (data[row + x * 4] < 105) dark++;
    }
    scores[y] = dark / Math.ceil(span / 2);
  }

  // A real table rule normally spans a meaningful part of the page width.
  const hot = [];
  for (let y = 1; y < height - 1; y++) {
    const local = (scores[y - 1] + scores[y] + scores[y + 1]) / 3;
    if (local >= 0.24) hot.push(y);
  }

  const groups = [];
  for (const y of hot) {
    const last = groups[groups.length - 1];
    if (!last || y - last[last.length - 1] > 3) groups.push([y]);
    else last.push(y);
  }

  return groups.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
}

function buildPhysicalRowBands(canvas) {
  const lines = detectHorizontalGridLines(canvas);
  const bands = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const top = lines[i] + 2;
    const bottom = lines[i + 1] - 2;
    const h = bottom - top;
    if (h >= ROW_MIN_HEIGHT && h <= ROW_MAX_HEIGHT) bands.push({ top, bottom, height: h });
  }
  return bands;
}

function cropBand(canvas, band, pad = 5) {
  const top = Math.max(0, band.top - pad);
  const bottom = Math.min(canvas.height, band.bottom + pad);
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = Math.max(1, bottom - top);
  out.getContext("2d").drawImage(canvas, 0, top, canvas.width, bottom - top, 0, 0, out.width, out.height);
  return out;
}

function rankByItemName(scan, master) {
  return master
    .map(m => ({ ...m, nameScore: similarity(scan.scannedItem, m.item) }))
    .sort((a, b) => b.nameScore - a.nameScore);
}

// V3 RULES:
// 1) ITEM NAME is ALWAYS the primary identity.
// 2) SKU is confirmation only; it never chooses the product by itself.
// 3) If printed SKU is missing/unreadable, final SKU is filled from Stocks.
// 4) If printed SKU disagrees, keep printed SKU for audit but final stockSku is the item-name match.
// 5) Qty + UOM always come from the delivery note.
function itemFirstMatch(scan, master) {
  const ranked = rankByItemName(scan, master);
  const first = ranked[0];
  const second = ranked[1];
  if (!first) return { stockSku: "", item: scan.scannedItem, confidence: 0, matchType: "UNMATCHED", reviewed: false, ambiguous: false, candidates: [] };

  const gap = first.nameScore - (second?.nameScore || 0);
  const ambiguous = first.nameScore >= NAME_ACCEPT && second && second.nameScore >= NAME_ACCEPT && gap < AMBIGUITY_GAP;
  const acceptable = first.nameScore >= NAME_ACCEPT && !ambiguous;
  const printedSku = normSku(scan.deliverySku);
  const masterSku = normSku(first.sku);
  const skuMissing = !printedSku;
  const skuConfirmed = Boolean(printedSku && masterSku && printedSku === masterSku);
  const skuMismatch = Boolean(printedSku && masterSku && printedSku !== masterSku);

  let matchType = ambiguous ? "AMBIGUOUS_NAME" : acceptable ? "ITEM_NAME" : "REVIEW";
  if (acceptable && skuConfirmed) matchType = "NAME+SKU_CONFIRMED";
  if (acceptable && skuMissing) matchType = "NAME+SKU_FILLED";
  if (acceptable && skuMismatch) matchType = "NAME+SKU_MISMATCH";

  return {
    stockSku: acceptable ? first.sku : "",
    item: acceptable ? first.item : scan.scannedItem,
    confidence: Math.round(clamp(first.nameScore * 100)),
    matchType,
    reviewed: acceptable && first.nameScore >= NAME_STRONG && !skuMismatch,
    ambiguous,
    skuMissing,
    skuConfirmed,
    skuMismatch,
    nameScore: first.nameScore,
    candidates: ranked.slice(0, 4).map(x => ({ sku: x.sku, item: x.item, score: Math.round(x.nameScore * 100) })),
  };
}

function isLikelyProductRow(parsed, master) {
  if (!parsed) return false;
  const ranked = rankByItemName(parsed, master);
  const best = ranked[0]?.nameScore || 0;
  return best >= 0.64 || Boolean(parsed.deliverySku) || (Boolean(parsed.uom) && Number(parsed.qty) > 0);
}

async function recognizePhysicalRows(worker, contrastCanvas, thresholdCanvas, master, onProgress) {
  const bands = buildPhysicalRowBands(thresholdCanvas);
  if (bands.length < 3) {
    throw new Error("Table grid could not be detected clearly. Keep the full delivery-note table visible, straight and sharp.");
  }

  const raw = [];
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const c1 = cropBand(contrastCanvas, band);
    const c2 = cropBand(thresholdCanvas, band);
    const first = await worker.recognize(c1);
    const second = await worker.recognize(c2);
    const a = parseRowText(first?.data?.text || "");
    const b = parseRowText(second?.data?.text || "");

    const scoreA = rankByItemName(a, master)[0]?.nameScore || 0;
    const scoreB = rankByItemName(b, master)[0]?.nameScore || 0;
    const primary = scoreB > scoreA ? b : a;
    const other = primary === a ? b : a;
    const combined = {
      ...primary,
      deliverySku: primary.deliverySku || other.deliverySku,
      scannedItem: primary.scannedItem || other.scannedItem,
      qty: primary.qty > 0 ? primary.qty : other.qty,
      uom: primary.uom || other.uom,
      passAgreement: similarity(a.scannedItem, b.scannedItem) >= 0.78,
      physicalBand: band,
      physicalIndex: i,
    };
    raw.push(combined);
    onProgress?.(i + 1, bands.length);
  }

  const productFlags = raw.map(r => isLikelyProductRow(r, master));
  const productIndexes = productFlags.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (!productIndexes.length) throw new Error("Physical table rows were found, but no product rows could be identified.");

  // Keep every physical band between first and last recognized product row.
  // This is the key V3 protection: an unreadable middle row remains present for staff review.
  const first = productIndexes[0];
  const last = productIndexes[productIndexes.length - 1];
  return raw.slice(first, last + 1).map((r, i) => ({ ...r, physicalRow: i + 1 }));
}

function createCleanPdf({ branch, transactionId, noteNo, deliveryDate, rows }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14; let y = 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("DAM UNITED - BART DELIVERY NOTE", left, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Branch: ${branch?.code || ""} - ${branch?.name || ""}`, left, y); y += 5;
  doc.text(`Transaction: ${transactionId}`, left, y); y += 5;
  doc.text(`Delivery Note: ${noteNo || "-"}    Delivery Date: ${deliveryDate || "-"}`, left, y); y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("#", left, y); doc.text("Delivery SKU", 22, y); doc.text("Matched Item", 53, y); doc.text("Qty", 158, y); doc.text("UOM", 174, y); y += 4;
  doc.line(left, y, 196, y); y += 5;
  rows.forEach((r, i) => {
    if (y > 278) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(String(i + 1), left, y); doc.text(String(r.deliverySku || "-"), 22, y);
    const itemLines = doc.splitTextToSize(String(r.item || r.scannedItem || ""), 98);
    doc.text(itemLines, 53, y); doc.text(String(r.qty || ""), 158, y); doc.text(String(r.uom || ""), 174, y);
    y += Math.max(6, itemLines.length * 4 + 1);
  });
  doc.save(`${transactionId}.pdf`);
}

export default function DNVisionScanner({ branch, onBack }) {
  const inputRef = useRef(null);
  const [master, setMaster] = useState([]); const [masterBusy, setMasterBusy] = useState(true);
  const [file, setFile] = useState(null); const [preview, setPreview] = useState("");
  const [rows, setRows] = useState([]); const [progress, setProgress] = useState(0); const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false); const [submitting, setSubmitting] = useState(false); const [message, setMessage] = useState(null);
  const [noteNo, setNoteNo] = useState(""); const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactionId, setTransactionId] = useState(() => makeId(branch?.code));

  async function loadMaster(refresh = false) {
    setMasterBusy(true); setMessage(null);
    try {
      const r = await fetch(`/api/staff/bart/delivery-notes/master?branch=${encodeURIComponent(branch?.code || "")}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.message || "Unable to load Stocks master.");
      setMaster(d.items || []);
    } catch (e) { setMessage({ type: "error", text: e.message }); }
    finally { setMasterBusy(false); }
  }
  useEffect(() => { loadMaster(false); }, [branch?.code]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f)); setRows([]); setMessage(null); setProgress(0); setStatus(""); setTransactionId(makeId(branch?.code));
  }

  async function scan() {
    if (!file || !master.length || busy) return;
    setBusy(true); setMessage(null); setProgress(2); let worker;
    try {
      setStatus("Cleaning document + detecting physical table rows...");
      const [contrast, threshold] = await Promise.all([imageToCanvas(file, "contrast"), imageToCanvas(file, "threshold")]);
      setProgress(5);
      setStatus("Loading free OCR engine...");
      worker = await createWorker("eng", 1, { logger: () => {} });
      setProgress(10);
      setStatus("Reading every physical row twice...");
      const physicalRows = await recognizePhysicalRows(worker, contrast, threshold, master, (done, total) => {
        setProgress(Math.round(10 + (done / Math.max(1, total)) * 82));
        setStatus(`Reading physical row ${done} of ${total}...`);
      });
      setStatus("Item-name matching + SKU confirmation...");
      const matched = physicalRows.map((x, i) => ({ id: `${Date.now()}-${i}`, ...x, ...itemFirstMatch(x, master) }));
      setRows(matched); setProgress(100);
      const uncertain = matched.filter(x => !x.stockSku || x.ambiguous || !(x.qty > 0) || !x.uom || !x.reviewed).length;
      setMessage({ type: uncertain ? "warn" : "success", text: uncertain ? `${matched.length} PHYSICAL product rows preserved. ${uncertain} row(s) require staff review.` : `${matched.length} PHYSICAL product rows preserved and verified.` });
    } catch (e) { setMessage({ type: "error", text: e.message || "Scan failed." }); }
    finally { if (worker) await worker.terminate().catch(() => {}); setBusy(false); setStatus(""); }
  }

  function update(id, key, value) { setRows(r => r.map(x => x.id === id ? { ...x, [key]: value, reviewed: true } : x)); }
  function chooseMaster(id, stockSku) {
    const m = master.find(x => x.sku === stockSku); if (!m) return;
    setRows(r => r.map(x => x.id === id ? { ...x, stockSku: m.sku, item: m.item, confidence: 100, matchType: "MANUAL", ambiguous: false, reviewed: true } : x));
  }
  function addRow() { setRows(r => [...r, { id: `manual-${Date.now()}`, deliverySku: "", scannedItem: "", stockSku: "", item: "", qty: 0, uom: "", confidence: 0, matchType: "MANUAL", reviewed: true, ambiguous: false, candidates: [] }]); }
  const invalid = useMemo(() => rows.filter(x => !x.stockSku || !x.item || !x.uom || !(Number(x.qty) > 0) || x.ambiguous || !x.reviewed), [rows]);

  async function submit() {
    if (!rows.length || invalid.length || submitting) return;
    setSubmitting(true); setMessage(null);
    try {
      const r = await fetch("/api/staff/bart/delivery-notes/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        branchCode: branch?.code, transactionId, deliveryNoteNo: noteNo, deliveryDate, submittedBy: "BRANCH STAFF",
        items: rows.map(x => ({ deliverySku: x.deliverySku, stockSku: x.stockSku, item: x.item, qty: Number(x.qty), uom: x.uom, matchType: x.matchType, confidence: x.confidence, reviewed: x.reviewed }))
      }) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.message || "Submit failed.");
      setMessage({ type: "success", text: d.duplicate ? `Already recorded: ${d.transactionId}` : `Saved: ${d.totalItems} items • ${d.transactionId}` });
      if (!d.duplicate) { setRows([]); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(""); setNoteNo(""); setTransactionId(makeId(branch?.code)); }
    } catch (e) { setMessage({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  return <div className="dnv-page">
    <header className="dnv-head"><button onClick={onBack}><ArrowLeft size={18}/> BACK</button><div><span>BART • DELIVERY INTELLIGENCE V3</span><h1>Delivery Note Scanner</h1><p>{branch?.code} • {branch?.name}</p></div><div className="dnv-master"><ShieldCheck size={18}/><strong>{masterBusy ? "Loading..." : `${master.length} master items`}</strong><button onClick={() => loadMaster(true)} disabled={masterBusy}><RefreshCcw size={15}/></button></div></header>
    {message && <div className={`dnv-message ${message.type}`}>{message.type === "error" || message.type === "warn" ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}<span>{message.text}</span></div>}

    <section className="dnv-grid">
      <div className="dnv-card capture"><div className="dnv-card-title"><Camera/><div><span>STEP 01</span><h2>Capture document</h2></div></div>
        <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
        <button className="dnv-drop" onClick={() => inputRef.current?.click()}>{preview ? <img src={preview} alt="Delivery note preview"/> : <><Upload size={38}/><strong>Take photo or choose image</strong><small>Keep the entire paper visible and sharp.</small></>}</button>
        <div className="dnv-fields"><label>Delivery Note No.<input value={noteNo} onChange={e=>setNoteNo(e.target.value)} placeholder="Optional reference"/></label><label>Delivery Date<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label></div>
        <button className="dnv-scan" onClick={scan} disabled={!file || busy || masterBusy || !master.length}>{busy ? <LoaderCircle className="dnv-spin"/> : <ScanLine/>}{busy ? status || "Scanning..." : "DUAL SCAN + VERIFY"}</button>
        {busy && <div className="dnv-progress"><div style={{width:`${progress}%`}}/><span>{progress}%</span></div>}
      </div>

      <div className="dnv-card intelligence"><div className="dnv-card-title"><FileImage/><div><span>ITEM-FIRST MATCH ENGINE</span><h2>Item Name → SKU confirmation</h2></div></div>
        <div className="dnv-pipeline"><b>PHOTO</b><i>→</i><b>PHYSICAL ROWS</b><i>→</i><b>OCR×2/ROW</b><i>→</i><b>ITEM MATCH</b></div>
        <p><strong>Item Name is always first.</strong> SKU only confirms the item. Missing SKU is filled from Stocks; mismatched printed SKU is preserved for audit and flagged. Qty + UOM always stay from the delivery note. A physical row is never silently dropped.</p>
        <div className="dnv-stat"><span>Transaction</span><code>{transactionId}</code></div><div className="dnv-stat"><span>Rows detected</span><strong>{rows.length}</strong></div><div className="dnv-stat"><span>Needs review</span><strong className={invalid.length ? "bad":"good"}>{invalid.length}</strong></div>
        <button className="dnv-pdf" disabled={!rows.length} onClick={() => createCleanPdf({ branch, transactionId, noteNo, deliveryDate, rows })}><FileDown size={16}/> CREATE CLEAN PDF</button>
      </div>
    </section>

    <section className="dnv-results"><div className="dnv-results-head"><div><span>STEP 02</span><h2>Verify every row</h2><p>Every physical table row is preserved. Ambiguous, unreadable or SKU-mismatch rows require staff review.</p></div><button onClick={addRow}><Plus size={16}/> ADD ROW</button></div>
      {!rows.length ? <div className="dnv-empty"><ScanLine size={34}/><strong>No scanned rows yet</strong><span>Capture a delivery note and run Dual Scan + Verify.</span></div> : <div className="dnv-table-wrap"><table><thead><tr><th>#</th><th>Delivery SKU</th><th>Matched Stock Item</th><th>Qty</th><th>Delivery UOM</th><th>Match</th><th></th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id} className={!invalid.includes(r)?"ok":"review"}><td>{i+1}</td><td><input value={r.deliverySku} onChange={e=>update(r.id,"deliverySku",e.target.value)}/></td><td><select value={r.stockSku} onChange={e=>chooseMaster(r.id,e.target.value)}><option value="">Select / unmatched</option>{master.map(m=><option key={`${m.sku}-${m.item}`} value={m.sku}>{m.sku} • {m.item}</option>)}</select><small>{r.item || r.scannedItem}</small>{r.skuMismatch && <em className="dnv-ambiguous">Printed SKU {r.deliverySku} differs from Stocks SKU {r.stockSku}</em>}{r.skuMissing && r.stockSku && <em className="dnv-filled">SKU filled from Stocks: {r.stockSku}</em>}{r.ambiguous && <em className="dnv-ambiguous">Ambiguous: {r.candidates?.map(c=>`${c.sku} ${c.score}%`).join(" • ")}</em>}</td><td><input className="qty" type="number" min="0" step="any" value={r.qty} onChange={e=>update(r.id,"qty",e.target.value)}/></td><td><input value={r.uom} onChange={e=>update(r.id,"uom",e.target.value.toUpperCase())}/></td><td><span className={`dnv-confidence ${r.confidence>=93?"high":r.confidence>=86?"mid":"low"}`}>{r.confidence}% • {r.matchType}</span>{!r.reviewed&&!r.ambiguous&&r.stockSku&&<button className="dnv-review" onClick={()=>update(r.id,"reviewed",true)}>MARK REVIEWED</button>}</td><td><button className="dnv-trash" onClick={()=>setRows(x=>x.filter(y=>y.id!==r.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
    </section>

    <footer className="dnv-submitbar"><div><strong>{rows.length} items</strong><span>{invalid.length ? `${invalid.length} item(s) require correction/review.` : rows.length ? "All rows ready for submission." : "Scan a delivery note first."}</span></div><button onClick={submit} disabled={!rows.length || invalid.length>0 || submitting}>{submitting?<LoaderCircle className="dnv-spin"/>:<Send/>}{submitting?"SAVING...":"SUBMIT DELIVERY"}</button></footer>
  </div>;
}
