import {useState} from 'react';
import {ArrowLeft, LockKeyhole, Search, Plus, Save} from 'lucide-react';
import './BartItemManagement.css';

const upper=v=>String(v||'').toUpperCase().trimStart();
const title=v=>String(v||'').replace(/\b[a-z]/g,x=>x.toUpperCase());
const UOMS=['PCS','Gram','ML'];
async function api(path,token,body){
  const res=await fetch('/api/staff/bart/items/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Bart-Items-Token':token||''},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.success){const error=new Error(data.message||`Request failed (${res.status})`);error.duplicate=data.duplicate;throw error;}
  return data;
}
export default function BartItemManagement({branch,onBack}){
  const [item,setItem]=useState(''),[sku,setSku]=useState(''),[uom,setUom]=useState('');
  const [mode,setMode]=useState('add'),[password,setPassword]=useState(''),[adminToken,setAdminToken]=useState('');
  const [branches,setBranches]=useState([]),[catalog,setCatalog]=useState([]),[selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[search,setSearch]=useState('');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[results,setResults]=useState([]);
  const token=mode==='alter'?adminToken:branch?.staffToken;
  const alert=(message,type='error')=>{setNotice({message,type});window.scrollTo({top:0,behavior:'smooth'});};
  async function getBranches(t){const d=await api('branches',t);setBranches(d.branches);return d.branches;}
  async function loadAll(t,bs){
    const combined=new Map(),fail=[];
    for(const b of bs){
      try{const d=await api('branch?code='+encodeURIComponent(b.code),t);for(const x of d.items){const key=upper(x.sku);if(!key)continue;const old=combined.get(key);if(!old)combined.set(key,{...x,branches:[b.code]});else old.branches.push(b.code);}}
      catch(e){fail.push(`${b.code}: ${e.message}`);}
    }
    if(fail.length)alert('Could not read '+fail.length+' branches. Please retry before altering: '+fail.join('; '));
    setCatalog([...combined.values()].sort((a,b)=>a.item.localeCompare(b.item)));
    return fail.length===0;
  }
  async function unlock(){
    setBusy(true);setNotice(null);
    try{const d=await api('admin-login','',{password});setAdminToken(d.token);setPassword('');const bs=await getBranches(d.token);await loadAll(d.token,bs);alert('Admin access unlocked. Search and select an item.','success');}
    catch(e){alert(e.message);}finally{setBusy(false);}
  }
  async function apply(){
    const isAlter=mode==='alter';
    if(!isAlter&&(!item.trim()||!sku.trim()||!uom)){alert('Item Name, SKU and UOM are required.');return;}
    if(isAlter&&!selected){alert('Select an item to alter.');return;}
    const changes={};if(isAlter){for(const key of ['item','sku','uom'])if(draft[key]!==selected[key])changes[key]=draft[key];if(!Object.keys(changes).length){alert('No changes detected.');return;}}
    setBusy(true);setResults([]);setNotice(null);
    try{
      const bs=branches.length?branches:await getBranches(token);
      // Global preflight: read each branch before ANY write. One branch per Worker request.
      const failures=[],existing=[];
      for(const b of bs){
        try{const d=await api('branch?code='+encodeURIComponent(b.code),token);existing.push({branch:b,items:d.items});}
        catch(e){failures.push(`${b.code}: ${e.message}`);}
      }
      if(failures.length)throw Error('Preflight failed. No changes made: '+failures.join('; '));
      const nextSku=upper(isAlter?draft.sku:sku),nextName=(isAlter?draft.item:item).trim().toUpperCase();
      const conflicts=existing.filter(({branch:b,items})=>items.some(x=>(upper(x.sku)===nextSku||x.item.trim().toUpperCase()===nextName)&&(!isAlter||upper(x.sku)!==upper(selected.sku)))).map(x=>x.branch.code);
      if(conflicts.length)throw Error('Item Already Added! Duplicate SKU or name found in '+conflicts.join(', ')+'.');
      if(!window.confirm(`Apply ${isAlter?'alteration':'new item'} to ${bs.length} BART branch sheets? Existing rows will not be overwritten.`))return;
      const done=[];
      for(const {branch:b} of existing){
        try{const payload=isAlter?{code:b.code,mode:'alter',originalSku:selected.sku,original:{item:selected.item,uom:selected.uom},changes}:{code:b.code,mode:'add',item:{item:title(item.trim()),sku:upper(sku.trim()),uom}};
          const d=await api('apply',token,payload);done.push({code:b.code,status:d.status});}
        catch(e){done.push({code:b.code,status:'FAILED: '+e.message});}
        setResults([...done]);
      }
      const failed=done.filter(x=>x.status.startsWith('FAILED'));
      if(failed.length)alert(`${done.length-failed.length} branches updated; ${failed.length} failed. Review the results before retrying.`);
      else{alert(`Successfully updated all ${done.length} BART branches.`,'success');if(isAlter){setSelected(null);setDraft(null);await loadAll(token,bs);}else{setItem('');setSku('');setUom('');}}
    }catch(e){alert(e.message);}finally{setBusy(false);}
  }
  const matches=catalog.filter(x=>(x.item+' '+x.sku).toLowerCase().includes(search.toLowerCase())).slice(0,100);
  return <main className="bart-items">
    <div className="bart-items-head"><button onClick={onBack} className="bart-items-back"><ArrowLeft size={18}/> Back</button><h1>Add Items to Branch</h1><p>BART • Google Sheets stock master</p></div>
    {notice&&<div role="alert" className={'bart-items-alert '+notice.type}>{notice.message}<button onClick={()=>setNotice(null)} aria-label="Dismiss">×</button></div>}
    <section className="bart-items-panel">
      <div className="bart-items-tabs"><button className={mode==='add'?'active':''} onClick={()=>{setMode('add');setNotice(null);}}><Plus size={16}/> Add Items</button><button className={mode==='alter'?'active':''} onClick={()=>{setMode('alter');setNotice(null);}}><LockKeyhole size={16}/> Alter Items</button></div>
      {mode==='add'?<><p>New items will be inserted at row 80 in every BART branch's Stocks tab.</p><label>Item Name *<input value={item} onChange={e=>setItem(title(e.target.value))} maxLength={180} placeholder="Enter item name"/></label><label>SKU *<input value={sku} onChange={e=>setSku(upper(e.target.value))} maxLength={60} placeholder="e.g. P450"/></label><label>UOM *<select value={uom} onChange={e=>setUom(e.target.value)}><option value="">Select UOM</option>{UOMS.map(v=><option key={v}>{v}</option>)}</select></label><button className="bart-items-primary" disabled={busy||!branch?.staffToken||!item.trim()||!sku.trim()||!uom} onClick={apply}>{busy?'Processing…':'Submit Item to All BART Branches'}</button></>:
      !adminToken?<><p>Enter the admin-only password configured in Cloudflare.</p><label>Alter Items Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&unlock()}/></label><button className="bart-items-primary" disabled={busy||!password} onClick={unlock}>{busy?'Verifying…':'Unlock Alter Items'}</button></>:
      <><label>Search item name or SKU<div className="bart-items-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all BART items"/></div></label><div className="bart-items-results">{matches.map(x=><button key={x.sku} className={selected?.sku===x.sku?'selected':''} onClick={()=>{setSelected(x);setDraft({item:x.item,sku:x.sku,uom:x.uom});}}><strong>{x.item}</strong><span>{x.sku} · {x.uom||'No UOM'} · {x.branches.length} branches</span></button>)}</div>{selected&&<div className="bart-items-editor"><h3>Alter selected item</h3><p>Original SKU: {selected.sku}</p><label>Item Name<input value={draft.item} onChange={e=>setDraft({...draft,item:title(e.target.value)})}/></label><label>SKU<input value={draft.sku} onChange={e=>setDraft({...draft,sku:upper(e.target.value)})}/></label><label>UOM<select value={draft.uom} onChange={e=>setDraft({...draft,uom:e.target.value})}><option value="">Select UOM</option>{UOMS.map(v=><option key={v}>{v}</option>)}</select></label><button className="bart-items-primary" disabled={busy||!draft.item.trim()||!draft.sku.trim()||!draft.uom} onClick={apply}><Save size={16}/> {busy?'Processing…':'Save Changes to All BART Branches'}</button></div>}</>}
      {busy&&<p aria-live="polite">Please keep this page open until all branches finish.</p>}
      {results.length>0&&<div className="bart-items-results-report"><h3>Branch results ({results.length})</h3>{results.map(r=><p key={r.code}><strong>{r.code}</strong> — {r.status}</p>)}</div>}
    </section>
  </main>;
}
