import React, { useEffect, useMemo, useRef, useState } from "react";
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

function autoGrowDeliveryField(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(58, el.scrollHeight)}px`;
}

export default function BartDeliveryNotes({ branch, onBack }) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [pages, setPages] = useState([]);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [scanUsage, setScanUsage] = useState({ used: 0, remaining: 3, limit: 3, loading: true });
  const [rows, setRows] = useState([]);
  const [documentType, setDocumentType] = useState("DELIVERY_NOTE");
  const [stockItems, setStockItems] = useState([]);
  const skuMap = useMemo(() => new Map(stockItems.map(x => [String(x.sku || "").trim().toUpperCase(), x.item])), [stockItems]);
  const [note, setNote] = useState({ deliveryNoteNo: "", deliveryDate: "", supplier: "", submittedBy: "" });

  const branchCode = String(branch?.code || branch?.BranchCode || branch?.branchCode || "").trim().toUpperCase();
  const unresolved = useMemo(() => rows.filter(r => r.status !== "CONFIRMED").length, [rows]);
  const scanLimitReached = !scanUsage.loading && scanUsage.remaining <= 0;

  useEffect(() => {
    let active = true;
    if (!branchCode) return undefined;
    api(`/api/staff/bart/delivery-notes/scan-status?branch=${encodeURIComponent(branchCode)}`)
      .then(data => { if (active) setScanUsage({ used: data.used || 0, remaining: data.remaining ?? 3, limit: data.limit || 3, loading: false }); })
      .catch(e => { if (active) { setScanUsage(s => ({ ...s, loading: false })); setError(e.message); } });
    return () => { active = false; };
  }, [branchCode]);

  useEffect(() => {
    let active = true;
    if (!branchCode) return undefined;
    api(`/api/staff/bart/delivery-notes/stock-master?branch=${encodeURIComponent(branchCode)}`)
      .then(data => { if (active) setStockItems(data.items || []); })
      .catch(e => { if (active) setError(`Stocks lookup unavailable: ${e.message}`); });
    return () => { active = false; };
  }, [branchCode]);

  function confirmRow(index) {
    setRows(old => old.map((r,i) => {
      if (i !== index) return r;
      const hasValues = documentType === "STOCK_DOCUMENT"
        ? String(r.quantity || "").trim()
        : String(r.ordered || "").trim() && String(r.delivered || "").trim();
      if (!String(r.sku || "").trim() || !String(r.item || "").trim() || !hasValues) {
        setError("Confirm needs SKU, item and all required quantities. Fill the missing cells first.");
        return r;
      }
      setError("");
      return {...r,status:"CONFIRMED",reviewReason:"STAFF_VERIFIED"};
    }));
  }

  function deleteRow(index) {
    if (busy || !window.confirm("Delete this item row?")) return;
    setRows(old => old.filter((_, i) => i !== index));
  }

  function addManualRow() {
    setRows(old => [...old, {
      rowId:`MANUAL-${Date.now()}`, pageNo: pages.length || 1,
      sku:"", item:"", ordered:"", delivered:"",
      detailedQty:"", expireDate:"", quantity:"",
      match:"MANUAL", status:"REVIEW", ocrText:"Manually added row"
    }]);
  }

  function chooseFile(e) {
    if (scanLimitReached) { setError("Daily scan limit reached. Contact the IT Team for more queries."); return; }
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setError(""); setMessage("");
    if (!f.type.startsWith("image/")) return setError("Please choose a delivery-note image.");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`Maximum image size is ${MAX_FILE_MB} MB.`);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(f); setPendingPreview(URL.createObjectURL(f));
  }

  async function scanPage() {
    if (!pendingFile || !branchCode) return;
    if (scanLimitReached) return setError("Daily scan limit reached. You have used all 3 Delivery Note scans for today. Contact the IT Team for more queries.");
    setBusy(true); setError(""); setMessage(`Scanning page ${pages.length + 1} with Azure AI Vision…`);
    try {
      const imageBase64 = await imageToJpegBase64(pendingFile);
      const data = await api("/api/staff/bart/delivery-notes/scan", { method: "POST", body: JSON.stringify({ branch: branchCode, imageBase64 }) });
      if (data.scanUsage) setScanUsage({ ...data.scanUsage, loading: false });
      const nextType = data.documentType || "DELIVERY_NOTE";
      if (pages.length && nextType !== documentType) {
        setError("Different document types cannot be combined in one transaction. Remove the page or start a new delivery note.");
        return;
      }
      setDocumentType(nextType);
      const pageNo = pages.length + 1;
      const appended = (data.items || []).map((r, i) => ({ ...r, pageNo, rowId: `P${pageNo}-${r.rowId || i + 1}` }));
      setRows(old => [...old, ...appended]);
      setPreviewApproved(true);
      setPreviewPage(pages.length);
      setPages(old => [...old, { pageNo, preview: pendingPreview, ocrText: data.ocrText || "", originalOcrText: data.ocrText || "", ocrLines: data.ocrLines || [], itemCount: appended.length }]);
      setPendingFile(null); setPendingPreview("");
      setNote(n => ({ ...n, deliveryNoteNo: n.deliveryNoteNo || data.meta?.deliveryNoteNo || "", deliveryDate: n.deliveryDate || data.meta?.deliveryDate || "", supplier: n.supplier || data.meta?.supplier || "" }));
      setMessage(`Page ${pageNo} added: ${appended.length} item(s). ${pageNo} page(s) scanned · ${rows.length + appended.length} total item(s).`);
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  async function continueFromOcr() {
    if (!pages.length) return setError("Scan a document first.");
    setBusy(true); setError(""); setMessage("Applying staff OCR corrections to item fields…");
    try {
      const nextRows = [];
      for (const page of pages) {
        const originalRows = rows.filter(r => r.pageNo === page.pageNo);
        if (page.ocrText === page.originalOcrText) {
          nextRows.push(...originalRows);
          continue;
        }
        const data = await api("/api/staff/bart/delivery-notes/reparse", {
          method: "POST",
          body: JSON.stringify({ branch: branchCode, documentType, ocrText: page.ocrText })
        });
        // Corrected text is authoritative. Never silently reuse outdated OCR quantities.
        const parsed = (data.items || []).map((r, i) => ({
          ...r, pageNo: page.pageNo, rowId: `EDIT-P${page.pageNo}-${i + 1}`
        }));
        if (!parsed.length) {
          throw new Error(`Page ${page.pageNo}: No SKU was found in the corrected text. Add the SKU to the transcription or restore the original text.`);
        }
        nextRows.push(...parsed);
      }
      setRows(nextRows);
      setPreviewApproved(true);
      setMessage("Corrected OCR applied. Check every SKU and quantity in the item table before submission.");
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  function updateRow(index, field, value) {
    setRows(old => old.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, [field]: value, reviewReason: "MANUAL_REVIEW", match: "MANUAL" };
      if (field === "sku") {
        const exactName = skuMap.get(String(value || "").trim().toUpperCase());
        if (exactName) {
          next.sku = String(value).trim().toUpperCase();
          next.stockSku = next.sku;
          next.item = exactName;
          next.match = "SKU_EXACT";
        } else {
          next.stockSku = "";
          next.item = "";
          next.match = "SKU_NOT_FOUND";
        }
      }
      const fieldsOk = documentType === "STOCK_DOCUMENT"
        ? String(next.quantity || "").trim()
        : String(next.ordered || "").trim() && String(next.delivered || "").trim();
      next.status = String(next.item || "").trim() && String(next.sku || "").trim() && fieldsOk ? "CONFIRMED" : "REVIEW";
      return next;
    }));
  }

  function removePage(pageNo) {
    if (busy) return;
    setPages(old => old.filter(p => p.pageNo !== pageNo));
    setRows(old => old.filter(r => r.pageNo !== pageNo));
    setPreviewApproved(false); setPreviewPage(0);
    setMessage(`Page ${pageNo} removed. Scan it again if required.`); setError("");
  }

  async function submit() {
    if (!previewApproved) return setError("Scan a page and review the item table first.");
    if (!rows.length) return setError("Nothing to submit.");
    if (!note.deliveryNoteNo.trim()) return setError("Delivery Note No is required.");
    if (unresolved) return setError(`${unresolved} row(s) still need review. Confirm/edit them first.`);
    setBusy(true); setError(""); setMessage("Saving ONE delivery-note transaction to the branch Google Sheet…");
    try {
      const data = await api("/api/staff/bart/delivery-notes/submit", { method: "POST", body: JSON.stringify({ branch: branchCode, ...note, documentType, pageCount: pages.length, ocrPages: pages.map(p => p.ocrText), items: rows }) });

      // Clear the transaction only after the backend confirms a successful save.
      pages.forEach((page) => {
        if (page?.preview?.startsWith?.("blob:")) URL.revokeObjectURL(page.preview);
      });
      if (pendingPreview?.startsWith?.("blob:")) URL.revokeObjectURL(pendingPreview);

      setSubmitted({
        deliveryNoteNo: note.deliveryNoteNo,
        transactionId: data.transactionId || "",
      });
      setPendingFile(null);
      setPendingPreview("");
      setPages([]);
      setPreviewApproved(false); setPreviewPage(0);
      setRows([]);
      setDocumentType("DELIVERY_NOTE");
      setNote({ deliveryNoteNo: "", deliveryDate: "", supplier: "", submittedBy: "" });
      setMessage("");
      setError("");

      window.setTimeout(() => onBack?.(), 3000);
    } catch (e) { setError(e.message); setMessage(""); }
    finally { setBusy(false); }
  }

  if (submitted) {
    return <div className="dnv-shell">
      <div style={{ minHeight: "68vh", display: "grid", placeItems: "center", padding: "28px 16px" }}>
        <div style={{ width: "min(560px, 100%)", textAlign: "center", padding: "44px 24px", borderRadius: 24, background: "#fff", boxShadow: "0 18px 60px rgba(0,0,0,.10)" }}>
          <div style={{ width: 112, height: 112, margin: "0 auto 22px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#16a34a", color: "#fff", fontSize: 72, fontWeight: 900 }}>✓</div>
          <h1 style={{ margin: "0 0 10px", fontSize: "clamp(28px, 5vw, 42px)", color: "#15803d" }}>Delivery Note Submitted</h1>
          <p>Saved successfully as one transaction.</p>
          {submitted.deliveryNoteNo && <p><b>Delivery Note:</b> {submitted.deliveryNoteNo}</p>}
          {submitted.transactionId && <p><b>Transaction:</b> {submitted.transactionId}</p>}
          <p style={{ marginTop: 18, opacity: .68 }}>Returning to Staff Dashboard…</p>
        </div>
      </div>
    </div>;
  }

  return <div className="dnv-shell">
    <header className="dnv-head"><button className="dnv-back" onClick={onBack}><ArrowLeft size={18}/> Back</button><div><span>05 / DELIVERY NOTES</span><h1>Azure AI Vision Receiving</h1><p>{branchCode} · {branch?.name || branch?.BranchName || "BART Branch"}</p></div><div className="dnv-badge"><FileScan size={18}/> AZURE OCR</div></header>

    <div style={{ margin: "14px 0 18px", padding: "14px 18px", borderRadius: 14, background: scanLimitReached ? "#fff1f2" : "#f0fdf4", border: `1px solid ${scanLimitReached ? "#fecdd3" : "#bbf7d0"}` }}>
      <b>{scanUsage.loading ? "Checking today's scan allowance…" : `Daily Delivery Note scans: ${scanUsage.used} / ${scanUsage.limit} used · ${scanUsage.remaining} remaining`}</b>
      <div style={{ marginTop: 5, fontSize: 14 }}>{scanLimitReached ? "Daily scan limit reached. Contact the IT Team for more queries." : "You have a maximum of 3 Delivery Note OCR scans available per day. Each page/rescan uses one scan."}</div>
    </div>

    <section className="dnv-grid">
      <div className="dnv-card"><h2>1. Scan delivery-note pages</h2><p>Scan Page 1 first. If the delivery note has another page, add it before submitting. All pages stay in ONE transaction.</p>
        <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
        <button className="dnv-primary" disabled={scanUsage.loading || scanLimitReached} onClick={() => inputRef.current?.click()}><Camera size={18}/> {pages.length ? "+ Scan Another Page (Optional)" : "Take / choose Page 1"}</button>
        {pendingPreview && <><img className="dnv-preview" src={pendingPreview} alt="Pending delivery note page"/><button className="dnv-scan" disabled={busy || scanUsage.loading || scanLimitReached} onClick={scanPage}>{busy ? <Loader2 className="dnv-spin" size={18}/> : <RefreshCcw size={18}/>} Scan & Add Page {pages.length + 1}</button></>}
        {!!pages.length && <div className="dnv-pages"><div className="dnv-pages-head"><FilePlus2 size={17}/><b>{pages.length} page(s) scanned · {rows.length} items</b></div>{pages.map(p=><div className="dnv-page" key={p.pageNo}><span>Page {p.pageNo} · {p.itemCount} items</span><button onClick={()=>removePage(p.pageNo)} title="Remove this page"><Trash2 size={15}/> Remove</button></div>)}</div>}
      </div>

      <div className="dnv-card"><h2>2. Delivery details</h2><label>Delivery Note No<input value={note.deliveryNoteNo} onChange={e=>setNote({...note,deliveryNoteNo:e.target.value})}/></label><label>Delivery Date<input type="date" value={note.deliveryDate} onChange={e=>setNote({...note,deliveryDate:e.target.value})}/></label><label>Supplier<input value={note.supplier} onChange={e=>setNote({...note,supplier:e.target.value})}/></label><label>Submitted By<input value={note.submittedBy} onChange={e=>setNote({...note,submittedBy:e.target.value})}/></label><div className="dnv-stats"><b>{rows.length}</b><span>items detected</span><b>{unresolved}</b><span>need review</span></div></div>
    </section>

    {(message || error) && <div className={`dnv-msg ${error ? "bad" : "ok"}`}>{error ? <TriangleAlert size={18}/> : <CheckCircle2 size={18}/>} {error || message}</div>}

    {pages.length > 0 && <section className="dnv-table-card" style={{marginTop:20,background:"#fff",border:"1px solid #e2e8f0"}}>
      <div className="dnv-title"><div><h2>Detected Delivery Note — Original Document Review</h2><p>Each printed product row is reconstructed as one editable row. Compare ORDERED and DELIVERED with the photographed paper. Arabic text is excluded from item cells.</p></div></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"12px 0"}}>
        {pages.map((p,i)=><button key={p.pageNo} type="button" onClick={()=>setPreviewPage(i)} style={{padding:"9px 14px",borderRadius:8,border:"1px solid #cbd5e1",background:previewPage===i?"#dbeafe":"#fff",cursor:"pointer"}}>View Original Page {p.pageNo}</button>)}
      </div>
      {pages[previewPage] && <details><summary style={{cursor:"pointer",fontWeight:700}}>Compare with original photographed page {pages[previewPage].pageNo}</summary><img src={pages[previewPage].preview} alt={`Original document page ${pages[previewPage].pageNo}`} style={{display:"block",width:"100%",maxWidth:700,maxHeight:850,objectFit:"contain",margin:"12px auto",borderRadius:10}}/></details>}
      <p style={{marginTop:12,fontSize:13,color:"#64748b"}}>Rows marked REVIEW require your verification. Crossed-out rows stay visible until you delete them. Editing a quantity directly in the table changes the value that will be submitted.</p>
    </section>}

    {rows.length > 0 && previewApproved && <section className="dnv-table-card"><div className="dnv-title"><div><h2>3. Editable Delivery Note — Verify & confirm</h2><p>One physical product row becomes one editable item. Validate ORDERED and DELIVERED against the original photo; fill unreadable handwriting manually.</p></div><button className="dnv-submit" disabled={busy || unresolved > 0} onClick={submit}><Save size={18}/> Submit ONE Transaction</button></div>
      <div style={{display:"flex",gap:12,alignItems:"center",margin:"12px 0"}}>
        <b>Detected format: {documentType === "STOCK_DOCUMENT" ? "BART Stock Document" : "Delivery Note"}</b>
        <button type="button" className="dnv-primary" onClick={addManualRow}>+ Add Item Manually</button>
      </div>
      <div className="dnv-table-wrap"><table>
        <thead><tr><th>#</th><th>Page</th><th>SKU</th><th>English Item</th>
        {documentType === "STOCK_DOCUMENT" ? <><th>Detailed Qty (Shelf#)</th><th>Expire Date</th><th>Quantity</th></> : <><th>ORDERED</th><th>DELIVERED</th></>}
        <th>Match</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={r.rowId || i} className={r.status === "CONFIRMED" ? "confirmed" : "review"}>
          <td>{i+1}</td><td>P{r.pageNo || 1}</td>
          <td className="dnv-sku"><input value={r.sku || ""} onChange={e=>updateRow(i,"sku",e.target.value)} title="Exact SKU lookup from branch Stocks"/></td>
          <td className="dnv-item"><input value={r.item || ""} onChange={e=>updateRow(i,"item",e.target.value)}/><small>{r.crossedOut ? "⚠ Possible crossed-out item — verify / delete. " : ""}OCR: {r.ocrText}</small></td>
          {documentType === "STOCK_DOCUMENT" ? <>
            <td className="dnv-quantity"><textarea rows={2} value={r.detailedQty || ""} onChange={e=>updateRow(i,"detailedQty",e.target.value)}/></td>
            <td className="dnv-quantity"><textarea rows={2} value={r.expireDate || ""} onChange={e=>updateRow(i,"expireDate",e.target.value)}/></td>
            <td className="dnv-quantity"><textarea rows={2} value={r.quantity || ""} onChange={e=>updateRow(i,"quantity",e.target.value)}/></td>
          </> : <>
            <td className="dnv-quantity"><textarea rows={2} value={r.ordered || ""} title={r.ordered || ""} ref={autoGrowDeliveryField} onInput={e=>autoGrowDeliveryField(e.currentTarget)} onChange={e=>updateRow(i,"ordered",e.target.value)} style={{overflow:"hidden",resize:"vertical",whiteSpace:"pre-wrap"}}/></td>
            <td className="dnv-quantity"><textarea rows={2} value={r.delivered || ""} title={r.delivered || ""} ref={autoGrowDeliveryField} onInput={e=>autoGrowDeliveryField(e.currentTarget)} onChange={e=>updateRow(i,"delivered",e.target.value)} style={{overflow:"hidden",resize:"vertical",whiteSpace:"pre-wrap"}}/></td>
          </>}
          <td>{r.match || "REVIEW"}<small>{r.score ? ` ${Math.round(r.score*100)}%` : ""}</small></td>
          <td>{r.status === "CONFIRMED" ? <span className="dnv-ok">CONFIRMED</span> : <span className="dnv-warn">REVIEW</span>}</td>
          <td><div style={{display:"flex",gap:6,alignItems:"center"}}><button type="button" disabled={busy || r.status === "CONFIRMED"} onClick={() => confirmRow(i)} style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:8,padding:"9px 10px",fontWeight:700}}>✓ Confirm</button><button type="button" disabled={busy} onClick={() => deleteRow(i)} title="Delete this item" style={{background:"#fee2e2",color:"#b91c1c",border:"1px solid #fecaca",borderRadius:8,padding:"9px 12px",fontWeight:700}}>🗑 Delete</button></div></td>
        </tr>)}</tbody></table></div>
    </section>}
  </div>;
}
