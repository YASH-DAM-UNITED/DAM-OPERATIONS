// Shared persistent D1 cache. Only explicit /refresh contacts Google Sheets.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const iso=v=>{const s=String(v??'').trim();if(/^\d{4}-\d\d-\d\d/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;};
const norm=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,' ');
const prev=d=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10);};
const tableSQL=`CREATE TABLE IF NOT EXISTS tm_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`;
async function init(db){await db.prepare(tableSQL).run();}
async function get(db,key){const r=await db.prepare('SELECT payload,updated_at FROM tm_cache WHERE cache_key=?').bind(key).first();return r?{data:JSON.parse(r.payload),updatedAt:r.updated_at}:null;}
async function put(db,key,data){await db.prepare('INSERT INTO tm_cache(cache_key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(key,JSON.stringify(data),new Date().toISOString()).run();}
function itemsFromCell(cell){const lines=String(cell??'').split(/\n/),out=[];for(const line of lines){const match=line.match(/^\s*\d+\.\s*([^|]*)\|\s*([^|]*)/);if(!match)continue;const field=k=>{const m=line.match(new RegExp('(?:^|\\|)\\s*'+k+'\\s*:\\s*([^|]*)','i'));return m?m[1].trim():'';};out.push({sku:match[1].trim(),item:match[2].trim(),received:num(field('RECEIVED'))??num(field('DELIVERED')),ordered:num(field('ORDERED')),uom:field('UOM')});}return out;}
function unpackStock(rows){const header=rows[0]||[];const dates=header.map((h,i)=>({date:iso(h),i})).filter(x=>x.i>=3&&x.date);const result=[];for(const row of rows.slice(1)){const item=String(row[0]??'').trim(),sku=String(row[1]??'').trim();if(!item||!sku||/^(DAILY ITEM|WEEKLY ITEM|ITEM|TOTAL)$/i.test(item))continue;for(const d of dates){const quantity=num(row[d.i]);if(quantity!==null)result.push({sku,item,uom:String(row[2]??''),date:d.date,quantity});}}return result;}
function unpackDN(rows){const result=[];for(const row of rows.slice(1)){const date=iso(row[4]);if(!date)continue;const lines=itemsFromCell(row[8]);if(lines.length)result.push({date,timestamp:String(row[0]??''),transactionId:String(row[1]??''),deliveryNoteNo:String(row[3]??''),items:lines});}return result;}
async function concurrent(items,limit,fn){let cursor=0;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;try{out[i]=await fn(items[i]);}catch(e){out[i]={error:String(e?.message||e)};}}}));return out;}
async function status(db){const state=await get(db,'state');return state?.data||{lastRefresh:null,branches:0,failed:[],refreshing:false};}
export async function cacheAction(path,input,env,deps){const db=env.DB;if(!db)return json({success:false,message:'Cloudflare D1 binding DB is required.'},503);await init(db);
 if(path.endsWith('/status'))return json({success:true,status:await status(db)});
 if(path.endsWith('/refresh')){
   // Atomic DB lock prevents simultaneous users from starting independent refreshes.
   const now=Date.now();const lock=await db.prepare("INSERT INTO tm_cache(cache_key,payload,updated_at) VALUES('refresh-lock',?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE CAST(json_extract(tm_cache.payload,'$.until') AS INTEGER) < ?").bind(JSON.stringify({until:now+10*60*1000}),new Date().toISOString(),now).run();
   if(!lock.meta?.changes)return json({success:false,message:'A shared refresh is already running.'},409);
   try{
     const brands=['bart','glor','mooma'];const directory=await Promise.all(brands.map(async brand=>({brand,branches:await deps.branches(env,brand)})));
     const jobs=directory.flatMap(d=>d.branches.map(branch=>({brand:d.brand,branch})));
     const unique=[...new Map(jobs.map(j=>[j.brand+':'+j.branch.code,j])).values()];
     const results=await concurrent(unique,3,async job=>{const {brand,branch}=job;const sheetId=branch.sheetId||branch.sheet_id;if(!sheetId)throw Error('Missing spreadsheet ID');const [stocks,notes]=await Promise.all([deps.read(env,sheetId,'Stocks!A:ZZ'),deps.read(env,sheetId,"'Delivery Note'!A:L")]);const payload={brand,branch:{code:branch.code,name:branch.name,sheetId},stocks:unpackStock(stocks),notes:unpackDN(notes)};await put(db,'branch:'+brand+':'+branch.code,payload);return {brand,branch:branch.code,ok:true};});
     const failed=results.map((r,i)=>r.error?{brand:unique[i].brand,branch:unique[i].branch.code,error:r.error}:null).filter(Boolean);
     await put(db,'directory',directory);
     const state={lastRefresh:new Date().toISOString(),branches:unique.length,loaded:results.length-failed.length,failed,refreshing:false,estimatedGoogleCalls:unique.length*2};await put(db,'state',state);return json({success:true,status:state});
   }catch(e){return json({success:false,message:'Refresh failed; previous cache retained: '+String(e.message||e)},500);}finally{await db.prepare("DELETE FROM tm_cache WHERE cache_key='refresh-lock'").run();}
 }
 const directory=await get(db,'directory');if(!directory)return json({success:false,message:'Cache is empty. Click Refresh All Data once.'},409);
 if(path.endsWith('/branches'))return json({success:true,directory:directory.data,status:await status(db)});
 if(!path.endsWith('/report'))return json({success:false,message:'Unknown operation'},404);
 const start=iso(input.start),end=iso(input.end);if(!start||!end||start>end||Date.parse(end)-Date.parse(start)>366*86400000)return json({success:false,message:'Invalid reporting dates.'},400);
 const brands=(Array.isArray(input.brands)?input.brands:[]).filter(b=>['bart','glor','mooma'].includes(b));if(!brands.length)return json({success:false,message:'Select a brand.'},400);
 const selected=new Set((input.branches||[]).map(norm)),selectedItems=new Set((input.items||[]).map(norm));
 const jobs=directory.data.filter(d=>brands.includes(d.brand)).flatMap(d=>d.branches.filter(b=>!selected.size||selected.has(norm(b.code))).map(b=>({brand:d.brand,branch:b})));
 const results=[];for(const job of jobs){const cached=await get(db,'branch:'+job.brand+':'+job.branch.code);if(!cached){results.push({brand:job.brand,branch:job.branch.code,errors:['No cached snapshot for this branch']});continue;}
 const raw=cached.data,stocks=raw.stocks.filter(s=>s.date>=prev(start)&&s.date<=end&&(!selectedItems.size||selectedItems.has(norm(s.sku)))),notes=raw.notes.filter(n=>n.date>=start&&n.date<=end).map(n=>({...n,items:n.items.filter(i=>!selectedItems.size||selectedItems.has(norm(i.sku)))})).filter(n=>n.items.length);
 const skuMap=new Map();for(const s of stocks){const key=norm(s.sku);if(!skuMap.has(key))skuMap.set(key,{sku:s.sku,item:s.item,uom:s.uom,daily:{},opening:null,closing:null,receiving:0,receivingStatus:'complete'});skuMap.get(key).daily[s.date]=s.quantity;}
 for(const note of notes)for(const i of note.items){const key=norm(i.sku);if(!skuMap.has(key))skuMap.set(key,{sku:i.sku,item:i.item,uom:i.uom,daily:{},opening:null,closing:null,receiving:0,receivingStatus:'complete'});const target=skuMap.get(key);if(i.received===null)target.receivingStatus='missing received quantity';else target.receiving+=i.received;}
 const summary=[...skuMap.values()].map(s=>({...s,opening:s.daily[prev(start)]??null,closing:s.daily[end]??null})).sort((a,b)=>a.sku.localeCompare(b.sku,undefined,{numeric:true}));results.push({brand:job.brand,branch:job.branch.code,branchName:job.branch.name,stocks,notes,summary,updatedAt:cached.updatedAt,errors:[]});}
 return json({success:true,start,end,openingDate:prev(start),results,status:await status(db),notice:'Opening: prior day; Closing: To Date; Receiving: sum of received quantities from Delivery Notes. Other fields pending.'});
}
