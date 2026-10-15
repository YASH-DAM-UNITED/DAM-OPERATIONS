# DAM Operations — Clean GitHub project

This is the complete GLOR + MOOMA integration project, not a patch.

## Upload
1. Back up your existing GitHub repository/branch.
2. Extract this ZIP.
3. Open the `DAM-OPERATIONS-main` folder and use its contents as the project root.
4. Keep the directory structure exactly as provided. In particular:
   - `src/` contains React components, CSS, and item catalog.
   - `worker/` contains the Cloudflare Worker and brand backends.
   - `Public/` contains existing static assets (capital P retained from source).
   - `package.json`, `index.html`, `vite.config.js`, `wrangler.jsonc` stay at root.
5. Deploy to staging first. Verify BART, GLOR, MOOMA before production.

## Cleanup
Four misplaced root-level duplicates from the previous ZIP were omitted:
`BartDeliveryNotes.css`, `BartDeliveryNotes.jsx`, `dam-item-catalog.json`, `index.js`.
Their canonical copies are already in `src/` or `worker/`.
The root duplicates were archived in the separately supplied legacy backup ZIP.

No files inside src/, worker/, or Public/ were removed or changed.
No code or Google Sheets data was modified by this cleanup.
This packaging cleanup does not constitute a successful frontend build or live integration test.

## Notes
Read `UPGRADE_GLOR_MOOMA_README.md` for integration-specific deployment steps.
