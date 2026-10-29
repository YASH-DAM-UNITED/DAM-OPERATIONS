/**
 * BART | Streamlit Report Page
 * Data contract: receives existing BartAdminPortal inventory and historical API responses.
 * NO fetch(), no Google Sheets client, no new backend endpoint.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle, CalendarRange, Check, Download, FileSpreadsheet,
  Filter, Layers3, PackageSearch, Search, Table2, X,
} from "lucide-react";
import "./StreamlitReportPage.css";

const CATEGORIES = ["FOOD ITEMS", "DRY ITEMS", "MISC ITEMS", "UNCATEGORIZED DETECTED"];
const fmt = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n) || 0);
const asText = (v) => String(v ?? "").trim();
const asNumber = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const itemKey = (row) => [row.schedule, row.sku, row.name, row.uom].join("\u001f");
const branchNames = (payload) => (payload?.branches || []).map((b) => typeof b === "string" ? b : asText(b.name || b.BranchName)).filter(Boolean);

function normalizeItems(rows, schedule, branches) {
  return (Array.isArray(rows) ? rows : []).map((raw) => {
    // Supports the exact worker/index.js response and the older flattened UI shape.
    const name = asText(raw.itemName ?? raw["Item Name"]);
    const sku = asText(raw.sku ?? raw.SKU);
    const uom = asText(raw.uom ?? raw.UOM);
    const values = {};
    for (const b of branches) values[b] = asNumber(raw.branches?.[b] ?? raw[b]);
    return {
      name, sku, uom, schedule,
      category: CATEGORIES.includes(asText(raw.category).toUpperCase())
        ? asText(raw.category).toUpperCase() : "UNCATEGORIZED DETECTED",
      values,
      total: branches.reduce((sum, b) => sum + values[b], 0),
    };
  }).filter((row) => row.name);
}

function normalizeSnapshot(payload) {
  const branches = branchNames(payload);
  return {
    branches,
    daily: normalizeItems(payload?.daily, "Daily", branches),
    weekly: normalizeItems(payload?.weekly, "Weekly", branches),
    failed: payload?.failedBranches || [],
  };
}

function normalizeHistory(payload) {
  const branches = branchNames(payload);
  const dates = Array.isArray(payload?.dates) ? payload.dates : [];
  const byDate = {};
  for (const date of dates) {
    const raw = payload?.byDate?.[date] || {};
    byDate[date] = [
      ...normalizeItems(raw.daily, "Daily", branches),
      ...normalizeItems(raw.weekly, "Weekly", branches),
    ];
  }
  return { branches, dates, byDate, failed: payload?.failedBranches || [] };
}

function rowsForGrid(rows, branches) {
  return rows.map((row) => [row.sku, row.name, row.uom, ...branches.map((b) => row.values[b] ?? 0), row.total]);
}

const BORDER = { top: { style: "thin", color: { rgb: "D5DBE3" } }, bottom: { style: "thin", color: { rgb: "D5DBE3" } }, left: { style: "thin", color: { rgb: "D5DBE3" } }, right: { style: "thin", color: { rgb: "D5DBE3" } } };
const BASE_STYLE = { border: BORDER, alignment: { vertical: "center", horizontal: "center" }, font: { name: "Aptos", sz: 10, color: { rgb: "172333" } } };
const HEAD_STYLE = { ...BASE_STYLE, font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "243044" } } };
const TOTAL_STYLE = { ...BASE_STYLE, font: { name: "Aptos", sz: 10, bold: true, color: { rgb: "172333" } }, fill: { fgColor: { rgb: "E7EDF5" } } };

function addSheet(XLSX, book, name, matrix, opts = {}) {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const headRows = opts.headRows ?? 1;
  for (const address of Object.keys(ws)) {
    if (address.startsWith("!")) continue;
    const cell = ws[address];
    const { r } = XLSX.utils.decode_cell(address);
    cell.s = r < headRows ? HEAD_STYLE : (opts.totalRow === r ? TOTAL_STYLE : BASE_STYLE);
    if (typeof cell.v === "number") cell.z = "0.##";
  }
  ws["!cols"] = (matrix[0] || []).map((_, i) => ({ wch: i === 0 ? 22 : i === 1 ? 36 : i === 2 ? 15 : 16 }));
  ws["!rows"] = Array.from({ length: Math.min(headRows, matrix.length) }, () => ({ hpt: 24 }));
  if (opts.merges?.length) {
    ws["!merges"] = opts.merges;
    // Ensure the complete merged region has visible cell borders in Excel.
    for (const merge of opts.merges) {
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (!ws[address]) ws[address] = { t: "z" };
          ws[address].s = BASE_STYLE;
        }
      }
    }
  }
  if (opts.filter && matrix.length > headRows) {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headRows - 1, c: 0 }, e: { r: matrix.length - 1, c: (matrix[0] || []).length - 1 } }) };
  }
  XLSX.utils.book_append_sheet(book, ws, name.slice(0, 31));
}

async function downloadWorkbook(fileName, populate) {
  // Existing package.json already includes xlsx-js-style; loaded only when exporting.
  const imported = await import("xlsx-js-style");
  const XLSX = imported.default || imported;
  const book = XLSX.utils.book_new();
  populate(XLSX, book);
  XLSX.writeFile(book, fileName, { bookType: "xlsx", compression: true });
}

function snapshotExport(XLSX, book, snapshot, date) {
  const all = [...snapshot.daily, ...snapshot.weekly];
  addSheet(XLSX, book, "Dashboard Summary", [
    ["BART Inventory Executive Report", ""],
    ["Reporting Date", date],
    ["Branches", snapshot.branches.length],
    ["Daily Items", snapshot.daily.length],
    ["Weekly Items", snapshot.weekly.length],
    ["Failed Branch Reads", snapshot.failed.length],
    ["Note", "Blank/missing dates may be reported as zero by the existing backend."],
  ], { headRows: 1 });
  const table = (rows) => [["SKU", "Item Name", "UOM", ...snapshot.branches, "Total"], ...rowsForGrid(rows, snapshot.branches)];
  addSheet(XLSX, book, "Daily Items", table(snapshot.daily), { filter: true });
  addSheet(XLSX, book, "Weekly Items", table(snapshot.weekly), { filter: true });
  for (const category of CATEGORIES) {
    const rows = all.filter((row) => row.category === category).sort((a, b) => a.name.localeCompare(b.name));
    if (rows.length) addSheet(XLSX, book, category.replace(" DETECTED", ""), table(rows), { filter: true });
  }
}

function selectedExport(XLSX, book, selected, branches) {
  // Streamlit-style transposed report: 3 header rows, branches down, selected items across.
  const matrix = [
    ["", ...selected.map((row) => row.name)],
    ["", ...selected.map((row) => row.sku)],
    ["Branch Name", ...selected.map((row) => row.uom)],
    ...branches.map((b) => [b, ...selected.map((row) => row.values[b] ?? 0)]),
    ["Total", ...selected.map((row) => row.total)],
  ];
  addSheet(XLSX, book, "Selected Items", matrix, { headRows: 3, totalRow: matrix.length - 1 });
}

function dateRangeExport(XLSX, book, history, fastSkuSet) {
  const allByDate = history.byDate;
  const create = (sheetName, schedules, includeSchedule = false, filterSku = null) => {
    const unique = new Map();
    for (const date of history.dates) {
      for (const row of allByDate[date] || []) {
        if (!schedules.includes(row.schedule) || (filterSku && !filterSku.has(row.sku.toUpperCase()))) continue;
        unique.set(itemKey(row), row);
      }
    }
    const ordered = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name) || a.schedule.localeCompare(b.schedule) || a.sku.localeCompare(b.sku));
    const prefix = ["Item Name", "SKU", "UOM", ...(includeSchedule ? ["Schedule"] : []), "Date"];
    const matrix = [[...prefix, ...history.branches]];
    const merges = [];
    for (const item of ordered) {
      const first = matrix.length;
      for (const [index, date] of history.dates.entries()) {
        const row = (allByDate[date] || []).find((r) => itemKey(r) === itemKey(item));
        const descriptor = index === 0 ? [item.name, item.sku, item.uom, ...(includeSchedule ? [item.schedule] : [])] : [null, null, null, ...(includeSchedule ? [null] : [])];
        matrix.push([...descriptor, date, ...history.branches.map((b) => row?.values[b] ?? 0)]);
      }
      const last = matrix.length - 1;
      if (last > first) {
        for (let c = 0; c < (includeSchedule ? 4 : 3); c++) merges.push({ s: { r: first, c }, e: { r: last, c } });
      }
    }
    addSheet(XLSX, book, sheetName, matrix, { merges, filter: false });
  };
  create("Daily Items", ["Daily"]);
  create("Weekly Items", ["Weekly"]);
  create("Combined Items", ["Daily", "Weekly"], true);
  if (fastSkuSet.size) create("Fast Moving Items", ["Daily", "Weekly"], true, fastSkuSet);
}

function DataTable({ rows, branches, showSchedule = false, maxRows = 300 }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [reverse, setReverse] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const diff = sort === "total" ? a.total - b.total : asText(a[sort]).localeCompare(asText(b[sort]), undefined, { numeric: true });
    return reverse ? -diff : diff;
  }), [rows, sort, reverse]);
  const pages = Math.max(1, Math.ceil(sorted.length / maxRows));
  const activePage = Math.min(page, pages);
  const shown = sorted.slice((activePage - 1) * maxRows, activePage * maxRows);
  const orderBy = (key) => { setReverse(sort === key ? !reverse : false); setSort(key); setPage(1); };
  return <>
    <div className="srp-table-scroll" role="region" aria-label="Branch stock table" tabIndex={0}>
      <table className="srp-table">
        <thead><tr>
          <th><button onClick={() => orderBy("sku")}>SKU</button></th>
          <th><button onClick={() => orderBy("name")}>Item Name</button></th>
          <th>UOM</th>
          {showSchedule && <th>Schedule</th>}
          {branches.map((b) => <th key={b} title={b}>{b}</th>)}
          <th><button onClick={() => orderBy("total")}>Total</button></th>
        </tr></thead>
        <tbody>{shown.map((row) => <tr key={itemKey(row)}>
          <td>{row.sku || "—"}</td><td>{row.name}</td><td>{row.uom}</td>
          {showSchedule && <td>{row.schedule}</td>}
          {branches.map((b) => <td className={(row.values[b] ?? 0) === 0 ? "srp-zero" : ""} key={b}>{fmt(row.values[b])}</td>)}
          <td className="srp-total">{fmt(row.total)}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="srp-empty">No items found for this selection.</div>}
    </div>
    {pages > 1 && <div className="srp-pager">
      <span>Showing {(activePage - 1) * maxRows + 1}–{Math.min(activePage * maxRows, sorted.length)} of {sorted.length}</span>
      <button disabled={activePage === 1} onClick={() => setPage((v) => v - 1)}>Previous</button>
      <span>{activePage} / {pages}</span>
      <button disabled={activePage === pages} onClick={() => setPage((v) => v + 1)}>Next</button>
    </div>}
  </>;
}

function ItemPicker({ items, selected, onChange, label }) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => items.filter((row) => `${row.sku} ${row.name} ${row.uom} ${row.schedule}`.toLowerCase().includes(query.toLowerCase())).slice(0, 70), [items, query]);
  const selectedSet = new Set(selected);
  return <div className="srp-picker">
    <label className="srp-label">{label}</label>
    <div className="srp-search"><Search size={17}/><input aria-label={label} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by SKU or item name" /></div>
    <div className="srp-picker-options">
      {options.map((row) => {
        const key = itemKey(row);
        return <label key={key} className="srp-option">
          <input type="checkbox" checked={selectedSet.has(key)} onChange={() => onChange(selectedSet.has(key) ? selected.filter((v) => v !== key) : [...selected, key])}/>
          <span><b>{row.sku || "—"}</b> · {row.name} <small>{row.uom} / {row.schedule}</small></span>
        </label>;
      })}
      {!options.length && <p className="srp-note">No matching items.</p>}
    </div>
    {!!selected.length && <div className="srp-selection"><span>{selected.length} selected</span><button onClick={() => onChange([])}>Clear all <X size={13}/></button></div>}
  </div>;
}

export default function StreamlitReportPage({ data, date, historical, historicalLoading, range, setRange, loadHistorical }) {
  const snapshot = useMemo(() => normalizeSnapshot(data), [data]);
  const all = useMemo(() => [...snapshot.daily, ...snapshot.weekly], [snapshot]);
  const [section, setSection] = useState("search");
  const [chosen, setChosen] = useState([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [filter, setFilter] = useState("");
  const [fastChosen, setFastChosen] = useState([]);
  const [previewSchedule, setPreviewSchedule] = useState("Daily");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const selected = useMemo(() => all.filter((row) => chosen.includes(itemKey(row))), [all, chosen]);
  const filtered = (rows) => rows.filter((row) => `${row.name} ${row.sku} ${row.uom}`.toLowerCase().includes(filter.toLowerCase()));
  const historyReady = Boolean(historical && historical.startDate === range.start && historical.endDate === range.end);
  const history = useMemo(() => historyReady ? normalizeHistory(historical) : null, [historical, historyReady]);
  const historicalItems = useMemo(() => {
    const map = new Map();
    for (const rows of Object.values(history?.byDate || {})) for (const row of rows) map.set(itemKey(row), row);
    return [...map.values()];
  }, [history]);
  const fastSelected = historicalItems.filter((row) => fastChosen.includes(itemKey(row)));
  const fastSkus = new Set(fastSelected.map((row) => row.sku.toUpperCase()));

  const download = async (filename, writer) => {
    setExporting(true); setExportError("");
    try { await downloadWorkbook(filename, writer); }
    catch (error) { console.error("Report export failed:", error); setExportError(error?.message || "Unable to export Excel report."); }
    finally { setExporting(false); }
  };

  const historyPreview = useMemo(() => {
    if (!history) return [];
    const map = new Map();
    for (const day of history.dates) for (const row of history.byDate[day] || []) {
      if (previewSchedule !== "Combined" && row.schedule !== previewSchedule) continue;
      const key = itemKey(row);
      if (!map.has(key)) map.set(key, { ...row, values: Object.fromEntries(history.branches.map((b) => [b, 0])), total: 0 });
      const current = map.get(key);
      for (const b of history.branches) current.values[b] += row.values[b] || 0;
      current.total += row.total;
    }
    return [...map.values()];
  }, [history, previewSchedule]);

  return <div className="srp-page">
    <div className="srp-heading"><div><span className="srp-eyebrow">BART / REPORTING WORKSPACE</span><h2>Streamlit Report Page</h2><p>Streamlit-style inventory reports powered by the existing DAM Operations Admin data.</p></div><div className="srp-date"><CalendarRange size={17}/> Snapshot: {date}</div></div>
    <div className="srp-stats">
      <div><span>BRANCHES</span><strong>{snapshot.branches.length}</strong></div>
      <div><span>DAILY ITEMS</span><strong>{snapshot.daily.length}</strong></div>
      <div><span>WEEKLY ITEMS</span><strong>{snapshot.weekly.length}</strong></div>
      <div><span>FAILED BRANCHES</span><strong>{snapshot.failed.length}</strong></div>
    </div>
    {snapshot.failed.length > 0 && <div className="srp-warning"><AlertTriangle size={17}/> Some branches could not be loaded: {snapshot.failed.map((b) => b.name || b.code || b).join(", ")}. Reports may be incomplete.</div>}
    <div className="srp-note srp-notice">The DAM backend currently treats missing dates and blank/invalid quantities as zero. Verify source submissions before interpreting zeros as confirmed stock.</div>
    <nav className="srp-tabs" aria-label="Streamlit reports">
      {[["search", "Global Inventory Search", Search], ["category", "Category Overview", Layers3], ["stock", "Daily / Weekly Stock", Table2], ["excel", "Live Excel Report", FileSpreadsheet], ["range", "Date Range Movement", CalendarRange]].map(([key, label, Icon]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={16}/>{label}</button>)}
    </nav>

    {section === "search" && <section className="srp-panel">
      <div className="srp-section-head"><div><h3>Global Inventory Search</h3><p>Select multiple SKUs or item names, compare stock across all BART branches, and export a transposed Excel file.</p></div><PackageSearch size={22}/></div>
      <ItemPicker items={all} selected={chosen} onChange={setChosen} label="Choose inventory items" />
      {!!selected.length && <><div className="srp-toolbar"><span>{selected.length} selected item(s)</span><button className="srp-primary" disabled={exporting} onClick={() => download(`BART_Selected_Items_Transposed_${date}.xlsx`, (XLSX, book) => selectedExport(XLSX, book, selected, snapshot.branches))}><Download size={16}/> Download Transposed Excel</button></div><DataTable rows={selected} branches={snapshot.branches}/></>}
    </section>}

    {section === "category" && <section className="srp-panel">
      <div className="srp-section-head"><div><h3>Category-Wise Stock Overview</h3><p>Categories are taken from the existing BART backend SKU classification.</p></div><Filter size={22}/></div>
      <div className="srp-category-tabs">{CATEGORIES.map((c) => <button className={category === c ? "active" : ""} onClick={() => setCategory(c)} key={c}>{c} <span>{all.filter((row) => row.category === c).length}</span></button>)}</div>
      <div className="srp-toolbar"><div className="srp-search srp-filter"><Search size={16}/><input aria-label="Filter category items" placeholder="Filter items in this category" value={filter} onChange={(e) => setFilter(e.target.value)}/></div></div>
      <DataTable key={category} rows={filtered(all.filter((row) => row.category === category))} branches={snapshot.branches} showSchedule/>
    </section>}

    {section === "stock" && <section className="srp-panel">
      <div className="srp-section-head"><div><h3>Daily & Weekly Stock</h3><p>Inventory quantities from the selected Admin snapshot date.</p></div><Table2 size={22}/></div>
      <div className="srp-toolbar"><div className="srp-search srp-filter"><Search size={16}/><input aria-label="Filter stock items" placeholder="Search SKU or item name" value={filter} onChange={(e) => setFilter(e.target.value)}/></div></div>
      <h4>Daily Items Stock ({snapshot.daily.length})</h4><DataTable rows={filtered(snapshot.daily)} branches={snapshot.branches}/>
      <h4>Weekly Items Stock ({snapshot.weekly.length})</h4><DataTable rows={filtered(snapshot.weekly)} branches={snapshot.branches}/>
    </section>}

    {section === "excel" && <section className="srp-panel">
      <div className="srp-section-head"><div><h3>Inventory Insights — Live Excel</h3><p>Download the selected-date inventory in a bordered, multi-worksheet Excel workbook.</p></div><FileSpreadsheet size={22}/></div>
      <div className="srp-export-description"><Check size={17}/> Dashboard Summary, Daily Items, Weekly Items, Food, Dry, Misc and any Uncategorized items.</div>
      <button className="srp-primary" disabled={exporting || !all.length} onClick={() => download(`BART_Report_${date}.xlsx`, (XLSX, book) => snapshotExport(XLSX, book, snapshot, date))}><Download size={17}/> Generate LIVE Report into Excel</button>
    </section>}

    {section === "range" && <section className="srp-panel">
      <div className="srp-section-head"><div><h3>Date Range Stock Movement Report</h3><p>Uses the existing Admin date-range endpoint and backend cache, without a separate Google Sheets integration. Maximum 93 days per request.</p></div><CalendarRange size={22}/></div>
      <form className="srp-range-form" onSubmit={(e) => { e.preventDefault(); if (range.start && range.end && range.start <= range.end && (Math.round((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000) + 1) <= 93) loadHistorical(false); }}>
        <label>From Date<input required type="date" value={range.start} onChange={(e) => setRange((prev) => ({ ...prev, start: e.target.value }))}/></label>
        <label>To Date<input required type="date" value={range.end} onChange={(e) => setRange((prev) => ({ ...prev, end: e.target.value }))}/></label>
        <button className="srp-primary" disabled={historicalLoading || !range.start || !range.end || range.start > range.end || ((Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000 + 1 > 93)} type="submit">{historicalLoading ? "Loading historical data..." : "Generate Date Range Report"}</button>
      </form>
      {range.start > range.end && <div className="srp-warning">From Date cannot be after To Date.</div>}
      {range.start <= range.end && (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000 + 1 > 93 && <div className="srp-warning">Select a date range of 93 days or fewer.</div>}
      {history && <>
        <div className="srp-range-meta"><span>{history.dates.length} dates</span><span>{history.branches.length} branches</span><span>{history.failed.length} failed branch reads</span></div>
        {history.failed.length > 0 && <div className="srp-warning"><AlertTriangle size={17}/> Incomplete historical data: {history.failed.map((b) => b.name || b.code || b).join(", ")}</div>}
        <h4>Fast Moving Items — Optional SKU Selection</h4>
        <p className="srp-note">Choose any SKUs to include in an additional “Fast Moving Items” worksheet. This is a selected-item report, not a calculated sales velocity ranking.</p>
        <ItemPicker items={historicalItems} selected={fastChosen} onChange={setFastChosen} label="Select SKUs for Fast Moving Items sheet"/>
        <div className="srp-toolbar"><span>Historical report ready: {historical.startDate} to {historical.endDate}</span><button className="srp-primary" disabled={exporting || !history.dates.length} onClick={() => download(`BART_Stock_Movement_${range.start}_${range.end}.xlsx`, (XLSX, book) => dateRangeExport(XLSX, book, history, fastSkus))}><Download size={16}/> Download Date Range Stock Report</button></div>
        <div className="srp-category-tabs">{["Daily", "Weekly", "Combined"].map((v) => <button className={previewSchedule === v ? "active" : ""} onClick={() => setPreviewSchedule(v)} key={v}>{v} Preview</button>)}</div>
        <p className="srp-note">Preview totals sum daily stock snapshots across the date range; they are not stock consumption or sales figures. Download Excel for date-by-date values.</p>
        <DataTable key={previewSchedule + range.start + range.end} rows={historyPreview} branches={history.branches} showSchedule={previewSchedule === "Combined"}/>
      </>}
      {!history && !historicalLoading && <p className="srp-note">Choose dates and click Generate to load the historical report. Previously loaded ranges can be reused when available.</p>}
    </section>}
    {exportError && <div className="srp-warning" role="alert"><AlertTriangle size={17}/>{exportError}</div>}
  </div>;
}
