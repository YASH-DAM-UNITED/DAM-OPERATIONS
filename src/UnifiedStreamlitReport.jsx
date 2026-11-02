import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, AlertTriangle, CalendarDays, CheckCircle2, Download, FileSpreadsheet, LockKeyhole, LogOut, Moon, RefreshCw, Save, Search, Sun, Trash2 } from 'lucide-react';
import StreamlitReportPage from './StreamlitReportPage.jsx';
import './UnifiedStreamlitReport.css';

const BRANDS = ['bart','glor','mooma'];
const STORAGE_SELECTIONS = 'dam-v3-unified-report-presets';
const YESTERDAY = () => new Date(Date.now() + 3*3600000 - 86400000).toISOString().slice(0,10);
const identity = r => `${r.schedule}\u001f${r.sku}\u001f${r.name}`;
const getSaved = () => { try { const value=JSON.parse(localStorage.getItem(STORAGE_SELECTIONS)||'{}'); return value && typeof value==='object' && !Array.isArray(value) ? value : {}; } catch { return {}; } };
const initialTheme = () => { try { return localStorage.getItem('dam-unified-report-theme') === 'light' || localStorage.getItem('dam-admin-theme') === 'light' ? 'light':'dark'; } catch { return 'dark'; } };
const safeQuantity = raw => { if(raw === '' || raw === null || raw === undefined) return null; const value=Number(String(raw).replace(/,/g,'')); return Number.isFinite(value) ? value : null; };
const displayQuantity = n => n === null ? '—' : new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
function normalize(payload) {
  const branches=(payload?.branches||[]).map(b=> typeof b==='string'?{code:'',name:b}:{code:String(b.code||''),name:String(b.name||b.BranchName||'')}).filter(b=>b.name);
  const rows=[['Daily',payload?.daily],['Weekly',payload?.weekly]].flatMap(([schedule,list])=>(Array.isArray(list)?list:[]).map(raw=>{
    const row={schedule,sku:String(raw.sku??raw.SKU??'').trim(),name:String(raw.itemName??raw['Item Name']??'').trim(),uom:String(raw.uom??raw.UOM??'').trim(),values:{}};
    for(const branch of branches) row.values[branch.name]=safeQuantity(raw.branches?.[branch.name] ?? raw[branch.name]);
    return row;
  }).filter(r=>r.name||r.sku));
  return {branches,rows};
}
function getSelection(rows, keys) {const selected=new Set(keys||[]);return rows.filter(r=>selected.has(identity(r))).sort((a,b)=>a.sku.localeCompare(b.sku,undefined,{numeric:true})||a.name.localeCompare(b.name));}
function buildReport(XLSX, date, snapshots, selections) {
  const book=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([]);
  const humanDate=new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
  const border={top:{style:'thin',color:{rgb:'B7C4D4'}},bottom:{style:'thin',color:{rgb:'B7C4D4'}},left:{style:'thin',color:{rgb:'B7C4D4'}},right:{style:'thin',color:{rgb:'B7C4D4'}}};
  const merges=[];
  const sections=[];
  XLSX.utils.sheet_add_aoa(ws,[['REPORT 1 | STOCK REPORT'],[`Reporting Date: ${humanDate}`]],{origin:'A1'});
  let cursor=3;
  let maxCols=2;
  for(const brand of BRANDS) {
    const snap=normalize(snapshots[brand]);
    const selected=getSelection(snap.rows,selections[brand]);
    const count=selected.length+2;
    maxCols=Math.max(maxCols,count);
    const titleRow=cursor;
    XLSX.utils.sheet_add_aoa(ws,[[`${brand.toUpperCase()} STOCK REPORT | ${humanDate}`]],{origin:{r:cursor,c:0}});
    merges.push({s:{r:cursor,c:0},e:{r:cursor,c:count-1}});cursor++;
    const head=cursor;
    XLSX.utils.sheet_add_aoa(ws,[['Branch Code','Branch Name',...selected.map(r=>r.sku||'–')]],{origin:{r:cursor,c:0}});cursor++;
    for(const b of snap.branches){
      XLSX.utils.sheet_add_aoa(ws,[[b.code,b.name,...selected.map(r=>r.values[b.name])]],{origin:{r:cursor,c:0}});cursor++;
    }
    const total=cursor;
    XLSX.utils.sheet_add_aoa(ws,[['TOTAL','',...selected.map(r=>{
      const vals=snap.branches.map(b=>r.values[b.name]);
      return vals.every(v=>v!==null) ? vals.reduce((a,v)=>a+v,0) : null;
    })]],{origin:{r:cursor,c:0}});cursor++;
    sections.push({titleRow,head,total,count});
    cursor+=2;
  }
  merges.push({s:{r:0,c:0},e:{r:0,c:maxCols-1}},{s:{r:1,c:0},e:{r:1,c:maxCols-1}});
  for(const section of sections){
    const {titleRow,head,total,count}=section;
    for(let r=titleRow;r<=total;r++)for(let c=0;c<count;c++){
      const addr=XLSX.utils.encode_cell({r,c});
      if(!ws[addr])ws[addr]={t:'z'};
      const isTitle=r===titleRow;const isHead=r===head;const isTotal=r===total;
      ws[addr].s={border,alignment:{vertical:'center',horizontal:c<=1?'left':'center'},font:{name:'Aptos',sz:isTitle?15:10,bold:isTitle||isHead||isTotal,color:{rgb:isTitle||isHead?'FFFFFF':'152438'}},fill:{fgColor:{rgb:isTitle?'193A60':isHead?'345F89':isTotal?'E3EBF5':'FFFFFF'}}};
      if(typeof ws[addr].v==='number')ws[addr].z='0.##';
    }
    ws['!rows'] ||= [];ws['!rows'][titleRow]={hpt:30};ws['!rows'][head]={hpt:25};
  }
  for(const r of [0,1])for(let c=0;c<maxCols;c++){
    const addr=XLSX.utils.encode_cell({r,c});if(!ws[addr])ws[addr]={t:'z'};
    ws[addr].s={border,alignment:{vertical:'center',horizontal:'left'},font:{name:'Aptos',sz:r===0?18:12,bold:true,color:{rgb:r===0?'FFFFFF':'17385A'}},fill:{fgColor:{rgb:r===0?'193A60':'EAF1FA'}}};
  }
  ws['!merges']=merges;
  ws['!cols']=Array.from({length:maxCols},(_,i)=>({wch:i===0?16:i===1?28:15}));
  ws['!pageSetup']={orientation:'landscape',fitToWidth:1,fitToHeight:0};
  ws['!printOptions']={horizontalCentered:true};
  XLSX.utils.book_append_sheet(book,ws,'Stock Report');
  return book;
}
async function getJson(path,options) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success===false){const err=new Error(result.message||`Request failed (${response.status})`);err.status=response.status;throw err;}
  return result;
}

export default function UnifiedStreamlitReport({onBack}) {
  const [theme,setTheme]=useState(initialTheme);
  const [authenticated,setAuthenticated]=useState(false);
  const [checking,setChecking]=useState(true);
  const [password,setPassword]=useState('');
  const [date,setDate]=useState(YESTERDAY);
  const [snapshots,setSnapshots]=useState({});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [brandErrors,setBrandErrors]=useState({});
  const [selections,setSelections]=useState({bart:[],glor:[],mooma:[]});
  const [search,setSearch]=useState({bart:'',glor:'',mooma:''});
  const [presets,setPresets]=useState(getSaved);
  const [presetName,setPresetName]=useState('Daily Report 1');
  const [activeBrand,setActiveBrand]=useState('bart');
  const [detailOpen,setDetailOpen]=useState(false);
  const [ranges,setRanges]=useState({bart:{start:YESTERDAY(),end:YESTERDAY()},glor:{start:YESTERDAY(),end:YESTERDAY()},mooma:{start:YESTERDAY(),end:YESTERDAY()}});
  const [history,setHistory]=useState({});
  const [historyLoading,setHistoryLoading]=useState(false);
  const [exporting,setExporting]=useState(false);
  const requestSequence=useRef(0);
  useEffect(()=>{try{localStorage.setItem('dam-unified-report-theme',theme)}catch{}},[theme]);
  useEffect(()=>{let alive=true;getJson('/api/admin/bart/session').then(r=>{if(alive)setAuthenticated(Boolean(r.authenticated));}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setChecking(false)});return()=>{alive=false}},[]);
  const loadAll=useCallback(async(force=false)=>{
    const sequence=++requestSequence.current;
    setLoading(true);setError('');setBrandErrors({});setSnapshots({});setHistory({});
    const results=await Promise.allSettled(BRANDS.map(brand=>getJson(`/api/admin/${brand}/inventory?date=${encodeURIComponent(date)}${force?'&force=1':''}`)));
    if(sequence!==requestSequence.current)return;
    const loaded={};const failed={};
    results.forEach((result,i)=>{const brand=BRANDS[i];if(result.status==='fulfilled' && result.value.date===date)loaded[brand]=result.value;else failed[brand]=result.status==='rejected'?result.reason.message:'Reporting date mismatch';});
    setSnapshots(loaded);setBrandErrors(failed);setLoading(false);
    if(Object.keys(failed).length && results.some(r=>r.status==='rejected' && r.reason.status===401))setAuthenticated(false);
  },[date]);
  useEffect(()=>{if(authenticated)loadAll();},[authenticated,loadAll]);
  const normalized=useMemo(()=>Object.fromEntries(BRANDS.map(b=>[b,normalize(snapshots[b])])),[snapshots]);
  const picked=useMemo(()=>Object.fromEntries(BRANDS.map(b=>[b,getSelection(normalized[b].rows,selections[b])])),[normalized,selections]);
  const allReady=BRANDS.every(b=>snapshots[b] && !brandErrors[b] && !(snapshots[b].failedBranches||[]).length && normalized[b].branches.length && selections[b].length && picked[b].length===selections[b].length);
  const hasMissing=BRANDS.some(b=>picked[b].some(r=>normalized[b].branches.some(branch=>r.values[branch.name]===null)));
  const canExport=allReady&&!loading&&!hasMissing;
  const updateSelected=(brand,id)=>setSelections(old=>({...old,[brand]:old[brand].includes(id)?old[brand].filter(x=>x!==id):[...old[brand],id]}));
  async function login(e){e.preventDefault();setError('');try{await getJson('/api/admin/bart/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});setPassword('');setAuthenticated(true)}catch(e){setError(e.message)}}
  async function logout(){try{await getJson('/api/admin/bart/logout',{method:'POST'});setAuthenticated(false);setSnapshots({});setHistory({})}catch(e){setError(e.message)}}
  function savePreset(){const name=presetName.trim();if(!name)return setError('Enter a name for the saved selection.');const next={...presets,[name]:selections};try{localStorage.setItem(STORAGE_SELECTIONS,JSON.stringify(next));setPresets(next);setError('')}catch{setError('Unable to save selection in this browser.')}}
  function loadPreset(name){const p=presets[name];if(!p)return;setSelections(Object.fromEntries(BRANDS.map(b=>[b,Array.isArray(p[b])?p[b]:[]])));setPresetName(name)}
  function deletePreset(name){const next={...presets};delete next[name];try{localStorage.setItem(STORAGE_SELECTIONS,JSON.stringify(next));setPresets(next)}catch{setError('Unable to update saved selections.')}}
  async function exportReport(){if(!canExport)return;setExporting(true);setError('');try{const imported=await import('xlsx-js-style');const XLSX=imported.default||imported;const book=buildReport(XLSX,date,snapshots,selections);XLSX.writeFile(book,`Report_1_${date}_BART_GLOR_MOOMA.xlsx`,{bookType:'xlsx',compression:true})}catch(e){setError(e.message||'Excel export failed')}finally{setExporting(false)}}
  const range=ranges[activeBrand];
  async function loadHistorical(force=false){if(!range.start||!range.end||range.start>range.end)return;setHistoryLoading(true);setError('');try{const data=await getJson(`/api/admin/${activeBrand}/date-range?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}${force?'&force=1':''}`);setHistory(old=>({...old,[activeBrand]:data}))}catch(e){setError(e.message)}finally{setHistoryLoading(false)}}
  return <main className={`unified-report theme-${theme}`}>
    <div className="unified-wrap">
      <header className="unified-header"><button className="unified-button" onClick={onBack}><ArrowLeft size={17}/> All brands</button><div><span>DAM UNITED / ADMINISTRATION</span><h1>Unified Streamlit Report</h1><p>One reporting workspace for BART, GLOR and MOOMA</p></div><button className="unified-button" onClick={()=>setTheme(v=>v==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>} {theme==='dark'?'Light mode':'Dark mode'}</button>{authenticated&&<button className="unified-button" onClick={logout}><LogOut size={16}/> Sign out</button>}</header>
      {error&&<div className="unified-alert" role="alert">{error}</div>}
      {checking?<p>Checking admin access…</p>:!authenticated?<form className="unified-login" onSubmit={login}><h2><LockKeyhole size={21}/> Admin authentication</h2><p>Use your existing DAM Admin password.</p><input type="password" required autoComplete="current-password" placeholder="Admin password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="unified-primary">Sign in</button></form>:<>
        <section className="unified-toolbar"><label><CalendarDays size={17}/> Stock report date <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="unified-button" disabled={loading} onClick={()=>loadAll(true)}><RefreshCw size={16}/>{loading?'Loading all brands…':'Sync fresh data'}</button><span>The API reports the requested date; blank source quantities may be returned as zero. Check source submissions before relying on zeros. Refresh after new submissions.</span></section>
        <section className="unified-presets"><div><strong>Saved product selections</strong><p>Saved in this browser, not in Google Sheets.</p></div><input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Selection name" aria-label="Selection name"/><button className="unified-button" onClick={savePreset}><Save size={16}/> Save</button><select value="" aria-label="Load saved selection" onChange={e=>loadPreset(e.target.value)}><option value="">Load saved selection…</option>{Object.keys(presets).sort().map(n=><option key={n} value={n}>{n}</option>)}</select>{presets[presetName]&&<button className="unified-button" title="Delete named selection" onClick={()=>deletePreset(presetName)}><Trash2 size={16}/> Delete</button>}</section>
        <div className="unified-brands">
          {BRANDS.map(brand=>{
            const snap=normalized[brand];const query=search[brand].toLowerCase().trim();const filtered=snap.rows.filter(r=>`${r.sku} ${r.name} ${r.uom}`.toLowerCase().includes(query));const selected=picked[brand];const failed=snapshots[brand]?.failedBranches||[];
            return <section className="unified-brand" key={brand}>
              <div className="unified-brand-head"><div><span>INDEPENDENT PRODUCT SELECTION</span><h2>{brand.toUpperCase()} STOCK REPORT</h2><small>{snap.branches.length} branches · {snap.rows.length} items · {selected.length} selected</small></div>{snapshots[brand]&&failed.length===0?<CheckCircle2 size={21}/>:<AlertTriangle size={21}/>}</div>
              {brandErrors[brand]&&<p className="unified-alert">{brandErrors[brand]}</p>}
              {failed.length>0&&<p className="unified-alert">Incomplete data: {failed.map(b=>b.code||b.name).join(', ')}. Export disabled until resolved.</p>}
              {snapshots[brand]?.date&&<p className="unified-date">Requested stock date: <strong>{snapshots[brand].date}</strong> · Source: {snapshots[brand].source||'Admin stock API'}</p>}
              <label className="unified-search"><Search size={17}/><input value={search[brand]} onChange={e=>setSearch(old=>({...old,[brand]:e.target.value}))} placeholder={`Search ${brand.toUpperCase()} SKU or product name`} /></label>
              <div className="unified-options">{filtered.slice(0,200).map(r=><label key={identity(r)} className="unified-option"><input type="checkbox" checked={selections[brand].includes(identity(r))} onChange={()=>updateSelected(brand,identity(r))}/><strong>{r.sku||'–'}</strong><span>{r.name}</span><small>{r.schedule} · {r.uom||'UOM missing'}</small></label>)}{!filtered.length&&<p className="unified-empty">{loading?'Loading products…':'No matching items.'}</p>}{filtered.length>200&&<p className="unified-empty">Showing first 200 matches. Narrow the search to find other items.</p>}</div>
              <div className="unified-selection-footer"><span>{selected.length} selected</span><button className="unified-link" onClick={()=>setSelections(old=>({...old,[brand]:[]}))}>Clear selection</button></div>
            </section>;
          })}
        </div>
        <section className="unified-preview"><div className="unified-preview-head"><div><h2>Combined report preview</h2><p>One worksheet · Three bordered tables · Reporting date {date}</p></div><button className="unified-primary" disabled={!canExport||exporting} onClick={exportReport}><Download size={17}/>{exporting?'Preparing Excel…':'Download Combined Excel'}</button></div>
          {!canExport&&<p className="unified-alert"><AlertTriangle size={16}/> Select at least one item in each brand. All three brands, their branches and selected quantities must load successfully before export. Missing quantities are not treated as zero.</p>}
          {BRANDS.map(brand=><div className="unified-table-block" key={brand}><h3>{brand.toUpperCase()} STOCK REPORT — {date}</h3><div className="unified-scroll"><table><thead><tr><th>Branch Code</th><th>Branch Name</th>{picked[brand].map(r=><th key={identity(r)} title={r.name}>{r.sku||'–'}</th>)}</tr></thead><tbody>{normalized[brand].branches.map(b=><tr key={b.code||b.name}><th>{b.code}</th><th>{b.name}</th>{picked[brand].map(r=><td key={identity(r)}>{displayQuantity(r.values[b.name])}</td>)}</tr>)}<tr className="unified-total"><th>TOTAL</th><th></th>{picked[brand].map(r=>{const values=normalized[brand].branches.map(b=>r.values[b.name]);return <td key={identity(r)}>{values.every(v=>v!==null)?displayQuantity(values.reduce((a,b)=>a+b,0)):'—'}</td>})}</tr></tbody></table></div></div>)}
        </section>
        <section className="unified-detail"><div className="unified-preview-head"><div><h2>Detailed Streamlit reporting</h2><p>Open the original reporting tools for inventory search, categories, daily/weekly stock and date-range movement.</p></div><button className="unified-button" onClick={()=>setDetailOpen(v=>!v)}>{detailOpen?'Hide details':'Open detailed reports'}</button></div>{detailOpen&&<><div className="unified-tabs">{BRANDS.map(b=><button key={b} className={activeBrand===b?'active':''} onClick={()=>setActiveBrand(b)}>{b.toUpperCase()}</button>)}</div>{snapshots[activeBrand]&&<StreamlitReportPage key={activeBrand} brand={activeBrand.toUpperCase()} data={snapshots[activeBrand]} date={date} historical={history[activeBrand]} historicalLoading={historyLoading} range={range} setRange={v=>setRanges(old=>({...old,[activeBrand]:typeof v==='function'?v(old[activeBrand]):v}))} loadHistorical={loadHistorical}/>}</>}</section>
      </>}
    </div>
  </main>;
}
