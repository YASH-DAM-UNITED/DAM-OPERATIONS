// Top Management ONLY: isolate-local memory cache. Never accesses D1, R2 or KV.
// A browser retains its own snapshot for the current page session.
const snapshots = new Map();
const inflight = new Map();
let directoryCache = null;
let refreshedAt = null;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const iso=v=>{const s=String(v??'').trim();if(/^\d{4}-\d\d-\d\d/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;};
function unpackStock(rows){const header=rows[0]||[];const dates=header.map((h,i)=>({date:iso(h),i})).filter(x=>x.i>=3&&x.date);const result=[];for(const row of rows.slice(1)){const item=String(row[0]??'').trim(),sku=String(row[1]??'').trim();if(!item||!sku||/^(DAILY ITEM|WEEKLY ITEM|ITEM|TOTAL)$/i.test(item))continue;for(const d of dates){const quantity=num(row[d.i]);if(quantity!==null)result.push({sku,item,uom:String(row[2]??''),date:d.date,quantity});}}return result;}
function itemsFromCell(cell){const out=[];for(const line of String(cell??'').split(/\n/)){const match=line.match(/^\s*\d+\.\s*([^|]*)\|\s*([^|]*)/);if(!match)continue;const field=k=>{const m=line.match(new RegExp('(?:^|\\|)\\s*'+k+'\\s*:\\s*([^|]*)','i'));return m?m[1].trim():'';};out.push({sku:match[1].trim(),item:match[2].trim(),received:num(field('RECEIVED'))??num(field('DELIVERED')),ordered:num(field('ORDERED')),uom:field('UOM')});}return out;}
function unpackDN(rows){const result=[],seen=new Set();for(const row of rows.slice(1)){const date=iso(row[4]);if(!date)continue;const items=itemsFromCell(row[8]);if(!items.length)continue;const timestamp=String(row[0]??''),transactionId=String(row[1]??''),deliveryNoteNo=String(row[3]??'');const key=transactionId||[deliveryNoteNo,date,timestamp].join('|');if(seen.has(key))continue;seen.add(key);result.push({date,timestamp,transactionId,deliveryNoteNo,items});}return result;}
function once(key,fn){if(inflight.has(key))return inflight.get(key);const p=Promise.resolve().then(fn).finally(()=>inflight.delete(key));inflight.set(key,p);return p;}
export async function cacheAction(path,input,env,deps){
 if(path.endsWith('/status'))return json({success:true,status:{lastRefresh:refreshedAt,branches:snapshots.size,scope:'worker-isolate-memory'}});
 if(path.endsWith('/directory')){
  return once('directory',async()=>{try{const brands=['bart','glor','mooma'];const directory=await Promise.all(brands.map(async brand=>({brand,branches:await deps.branches(env,brand)})));directoryCache=directory;return json({success:true,directory});}catch(e){return json({success:false,message:String(e.message||e)},502);}});
 }
 if(path.endsWith('/branch')){
  const brand=String(input.brand||'').toLowerCase(),branchCode=String(input.branch||'').toUpperCase();
  if(!['bart','glor','mooma'].includes(brand)||!/^([BGM])\d{3,4}$/.test(branchCode))return json({success:false,message:'Invalid brand or branch.'},400);
  const known=directoryCache?.find(d=>d.brand===brand)?.branches;
  // Worker isolates do not share memory. Resolve directory independently if necessary.
  const branchList=known||await deps.branches(env,brand);
  const branch=branchList.find(b=>String(b.code).toUpperCase()===branchCode);
  if(!branch)return json({success:false,message:'Branch directory is unavailable on this Worker instance. Reload the directory and retry.'},409);
  const sheetId=branch.sheetId||branch.sheet_id;if(!sheetId)return json({success:false,message:'Missing spreadsheet ID for '+branchCode},422);
  const key=brand+':'+branchCode;
  return once('branch:'+key,async()=>{
   try{
    // Two sheet reads per branch, per HTTP invocation. A failed DN read is flagged, never treated as zero.
    const [stockResult,dnResult]=await Promise.allSettled([deps.read(env,sheetId,'Stocks!A:ZZ'),deps.read(env,sheetId,"'Delivery Note'!A:L")]);
    if(stockResult.status!=='fulfilled')throw Error('Stocks: '+String(stockResult.reason?.message||stockResult.reason));
    const payload={brand,branch:{code:branch.code,name:branch.name},stocks:unpackStock(stockResult.value),notes:dnResult.status==='fulfilled'?unpackDN(dnResult.value):[],notesAvailable:dnResult.status==='fulfilled',notesError:dnResult.status==='rejected'?String(dnResult.reason?.message||dnResult.reason):null,updatedAt:new Date().toISOString()};
    snapshots.set(key,payload);refreshedAt=payload.updatedAt;
    return json({success:true,data:payload});
   }catch(e){return json({success:false,message:String(e.message||e),retainedPrevious:snapshots.has(key)},502);}
  });
 }
 if(path.endsWith('/cached-branch')){const key=String(input.brand||'').toLowerCase()+':'+String(input.branch||'').toUpperCase();const data=snapshots.get(key);return data?json({success:true,data}):json({success:false,message:'Not cached in this Worker instance.'},404);}
 return json({success:false,message:'Unknown Top Management operation.'},404);
}
