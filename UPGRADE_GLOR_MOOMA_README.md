# DAM Operations — Additive GLOR + MOOMA integration (October 2026)

## Before deploying
1. Back up the existing GitHub revision and export/duplicate each affected Google Sheet.
2. Upload the full repository contents, preserving existing paths. Do not delete Sheets tabs or rows.
3. The `wrangler.jsonc` includes the GLOR/MOOMA master spreadsheet IDs and GLOR gid. Spreadsheet IDs are not passwords. Do not place Google private keys in GitHub.
4. Confirm that `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` (Cloudflare secrets) are set. GLOR reuses those credentials by default, or optionally `GLOR_GOOGLE_CLIENT_EMAIL` and `GLOR_GOOGLE_PRIVATE_KEY`.
5. Existing MOOMA secrets continue to work. MOOMA also falls back to the shared GOOGLE credentials.
6. Existing Azure OCR and Gemma credentials remain required for delivery-note scanning.
7. Deploy in a test environment first, then verify branch authentication and Google Sheet reads/writes before production rollout.

## Additive changes
- `src/glor/*` + `worker/glorBackend.js`: GLOR portal and independent stock/transfer/schedule API, adapted from the existing MOOMA module. The GLOR master sheet is selected using gid 627415313 rather than assuming Sheet1.
- `src/App.jsx`: GLOR staff route; admin gateway BART/GLOR/MOOMA selection corrected.
- `src/AdminBrandGateway.jsx`: single brand click transition and GLOR count updated to six.
- `src/BrandAdminPortal.jsx`: protected, read-only branch and stock-catalog overview for GLOR and MOOMA. Uses existing DAM admin login/session. Does NOT enable admin stock edits.
- `src/BrandScheduleView.jsx`: read-only schedule viewer for GLOR and MOOMA using their existing brand-specific schedule endpoints.
- `src/mooma/MoomaPortal.jsx` and dashboard: add Delivery Notes and connect schedule viewer. Other existing modules are preserved.
- `src/BartDeliveryNotes.jsx`: accepts optional `brand` prop and calls the correct brand's delivery-note API. Default remains BART.
- `worker/index.js`: additive GLOR/MOOMA delivery-note and admin overview routes; catalog lookup and sheet writes isolated by brand/branch.
- `worker/moomaBackend.js`: credentials may fall back to existing shared Google service account; branch-list response no longer sends spreadsheet IDs.
- `wrangler.jsonc`: brand master IDs added.

## Master sheet requirements
Each master tab must have header columns `BranchCode`, `BranchName`, `SheetID`, and `Password` (spaces allowed). GLOR: G001–G006. MOOMA: M001–M002. The branch-specific spreadsheets need `Stocks` and the operational tabs required by their modules.

## Operational safety
- No existing Google Sheets rows, tabs, or data are deliberately deleted by this upgrade.
- Delivery Note submission may create a `Delivery Note` tab and append transaction rows; daily scan counters are stored in that tab's M:N columns.
- GLOR and MOOMA use separate master sheet IDs and validate branch codes against their own master sheets.
- Existing BART delivery API URLs remain supported.
- This archive has NOT been tested against live Google Sheets, Azure OCR, Cloudflare deployment, or actual staff credentials.
- Existing MOOMA/GLOR stock APIs use their legacy branch-code request model; production hardening should add server-verified branch sessions to all write endpoints. Do not treat password validation on login alone as full endpoint authorization.
- The GLOR stock record module inherits MOOMA's item grouping rules. Verify GLOR bakery/daily/weekly classifications on live Sheets before entering production data.
- Admin inventory editing and staff schedule editing are not included; their overview/viewer screens are read-only.

## Smoke test checklist (on staging)
1. BART: B001 login, stock view, stock record, transfers, schedule, delivery notes, admin.
2. GLOR: G001 through G006 load from correct master, wrong password denied, correct password opens dashboard.
3. GLOR: verify Stocks items, create a TEST stock entry, view entry, test transfer between two GLOR branches, open schedule viewer.
4. MOOMA: M001 and M002 existing login/stock/transfer modules still work; schedule viewer and delivery notes open.
5. Delivery notes: scan one sample for each brand; verify catalog suggestions, SKU/UOM, 3/day counter, duplicate check, final Google Sheets row, and no cross-brand data.
6. Admin: existing password opens each brand overview, unauthorized request gets 401, and BART admin still works.
7. Check on iPhone and desktop; keep backup ready for rollback.

## Rollback
Restore the prior GitHub commit / Cloudflare Worker deployment. This rolls back application code only. Google Sheets data appended during tests remains and should be reviewed manually rather than automatically deleted.
