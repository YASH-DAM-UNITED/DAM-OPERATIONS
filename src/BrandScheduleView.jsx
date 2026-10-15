import React,{useEffect,useState} from 'react';
import {ArrowLeft,RefreshCw} from 'lucide-react';
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export default function BrandScheduleView({brand,branch,onBack}) {
  const code=String(branch?.code||branch?.branchCode||'').toUpperCase();
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  async function load() {
    setLoading(true);setError('');
    try {
      const response=await fetch(`/api/${brand}/schedule/init?branch=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}`,{cache:'no-store'});
      const json=await response.json().catch(()=>({}));
      if(!response.ok||json.success===false)throw new Error(json.message||'Could not load staff schedule.');
      setData(json);
    }catch(e){setError(e.message);setData(null)}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[brand,code,date]);
  const button={border:'1px solid #3076bb',background:'#174476',color:'white',padding:'10px 16px',borderRadius:9,cursor:'pointer'};
  return <main style={{minHeight:'100vh',background:'#071a31',color:'#eef7ff',padding:'clamp(15px,3vw,38px)'}}>
    <div style={{maxWidth:1250,margin:'auto'}}>
      <button onClick={onBack} style={button}><ArrowLeft size={15} style={{verticalAlign:'middle'}}/> Dashboard</button>
      <h1>{brand.toUpperCase()} Staff Schedule</h1>
      <p>{code} — {branch?.name||''} · Read-only weekly schedule</p>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',margin:'22px 0'}}>
        <label htmlFor="schedule-date">Week containing</label>
        <input id="schedule-date" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{padding:10,borderRadius:8}}/>
        <button onClick={load} disabled={loading} style={button}><RefreshCw size={15} style={{verticalAlign:'middle'}}/> Refresh</button>
      </div>
      {error && <p role="alert" style={{color:'#ffd6a0'}}>{error}</p>}
      {loading ? <p>Loading schedule…</p> : data && <>
        <p>{data.employees?.length||0} employees · {data.submitted?'Shifts available':'No shifts submitted for this week'}</p>
        <div style={{overflowX:'auto',border:'1px solid #26547b',borderRadius:12}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:950}}>
            <thead><tr>{['Employee ID','Name','Role',...DAYS,'Overtime'].map(x=><th key={x} style={{padding:12,textAlign:'left',background:'#10375c'}}>{x}</th>)}</tr></thead>
            <tbody>{(data.employees||[]).map((e,i)=><tr key={e.employeeId||i}>{[e.employeeId,e.name,e.role,...DAYS.map(d=>e.shifts?.[d]||''),e.overtime].map((v,j)=><td key={j} style={{padding:12,borderTop:'1px solid #26547b'}}>{v||'—'}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  </main>;
}
