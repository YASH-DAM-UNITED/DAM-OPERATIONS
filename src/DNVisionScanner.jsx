import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, FileImage, LoaderCircle, RefreshCcw, ScanLine, ShieldCheck, Trash2, Upload, AlertTriangle, Plus, Send } from "lucide-react";
import { createWorker } from "tesseract.js";
import "./DNVisionScanner.css";

const UOMS = ["PCS", "PC", "PIECE", "PIECES", "BOTTLE", "BOTTLES", "BTL", "BOX", "BOXES", "PACK", "PACKS", "PKT", "KG", "G", "GM", "ML", "L", "LTR", "CAN", "CANS", "BAG", "BAGS", "CTN", "CARTON", "CARTONS"];
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;

function norm(v) { return String(v ?? "").normalize("NFKC").replace(ARABIC, " ").replace(/[^a-zA-Z0-9.\- ]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase(); }
function normSku(v) { return norm(v).replace(/\s+/g, "").replace(/[^A-Z0-9()\-]/g, ""); }
function clamp(n, a = 0, b = 100) { return Math.max(a, Math.min(b, n)); }

function levenshtein(a, b) {
  a = norm(a); b = norm(b);
  if (!a) return b.length; if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
function similarity(a, b) {
  a = norm(a); b = norm(b); const m = Math.max(a.length, b.length);
  return m ? 1 - levenshtein(a, b) / m : 0;
}
function makeId(branch) {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `DN-${String(branch || "BART").toUpperCase()}-${stamp}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5).toUpperCase()}`;
}

async function preprocess(file) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 2200;
  const scale = Math.min(2, maxWidth / bitmap.width);
  const width = Math.max(bitmap.width, Math.round(bitmap.width * scale));
  const height = Math.round(bitmap.height * (width / bitmap.width));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height); const p = image.data;
  for (let i = 0; i < p.length; i += 4) {
    let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    g = clamp((g - 128) * 1.45 + 128, 0, 255);
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function parseText(text) {
  const lines = String(text || "").split(/\r?\n/).map(x => x.replace(ARABIC, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const rows = [];
  for (const raw of lines) {
    const bracket = raw.match(/\[\s*([A-Za-z0-9()\-]+)\s*\]/);
    if (!bracket) continue;
    const deliverySku = normSku(bracket[1]);
    let tail = raw.slice((bracket.index || 0) + bracket[0].length).trim();
    const uomPattern = UOMS.join("|");
    const qtyMatches = [...tail.matchAll(new RegExp(`(?:^|\\s|-)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${uomPattern})\\b`, "gi"))];
    const q = qtyMatches.length ? qtyMatches[qtyMatches.length - 1] : null;
    let qty = q ? Number(q[1].replace(",", ".")) : 0;
    let uom = q ? norm(q[2]) : "";
    let item = q ? tail.slice(0, q.index).replace(/\s*-\s*$/, "").trim() : tail.replace(/\s+-\s+.*$/, "").trim();
    item = item.replace(ARABIC, " ").replace(/\s+/g, " ").trim();
    if (deliverySku || item) rows.push({ deliverySku, scannedItem: item, qty, scannedUom: uom, raw });
  }
  return rows;
}

function bestMatch(scan, master) {
  let best = null;
  for (const item of master) {
    const skuExact = normSku(scan.deliverySku) && normSku(scan.deliverySku) === normSku(item.sku);
    const skuSim = similarity(normSku(scan.deliverySku), normSku(item.sku));
    const nameSim = similarity(scan.scannedItem, item.item);
    const uomExact = norm(scan.scannedUom) && norm(scan.scannedUom) === norm(item.uom);
    let score = nameSim * 62 + skuSim * 25 + (uomExact ? 13 : 0);
    if (skuExact) score = Math.max(score, 88 + nameSim * 9 + (uomExact ? 3 : 0));
    if (!best || score > best.score) best = { ...item, score, skuExact, nameSim, uomExact };
  }
  if (!best) return { stockSku: "", item: scan.scannedItem, uom: scan.scannedUom, confidence: 0, matchType: "UNMATCHED", reviewed: false };
  const confidence = Math.round(clamp(best.score));
  const matchType = best.skuExact && best.nameSim >= .72 ? "SKU+NAME" : best.skuExact ? "SKU" : best.nameSim >= .86 ? "ITEM_NAME" : confidence >= 70 ? "FUZZY" : "REVIEW";
  return { stockSku: best.sku, item: best.item, uom: best.uom, confidence, matchType, reviewed: confidence >= 88 };
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
    setBusy(true); setMessage(null); setProgress(2); setStatus("Enhancing document...");
    let worker;
    try {
      const canvas = await preprocess(file);
      setStatus("Loading free OCR engine...");
      worker = await createWorker("eng", 1, { logger: m => {
        if (m.status === "recognizing text") { setProgress(Math.round((m.progress || 0) * 100)); setStatus("Reading delivery note..."); }
      }});
      const result = await worker.recognize(canvas);
      setStatus("Matching with branch Stocks master...");
      const parsed = parseText(result?.data?.text || "");
      const matched = parsed.map((x, i) => ({ id: `${Date.now()}-${i}`, ...x, ...bestMatch(x, master) }));
      setRows(matched); setProgress(100);
      if (!matched.length) throw new Error("No [SKU] item rows were detected. Retake the photo straight, close and clear, or add rows manually.");
      const uncertain = matched.filter(x => x.confidence < 88 || !(x.qty > 0)).length;
      setMessage({ type: uncertain ? "warn" : "success", text: uncertain ? `${matched.length} rows found. ${uncertain} row(s) need review before submit.` : `${matched.length} rows found and strongly matched.` });
    } catch (e) { setMessage({ type: "error", text: e.message || "Scan failed." }); }
    finally { if (worker) await worker.terminate().catch(() => {}); setBusy(false); setStatus(""); }
  }

  function update(id, key, value) { setRows(r => r.map(x => x.id === id ? { ...x, [key]: value, reviewed: true } : x)); }
  function rematch(id, stockSku) {
    const m = master.find(x => x.sku === stockSku); if (!m) return;
    setRows(r => r.map(x => x.id === id ? { ...x, stockSku: m.sku, item: m.item, uom: m.uom, confidence: 100, matchType: "MANUAL", reviewed: true } : x));
  }
  function addRow() { setRows(r => [...r, { id: `manual-${Date.now()}`, deliverySku: "", scannedItem: "", stockSku: "", item: "", qty: 0, uom: "", confidence: 0, matchType: "MANUAL", reviewed: true }]); }
  const invalid = useMemo(() => rows.filter(x => !x.item || !x.uom || !(Number(x.qty) > 0) || (x.confidence < 88 && !x.reviewed)), [rows]);

  async function submit() {
    if (!rows.length || invalid.length || submitting) return;
    setSubmitting(true); setMessage(null);
    try {
      const r = await fetch("/api/staff/bart/delivery-notes/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        branchCode: branch?.code, transactionId, deliveryNoteNo: noteNo, deliveryDate, submittedBy: "BRANCH STAFF",
        items: rows.map(x => ({ deliverySku: x.deliverySku, stockSku: x.stockSku, item: x.item, qty: Number(x.qty), uom: x.uom, matchType: x.matchType, confidence: x.confidence, reviewed: x.reviewed }))
      }) });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.message || "Submit failed.");
      setMessage({ type: "success", text: d.duplicate ? `Already recorded: ${d.transactionId}` : `Saved successfully. ${d.totalItems} items • ${d.transactionId}` });
      if (!d.duplicate) { setRows([]); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(""); setNoteNo(""); setTransactionId(makeId(branch?.code)); }
    } catch (e) { setMessage({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  return <div className="dnv-page">
    <header className="dnv-head"><button onClick={onBack}><ArrowLeft size={18}/> BACK</button><div><span>BART • DELIVERY INTELLIGENCE</span><h1>Delivery Note Scanner</h1><p>{branch?.code} • {branch?.name}</p></div><div className="dnv-master"><ShieldCheck size={18}/><strong>{masterBusy ? "Loading..." : `${master.length} master items`}</strong><button onClick={() => loadMaster(true)} disabled={masterBusy}><RefreshCcw size={15}/></button></div></header>

    {message && <div className={`dnv-message ${message.type}`}>{message.type === "error" || message.type === "warn" ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}<span>{message.text}</span></div>}

    <section className="dnv-grid">
      <div className="dnv-card capture"><div className="dnv-card-title"><Camera/><div><span>STEP 01</span><h2>Capture document</h2></div></div>
        <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
        <button className="dnv-drop" onClick={() => inputRef.current?.click()}>{preview ? <img src={preview} alt="Delivery note preview"/> : <><Upload size={38}/><strong>Take photo or choose image</strong><small>Keep the full paper visible, straight and well lit.</small></>}</button>
        <div className="dnv-fields"><label>Delivery Note No.<input value={noteNo} onChange={e=>setNoteNo(e.target.value)} placeholder="Optional reference"/></label><label>Delivery Date<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label></div>
        <button className="dnv-scan" onClick={scan} disabled={!file || busy || masterBusy || !master.length}>{busy ? <LoaderCircle className="dnv-spin"/> : <ScanLine/>}{busy ? status || "Scanning..." : "SCAN + MATCH"}</button>
        {busy && <div className="dnv-progress"><div style={{width:`${progress}%`}}/><span>{progress}%</span></div>}
      </div>

      <div className="dnv-card intelligence"><div className="dnv-card-title"><FileImage/><div><span>VALIDATION ENGINE</span><h2>Free + branch-aware</h2></div></div>
        <div className="dnv-pipeline"><b>IMAGE</b><i>→</i><b>OCR</b><i>→</i><b>SKU</b><i>+</i><b>NAME</b><i>+</i><b>UOM</b><i>→</i><b>VERIFY</b></div>
        <p>The scan is never trusted alone. Every detected row is compared with this branch's <strong>Stocks</strong> master. Different delivery SKUs can still map through the item name and UOM.</p>
        <div className="dnv-stat"><span>Transaction</span><code>{transactionId}</code></div><div className="dnv-stat"><span>Rows detected</span><strong>{rows.length}</strong></div><div className="dnv-stat"><span>Needs review</span><strong className={invalid.length ? "bad":"good"}>{invalid.length}</strong></div>
      </div>
    </section>

    <section className="dnv-results"><div className="dnv-results-head"><div><span>STEP 02</span><h2>Verify every row</h2><p>Orange/red rows must be checked. You can correct any value before submission.</p></div><button onClick={addRow}><Plus size={16}/> ADD ROW</button></div>
      {!rows.length ? <div className="dnv-empty"><ScanLine size={34}/><strong>No scanned rows yet</strong><span>Capture a delivery note and run Scan + Match.</span></div> : <div className="dnv-table-wrap"><table><thead><tr><th>#</th><th>Delivery SKU</th><th>Matched Stock Item</th><th>Qty</th><th>UOM</th><th>Match</th><th></th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id} className={r.confidence>=88&&r.qty>0?"ok":"review"}><td>{i+1}</td><td><input value={r.deliverySku} onChange={e=>update(r.id,"deliverySku",e.target.value)}/></td><td><select value={r.stockSku} onChange={e=>rematch(r.id,e.target.value)}><option value="">Select / unmatched</option>{master.map(m=><option key={`${m.sku}-${m.item}`} value={m.sku}>{m.sku} • {m.item}</option>)}</select><small>{r.item}</small></td><td><input className="qty" type="number" min="0" step="any" value={r.qty} onChange={e=>update(r.id,"qty",e.target.value)}/></td><td><input value={r.uom} onChange={e=>update(r.id,"uom",e.target.value.toUpperCase())}/></td><td><span className={`dnv-confidence ${r.confidence>=88?"high":r.confidence>=70?"mid":"low"}`}>{r.confidence}% • {r.matchType}</span>{r.confidence<88&&!r.reviewed&&<button className="dnv-review" onClick={()=>update(r.id,"reviewed",true)}>MARK REVIEWED</button>}</td><td><button className="dnv-trash" onClick={()=>setRows(x=>x.filter(y=>y.id!==r.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
    </section>

    <footer className="dnv-submitbar"><div><strong>{rows.length} items</strong><span>{invalid.length ? `${invalid.length} item(s) still require correction/review.` : rows.length ? "All rows ready for submission." : "Scan a delivery note first."}</span></div><button onClick={submit} disabled={!rows.length || invalid.length>0 || submitting}>{submitting?<LoaderCircle className="dnv-spin"/>:<Send/>}{submitting?"SAVING...":"SUBMIT DELIVERY"}</button></footer>
  </div>;
}
