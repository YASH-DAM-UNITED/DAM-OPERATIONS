import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, FileScan, Loader2, RefreshCcw, Save, TriangleAlert } from "lucide-react";
import "./BartDeliveryNotes.css";

const MAX_FILE_MB = 10;

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  });
}

async function imageToJpegBase64(file, maxSide = 2200, quality = 0.88) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [note, setNote] = useState({ deliveryNoteNo: "", deliveryDate: "", supplier: "", submittedBy: "" });

  const branchCode = String(branch?.code || branch?.BranchCode || branch?.branchCode || "").trim().toUpperCase();
  const rows = result?.items || [];
  const unresolved = useMemo(() => rows.filter((r) => r.status !== "CONFIRMED").length, [rows]);

  function chooseFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(""); setMessage(""); setResult(null);
    if (!f.type.startsWith("image/")) return setError("Please choose a delivery-note image.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`Maximum image size is ${MAX_FILE_MB} MB.`);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  async function scan() {
    if (!file || !branchCode) return;
    setBusy(true); setError(""); setMessage("Preparing image…");
    try {
      const imageBase64 = await imageToJpegBase64(file);
      setMessage("PaddleOCR is parsing the delivery note structure…");
      const data = await api("/api/staff/bart/delivery-notes/scan", {
        method: "POST",
        body: JSON.stringify({ branch: branchCode, imageBase64 }),
      });
      setResult(data);
      setNote((n) => ({
        ...n,
        deliveryNoteNo: data.meta?.deliveryNoteNo || n.deliveryNoteNo,
        deliveryDate: data.meta?.deliveryDate || n.deliveryDate,
        supplier: data.meta?.supplier || n.supplier,
      }));
      setMessage(data.items?.length ? `Detected ${data.items.length} product row(s). Review before submitting.` : "OCR completed, but no product rows were confidently reconstructed.");
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  function updateRow(index, field, value) {
    setResult((old) => ({ ...old, items: old.items.map((r, i) => { if (i !== index) return r; const next = { ...r, [field]: value, reviewReason: "MANUAL_REVIEW", skuMismatch: false, match: r.match === "ITEM_NAME" ? "ITEM_NAME" : "MANUAL" }; next.status = String(next.item||"").trim() && String(next.stockSku||"").trim() && String(next.qty??"").trim() && String(next.uom||"").trim() ? "CONFIRMED" : "REVIEW"; return next; }) }));
  }

  async function submit() {
    if (!rows.length) return setError("Nothing to submit.");
    if (unresolved) return setError(`${unresolved} row(s) still need review. Confirm/edit them first.`);
    setBusy(true); setError(""); setMessage("Saving one delivery transaction to Google Sheets…");
    try {
      const data = await api("/api/staff/bart/delivery-notes/submit", {
        method: "POST",
        body: JSON.stringify({ branch: branchCode, ...note, items: rows }),
      });
      setMessage(`Saved successfully. Transaction: ${data.transactionId}`);
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  return <div className="dnv-shell">
    <header className="dnv-head">
      <button className="dnv-back" onClick={onBack}><ArrowLeft size={18}/> Back</button>
      <div><span>05 / DELIVERY NOTES</span><h1>PaddleOCR Smart Receiving</h1><p>{branchCode} · {branch?.name || branch?.BranchName || "BART Branch"}</p></div>
      <div className="dnv-badge"><FileScan size={18}/> PADDLEOCR · DOCUMENT AI</div>
    </header>

    <section className="dnv-grid">
      <div className="dnv-card">
        <h2>1. Capture delivery note</h2>
        <p>One clear photo of the full page. PaddleOCR reads the document layout and table structure in one pass.</p>
        <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
        <button className="dnv-primary" onClick={() => inputRef.current?.click()}><Camera size={18}/> {file ? "Choose another image" : "Take / choose photo"}</button>
        {preview && <img className="dnv-preview" src={preview} alt="Delivery note preview"/>}
        <button className="dnv-scan" disabled={!file || busy} onClick={scan}>{busy ? <Loader2 className="dnv-spin" size={18}/> : <RefreshCcw size={18}/>} Scan with PaddleOCR</button>
      </div>

      <div className="dnv-card">
        <h2>2. Delivery details</h2>
        <label>Delivery Note No<input value={note.deliveryNoteNo} onChange={e=>setNote({...note,deliveryNoteNo:e.target.value})}/></label>
        <label>Delivery Date<input type="date" value={note.deliveryDate} onChange={e=>setNote({...note,deliveryDate:e.target.value})}/></label>
        <label>Supplier<input value={note.supplier} onChange={e=>setNote({...note,supplier:e.target.value})}/></label>
        <label>Submitted By<input value={note.submittedBy} onChange={e=>setNote({...note,submittedBy:e.target.value})}/></label>
        <div className="dnv-stats"><b>{rows.length}</b><span>rows detected</span><b>{unresolved}</b><span>need review</span></div>
      </div>
    </section>

    {(message || error) && <div className={`dnv-msg ${error ? "bad" : "ok"}`}>{error ? <TriangleAlert size={18}/> : <CheckCircle2 size={18}/>} {error || message}</div>}

    {rows.length > 0 && <section className="dnv-table-card">
      <div className="dnv-title"><div><h2>3. Verify detected items</h2><p>Item name identifies the Stocks product. SKU only confirms/fills. Qty and UOM stay from the delivery note.</p></div><button className="dnv-submit" disabled={busy || unresolved>0} onClick={submit}><Save size={18}/> Submit Delivery</button></div>
      <div className="dnv-table-wrap"><table><thead><tr><th>#</th><th>Printed SKU</th><th>DAM SKU</th><th>Item</th><th>Qty</th><th>UOM</th><th>Match</th><th>Status</th></tr></thead><tbody>
        {rows.map((r,i)=><tr key={r.rowId || i} className={r.status === "CONFIRMED" ? "confirmed" : "review"}>
          <td>{i+1}</td>
          <td><input value={r.deliverySku || ""} onChange={e=>updateRow(i,"deliverySku",e.target.value)}/></td>
          <td><input value={r.stockSku || ""} onChange={e=>updateRow(i,"stockSku",e.target.value)}/></td>
          <td className="dnv-item"><input value={r.item || ""} onChange={e=>updateRow(i,"item",e.target.value)}/><small>{r.ocrText}</small></td>
          <td><input value={r.qty ?? ""} onChange={e=>updateRow(i,"qty",e.target.value)}/></td>
          <td><input value={r.uom || ""} onChange={e=>updateRow(i,"uom",e.target.value)}/></td>
          <td>{r.match || "REVIEW"}<small>{r.score ? ` ${Math.round(r.score*100)}%` : ""}</small></td>
          <td>{r.status === "CONFIRMED" ? <span className="dnv-ok">CONFIRMED</span> : <span className="dnv-warn">REVIEW</span>}</td>
        </tr>)}
      </tbody></table></div>
    </section>}
  </div>;
}
