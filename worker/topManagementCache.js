// BART Delivery Note Page only. In-memory request coalescing; no D1/R2/KV.
const inflight=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const iso=value=>{const s=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
const number=v=>{const s=String(v??'').replace(/,/g,'').trim();return s!==''&&Number.isFinite(Number(s))?Number(s):null};
function itemsFromCell(cell){return String(cell??'').split('\n').flatMap(line=>{const m=line.match(/^\s*\d+\.\s*([^|]*)\|\s*([^|]*)/);if(!m)return [];const field=k=>{const hit=line.match(new RegExp('(?:^|\\|)\\s*'+k+'\\s*:\\s*([^|]*)','i'));return hit?hit[1].trim():''};return [{sku:m[1].trim(),item:m[2].trim(),uom:field('UOM'),ordered:number(field('ORDERED')),delivered:number(field('DELIVERED'))??number(field('RECEIVED')),quantity:number(field('QTY')),raw:line}];});}
function parse(rows){const out=[];for(const row of rows.slice(1)){const date=iso(row[4]);if(!date)continue;out.push({timestamp:String(row[0]??''),transactionId:String(row[1]??''),branch:String(row[2]??''),deliveryNoteNo:String(row[3]??''),date,supplier:String(row[5]??''),pages:number(row[6]),totalItems:number(row[7]),items:itemsFromCell(row[8]),submittedBy:String(row[9]??''),orderType:String(row[11]??'').trim()||'Uncategorized'});}return out;}
const once=(key,fn)=>{if(inflight.has(key))return inflight.get(key);const p=Promise.resolve().then(fn).finally(()=>inflight.delete(key));inflight.set(key,p);return p};
export async function cacheAction(path,input,env,deps){
 if(path.endsWith('/directory'))return once('directory',async()=>{try{return json({success:true,directory:[{brand:'bart',branches:await deps.branches(env,'bart')}]})}catch(e){return json({success:false,message:String(e.message||e)},502)}});
 if(path.endsWith('/branch')){const code=String(input.branch||'').toUpperCase();if(!/^B\d{3,4}$/.test(code)||String(input.brand||'bart').toLowerCase()!=='bart')return json({success:false,message:'Invalid BART branch'},400);
 return once('bart:'+code,async()=>{try{const branches=await deps.branches(env,'bart');const branch=branches.find(b=>String(b.code).toUpperCase()===code);if(!branch)return json({success:false,message:'Branch not in BART directory'},404);const sheetId=branch.sheetId||branch.sheet_id;if(!sheetId)throw Error('Spreadsheet ID missing');const rows=await deps.read(env,sheetId,"'Delivery Note'!A:L");return json({success:true,data:{brand:'bart',branch:{code:branch.code,name:branch.name},notes:parse(rows),updatedAt:new Date().toISOString()}})}catch(e){return json({success:false,message:String(e.message||e)},502)}});
 }
 return json({success:false,message:'Unknown operation'},404);
}
