import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Cpu,
  FileImage,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import "./BartDeliveryNotesAI.css";
import {
  extractJson,
  normalizeResult,
  rowNeedsReview,
  validateNote,
} from "./delivery-ai-utils";

const EMPTY_NOTE = {
  deliveryNote: "",
  shippingDate: "",
  source: "",
  destination: "",
  items: [],
};

export default function BartDeliveryNotesAI({ branch, onBack }) {
  const inputRef = useRef(null);
  const workerRef = useRef(null);
  const objectUrlRef = useRef(null);

  const [device, setDevice] = useState({ checking: true, webgpu: false, adapter: "" });
  const [modelState, setModelState] = useState("idle");
  const [modelProgress, setModelProgress] = useState(null);
  const [status, setStatus] = useState("Waiting for a delivery-note photo.");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [rawOutput, setRawOutput] = useState("");
  const [note, setNote] = useState(EMPTY_NOTE);
  const [error, setError] = useState("");
  const [scanMs, setScanMs] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!navigator.gpu) {
          if (alive) setDevice({ checking: false, webgpu: false, adapter: "" });
          return;
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!alive) return;
        if (!adapter) {
          setDevice({ checking: false, webgpu: false, adapter: "" });
          return;
        }
        let adapterName = "WebGPU adapter ready";
        try {
          const info = adapter.info;
          if (info?.device || info?.description) adapterName = info.device || info.description;
        } catch (_) {}
        setDevice({ checking: false, webgpu: true, adapter: adapterName });
      } catch (_) {
        if (alive) setDevice({ checking: false, webgpu: false, adapter: "" });
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("./delivery-ai.worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === "status") setStatus(msg.message || "Working…");
      if (msg.type === "model-progress") {
        setModelState("loading");
        if (typeof msg.percent === "number") setModelProgress(msg.percent);
      }
      if (msg.type === "model-ready") {
        setModelState("ready");
        setModelProgress(100);
        setStatus("Local AI ready. Choose or take a photo.");
      }
      if (msg.type === "stream") setRawOutput(msg.text || "");
      if (msg.type === "result") {
        setScanMs(msg.elapsedMs ?? null);
        setRawOutput(msg.text || "");
        try {
          const parsed = normalizeResult(extractJson(msg.text || ""));
          setNote(parsed);
          setStatus(`Scan completed. ${parsed.items.length} product row(s) extracted.`);
          setModelState("ready");
        } catch (e) {
          setError(e.message || "Could not parse the AI result.");
          setStatus("AI finished, but the result needs manual review.");
          setModelState("ready");
        }
      }
      if (msg.type === "error") {
        setError(msg.message || "Local AI error");
        setModelState("error");
        setStatus("Local AI could not complete this scan.");
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const warnings = useMemo(() => validateNote(note), [note]);
  const reviewCount = useMemo(() => note.items.filter(rowNeedsReview).length, [note.items]);
  const isScanning = modelState === "scanning";

  function loadModel() {
    setError("");
    if (!device.webgpu) {
      setError("This browser/device does not expose WebGPU. Test with a current Chrome/Edge desktop first.");
      return;
    }
    setModelState("loading");
    setStatus("Downloading/preparing the local vision model…");
    workerRef.current?.postMessage({ type: "load" });
  }

  function selectFile(selected) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(selected);
    objectUrlRef.current = url;
    setFile(selected);
    setPreview(url);
    setRawOutput("");
    setNote(EMPTY_NOTE);
    setScanMs(null);
    setConfirmed(false);
    setError("");
    setStatus("Photo ready. Tap Scan with local AI.");
  }

  async function scan() {
    if (!file || !workerRef.current) return;
    if (!device.webgpu) {
      setError("WebGPU is not available on this device/browser.");
      return;
    }
    setError("");
    setRawOutput("");
    setNote(EMPTY_NOTE);
    setConfirmed(false);
    setModelState("scanning");
    setStatus("Preparing image…");
    const buffer = await file.arrayBuffer();
    workerRef.current.postMessage(
      { type: "scan", arrayBuffer: buffer, mimeType: file.type },
      [buffer]
    );
  }

  function reset() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(null);
    setPreview("");
    setRawOutput("");
    setNote(EMPTY_NOTE);
    setError("");
    setScanMs(null);
    setConfirmed(false);
    setStatus("Waiting for a delivery-note photo.");
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateHeader(key, value) {
    setNote((n) => ({ ...n, [key]: value }));
    setConfirmed(false);
  }

  function updateItem(id, key, value) {
    setNote((n) => ({
      ...n,
      items: n.items.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]: key.toLowerCase().includes("qty")
                ? value === "" ? null : Number(value)
                : value,
              needsReview: false,
            }
          : row
      ),
    }));
    setConfirmed(false);
  }

  function addRow() {
    setNote((n) => ({
      ...n,
      items: [
        ...n.items,
        {
          id: `manual-${Date.now()}`,
          sku: "",
          product: "",
          orderedQty: null,
          orderedUom: "",
          orderedSize: "",
          deliveredQty: null,
          deliveredUom: "",
          deliveredSize: "",
          needsReview: true,
        },
      ],
    }));
  }

  function removeRow(id) {
    setNote((n) => ({ ...n, items: n.items.filter((row) => row.id !== id) }));
    setConfirmed(false);
  }

  function submitTest() {
    if (!confirmed) return;
    const payload = {
      branchCode: branch?.code || "",
      branchName: branch?.name || "",
      ...note,
      scanner: "local-vlm-smolvlm-256m",
      scanMs,
      submittedAt: new Date().toISOString(),
    };
    console.log("DAM LOCAL AI TEST PAYLOAD", payload);
    alert("TEST MODE: Verified result prepared successfully. Nothing was sent to the backend. Check Console for payload.");
  }

  return (
    <div className="dai-page">
      <header className="dai-topbar">
        <button className="dai-icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div>
          <div className="dai-eyebrow">DAM OPERATIONS · LOCAL AI TEST</div>
          <h1>Delivery Note Vision Scanner</h1>
          <p>{branch?.name || branch?.code || "Selected branch"}</p>
        </div>
        <div className={`dai-device ${device.webgpu ? "ok" : "bad"}`}>
          <Cpu size={17} /> {device.checking ? "Checking…" : device.webgpu ? "WebGPU Ready" : "No WebGPU"}
        </div>
      </header>

      <main className="dai-shell">
        <section className="dai-hero">
          <div>
            <div className="dai-pill"><Sparkles size={15} /> No API key · Local browser AI</div>
            <h2>Take a photo. AI reads it on this device.</h2>
            <p>The image is processed locally by a vision-language model. This v1 page is intentionally TEST MODE so we can measure accuracy and speed before connecting it to your real submission flow.</p>
          </div>
          <BrainCircuit className="dai-brain" size={72} />
        </section>

        {!device.checking && !device.webgpu && (
          <div className="dai-alert warning">
            <TriangleAlert size={20} />
            <div><strong>WebGPU is unavailable here.</strong><span>Use a current Chrome/Edge desktop for the first test. Phone support must be proven device-by-device before rollout.</span></div>
          </div>
        )}

        {error && (
          <div className="dai-alert error"><TriangleAlert size={20} /><div><strong>Scanner error</strong><span>{error}</span></div></div>
        )}

        <section className="dai-grid">
          <div className="dai-card capture-card">
            <div className="dai-card-head"><div><span>STEP 1</span><h3>Photo</h3></div>{file && <button className="dai-text-btn" onClick={reset}><X size={16}/> Clear</button>}</div>

            {!preview ? (
              <button className="dai-drop" onClick={() => inputRef.current?.click()}>
                <Camera size={38} />
                <strong>Take photo / choose image</strong>
                <span>JPG, PNG, WEBP</span>
              </button>
            ) : (
              <div className="dai-preview-wrap"><img src={preview} alt="Delivery note preview" /></div>
            )}

            <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => selectFile(e.target.files?.[0])} />

            <div className="dai-actions">
              {modelState !== "ready" && modelState !== "scanning" && (
                <button className="dai-secondary" onClick={loadModel} disabled={!device.webgpu || modelState === "loading"}>
                  <BrainCircuit size={18}/> {modelState === "loading" ? "Loading model…" : "Prepare local AI"}
                </button>
              )}
              <button className="dai-primary" onClick={scan} disabled={!file || !device.webgpu || isScanning || modelState === "loading"}>
                {isScanning ? <RefreshCw className="spin" size={18}/> : <FileImage size={18}/>} {isScanning ? "Scanning…" : "Scan with local AI"}
              </button>
            </div>

            {(modelState === "loading" || modelProgress !== null) && (
              <div className="dai-progress"><div><span>AI model</span><strong>{modelProgress ?? 0}%</strong></div><progress max="100" value={modelProgress ?? 0}/></div>
            )}
            <div className="dai-status">{status}{scanMs ? ` · ${Math.round(scanMs / 1000)} sec` : ""}</div>
          </div>

          <div className="dai-card result-card">
            <div className="dai-card-head"><div><span>STEP 2</span><h3>AI Result</h3></div>{note.items.length > 0 && <div className="dai-row-count">{note.items.length} rows</div>}</div>

            {!note.items.length && !rawOutput ? (
              <div className="dai-empty"><BrainCircuit size={40}/><strong>No result yet</strong><span>Scan a real DAM delivery note to test the local model.</span></div>
            ) : (
              <>
                <div className="dai-fields">
                  <label>Delivery Note<input value={note.deliveryNote} onChange={(e)=>updateHeader("deliveryNote",e.target.value)} /></label>
                  <label>Shipping Date<input value={note.shippingDate} onChange={(e)=>updateHeader("shippingDate",e.target.value)} /></label>
                  <label>Source<input value={note.source} onChange={(e)=>updateHeader("source",e.target.value)} /></label>
                  <label>Destination<input value={note.destination} onChange={(e)=>updateHeader("destination",e.target.value)} /></label>
                </div>

                <div className="dai-summary">
                  <span className={reviewCount ? "warn" : "good"}>{reviewCount ? `${reviewCount} need review` : "All extracted rows complete"}</span>
                  {warnings.length > 0 && <span>{warnings.length} validation warning(s)</span>}
                </div>

                <div className="dai-table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>SKU / Product</th><th>Ordered</th><th>Delivered</th><th></th></tr></thead>
                    <tbody>
                      {note.items.map((row, index) => (
                        <tr key={row.id} className={rowNeedsReview(row) ? "needs-review" : ""}>
                          <td>{index + 1}</td>
                          <td><input className="sku" value={row.sku} onChange={(e)=>updateItem(row.id,"sku",e.target.value.toUpperCase())}/><input value={row.product} onChange={(e)=>updateItem(row.id,"product",e.target.value)}/></td>
                          <td><div className="triple"><input type="number" step="any" value={row.orderedQty ?? ""} onChange={(e)=>updateItem(row.id,"orderedQty",e.target.value)}/><input value={row.orderedUom} onChange={(e)=>updateItem(row.id,"orderedUom",e.target.value.toUpperCase())}/><input value={row.orderedSize} placeholder="size" onChange={(e)=>updateItem(row.id,"orderedSize",e.target.value.toUpperCase())}/></div></td>
                          <td><div className="triple"><input type="number" step="any" value={row.deliveredQty ?? ""} onChange={(e)=>updateItem(row.id,"deliveredQty",e.target.value)}/><input value={row.deliveredUom} onChange={(e)=>updateItem(row.id,"deliveredUom",e.target.value.toUpperCase())}/><input value={row.deliveredSize} placeholder="size" onChange={(e)=>updateItem(row.id,"deliveredSize",e.target.value.toUpperCase())}/></div></td>
                          <td><button className="dai-delete" onClick={()=>removeRow(row.id)}><X size={16}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="dai-add-row" onClick={addRow}>+ Add missing physical row</button>

                <details className="dai-debug"><summary>Raw local AI output</summary><pre>{rawOutput || "No raw output"}</pre></details>
              </>
            )}
          </div>
        </section>

        {note.items.length > 0 && (
          <section className="dai-card verify-card">
            <div><ShieldCheck size={28}/><div><h3>Staff verification</h3><p>Local AI is not trusted blindly. Compare every row with the paper before confirming.</p></div></div>
            <label className="dai-confirm"><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)}/><span>I checked the header and every physical product row.</span></label>
            <button className="dai-primary submit" disabled={!confirmed} onClick={submitTest}><CheckCircle2 size={18}/> Prepare test payload</button>
          </section>
        )}
      </main>
    </div>
  );
}
