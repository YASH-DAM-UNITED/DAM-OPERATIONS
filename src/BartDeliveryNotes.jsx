import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, FilePlus2, FileScan, Loader2, RefreshCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import "./BartDeliveryNotes.css";

const MAX_FILE_MB = 10;

function api(path, options = {}) {
  return fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } })
    .then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`); return data; });
}

async function imageToJpegBase64(file, maxSide = 2200, quality = 0.88) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false }); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState({ deliveryNoteNo: "", deliveryDate: "", supplier: "", submittedBy: "" });

  const branchCode = String(branch?.code || branch?.BranchCode || branch?.branchCode || "").trim().toUpperCase();
  const unresolved = useMemo(() => rows.filter(r => r.status !== "CONFIRMED").length, [rows]);

  function chooseFile(e) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setError(""); setMessage("");
    if (!f.type.startsWith("image/")) return setError("Please choose a delivery-note image.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`Maximum image size is ${MAX_FILE_MB} MB.`);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(f); setPendingPreview(URL.createObjectURL(f));
  }

  async function scanPage() {
    if (!pendingFile || !branchCode) return;
    setBusy(true); setError(""); setMessage(`Scanning page ${pages.length + 1} with Azure AI Vision…`);
    try {
      const imageBase64 = await imageToJpegBase64(pendingFile);
      const data = await api("/api/staff/bart/delivery-notes/scan", { method: "POST", body: JSON.stringify({ branch: branchCode, imageBase64 }) });
      const pageNo = pages.length + 1;
      const appended = (data.items || []).map((r, i) => ({ ...r, pageNo, rowId: `P${pageNo}-${r.rowId || i + 1}` }));
      setRows(old => [...old, ...appended]);
      setPages(old => [...old, { pageNo, preview: pendingPreview, ocrText: data.ocrText || "", itemCount: appended.length }]);
      setPendingFile(null); setPendingPreview("");
      setNote(n => ({ ...n, deliveryNoteNo: n.deliveryNoteNo || data.meta?.deliveryNoteNo || "", deliveryDate: n.deliveryDate || data.meta?.deliveryDate || "", supplier: n.supplier || data.meta?.supplier || "" }));
      setMessage(`Page ${pageNo} added: ${appended.length} item(s). ${pageNo} page(s) scanned · ${rows.length + appended.length} total item(s).`);
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  function updateRow(index, field, value) {
    setRows(old => old.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, [field]: value, reviewReason: "MANUAL_REVIEW", match: r.match === "ITEM_NAME" ? "ITEM_NAME" : "MANUAL" };
      next.status = String(next.item || "").trim() && String(next.sku || next.stockSku || "").trim() && String(next.ordered || "").trim() && String(next.delivered || "").trim() ? "CONFIRMED" : "REVIEW";
      return next;
    }));
  }

  function removePage(pageNo) {
    if (busy) return;
    setPages(old => old.filter(p => p.pageNo !== pageNo));
    setRows(old => old.filter(r => r.pageNo !== pageNo));
    setMessage(`Page ${pageNo} removed. Scan it again if required.`); setError("");
  }

  async function submit() {
    if (!rows.length) return setError("Nothing to submit.");
    if (!note.deliveryNoteNo.trim()) return setError("Delivery Note No is required.");
    if (unresolved) return setError(`${unresolved} row(s) still need review. Confirm/edit them first.`);
    setBusy(true); setError(""); setMessage("Saving ONE delivery-note transaction to the branch Google Sheet…");
    try {
      const data = await api("/api/staff/bart/delivery-notes/submit", { method: "POST", body: JSON.stringify({ branch: branchCode, ...note, pageCount: pages.length, ocrPages: pages.map(p => p.ocrText), items: rows }) });
      setMessage(`Saved successfully as ONE transaction. ${data.pageCount} page(s), ${data.totalItems} item(s). Transaction: ${data.transactionId}`);
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  return <div className="dnv-shell">
    <header className="dnv-head"><button className="dnv-back" onClick={onBack}><ArrowLeft size={18}/> Back</button><div><span>05 / DELIVERY NOTES</span><h1>Azure AI Vision Receiving</h1><p>{branchCode} · {branch?.name || branch?.BranchName || "BART Branch"}</p></div><div className="dnv-badge"><FileScan size={18}/> AZURE OCR</div></header>

    <section className="dnv-grid">
      <div className="dnv-card"><h2>1. Scan delivery-note pages</h2><p>Scan Page 1 first. If the delivery note has another page, add it before submitting. All pages stay in ONE transaction.</p>
        <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
        <button className="dnv-primary" onClick={() => inputRef.current?.click()}><Camera size={18}/> {pages.length ? "+ Scan Another Page (Optional)" : "Take / choose Page 1"}</button>
        {pendingPreview && <><img className="dnv-preview" src={pendingPreview} alt="Pending delivery note page"/><button className="dnv-scan" disabled={busy} onClick={scanPage}>{busy ? <Loader2 className="dnv-spin" size={18}/> : <RefreshCcw size={18}/>} Scan & Add Page {pages.length + 1}</button></>}
        {!!pages.length && <div className="dnv-pages"><div className="dnv-pages-head"><FilePlus2 size={17}/><b>{pages.length} page(s) scanned · {rows.length} items</b></div>{pages.map(p=><div className="dnv-page" key={p.pageNo}><span>Page {p.pageNo} · {p.itemCount} items</span><button onClick={()=>removePage(p.pageNo)} title="Remove this page"><Trash2 size={15}/> Remove</button></div>)}</div>}
      </div>

      <div className="dnv-card"><h2>2. Delivery details</h2><label>Delivery Note No<input value={note.deliveryNoteNo} onChange={e=>setNote({...note,deliveryNoteNo:e.target.value})}/></label><label>Delivery Date<input type="date" value={note.deliveryDate} onChange={e=>setNote({...note,deliveryDate:e.target.value})}/></label><label>Supplier<input value={note.supplier} onChange={e=>setNote({...note,supplier:e.target.value})}/></label><label>Submitted By<input value={note.submittedBy} onChange={e=>setNote({...note,submittedBy:e.target.value})}/></label><div className="dnv-stats"><b>{rows.length}</b><span>items detected</span><b>{unresolved}</b><span>need review</span></div></div>
    </section>

    {(message || error) && <div className={`dnv-msg ${error ? "bad" : "ok"}`}>{error ? <TriangleAlert size={18}/> : <CheckCircle2 size={18}/>} {error || message}</div>}

    {rows.length > 0 && <section className="dnv-table-card"><div className="dnv-title"><div><h2>3. Verify & confirm</h2><p>English Stocks item name is standard. The small line underneath keeps the full Azure OCR text for verification. ORDERED and DELIVERED preserve the complete printed quantity/UOM text.</p></div><button className="dnv-submit" disabled={busy || unresolved > 0} onClick={submit}><Save size={18}/> Submit ONE Transaction</button></div>
      <div className="dnv-table-wrap"><table><thead><tr><th>#</th><th>Page</th><th>SKU</th><th>Item</th><th>ORDERED</th><th>DELIVERED</th><th>Match</th><th>Status</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.rowId || i} className={r.status === "CONFIRMED" ? "confirmed" : "review"}><td>{i+1}</td><td>P{r.pageNo || 1}</td><td className="dnv-sku"><input value={r.sku || r.stockSku || ""} onChange={e=>updateRow(i,"sku",e.target.value)}/></td><td className="dnv-item"><input value={r.item || ""} onChange={e=>updateRow(i,"item",e.target.value)}/><small>OCR: {r.ocrText}</small></td><td className="dnv-quantity"><textarea rows="2" value={r.ordered || ""} onChange={e=>updateRow(i,"ordered",e.target.value)}/></td><td className="dnv-quantity"><textarea rows="2" value={r.delivered || ""} onChange={e=>updateRow(i,"delivered",e.target.value)}/></td><td>{r.match || "REVIEW"}<small>{r.score ? ` ${Math.round(r.score*100)}%` : ""}</small></td><td>{r.status === "CONFIRMED" ? <span className="dnv-ok">CONFIRMED</span> : <span className="dnv-warn">REVIEW</span>}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}
