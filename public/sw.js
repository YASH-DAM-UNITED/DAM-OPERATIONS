// DAM Operations: cache only same-origin static assets. NEVER cache API responses.
const CACHE = 'dam-static-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate', event => {event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch', event => {
 const req=event.request; const url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate') {event.respondWith(fetch(req).catch(()=>caches.match('/')));return;}
 if(!/\.(?:js|css|png|svg|webp|ico|woff2?|webmanifest)$/.test(url.pathname))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return res;})));
});
