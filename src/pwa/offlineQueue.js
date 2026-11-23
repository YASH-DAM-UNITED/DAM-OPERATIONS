// Device-local queue. No Cloudflare D1, KV or R2 calls.
const DB_NAME='dam-offline-v1', STORE='pending-stock';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function tx(mode,work){const db=await openDB();try{return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE),r=work(s);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.onerror=()=>reject(t.error);});}finally{db.close();}}
export async function listPending(){return tx('readonly',s=>s.getAll());}
export async function enqueueStock(endpoint,payload){if(!['/api/staff/bart/stock-record/submit'].includes(endpoint))throw Error('Unsupported offline operation');const id=crypto.randomUUID();await tx('readwrite',s=>s.put({id,endpoint,payload,createdAt:new Date().toISOString(),status:'pending'}));window.dispatchEvent(new Event('dam-queue-changed'));return id;}
export async function discardPending(id){await tx('readwrite',s=>s.delete(id));window.dispatchEvent(new Event('dam-queue-changed'));}
let running=false;
export async function syncPending(){if(running||!navigator.onLine)return;running=true;try{for(const item of await listPending()){if(item.status==='review')continue;try{const res=await fetch(item.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-DAM-Offline-Transaction':item.id},body:JSON.stringify(item.payload)});const body=await res.json().catch(()=>({}));if(res.ok&&body.success){await discardPending(item.id);}else{await tx('readwrite',s=>s.put({...item,status:'review',error:body.message||`HTTP ${res.status}`}));window.dispatchEvent(new Event('dam-queue-changed'));}}catch{break;}}}finally{running=false;}}
// Explicit user action is preferred to prevent accidental duplicate submissions.
