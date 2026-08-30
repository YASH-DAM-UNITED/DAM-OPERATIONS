MOOMA ROOT-LEVEL A-Z PACKAGE

FINAL STRUCTURE:

DAM-OPERATIONS/
├── src/                       existing BART/main frontend
├── mooma/                     NEW standalone MOOMA system
│   ├── index.html
│   ├── main.jsx
│   ├── MoomaPortal.jsx
│   ├── MoomaDashboard.jsx
│   ├── MoomaLoading.jsx
│   ├── MoomaStockRecord.jsx
│   ├── MoomaStockView.jsx
│   ├── MoomaStockTransfer.jsx
│   ├── MoomaStaffSchedule.jsx
│   ├── moomaApi.js
│   ├── moomaBackend.js
│   └── mooma.css
├── worker/
│   └── index.js
├── vite.config.js
└── wrangler.jsonc

WHAT TO DO:

1. Delete the old src/mooma folder AFTER you have copied this new root-level mooma folder.
2. Copy this package's mooma folder to the ROOT of DAM-OPERATIONS, beside src and worker.
3. Use integration/vite.config.js as the root vite.config.js, or merge its multi-page rollup input into your existing Vite config.
4. Apply integration/WORKER_PATCH.txt to worker/index.js.
5. Apply integration/MAIN_APP_NAVIGATION.txt to the existing brand selection click.
6. Keep your current wrangler.jsonc; do not create a second worker.

MOOMA URL:
https://dam-operations.damunited.workers.dev/mooma/

MOOMA API:
/api/mooma/test
/api/mooma/branches
/api/mooma/login
/api/mooma/stock-record/*
/api/mooma/stock-view
/api/mooma/stock-transfer/*
/api/mooma/schedule/*

CLOUDFLARE VARIABLES:
MOOMA_GOOGLE_CLIENT_EMAIL
MOOMA_GOOGLE_PRIVATE_KEY
MOOMA_MASTER_SHEET_ID

GOOGLE STRUCTURE:
Master Sheet1: BranchCode, BranchName, SheetID, Password
Branch spreadsheet: Stocks with same DAILY ITEM / WEEKLY ITEM structure as BART
Master spreadsheet: StaffSchedule with same BART schedule structure

UI INCLUDED:
- independent MOOMA palette (rosewood / dusty rose / pearl / ink)
- light mode and dark mode
- responsive mobile layouts
- animated page/module loading
- active-action scrolling
- branch select -> login auto-scroll
- stock review -> review auto-scroll
- transfer add item -> cart auto-scroll
- success/error -> result auto-scroll
- desktop/tablet/mobile handling
