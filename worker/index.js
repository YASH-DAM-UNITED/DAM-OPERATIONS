/* ============================================================
   DAM OPERATIONS
   BART STAFF BACKEND

   VERSION:
   BART-STOCK-RECORD-V6

   ARCHITECTURE
   ------------------------------------------------------------
   React Frontend
        ↓
   Cloudflare Worker
        ↓
   D1 Cache / Database
        +
   Google Sheets

   NORMAL BRANCH / LOGIN:
   D1 ONLY

   LIVE TRANSFERS:
   Shared ~15 second Google freshness

   STOCK VIEW:
   D1 cache ~30 minutes

   STOCK RECORD:
   D1 structure cache ~2 minutes
   Final submit ALWAYS verifies live Google Sheet

============================================================ */


/* ============================================================
   CONFIG
============================================================ */

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

const TRANSFER_CACHE_SECONDS = 15;

const STOCK_VIEW_CACHE_SECONDS =
  30 * 60;

const STOCK_RECORD_CACHE_SECONDS =
  120;


/* ============================================================
   BAKERY SKU LIST

   EXACT LIST FROM STREAMLIT
============================================================ */

const BAKERY_SKUS = new Set([
  "F066",
  "F081",
  "CB054",
  "S019",
  "CB055",
  "CB076",
  "CB056",
  "K154",
  "K256",
  "CB078",
  "CB057",
  "CB072",
]);


/* ============================================================
   CORS / RESPONSE HELPERS
============================================================ */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Headers":
      "Content-Type, X-Admin-Key",

    "Access-Control-Allow-Methods":
      "GET, POST, DELETE, OPTIONS",
  };
}


function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        ...corsHeaders(),
      },
    }
  );
}


/* ============================================================
   DATABASE SETUP
============================================================ */

async function ensureDatabase(env) {
  if (!env.DB) {
    throw new Error(
      "D1 binding 'DB' is missing."
    );
  }


  /* ========================================================
     BRANCH MASTER
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS branches (
      code TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      sheet_id TEXT,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();


  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_branches_brand
    ON branches(brand)
  `).run();


  /* ========================================================
     TRANSFERS
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      items TEXT,
      quantities TEXT,
      reason TEXT,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();


  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_transfers_destination_status
    ON transfers(destination, status)
  `).run();


  /* ========================================================
     STOCK VIEW CACHE
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_cache (
      branch_code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


  /* ========================================================
     STOCK RECORD RAW SHEET CACHE
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_record_cache (
      branch_code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


  /* ========================================================
     STOCK RECORD DRAFTS
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_drafts (
      draft_key TEXT PRIMARY KEY,
      branch_code TEXT NOT NULL,
      stock_date TEXT NOT NULL,
      mode TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();


  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_drafts_branch_date
    ON stock_drafts(branch_code, stock_date)
  `).run();


  /* ========================================================
     SYSTEM META
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();


  /* ========================================================
     SYNC LOCKS
  ======================================================== */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sync_locks (
      key TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )
  `).run();
}


/* ============================================================
   PASSWORD HASH
============================================================ */

async function hashPassword(
  password
) {
  const encoded =
    new TextEncoder().encode(
      String(
        password ?? ""
      )
    );


  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );


  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}


/* ============================================================
   GOOGLE ACCOUNTS
============================================================ */

function getGoogleAccounts(env) {
  const accounts = [];


  /* GOOGLE CONNECTION 1 */

  if (
    env.GOOGLE_CLIENT_EMAIL &&
    env.GOOGLE_PRIVATE_KEY
  ) {
    accounts.push({
      id:
        "google-1",

      email:
        env.GOOGLE_CLIENT_EMAIL,

      privateKey:
        env.GOOGLE_PRIVATE_KEY,
    });
  }


  /* GOOGLE CONNECTION 2 */

  if (
    env.GOOGLE_CLIENT_EMAIL_2 &&
    env.GOOGLE_PRIVATE_KEY_2
  ) {
    accounts.push({
      id:
        "google-2",

      email:
        env.GOOGLE_CLIENT_EMAIL_2,

      privateKey:
        env.GOOGLE_PRIVATE_KEY_2,
    });
  }


  if (
    accounts.length === 0
  ) {
    throw new Error(
      "No Google service account configured."
    );
  }


  return accounts;
}


/* ============================================================
   GOOGLE JWT HELPERS
============================================================ */

function base64UrlEncodeString(
  input
) {
  return btoa(input)
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


function arrayBufferToBase64Url(
  buffer
) {
  const bytes =
    new Uint8Array(
      buffer
    );


  let binary = "";


  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }


  return btoa(binary)
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


function pemToArrayBuffer(
  pem
) {
  if (!pem) {
    throw new Error(
      "Google private key missing."
    );
  }


  const normalized =
    String(pem)
      .replace(
        /\\n/g,
        "\n"
      )
      .trim();


  const clean =
    normalized
      .replace(
        /-----BEGIN PRIVATE KEY-----/g,
        ""
      )
      .replace(
        /-----END PRIVATE KEY-----/g,
        ""
      )
      .replace(
        /\s/g,
        ""
      );


  if (!clean) {
    throw new Error(
      "Google private key is empty."
    );
  }


  const binary =
    atob(clean);


  const bytes =
    new Uint8Array(
      binary.length
    );


  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }


  return bytes.buffer;
}


/* ============================================================
   GOOGLE TOKEN CACHE
============================================================ */

const tokenCache =
  new Map();


async function getGoogleAccessToken(
  account
) {
  const now =
    Date.now();


  const cached =
    tokenCache.get(
      account.id
    );


  if (
    cached &&
    cached.token &&
    cached.expiresAt >
      now + 60000
  ) {
    return cached.token;
  }


  const nowSeconds =
    Math.floor(
      now / 1000
    );


  const jwtHeader = {
    alg:
      "RS256",

    typ:
      "JWT",
  };


  const jwtClaims = {
    iss:
      account.email,

    scope:
      GOOGLE_SCOPE,

    aud:
      GOOGLE_TOKEN_URL,

    iat:
      nowSeconds,

    exp:
      nowSeconds +
      3600,
  };


  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(
        jwtHeader
      )
    );


  const encodedClaims =
    base64UrlEncodeString(
      JSON.stringify(
        jwtClaims
      )
    );


  const unsignedJWT =
    `${encodedHeader}.${encodedClaims}`;


  const importedKey =
    await crypto.subtle.importKey(
      "pkcs8",

      pemToArrayBuffer(
        account.privateKey
      ),

      {
        name:
          "RSASSA-PKCS1-v1_5",

        hash:
          "SHA-256",
      },

      false,

      ["sign"]
    );


  const signature =
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",

      importedKey,

      new TextEncoder()
        .encode(
          unsignedJWT
        )
    );


  const signedJWT =
    `${unsignedJWT}.` +
    arrayBufferToBase64Url(
      signature
    );


  const response =
    await fetch(
      GOOGLE_TOKEN_URL,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "urn:ietf:params:oauth:grant-type:jwt-bearer",

            assertion:
              signedJWT,
          }),
      }
    );


  const result =
    await response.json();


  if (!response.ok) {
    throw new Error(
      result.error_description ||
      result.error ||
      "Google authentication failed."
    );
  }


  tokenCache.set(
    account.id,
    {
      token:
        result.access_token,

      expiresAt:
        now +
        (
          result.expires_in ||
          3600
        ) *
          1000,
    }
  );


  return result.access_token;
}


/* ============================================================
   GOOGLE DUAL CONNECTION
============================================================ */

let googleAccountCounter = 0;


function rotatedGoogleAccounts(
  env
) {
  const accounts =
    getGoogleAccounts(env);


  const start =
    googleAccountCounter %
    accounts.length;


  googleAccountCounter++;


  return [
    ...accounts.slice(
      start
    ),

    ...accounts.slice(
      0,
      start
    ),
  ];
}


/* ============================================================
   GOOGLE REQUEST FAILOVER
============================================================ */

async function googleRequest(
  env,
  requestFactory
) {
  const accounts =
    rotatedGoogleAccounts(
      env
    );


  let lastError =
    null;


  for (
    const account of accounts
  ) {
    try {
      const token =
        await getGoogleAccessToken(
          account
        );


      const response =
        await requestFactory(
          token,
          account
        );


      /*
        RATE / QUOTA ISSUE
        TRY NEXT ACCOUNT
      */

      if (
        response.status ===
          429 ||
        response.status ===
          403
      ) {
        console.warn(
          `${account.id} quota/rate issue`
        );


        lastError =
          new Error(
            `${account.id} unavailable`
          );


        continue;
      }


      return response;

    } catch (error) {
      console.error(
        `${account.id} failed`,
        error
      );


      lastError =
        error;
    }
  }


  throw (
    lastError ||
    new Error(
      "All Google accounts failed."
    )
  );
}


/* ============================================================
   GOOGLE READ
============================================================ */

async function getSheetValues(
  env,
  spreadsheetId,
  range
) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(
      spreadsheetId
    )}/values/` +
    `${encodeURIComponent(
      range
    )}`;


  const response =
    await googleRequest(
      env,

      (
        token,
        account
      ) => {
        console.log(
          "GOOGLE READ:",
          account.id,
          range
        );


        return fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
      }
    );


  const data =
    await response.json();


  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Google Sheets read failed."
    );
  }


  return (
    data.values ||
    []
  );
}


/* ============================================================
   GOOGLE BATCH WRITE
============================================================ */

async function batchWriteSheet(
  env,
  spreadsheetId,
  data
) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`;


  const response =
    await googleRequest(
      env,

      (
        token,
        account
      ) => {
        console.log(
          "GOOGLE WRITE:",
          account.id
        );


        return fetch(
          url,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                valueInputOption:
                  "USER_ENTERED",

                data,
              }),
          }
        );
      }
    );


  const result =
    await response.json();


  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      "Google Sheets write failed."
    );
  }


  return result;
}


/* ============================================================
   HEADER NORMALIZER
============================================================ */

function normalizeHeader(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /_/g,
      ""
    )
    .replace(
      /-/g,
      ""
    );
}


/* ============================================================
   COLUMN NUMBER -> GOOGLE A1 LETTER
============================================================ */

function columnNumberToLetters(
  number
) {
  let result = "";


  while (
    number > 0
  ) {
    const remainder =
      (
        number - 1
      ) %
      26;


    result =
      String.fromCharCode(
        65 +
        remainder
      ) +
      result;


    number =
      Math.floor(
        (
          number - 1
        ) /
        26
      );
  }


  return result;
}


/* ============================================================
   SYSTEM META
============================================================ */

async function setMeta(
  env,
  key,
  value
) {
  const now =
    new Date()
      .toISOString();


  await env.DB.prepare(`
    INSERT INTO system_meta (
      key,
      value,
      updated_at
    )

    VALUES (?, ?, ?)

    ON CONFLICT(key)
    DO UPDATE SET
      value =
        excluded.value,

      updated_at =
        excluded.updated_at
  `)
    .bind(
      key,
      String(value),
      now
    )
    .run();
}


async function getMeta(
  env,
  key
) {
  const result =
    await env.DB.prepare(`
      SELECT value

      FROM system_meta

      WHERE key = ?

      LIMIT 1
    `)
      .bind(
        key
      )
      .first();


  return (
    result?.value ||
    null
  );
}


/* ============================================================
   SYNC LOCK
============================================================ */

async function acquireLock(
  env,
  key,
  seconds = 20
) {
  const now =
    Math.floor(
      Date.now() /
      1000
    );


  const expires =
    now +
    seconds;


  const result =
    await env.DB.prepare(`
      INSERT INTO sync_locks (
        key,
        expires_at
      )

      VALUES (?, ?)

      ON CONFLICT(key)
      DO UPDATE SET
        expires_at =
          excluded.expires_at

      WHERE
        sync_locks.expires_at
        < ?
    `)
      .bind(
        key,
        expires,
        now
      )
      .run();


  return (
    Number(
      result?.meta?.changes ||
      0
    ) > 0
  );
}


async function releaseLock(
  env,
  key
) {
  await env.DB.prepare(`
    DELETE FROM sync_locks
    WHERE key = ?
  `)
    .bind(
      key
    )
    .run();
}


/* ============================================================
   MASTER BRANCH DATA
============================================================ */

async function readBartMaster(
  env
) {
  if (
    !env.MASTER_SHEET_ID
  ) {
    throw new Error(
      "MASTER_SHEET_ID missing."
    );
  }


  const rows =
    await getSheetValues(
      env,
      env.MASTER_SHEET_ID,
      "Sheet1!A:Z"
    );


  if (
    rows.length === 0
  ) {
    return [];
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  const codeIndex =
    headers.indexOf(
      "branchcode"
    );


  const nameIndex =
    headers.indexOf(
      "branchname"
    );


  const sheetIdIndex =
    headers.indexOf(
      "sheetid"
    );


  const passwordIndex =
    headers.indexOf(
      "password"
    );


  if (
    codeIndex === -1 ||
    nameIndex === -1
  ) {
    throw new Error(
      "BranchCode / BranchName columns missing."
    );
  }


  const branches = [];


  for (
    const row of
    rows.slice(1)
  ) {
    const code =
      String(
        row[
          codeIndex
        ] || ""
      )
        .trim()
        .toUpperCase();


    /*
      ONLY BART
    */

    if (
      !code.startsWith(
        "B"
      )
    ) {
      continue;
    }


    const password =
      passwordIndex >=
      0
        ? String(
            row[
              passwordIndex
            ] || ""
          ).trim()

        : "";


    branches.push({
      code,

      brand:
        "bart",

      name:
        String(
          row[
            nameIndex
          ] || ""
        ).trim(),

      sheetId:
        sheetIdIndex >=
        0
          ? String(
              row[
                sheetIdIndex
              ] || ""
            ).trim()

          : "",

      passwordHash:
        await hashPassword(
          password
        ),
    });
  }


  return branches;
}


/* ============================================================
   ADMIN AUTH
============================================================ */

function adminAuthorized(
  request,
  env
) {
  if (
    !env.ADMIN_SYNC_KEY
  ) {
    return false;
  }


  return (
    request.headers.get(
      "X-Admin-Key"
    ) ===
    env.ADMIN_SYNC_KEY
  );
}


/* ============================================================
   MANUAL MASTER DATABASE REFRESH
============================================================ */

async function syncBartDatabase(
  request,
  env
) {
  if (
    !adminAuthorized(
      request,
      env
    )
  ) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Invalid database refresh password.",
      },
      401
    );
  }


  await ensureDatabase(
    env
  );


  const branches =
    await readBartMaster(
      env
    );


  const now =
    new Date()
      .toISOString();


  const statements = [];


  statements.push(
    env.DB.prepare(`
      DELETE FROM branches
      WHERE brand = ?
    `)
      .bind(
        "bart"
      )
  );


  for (
    const branch of branches
  ) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO branches (
          code,
          brand,
          name,
          sheet_id,
          password_hash,
          updated_at
        )

        VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          branch.code,
          branch.brand,
          branch.name,
          branch.sheetId,
          branch.passwordHash,
          now
        )
    );
  }


  await env.DB.batch(
    statements
  );


  await setMeta(
    env,
    "bart_last_sync",
    now
  );


  /*
    ALSO SYNC TRANSFERS NOW.

    LIVE TRANSFERS DO NOT DEPEND
    ON THIS BUTTON AFTERWARD.
  */

  const transfers =
    await readTransfersGoogle(
      env
    );


  await saveTransfersToD1(
    env,
    transfers
  );


  return jsonResponse({
    success:
      true,

    message:
      "BART database refreshed successfully.",

    branches:
      branches.length,

    transfers:
      transfers.length,

    lastSync:
      now,
  });
}


/* ============================================================
   BART BRANCH LIST
============================================================ */

async function getBartBranches(
  env
) {
  await ensureDatabase(
    env
  );


  const result =
    await env.DB.prepare(`
      SELECT
        code,
        name

      FROM branches

      WHERE brand = ?

      ORDER BY code ASC
    `)
      .bind(
        "bart"
      )
      .all();


  return (
    result.results ||
    []
  );
}


/* ============================================================
   GET BRANCH INTERNAL DETAILS
============================================================ */

async function getBartBranch(
  env,
  branchCode
) {
  return env.DB.prepare(`
    SELECT
      code,
      name,
      sheet_id,
      password_hash

    FROM branches

    WHERE
      code = ?
      AND brand = 'bart'

    LIMIT 1
  `)
    .bind(
      branchCode
    )
    .first();
}


/* ============================================================
   BART LOGIN
============================================================ */

async function bartLogin(
  request,
  env
) {
  await ensureDatabase(
    env
  );


  let body;


  try {
    body =
      await request.json();
  } catch {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Invalid request.",
      },
      400
    );
  }


  const branchCode =
    String(
      body.branchCode ||
      ""
    )
      .trim()
      .toUpperCase();


  const password =
    String(
      body.password ||
      ""
    ).trim();


  if (
    !branchCode ||
    !password
  ) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Branch and password are required.",
      },
      400
    );
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Branch not found.",
      },
      404
    );
  }


  const enteredHash =
    await hashPassword(
      password
    );


  if (
    enteredHash !==
    branch.password_hash
  ) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Incorrect password.",
      },
      401
    );
  }


  return jsonResponse({
    success:
      true,

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },
  });
}


/* ============================================================
   TRANSFERS GOOGLE READ
============================================================ */

async function readTransfersGoogle(
  env
) {
  const rows =
    await getSheetValues(
      env,
      env.MASTER_SHEET_ID,
      "Transfers!A:Z"
    );


  if (
    rows.length === 0
  ) {
    return [];
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  const findIndex =
    (name) =>
      headers.indexOf(
        normalizeHeader(
          name
        )
      );


  const idIndex =
    findIndex(
      "ID"
    );


  const originIndex =
    findIndex(
      "Origin"
    );


  const destinationIndex =
    findIndex(
      "Destination"
    );


  const itemsIndex =
    findIndex(
      "Items"
    );


  const quantitiesIndex =
    findIndex(
      "Quantities"
    );


  const reasonIndex =
    findIndex(
      "Reason"
    );


  const statusIndex =
    findIndex(
      "Status"
    );


  if (
    idIndex === -1 ||
    originIndex === -1 ||
    destinationIndex ===
      -1
  ) {
    throw new Error(
      "Required Transfers columns missing."
    );
  }


  return rows
    .slice(1)
    .filter(
      (row) =>
        String(
          row[
            idIndex
          ] || ""
        ).trim()
    )
    .map(
      (row) => ({
        id:
          String(
            row[
              idIndex
            ] || ""
          ).trim(),

        origin:
          String(
            row[
              originIndex
            ] || ""
          ).trim(),

        destination:
          String(
            row[
              destinationIndex
            ] || ""
          ).trim(),

        items:
          itemsIndex >=
          0
            ? String(
                row[
                  itemsIndex
                ] || ""
              )
            : "",

        quantities:
          quantitiesIndex >=
          0
            ? String(
                row[
                  quantitiesIndex
                ] || ""
              )
            : "",

        reason:
          reasonIndex >=
          0
            ? String(
                row[
                  reasonIndex
                ] || ""
              )
            : "",

        status:
          statusIndex >=
          0
            ? String(
                row[
                  statusIndex
                ] ||
                "Pending"
              ).trim()

            : "Pending",
      })
    );
}


/* ============================================================
   SAVE TRANSFERS D1
============================================================ */

async function saveTransfersToD1(
  env,
  transfers
) {
  const now =
    new Date()
      .toISOString();


  const statements = [];


  statements.push(
    env.DB.prepare(`
      DELETE FROM transfers
    `)
  );


  for (
    const transfer of
    transfers
  ) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO transfers (
          id,
          origin,
          destination,
          items,
          quantities,
          reason,
          status,
          updated_at
        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          transfer.id,
          transfer.origin,
          transfer.destination,
          transfer.items,
          transfer.quantities,
          transfer.reason,
          transfer.status,
          now
        )
    );
  }


  if (
    statements.length >
    0
  ) {
    await env.DB.batch(
      statements
    );
  }


  await setMeta(
    env,
    "transfers_last_sync_ms",
    Date.now()
  );
}


/* ============================================================
   LIVE TRANSFER FRESHNESS
============================================================ */

async function ensureTransfersFresh(
  env
) {
  await ensureDatabase(
    env
  );


  const previous =
    Number(
      await getMeta(
        env,
        "transfers_last_sync_ms"
      ) || 0
    );


  if (
    previous &&
    Date.now() -
      previous <
      TRANSFER_CACHE_SECONDS *
        1000
  ) {
    return {
      refreshed:
        false,

      source:
        "D1",
    };
  }


  /*
    ONLY ONE REQUEST GETS
    GOOGLE REFRESH LOCK
  */

  const acquired =
    await acquireLock(
      env,
      "transfer-live-sync",
      20
    );


  if (!acquired) {
    return {
      refreshed:
        false,

      source:
        "D1-SYNC-IN-PROGRESS",
    };
  }


  try {
    /*
      RECHECK AFTER ACQUIRING LOCK
    */

    const current =
      Number(
        await getMeta(
          env,
          "transfers_last_sync_ms"
        ) || 0
      );


    if (
      current &&
      Date.now() -
        current <
        TRANSFER_CACHE_SECONDS *
          1000
    ) {
      return {
        refreshed:
          false,

        source:
          "D1",
      };
    }


    const transfers =
      await readTransfersGoogle(
        env
      );


    await saveTransfersToD1(
      env,
      transfers
    );


    return {
      refreshed:
        true,

      source:
        "GOOGLE->D1",

      count:
        transfers.length,
    };

  } finally {
    await releaseLock(
      env,
      "transfer-live-sync"
    );
  }
}


/* ============================================================
   GET PENDING TRANSFERS
============================================================ */

async function getPendingTransfers(
  env,
  branchCode
) {
  const freshness =
    await ensureTransfersFresh(
      env
    );


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {
    return {
      transfers:
        [],

      freshness,
    };
  }


  const destination =
    `${branch.code} - ${branch.name}`;


  const result =
    await env.DB.prepare(`
      SELECT
        id,
        origin,
        destination,
        items,
        quantities,
        reason,
        status

      FROM transfers

      WHERE
        destination = ?
        AND status = 'Pending'

      ORDER BY updated_at DESC
    `)
      .bind(
        destination
      )
      .all();


  return {
    transfers:
      result.results ||
      [],

    freshness,
  };
}


/* ============================================================
   TRANSFER ITEM PARSER
============================================================ */

function parseTransferItems(
  transfer
) {
  const itemsText =
    String(
      transfer.items ||
      ""
    )
      .replace(
        /â€¢/g,
        "•"
      );


  const quantitiesText =
    String(
      transfer.quantities ||
      ""
    );


  if (
    !itemsText.trim() ||
    !quantitiesText.trim()
  ) {
    return [];
  }


  const items =
    itemsText
      .split("\n")
      .map(
        (item) =>
          item
            .replace(
              /^•\s*/,
              ""
            )
            .trim()
      )
      .filter(Boolean);


  const quantities =
    quantitiesText
      .split("\n")
      .map(
        (qty) =>
          qty.trim()
      )
      .filter(Boolean);


  const cart = [];


  for (
    let i = 0;
    i <
    Math.min(
      items.length,
      quantities.length
    );
    i++
  ) {
    let rawItem =
      items[i];


    if (
      rawItem.includes(
        "]"
      )
    ) {
      rawItem =
        rawItem
          .split("]")
          .slice(1)
          .join("]")
          .trim();
    }


    const itemName =
      rawItem
        .split(
          " ("
        )[0]
        .trim();


    cart.push({
      item:
        itemName,

      qty:
        quantities[i],
    });
  }


  return cart;
}


/* ============================================================
   YESTERDAY DATE
============================================================ */

function yesterdayDate() {
  const date =
    new Date();


  date.setUTCDate(
    date.getUTCDate() -
    1
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


/* ============================================================
   MODIFY BRANCH STOCK

   USED DURING REJECT REVERSAL
============================================================ */

async function modifyBranchStock(
  env,
  spreadsheetId,
  cart,
  mode
) {
  const rows =
    await getSheetValues(
      env,
      spreadsheetId,
      "Stocks!A:ZZ"
    );


  if (
    rows.length === 0
  ) {
    throw new Error(
      "Stocks sheet is empty."
    );
  }


  const headers =
    rows[0];


  const date =
    yesterdayDate();


  const dateIndex =
    headers.indexOf(
      date
    );


  if (
    dateIndex === -1
  ) {
    throw new Error(
      `Could not find stock date ${date}`
    );
  }


  const itemsColumn =
    rows.map(
      (row) =>
        String(
          row?.[0] || ""
        ).trim()
    );


  const updates = [];


  for (
    const entry of cart
  ) {
    const rowIndex =
      itemsColumn.indexOf(
        entry.item
      );


    if (
      rowIndex === -1
    ) {
      continue;
    }


    const currentRaw =
      rows[
        rowIndex
      ]?.[
        dateIndex
      ];


    const current =
      currentRaw &&
      String(
        currentRaw
      ).trim()
        ? Number(
            currentRaw
          )

        : 0;


    const qty =
      Number(
        entry.qty
      ) || 0;


    const newValue =
      mode ===
      "subtract"
        ? current - qty
        : current + qty;


    const column =
      columnNumberToLetters(
        dateIndex + 1
      );


    updates.push({
      range:
        `Stocks!${column}${rowIndex + 1}`,

      values:
        [[newValue]],
    });
  }


  if (
    updates.length === 0
  ) {
    throw new Error(
      "Transfer items not found in Stocks sheet."
    );
  }


  await batchWriteSheet(
    env,
    spreadsheetId,
    updates
  );
}


/* ============================================================
   FIND TRANSFER ROW
============================================================ */

async function findTransferRow(
  env,
  transferId
) {
  const rows =
    await getSheetValues(
      env,
      env.MASTER_SHEET_ID,
      "Transfers!A:Z"
    );


  if (
    rows.length === 0
  ) {
    return null;
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  const idIndex =
    headers.indexOf(
      "id"
    );


  const statusIndex =
    headers.indexOf(
      "status"
    );


  if (
    idIndex === -1 ||
    statusIndex === -1
  ) {
    throw new Error(
      "Transfers ID / Status columns missing."
    );
  }


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {
    if (
      String(
        rows[i]?.[
          idIndex
        ] || ""
      ).trim() ===
      transferId
    ) {
      return {
        row:
          i + 1,

        statusColumn:
          statusIndex +
          1,
      };
    }
  }


  return null;
}


/* ============================================================
   UPDATE GOOGLE TRANSFER STATUS
============================================================ */

async function updateGoogleTransferStatus(
  env,
  transferId,
  status
) {
  const location =
    await findTransferRow(
      env,
      transferId
    );


  if (!location) {
    throw new Error(
      "Transfer ID not found in Google."
    );
  }


  const column =
    columnNumberToLetters(
      location.statusColumn
    );


  await batchWriteSheet(
    env,
    env.MASTER_SHEET_ID,
    [
      {
        range:
          `Transfers!${column}${location.row}`,

        values:
          [[status]],
      },
    ]
  );
}


/* ============================================================
   ACCEPT / REJECT TRANSFER
============================================================ */

async function respondTransfer(
  request,
  env
) {
  await ensureDatabase(
    env
  );


  const body =
    await request.json();


  const transferId =
    String(
      body.transferId ||
      ""
    ).trim();


  const action =
    String(
      body.action ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !transferId ||
    ![
      "accept",
      "reject",
    ].includes(
      action
    )
  ) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Invalid transfer request.",
      },
      400
    );
  }


  const transfer =
    await env.DB.prepare(`
      SELECT *

      FROM transfers

      WHERE id = ?

      LIMIT 1
    `)
      .bind(
        transferId
      )
      .first();


  if (!transfer) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Transfer not found.",
      },
      404
    );
  }


  if (
    transfer.status !==
    "Pending"
  ) {
    return jsonResponse(
      {
        success:
          false,

        message:
          "Transfer already processed.",
      },
      409
    );
  }


  const finalStatus =
    action ===
    "accept"
      ? "Accepted"
      : "Rejected";


  /*
    SAME ORDER AS OLD STREAMLIT:
    UPDATE STATUS FIRST
  */

  await updateGoogleTransferStatus(
    env,
    transferId,
    finalStatus
  );


  await env.DB.prepare(`
    UPDATE transfers

    SET
      status = ?,
      updated_at = ?

    WHERE id = ?
  `)
    .bind(
      finalStatus,
      new Date()
        .toISOString(),
      transferId
    )
    .run();


  /*
    ACCEPT FINISHES HERE
  */

  if (
    action ===
    "accept"
  ) {
    return jsonResponse({
      success:
        true,

      status:
        "Accepted",

      message:
        "Transfer accepted successfully.",
    });
  }


  /*
    REJECT:
    REVERSE STOCK
  */

  const cart =
    parseTransferItems(
      transfer
    );


  const originCode =
    String(
      transfer.origin
    )
      .split(
        " - "
      )[0]
      .trim()
      .toUpperCase();


  const destinationCode =
    String(
      transfer.destination
    )
      .split(
        " - "
      )[0]
      .trim()
      .toUpperCase();


  const origin =
    await getBartBranch(
      env,
      originCode
    );


  const destination =
    await getBartBranch(
      env,
      destinationCode
    );


  if (
    !origin?.sheet_id ||
    !destination?.sheet_id
  ) {
    throw new Error(
      "Origin or destination SheetID unavailable."
    );
  }


  /*
    ADD BACK TO ORIGIN
  */

  await modifyBranchStock(
    env,
    origin.sheet_id,
    cart,
    "add"
  );


  /*
    SUBTRACT DESTINATION
  */

  await modifyBranchStock(
    env,
    destination.sheet_id,
    cart,
    "subtract"
  );


  /*
    STOCK CHANGED:
    INVALIDATE BOTH BRANCH CACHES
  */

  await env.DB.prepare(`
    DELETE FROM stock_cache

    WHERE branch_code
    IN (?, ?)
  `)
    .bind(
      originCode,
      destinationCode
    )
    .run();


  await env.DB.prepare(`
    DELETE FROM stock_record_cache

    WHERE branch_code
    IN (?, ?)
  `)
    .bind(
      originCode,
      destinationCode
    )
    .run();


  return jsonResponse({
    success:
      true,

    status:
      "Rejected",

    message:
      "Transfer rejected. Stock returned to origin and removed from destination.",
  });
}


/* ============================================================
   STOCK VIEW PARSER
============================================================ */

function parseStockViewData(
  data
) {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return {
      daily: [],
      weekly: [],
    };
  }


  const headers =
    data[0] ||
    [];


  const dataColumns =
    headers.slice(1);


  const daily = [];
  const weekly = [];


  let currentSection =
    null;


  for (
    const row of data
  ) {
    const rowText =
      (row || [])
        .join(" ")
        .trim()
        .toLowerCase();


    if (
      rowText.includes(
        "daily item"
      )
    ) {
      currentSection =
        "daily";

      continue;
    }


    if (
      rowText.includes(
        "weekly item"
      )
    ) {
      currentSection =
        "weekly";

      continue;
    }


    if (
      currentSection ===
        null ||
      !row ||
      !row[0]
    ) {
      continue;
    }


    const item =
      String(
        row[0]
      ).trim();


    const values =
      row.slice(1);


    while (
      values.length <
      dataColumns.length
    ) {
      values.push("");
    }


    const cleaned = [];

    let total = 0;


    for (
      let i = 0;
      i <
      dataColumns.length;
      i++
    ) {
      const value =
        values[i] ?? "";


      /*
        OLD STREAMLIT:
        FIRST 2 FIELDS AFTER ITEM
        STAY TEXT
      */

      if (
        i < 2
      ) {
        cleaned.push(
          value
        );

        continue;
      }


      const number =
        value === ""
          ? 0
          : Number(
              value
            );


      const safe =
        Number.isFinite(
          number
        )
          ? number
          : 0;


      cleaned.push(
        safe
      );


      total +=
        safe;
    }


    const rowObject = {
      Item:
        item,
    };


    dataColumns.forEach(
      (
        column,
        index
      ) => {
        rowObject[
          column
        ] =
          cleaned[
            index
          ];
      }
    );


    rowObject.Total =
      total;


    if (
      currentSection ===
      "daily"
    ) {
      daily.push(
        rowObject
      );

    } else {
      weekly.push(
        rowObject
      );
    }
  }


  return {
    daily,
    weekly,
  };
}


/* ============================================================
   STOCK VIEW
============================================================ */

async function getStockView(
  env,
  branchCode,
  forceRefresh = false
) {
  await ensureDatabase(
    env
  );


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (
    !branch ||
    !branch.sheet_id
  ) {
    throw new Error(
      "Branch SheetID not found."
    );
  }


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  const cached =
    await env.DB.prepare(`
      SELECT
        payload,
        synced_at

      FROM stock_cache

      WHERE branch_code = ?

      LIMIT 1
    `)
      .bind(
        branchCode
      )
      .first();


  if (
    !forceRefresh &&
    cached &&
    now -
      Number(
        cached.synced_at
      ) <
      STOCK_VIEW_CACHE_SECONDS
  ) {
    return {
      source:
        "D1",

      syncedAt:
        Number(
          cached.synced_at
        ),

      data:
        JSON.parse(
          cached.payload
        ),
    };
  }


  const lockKey =
    `stock-view-${branchCode}`;


  const acquired =
    await acquireLock(
      env,
      lockKey,
      20
    );


  /*
    IF ANOTHER REQUEST IS FETCHING
    AND WE HAVE CACHE,
    SERVE CACHE
  */

  if (
    !acquired &&
    cached
  ) {
    return {
      source:
        "D1",

      syncedAt:
        Number(
          cached.synced_at
        ),

      data:
        JSON.parse(
          cached.payload
        ),
    };
  }


  try {
    const rows =
      await getSheetValues(
        env,
        branch.sheet_id,
        "Stocks!A:ZZ"
      );


    const parsed =
      parseStockViewData(
        rows
      );


    await env.DB.prepare(`
      INSERT INTO stock_cache (
        branch_code,
        payload,
        synced_at
      )

      VALUES (?, ?, ?)

      ON CONFLICT(branch_code)
      DO UPDATE SET
        payload =
          excluded.payload,

        synced_at =
          excluded.synced_at
    `)
      .bind(
        branchCode,
        JSON.stringify(
          parsed
        ),
        now
      )
      .run();


    return {
      source:
        "GOOGLE->D1",

      syncedAt:
        now,

      data:
        parsed,
    };

  } finally {
    if (acquired) {
      await releaseLock(
        env,
        lockKey
      );
    }
  }
}


/* ============================================================
   STOCK RECORD SECTION FINDER
============================================================ */

function findSectionIndex(
  values,
  sectionName
) {
  const wanted =
    String(
      sectionName
    )
      .trim()
      .toUpperCase();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    if (
      String(
        values[i] ||
        ""
      )
        .trim()
        .toUpperCase() ===
      wanted
    ) {
      return i;
    }
  }


  return null;
}


/* ============================================================
   STOCK RECORD STRUCTURE
============================================================ */

function buildStockRecordData(
  sheetData
) {
  if (
    !Array.isArray(
      sheetData
    ) ||
    sheetData.length ===
      0
  ) {
    throw new Error(
      "Stocks sheet returned empty data."
    );
  }


  const columnA =
    sheetData.map(
      (row) =>
        String(
          row?.[0] ||
          ""
        ).trim()
    );


  const dailyStart =
    findSectionIndex(
      columnA,
      "DAILY ITEM"
    );


  const weeklyStart =
    findSectionIndex(
      columnA,
      "WEEKLY ITEM"
    );


  if (
    dailyStart === null ||
    weeklyStart === null
  ) {
    throw new Error(
      "'DAILY ITEM' or 'WEEKLY ITEM' section not found."
    );
  }


  function standardItems(
    selectedMode
  ) {
    const items = [];


    const start =
      selectedMode ===
      "daily"
        ? dailyStart + 1
        : weeklyStart + 1;


    const end =
      selectedMode ===
      "daily"
        ? weeklyStart
        : sheetData.length;


    for (
      let index = start;
      index < end;
      index++
    ) {
      const row =
        sheetData[
          index
        ] || [];


      const name =
        String(
          row[0] ||
          ""
        ).trim();


      if (!name) {
        continue;
      }


      if (
        [
          "DAILY ITEM",
          "WEEKLY ITEM",
        ].includes(
          name.toUpperCase()
        )
      ) {
        continue;
      }


      items.push({
        name,

        sku:
          String(
            row[1] ||
            ""
          ).trim(),

        uom:
          String(
            row[2] ||
            ""
          ).trim(),

        row:
          index +
          1,
      });
    }


    return items;
  }


  /* ========================================================
     BAKERY:
     SCAN WHOLE SHEET
     COLUMN B = SKU
  ======================================================== */

  const bakery = [];


  for (
    let index = 1;
    index <
    sheetData.length;
    index++
  ) {
    const row =
      sheetData[
        index
      ] || [];


    const name =
      String(
        row[0] ||
        ""
      ).trim();


    const sku =
      String(
        row[1] ||
        ""
      ).trim();


    if (
      name &&
      BAKERY_SKUS.has(
        sku
      )
    ) {
      bakery.push({
        name,

        sku,

        uom:
          String(
            row[2] ||
            ""
          ).trim(),

        row:
          index +
          1,
      });
    }
  }


  return {
    headers:
      sheetData[0] ||
      [],

    daily:
      standardItems(
        "daily"
      ),

    weekly:
      standardItems(
        "weekly"
      ),

    bakery,

    dailyStart,

    weeklyStart,
  };
}


/* ============================================================
   STOCK RECORD DUPLICATE CHECK

   BAKERY = NO DUPLICATE RESTRICTION
============================================================ */

function stockAlreadySubmitted(
  sheetData,
  structure,
  mode,
  date
) {
  if (
    mode ===
    "bakery"
  ) {
    return false;
  }


  const headers =
    sheetData[0] ||
    [];


  const columnIndex =
    headers.indexOf(
      date
    );


  if (
    columnIndex === -1
  ) {
    return false;
  }


  const start =
    mode ===
    "daily"
      ? structure.dailyStart +
        1
      : structure.weeklyStart +
        1;


  const end =
    mode ===
    "daily"
      ? structure.weeklyStart
      : sheetData.length;


  for (
    let rowIndex = start;
    rowIndex < end;
    rowIndex++
  ) {
    const row =
      sheetData[
        rowIndex
      ] || [];


    if (
      columnIndex <
        row.length &&
      String(
        row[
          columnIndex
        ] || ""
      ).trim()
    ) {
      return true;
    }
  }


  return false;
}


/* ============================================================
   STOCK RECORD STRUCTURE CACHE
============================================================ */

async function loadStockRecordStructure(
  env,
  branchCode,
  force = false
) {
  await ensureDatabase(
    env
  );


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (
    !branch ||
    !branch.sheet_id
  ) {
    throw new Error(
      "Branch SheetID not available."
    );
  }


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  const cached =
    await env.DB.prepare(`
      SELECT
        payload,
        synced_at

      FROM stock_record_cache

      WHERE branch_code = ?

      LIMIT 1
    `)
      .bind(
        branchCode
      )
      .first();


  if (
    !force &&
    cached &&
    now -
      Number(
        cached.synced_at
      ) <
      STOCK_RECORD_CACHE_SECONDS
  ) {
    return {
      branch,

      source:
        "D1",

      sheetData:
        JSON.parse(
          cached.payload
        ),
    };
  }


  const rows =
    await getSheetValues(
      env,
      branch.sheet_id,
      "Stocks!A:ZZ"
    );


  await env.DB.prepare(`
    INSERT INTO stock_record_cache (
      branch_code,
      payload,
      synced_at
    )

    VALUES (?, ?, ?)

    ON CONFLICT(branch_code)
    DO UPDATE SET
      payload =
        excluded.payload,

      synced_at =
        excluded.synced_at
  `)
    .bind(
      branchCode,
      JSON.stringify(
        rows
      ),
      now
    )
    .run();


  return {
    branch,

    source:
      "GOOGLE->D1",

    sheetData:
      rows,
  };
}


/* ============================================================
   STOCK RECORD DRAFT KEY
============================================================ */

function makeStockDraftKey(
  branchCode,
  date,
  mode
) {
  return (
    `${branchCode}_` +
    `${date}_` +
    `${mode}`
  );
}


/* ============================================================
   STOCK RECORD INIT
============================================================ */

async function stockRecordInit(
  env,
  branchCode,
  date
) {
  const loaded =
    await loadStockRecordStructure(
      env,
      branchCode
    );


  const structure =
    buildStockRecordData(
      loaded.sheetData
    );


  const draftResult =
    await env.DB.prepare(`
      SELECT
        mode,
        payload,
        updated_at

      FROM stock_drafts

      WHERE
        branch_code = ?
        AND stock_date = ?
    `)
      .bind(
        branchCode,
        date
      )
      .all();


  const drafts = {};


  for (
    const draft of
    draftResult.results ||
    []
  ) {
    try {
      drafts[
        draft.mode
      ] = {
        values:
          JSON.parse(
            draft.payload
          ),

        updatedAt:
          draft.updated_at,
      };

    } catch {
      /* IGNORE BAD DRAFT */
    }
  }


  return {
    success:
      true,

    source:
      loaded.source,

    branch: {
      code:
        loaded.branch.code,

      name:
        loaded.branch.name,
    },

    date,

    duplicate: {
      daily:
        stockAlreadySubmitted(
          loaded.sheetData,
          structure,
          "daily",
          date
        ),

      weekly:
        stockAlreadySubmitted(
          loaded.sheetData,
          structure,
          "weekly",
          date
        ),

      bakery:
        false,
    },

    items: {
      daily:
        structure.daily,

      weekly:
        structure.weekly,

      bakery:
        structure.bakery,
    },

    drafts,
  };
}


/* ============================================================
   SAVE STOCK RECORD DRAFT
============================================================ */

async function saveStockDraft(
  env,
  body
) {
  await ensureDatabase(
    env
  );


  const branchCode =
    String(
      body.branchCode ||
      ""
    )
      .trim()
      .toUpperCase();


  const date =
    String(
      body.date ||
      ""
    ).trim();


  const mode =
    String(
      body.mode ||
      ""
    )
      .trim()
      .toLowerCase();


  const values =
    body.values &&
    typeof body.values ===
      "object"
      ? body.values
      : {};


  if (
    !branchCode ||
    !date ||
    ![
      "daily",
      "weekly",
      "bakery",
    ].includes(
      mode
    )
  ) {
    throw new Error(
      "Invalid draft information."
    );
  }


  const draftKey =
    makeStockDraftKey(
      branchCode,
      date,
      mode
    );


  const now =
    Date.now();


  await env.DB.prepare(`
    INSERT INTO stock_drafts (
      draft_key,
      branch_code,
      stock_date,
      mode,
      payload,
      updated_at
    )

    VALUES (?, ?, ?, ?, ?, ?)

    ON CONFLICT(draft_key)
    DO UPDATE SET
      payload =
        excluded.payload,

      updated_at =
        excluded.updated_at
  `)
    .bind(
      draftKey,
      branchCode,
      date,
      mode,
      JSON.stringify(
        values
      ),
      now
    )
    .run();


  return {
    success:
      true,

    savedAt:
      now,
  };
}


/* ============================================================
   DELETE STOCK RECORD DRAFT
============================================================ */

async function deleteStockDraft(
  env,
  branchCode,
  date,
  mode
) {
  await ensureDatabase(
    env
  );


  const key =
    makeStockDraftKey(
      branchCode,
      date,
      mode
    );


  await env.DB.prepare(`
    DELETE FROM stock_drafts
    WHERE draft_key = ?
  `)
    .bind(
      key
    )
    .run();


  return {
    success:
      true,
  };
}


/* ============================================================
   STOCK RECORD FINAL SUBMIT

   IMPORTANT:
   ALWAYS RE-READS LIVE GOOGLE DATA
   BEFORE WRITE.
============================================================ */

async function submitStockRecord(
  env,
  body
) {
  await ensureDatabase(
    env
  );


  const branchCode =
    String(
      body.branchCode ||
      ""
    )
      .trim()
      .toUpperCase();


  const date =
    String(
      body.date ||
      ""
    ).trim();


  const mode =
    String(
      body.mode ||
      ""
    )
      .trim()
      .toLowerCase();


  const values =
    body.values &&
    typeof body.values ===
      "object"
      ? body.values
      : {};


  if (
    !branchCode ||
    !date ||
    ![
      "daily",
      "weekly",
      "bakery",
    ].includes(
      mode
    )
  ) {
    return {
      success:
        false,

      message:
        "Invalid stock submission.",
    };
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (
    !branch ||
    !branch.sheet_id
  ) {
    throw new Error(
      "Branch SheetID missing."
    );
  }


  /* ========================================================
     LIVE GOOGLE CHECK
  ======================================================== */

  const liveSheet =
    await getSheetValues(
      env,
      branch.sheet_id,
      "Stocks!A:ZZ"
    );


  if (
    liveSheet.length ===
    0
  ) {
    throw new Error(
      "Stocks sheet returned empty data."
    );
  }


  const structure =
    buildStockRecordData(
      liveSheet
    );


  /* ========================================================
     DUPLICATE SERVER CHECK
  ======================================================== */

  if (
    stockAlreadySubmitted(
      liveSheet,
      structure,
      mode,
      date
    )
  ) {
    return {
      success:
        false,

      duplicate:
        true,

      message:
        "Data for this date has already been submitted. No rewrite is possible.",
    };
  }


  const expectedItems =
    structure[
      mode
    ];


  if (
    !Array.isArray(
      expectedItems
    ) ||
    expectedItems.length ===
      0
  ) {
    throw new Error(
      `No ${mode} stock items found.`
    );
  }


  /* ========================================================
     VALIDATION
  ======================================================== */

  const missing = [];

  const invalid = [];


  for (
    const item of
    expectedItems
  ) {
    const value =
      String(
        values[
          item.name
        ] ?? ""
      ).trim();


    if (!value) {
      missing.push(
        item.name
      );

      continue;
    }


    if (
      !/^\d+$/.test(
        value
      )
    ) {
      invalid.push(
        item.name
      );
    }
  }


  if (
    invalid.length >
    0
  ) {
    return {
      success:
        false,

      validation:
        true,

      type:
        "invalid",

      items:
        invalid,

      message:
        "Non-numeric quantities were detected.",
    };
  }


  if (
    missing.length >
    0
  ) {
    return {
      success:
        false,

      validation:
        true,

      type:
        "missing",

      items:
        missing,

      message:
        "Some quantities are still empty.",
    };
  }


  /* ========================================================
     DATE COLUMN
  ======================================================== */

  const headers =
    liveSheet[0] ||
    [];


  let dateIndex =
    headers.indexOf(
      date
    );


  let googleColumn;


  const updates = [];


  const dateWasMissing =
    dateIndex === -1;


  if (
    dateWasMissing
  ) {
    dateIndex =
      headers.length;


    googleColumn =
      dateIndex +
      1;


    const letter =
      columnNumberToLetters(
        googleColumn
      );


    updates.push({
      range:
        `Stocks!${letter}1`,

      values:
        [[date]],
    });

  } else {
    googleColumn =
      dateIndex +
      1;
  }


  /* ========================================================
     LIVE COLUMN A MAPPING
  ======================================================== */

  const itemToRow =
    new Map();


  liveSheet.forEach(
    (
      row,
      index
    ) => {
      const item =
        String(
          row?.[0] ||
          ""
        ).trim();


      if (item) {
        itemToRow.set(
          item,
          index +
          1
        );
      }
    }
  );


  const columnLetter =
    columnNumberToLetters(
      googleColumn
    );


  /* ========================================================
     BUILD GOOGLE BATCH
  ======================================================== */

  let itemWrites = 0;


  for (
    const item of
    expectedItems
  ) {
    const row =
      itemToRow.get(
        item.name
      );


    if (!row) {
      continue;
    }


    updates.push({
      range:
        `Stocks!${columnLetter}${row}`,

      values: [
        [
          String(
            values[
              item.name
            ]
          ).trim(),
        ],
      ],
    });


    itemWrites++;
  }


  if (
    itemWrites === 0
  ) {
    throw new Error(
      "No matching stock rows found for submission."
    );
  }


  /* ========================================================
     ONE BATCH WRITE
  ======================================================== */

  await batchWriteSheet(
    env,
    branch.sheet_id,
    updates
  );


  /* ========================================================
     TRANSACTION DETAILS
  ======================================================== */

  const transactionId =
    crypto
      .randomUUID()
      .replace(
        /-/g,
        ""
      )
      .slice(
        0,
        8
      )
      .toUpperCase();


  const submissionTime =
    new Date()
      .toISOString();


  /* ========================================================
     CLEAR DRAFT
  ======================================================== */

  await deleteStockDraft(
    env,
    branchCode,
    date,
    mode
  );


  /* ========================================================
     INVALIDATE STOCK VIEW CACHE
  ======================================================== */

  await env.DB.prepare(`
    DELETE FROM stock_cache
    WHERE branch_code = ?
  `)
    .bind(
      branchCode
    )
    .run();


  /* ========================================================
     INVALIDATE STOCK RECORD CACHE
  ======================================================== */

  await env.DB.prepare(`
    DELETE FROM stock_record_cache
    WHERE branch_code = ?
  `)
    .bind(
      branchCode
    )
    .run();


  return {
    success:
      true,

    transactionId,

    submissionTime,

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },

    mode,

    date,

    itemsWritten:
      itemWrites,
  };
}


/* ============================================================
   DATABASE STATUS
============================================================ */

async function databaseStatus(
  env
) {
  await ensureDatabase(
    env
  );


  const branchCount =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS total

      FROM branches

      WHERE brand = ?
    `)
      .bind(
        "bart"
      )
      .first();


  const transferCount =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS total

      FROM transfers
    `)
      .first();


  const draftCount =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS total

      FROM stock_drafts
    `)
      .first();


  const masterSync =
    await getMeta(
      env,
      "bart_last_sync"
    );


  const transferSyncMs =
    Number(
      await getMeta(
        env,
        "transfers_last_sync_ms"
      ) || 0
    );


  return jsonResponse({
    success:
      true,

    database:
      "D1",

    bartBranches:
      Number(
        branchCount?.total ||
        0
      ),

    transfers:
      Number(
        transferCount?.total ||
        0
      ),

    stockDrafts:
      Number(
        draftCount?.total ||
        0
      ),

    lastSync:
      masterSync,

    transfersLastSync:
      transferSyncMs
        ? new Date(
            transferSyncMs
          ).toISOString()

        : null,

    googleCalled:
      false,
  });
}


/* ============================================================
   MAIN CLOUDFLARE WORKER
============================================================ */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );


    /* ========================================================
       CORS
    ======================================================== */

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status:
            204,

          headers:
            corsHeaders(),
        }
      );
    }


    try {
      /* ======================================================
         API TEST
      ====================================================== */

      if (
        url.pathname ===
        "/api/test"
      ) {
        return jsonResponse({
          success:
            true,

          version:
            "BART-STOCK-RECORD-V6",

          message:
            "DAM BART Worker active",

          features: {
            d1Branches:
              true,

            d1Login:
              true,

            liveTransfers:
              true,

            stockView:
              true,

            stockRecord:
              true,
          },

          envCheck: {
            GOOGLE_CLIENT_EMAIL:
              Boolean(
                env.GOOGLE_CLIENT_EMAIL
              ),

            GOOGLE_PRIVATE_KEY:
              Boolean(
                env.GOOGLE_PRIVATE_KEY
              ),

            GOOGLE_CLIENT_EMAIL_2:
              Boolean(
                env.GOOGLE_CLIENT_EMAIL_2
              ),

            GOOGLE_PRIVATE_KEY_2:
              Boolean(
                env.GOOGLE_PRIVATE_KEY_2
              ),

            MASTER_SHEET_ID:
              Boolean(
                env.MASTER_SHEET_ID
              ),

            ADMIN_SYNC_KEY:
              Boolean(
                env.ADMIN_SYNC_KEY
              ),

            D1_DATABASE:
              Boolean(
                env.DB
              ),
          },
        });
      }


      /* ======================================================
         DATABASE STATUS
      ====================================================== */

      if (
        url.pathname ===
          "/api/admin/database-status" &&
        request.method ===
          "GET"
      ) {
        return await databaseStatus(
          env
        );
      }


      /* ======================================================
         MANUAL MASTER DATABASE REFRESH
      ====================================================== */

      if (
        url.pathname ===
          "/api/admin/sync-bart" &&
        request.method ===
          "POST"
      ) {
        return await syncBartDatabase(
          request,
          env
        );
      }


      /* ======================================================
         BART BRANCH LIST
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/branches" &&
        request.method ===
          "GET"
      ) {
        const branches =
          await getBartBranches(
            env
          );


        return jsonResponse({
          success:
            true,

          source:
            "D1",

          googleCalled:
            false,

          count:
            branches.length,

          branches,
        });
      }


      /* ======================================================
         BART LOGIN
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/login" &&
        request.method ===
          "POST"
      ) {
        return await bartLogin(
          request,
          env
        );
      }


      /* ======================================================
         LIVE PENDING TRANSFERS
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/pending-transfers" &&
        request.method ===
          "GET"
      ) {
        const branchCode =
          String(
            url.searchParams.get(
              "branch"
            ) || ""
          )
            .trim()
            .toUpperCase();


        if (!branchCode) {
          return jsonResponse(
            {
              success:
                false,

              message:
                "Branch required.",
            },
            400
          );
        }


        const result =
          await getPendingTransfers(
            env,
            branchCode
          );


        return jsonResponse({
          success:
            true,

          count:
            result.transfers.length,

          transfers:
            result.transfers,

          transferFreshness:
            result.freshness,
        });
      }


      /* ======================================================
         ACCEPT / REJECT TRANSFER
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/transfer/respond" &&
        request.method ===
          "POST"
      ) {
        return await respondTransfer(
          request,
          env
        );
      }


      /* ======================================================
         STOCK VIEW
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-view" &&
        request.method ===
          "GET"
      ) {
        const branchCode =
          String(
            url.searchParams.get(
              "branch"
            ) || ""
          )
            .trim()
            .toUpperCase();


        const forceRefresh =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        if (!branchCode) {
          return jsonResponse(
            {
              success:
                false,

              message:
                "Branch required.",
            },
            400
          );
        }


        const result =
          await getStockView(
            env,
            branchCode,
            forceRefresh
          );


        return jsonResponse({
          success:
            true,

          branch:
            branchCode,

          source:
            result.source,

          syncedAt:
            result.syncedAt,

          stock:
            result.data,
        });
      }


      /* ======================================================
         STOCK RECORD INIT

         Example:
         /api/staff/bart/stock-record/init
         ?branch=B022
         &date=2026-08-26
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/init" &&
        request.method ===
          "GET"
      ) {
        const branchCode =
          String(
            url.searchParams.get(
              "branch"
            ) || ""
          )
            .trim()
            .toUpperCase();


        const date =
          String(
            url.searchParams.get(
              "date"
            ) || ""
          ).trim();


        if (
          !branchCode ||
          !date
        ) {
          return jsonResponse(
            {
              success:
                false,

              message:
                "Branch and date are required.",
            },
            400
          );
        }


        const result =
          await stockRecordInit(
            env,
            branchCode,
            date
          );


        return jsonResponse(
          result
        );
      }


      /* ======================================================
         SAVE STOCK RECORD DRAFT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/draft" &&
        request.method ===
          "POST"
      ) {
        const body =
          await request.json();


        const result =
          await saveStockDraft(
            env,
            body
          );


        return jsonResponse(
          result
        );
      }


      /* ======================================================
         DELETE STOCK RECORD DRAFT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/draft" &&
        request.method ===
          "DELETE"
      ) {
        const body =
          await request.json();


        const result =
          await deleteStockDraft(
            env,

            String(
              body.branchCode ||
              ""
            )
              .trim()
              .toUpperCase(),

            String(
              body.date ||
              ""
            ).trim(),

            String(
              body.mode ||
              ""
            )
              .trim()
              .toLowerCase()
          );


        return jsonResponse(
          result
        );
      }


      /* ======================================================
         FINAL STOCK RECORD SUBMIT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/submit" &&
        request.method ===
          "POST"
      ) {
        const body =
          await request.json();


        const result =
          await submitStockRecord(
            env,
            body
          );


        return jsonResponse(
          result,

          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         REACT FRONTEND
      ====================================================== */

      if (
        env.ASSETS
      ) {
        return env.ASSETS.fetch(
          request
        );
      }


      /* ======================================================
         NOT FOUND
      ====================================================== */

      return jsonResponse(
        {
          success:
            false,

          message:
            "Route not found.",
        },
        404
      );

    } catch (error) {
      console.error(
        "DAM BACKEND ERROR:",
        error
      );


      return jsonResponse(
        {
          success:
            false,

          message:
            error?.message ||
            "Internal server error.",
        },
        500
      );
    }
  },
};
