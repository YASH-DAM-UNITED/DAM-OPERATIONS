import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck, LockKeyhole, Eye, EyeOff, CalendarDays, LogOut, Sun, Moon } from 'lucide-react';
import StreamlitReportPage from './StreamlitReportPage.jsx';
import './BrandAdminPortal.css';

// GLOR and MOOMA share BART's read-only Streamlit report component.
// Their stock reads are performed only by brand-specific admin API endpoints.
const yesterdayJeddah = () => new Date(Date.now() + 3 * 3600000 - 86400000).toISOString().slice(0, 10);

export default function BrandAdminPortal({brand,onBack}) {
  const brandKey = String(brand || '').toLowerCase();
  const name = brandKey.toUpperCase();
  const supported = brandKey === 'glor' || brandKey === 'mooma';
  const [theme,setTheme] = useState(() => {
    try { const v=localStorage.getItem(`dam-${brandKey}-admin-theme`); if(v==='light'||v==='dark')return v; return localStorage.getItem('dam-admin-theme')==='light'?'light':'dark'; }
    catch { return 'dark'; }
  });
  useEffect(()=>{try{localStorage.setItem(`dam-${brandKey}-admin-theme`,theme)}catch{}},[brandKey,theme]);
  const [authenticated,setAuthenticated] = useState(false);
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [checking,setChecking] = useState(true);
  const [loading,setLoading] = useState(false);
  const [historicalLoading,setHistoricalLoading] = useState(false);
  const [error,setError] = useState('');
  const [data,setData] = useState(null);
  const [historical,setHistorical] = useState(null);
  const [date,setDate] = useState(yesterdayJeddah);
  const [range,setRange] = useState(()=>({start:yesterdayJeddah(),end:yesterdayJeddah()}));

  const requestJson = useCallback(async (path,options) => {
    const response = await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
    const result = await response.json().catch(()=>({}));
    if (!response.ok || result.success === false) {
      const message = result.message || `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return result;
  },[]);

  const loadInventory = useCallback(async (force=false) => {
    if (!supported) return;
    setLoading(true);setError('');
    try {
      const result = await requestJson(`/api/admin/${brandKey}/inventory?date=${encodeURIComponent(date)}${force?'&force=1':''}`);
      setData(result);
    } catch(e) {
      setError(e.message);
      if (e.status===401) setAuthenticated(false);
    } finally { setLoading(false); }
  },[brandKey,date,requestJson,supported]);

  const loadHistorical = useCallback(async (force=false) => {
    if (!supported || !range.start || !range.end || range.start>range.end) return;
    setHistoricalLoading(true);setError('');
    try {
      const result = await requestJson(`/api/admin/${brandKey}/date-range?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}${force?'&force=1':''}`);
      setHistorical(result);
    } catch(e) {
      setError(e.message);
      if (e.status===401) setAuthenticated(false);
    } finally { setHistoricalLoading(false); }
  },[brandKey,range,requestJson,supported]);

  useEffect(()=>{
    let live=true;
    setChecking(true);
    requestJson('/api/admin/bart/session')
      .then(d=>{if(live)setAuthenticated(Boolean(d.authenticated));})
      .catch(e=>{if(live)setError(e.message);})
      .finally(()=>{if(live)setChecking(false);});
    return ()=>{live=false};
  },[brandKey,requestJson]);

  useEffect(()=>{
    if(authenticated)loadInventory();
  },[authenticated,loadInventory]);

  async function login(event) {
    event.preventDefault();setLoading(true);setError('');
    try {
      await requestJson('/api/admin/bart/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      setPassword('');setAuthenticated(true);
    } catch(e) {setError(e.message);} finally {setLoading(false);}
  }
  async function logout() {
    try {await requestJson('/api/admin/bart/logout',{method:'POST'});} catch(e) {setError(e.message);return;}
    setAuthenticated(false);setData(null);setHistorical(null);
  }
  if (!supported) return <main className="brand-report-root"><p>Unsupported brand.</p></main>;

  return <main className={`brand-report-root theme-${theme}`} data-brand={brandKey}>
    <div className="brand-report-wrap">
      <header className="brand-report-topbar">
        <button type="button" onClick={onBack} className="brand-report-btn"><ArrowLeft size={17}/> All brands</button>
        <div className="brand-report-title"><span>DAM UNITED / ADMINISTRATION</span><h1>{name} Streamlit Reports</h1><p>Brand-isolated inventory and stock movement reporting</p></div>
        <button type="button" className="brand-report-btn" onClick={()=>setTheme(v=>v==='dark'?'light':'dark')} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>} {theme==='dark'?'Light mode':'Dark mode'}</button>
        {authenticated && <button type="button" onClick={logout} className="brand-report-btn"><LogOut size={16}/> Sign out</button>}
      </header>
      {error && <div role="alert" className="brand-report-error">{error}</div>}
      {checking ? <p>Checking admin access…</p> : !authenticated ?
        <form onSubmit={login} className="brand-report-login">
          <h2><LockKeyhole size={20}/> Admin authentication</h2>
          <p>Use your existing DAM Admin password.</p>
          <label htmlFor="brand-admin-password">Admin password</label>
          <div className="brand-report-password"><input id="brand-admin-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/><button type="button" aria-label="Show or hide password" onClick={()=>setShowPassword(v=>!v)} className="brand-report-btn">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
          <button disabled={loading} className="brand-report-btn brand-report-primary">{loading?'Signing in…':'Enter admin portal'}</button>
        </form> : <>
          <div className="brand-report-controls">
            <span className="brand-report-authorized"><ShieldCheck size={17}/> Authorized admin · read-only</span>
            <label><CalendarDays size={16}/> Stock date <input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <button className="brand-report-btn" disabled={loading} onClick={()=>loadInventory(true)}><RefreshCw size={16}/> {loading?'Loading…':'Sync fresh stock'}</button>
          </div>
          {loading && !data && <p>Loading {name} stock records…</p>}
          {data && <StreamlitReportPage key={brandKey} brand={name} data={data} date={date} historical={historical} historicalLoading={historicalLoading} range={range} setRange={setRange} loadHistorical={loadHistorical}/>}
        </>}
    </div>
  </main>;
}
