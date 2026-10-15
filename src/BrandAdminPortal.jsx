import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck, LockKeyhole, Eye, EyeOff } from 'lucide-react';

// Read-only administration: uses the existing HttpOnly DAM admin session.
// Never requests branch passwords or accepts arbitrary spreadsheet IDs.
export default function BrandAdminPortal({brand,onBack}) {
  const name = String(brand || '').toUpperCase();
  const [authenticated,setAuthenticated] = useState(false);
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [data,setData] = useState(null);

  async function requestJson(path,options) {
    const response = await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
    const result = await response.json().catch(()=>({}));
    if (!response.ok || result.success === false) throw new Error(result.message || `Request failed (${response.status})`);
    return result;
  }
  async function loadOverview() {
    setBusy(true);setError('');
    try { setData(await requestJson(`/api/admin/${brand}/overview`)); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(()=>{
    let live=true;
    requestJson('/api/admin/bart/session').then(d=>{
      if (!live)return;
      setAuthenticated(Boolean(d.authenticated));
    }).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  },[brand]);
  useEffect(()=>{if(authenticated)loadOverview()},[authenticated,brand]);
  async function login(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      await requestJson('/api/admin/bart/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      setPassword('');setAuthenticated(true);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const style={minHeight:'100vh',padding:'clamp(20px,4vw,60px)',background:'linear-gradient(145deg,#061326,#0a2850)',color:'#e9f5ff',fontFamily:'Inter,system-ui,sans-serif'};
  const panel={maxWidth:1100,margin:'0 auto'};
  const card={border:'1px solid #255079',borderRadius:18,padding:22,background:'#0b2545'};
  const button={border:'1px solid #3a80c4',borderRadius:10,background:'#12457c',color:'#fff',padding:'12px 18px',cursor:'pointer'};
  return <main style={style}>
    <div style={panel}>
      <button type="button" onClick={onBack} style={button}><ArrowLeft size={16} style={{verticalAlign:'middle'}}/> All brands</button>
      <div style={{margin:'32px 0 22px'}}>
        <p style={{color:'#70d8ff',letterSpacing:3,fontSize:12}}>DAM UNITED / ADMINISTRATION</p>
        <h1 style={{fontSize:'clamp(30px,5vw,56px)',margin:'10px 0'}}>{name} Command Center</h1>
        <p style={{color:'#bad3ea'}}>Live branch inventory overview · protected by the existing admin session</p>
      </div>
      {error && <div role="alert" style={{...card,borderColor:'#e7a65a',marginBottom:18}}>{error}</div>}
      {loading ? <p>Checking admin access…</p> : !authenticated ?
        <form onSubmit={login} style={{...card,maxWidth:470}}>
          <h2><LockKeyhole size={20} style={{verticalAlign:'middle'}}/> Admin authentication</h2>
          <p>Enter the existing DAM admin password to continue.</p>
          <label htmlFor="brand-admin-password">Admin password</label>
          <div style={{display:'flex',gap:8,margin:'12px 0'}}>
            <input id="brand-admin-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" style={{flex:1,minWidth:0,padding:12,borderRadius:8}}/>
            <button type="button" aria-label="Toggle password visibility" onClick={()=>setShowPassword(v=>!v)} style={button}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
          </div>
          <button disabled={busy} style={button}>{busy?'Signing in…':'Enter admin portal'}</button>
        </form> : <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:22}}>
            <p><ShieldCheck size={18} style={{verticalAlign:'middle',color:'#66e1cc'}}/> Authorized admin · read-only overview</p>
            <button type="button" disabled={busy} onClick={loadOverview} style={button}><RefreshCw size={16} style={{verticalAlign:'middle'}}/> Refresh</button>
          </div>
          {data && <>
            <div style={{...card,marginBottom:20}}><div style={{fontSize:13,color:'#9ec8e8'}}>Active branch directory</div><strong style={{fontSize:36}}>{data.branchCount}</strong><p style={{color:'#9ec8e8'}}>Branch records sourced from {name} master sheet</p></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>
              {(data.branches||[]).map(branch=><div key={branch.code} style={card}>
                <strong style={{color:'#79d8ff'}}>{branch.code}</strong>
                <h3 style={{margin:'10px 0'}}>{branch.name}</h3>
                <p style={{color:'#c6e1f2'}}>Stock catalog entries: {branch.stockItems ?? 'Unavailable'}</p>
                {branch.error && <small style={{color:'#ffc78b'}}>{branch.error}</small>}
              </div>)}
            </div>
            <p style={{marginTop:24,color:'#a5c3da'}}>Inventory overview is read-only. Existing stock submission, transfers and delivery note transactions remain in the staff modules. Additional administrative write operations require separate workflow validation.</p>
          </>}
        </>}
    </div>
  </main>;
}
