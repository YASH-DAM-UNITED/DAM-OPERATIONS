# DAM OPERATIONS — PWA patch (NO NEW D1)

## Included
Installable PWA shell, service worker for static files, device-local IndexedDB queue, sync status widget, and offline queueing for **BART stock submit** when the browser reports offline. No new D1, KV, R2, Supabase, or Firebase operations were added.

## CRITICAL: EXISTING D1 DEPENDENCIES
The uploaded project ALREADY HAS a D1 binding in `wrangler.jsonc` and multiple active `env.DB` calls in `worker/index.js`, `worker/glorBackend.js`, and `worker/moomaBackend.js`. GLOR and MOOMA drafts and other existing backend features depend on these calls. This patch does NOT remove or rewrite them, because doing so blindly would break live workflows. Therefore this package DOES NOT meet a strict guarantee of zero D1 use across the *existing application*. Do not deploy as a D1-free application until those dependencies are migrated or disabled safely.

## Offline limitations
Only BART stock POST can be queued by this patch. GLOR/MOOMA stock and all other workflows are NOT yet offline enabled. Stock init data must be loaded online before going offline. The PWA caches static app assets only; it intentionally never caches authenticated API responses. Sync requires opening the app and pressing Sync pending; it is not guaranteed in the background. A server-side idempotency mechanism must be added before production offline retries can be considered safe. Existing duplicate handling is not a substitute for an atomic idempotency key.

## Install
Overlay these files into the existing repo, then `npm install`, `npm run build`, test offline in Chrome DevTools, and validate all brand flows. Do not deploy until existing D1 usage is addressed under your zero-D1 policy.
