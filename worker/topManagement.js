import { cacheAction } from './topManagementCache.js';
// Read-only BART delivery-note reporting; no management password required.
export async function handleTopManagement(request,env,deps){
 if(request.method!=='POST')return new Response(JSON.stringify({success:false,message:'Method not allowed'}),{status:405,headers:{'Content-Type':'application/json'}});
 const path=new URL(request.url).pathname;
 if(!['/directory','/branch'].some(x=>path.endsWith(x)))return new Response(JSON.stringify({success:false,message:'Unknown operation'}),{status:404,headers:{'Content-Type':'application/json'}});
 return cacheAction(path,await request.json().catch(()=>({})),env,deps);
}
