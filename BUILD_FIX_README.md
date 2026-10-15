# Cloudflare Pages build fix — 15 October 2026

## What was fixed
In `src/AdminBrandGateway.jsx`, removed a duplicate pair of React refs (`openingRef`, `navigationTimerRef`) and an extra duplicate timer-cleanup effect. The first declaration and cleanup effect remain intact; admin brand selection logic remains unchanged.

## Deploy
Back up your current GitHub repository. Extract this archive and use the contents of `DAM-OPERATIONS-main` as the repository root. Commit and push. Cloudflare Pages should trigger a new build.

## Verification
Checked the file has exactly one declaration of each ref. Checked Worker JavaScript syntax with `node --check worker/index.js` and ZIP integrity. A complete Vite build could not be performed in this environment because npm dependency installation timed out. If another error appears, provide the new Cloudflare build log.

This patch does not modify Google Sheets, remove data, or change any BART, GLOR or MOOMA business operations.
