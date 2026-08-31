/* ============================================================
   DAM OPERATIONS
   BART STAFF BACKEND

   VERSION:
   BART-STAFF-SCHEDULE-V8dfgc
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
   RESPONSE
============================================================ */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",

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
   DATABASE
============================================================ */

async function ensureDatabase(env) {

  if (!env.DB) {
    throw new Error(
      "D1 binding DB is missing."
    );
  }


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
    CREATE INDEX IF NOT EXISTS
    idx_transfers_destination_status
    ON transfers(destination, status)
  `).run();


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_cache (
      branch_code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_record_cache (
      branch_code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


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
    CREATE INDEX IF NOT EXISTS
    idx_stock_drafts_branch_date
    ON stock_drafts(branch_code, stock_date)
  `).run();


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS schedule_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();


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
      "No Google service accounts configured."
    );
  }


  return accounts;
}


/* ============================================================
   JWT HELPERS
============================================================ */

function base64UrlEncodeString(
  input
) {

  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function pemToArrayBuffer(
  pem
) {

  const normalized =
    String(
      pem || ""
    )
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
      "Google private key missing."
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


  const timestamp =
    Math.floor(
      now / 1000
    );


  const header = {
    alg:
      "RS256",

    typ:
      "JWT",
  };


  const claims = {

    iss:
      account.email,

    scope:
      GOOGLE_SCOPE,

    aud:
      GOOGLE_TOKEN_URL,

    iat:
      timestamp,

    exp:
      timestamp + 3600,
  };


  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(
        header
      )
    );


  const encodedClaims =
    base64UrlEncodeString(
      JSON.stringify(
        claims
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

      new TextEncoder().encode(
        unsignedJWT
      )
    );


  const jwt =
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
              jwt,
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
   DUAL CONNECTION ROUND ROBIN
============================================================ */

let googleAccountCounter = 0;


function rotatedGoogleAccounts(
  env
) {

  const accounts =
    getGoogleAccounts(
      env
    );


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


async function googleRequest(
  env,
  factory
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
        await factory(
          token,
          account
        );


      if (
        response.status === 429 ||
        response.status === 403
      ) {

        lastError =
          new Error(
            `${account.id} temporarily unavailable`
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
      "All Google service accounts failed."
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
   GOOGLE APPEND
============================================================ */

async function appendSheetRow(
  env,
  spreadsheetId,
  range,
  row
) {

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(
      spreadsheetId
    )}/values/` +
    `${encodeURIComponent(
      range
    )}:append` +
    `?valueInputOption=USER_ENTERED` +
    `&insertDataOption=INSERT_ROWS`;


  const response =
    await googleRequest(
      env,

      (
        token,
        account
      ) => {

        console.log(
          "GOOGLE APPEND:",
          account.id,
          range
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

                values:
                  [row],
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
      "Google append failed."
    );
  }


  return result;
}


/* ============================================================
   HELPERS
============================================================ */

function normalizeHeader(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}


function columnNumberToLetters(
  number
) {

  let output = "";


  while (
    number > 0
  ) {

    const remainder =
      (
        number - 1
      ) %
      26;


    output =
      String.fromCharCode(
        65 +
        remainder
      ) +
      output;


    number =
      Math.floor(
        (
          number - 1
        ) /
        26
      );
  }


  return output;
}


/* ============================================================
   JEDDAH TIME
============================================================ */

function getJeddahNow() {

  return new Date(
    new Date().toLocaleString(
      "en-US",
      {
        timeZone:
          "Asia/Riyadh",
      }
    )
  );
}


function getJeddahYesterdayISO() {

  const date =
    getJeddahNow();


  date.setDate(
    date.getDate() -
    1
  );


  return [

    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),

  ].join("-");
}


function formatJeddahTimestamp() {

  const now =
    getJeddahNow();


  let hour =
    now.getHours();


  const ampm =
    hour >= 12
      ? "PM"
      : "AM";


  hour =
    hour % 12 ||
    12;


  return (

    `${now.getFullYear()}-` +

    `${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-` +

    `${String(
      now.getDate()
    ).padStart(2, "0")} ` +

    `${String(
      hour
    ).padStart(2, "0")}:` +

    `${String(
      now.getMinutes()
    ).padStart(2, "0")}:` +

    `${String(
      now.getSeconds()
    ).padStart(2, "0")} ` +

    `${ampm}`
  );
}


/* ============================================================
   META
============================================================ */

async function setMeta(
  env,
  key,
  value
) {

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

      String(
        value
      ),

      new Date()
        .toISOString()
    )
    .run();
}


async function getMeta(
  env,
  key
) {

  const row =
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
    row?.value ||
    null
  );
}


/* ============================================================
   LOCK
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
        sync_locks.expires_at < ?
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
   MASTER BRANCH READ
============================================================ */

async function readBartMaster(
  env
) {

  const rows =
    await getSheetValues(

      env,

      env.MASTER_SHEET_ID,

      "Sheet1!A:Z"
    );


  if (!rows.length) {

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


  const sheetIndex =
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
      "BranchCode or BranchName missing."
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


    if (
      !code.startsWith(
        "B"
      )
    ) {

      continue;
    }


    const password =
      passwordIndex >= 0
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
        sheetIndex >= 0
          ? String(
              row[
                sheetIndex
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
   GET BRANCH
============================================================ */

async function getBartBranch(
  env,
  code
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
      code
    )
    .first();
}


/* ============================================================
   MANUAL SYNC AUTH
============================================================ */

function adminAuthorized(
  request,
  env
) {

  return (

    Boolean(
      env.ADMIN_SYNC_KEY
    ) &&

    request.headers.get(
      "X-Admin-Key"
    ) ===
    env.ADMIN_SYNC_KEY
  );
}


/* ============================================================
   TRANSFER GOOGLE READ
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


  if (!rows.length) {

    return [];
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  const index =
    (name) =>
      headers.indexOf(
        normalizeHeader(
          name
        )
      );


  const idIndex =
    index("ID");

  const originIndex =
    index("Origin");

  const destinationIndex =
    index("Destination");

  const itemsIndex =
    index("Items");

  const quantitiesIndex =
    index("Quantities");

  const reasonIndex =
    index("Reason");

  const statusIndex =
    index("Status");

  const timestampIndex =
    index("Timestamp");


  if (
    idIndex === -1 ||
    originIndex === -1 ||
    destinationIndex === -1
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
          itemsIndex >= 0
            ? String(
                row[
                  itemsIndex
                ] || ""
              )
            : "",

        quantities:
          quantitiesIndex >= 0
            ? String(
                row[
                  quantitiesIndex
                ] || ""
              )
            : "",

        reason:
          reasonIndex >= 0
            ? String(
                row[
                  reasonIndex
                ] || ""
              )
            : "",

        status:
          statusIndex >= 0
            ? String(
                row[
                  statusIndex
                ] ||
                "Pending"
              ).trim()

            : "Pending",

        timestamp:
          timestampIndex >= 0
            ? String(
                row[
                  timestampIndex
                ] || ""
              )
            : "",
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


  const statements = [

    env.DB.prepare(`
      DELETE FROM transfers
    `),
  ];


  for (
    const transfer of transfers
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

          transfer.timestamp ||
          now
        )
    );
  }


  await env.DB.batch(
    statements
  );


  await setMeta(
    env,
    "transfers_last_sync_ms",
    Date.now()
  );
}


/* ============================================================
   LIVE TRANSFER REFRESH
============================================================ */

async function ensureTransfersFresh(
  env
) {

  await ensureDatabase(
    env
  );


  const lastSync =
    Number(
      await getMeta(
        env,
        "transfers_last_sync_ms"
      ) || 0
    );


  if (
    lastSync &&
    Date.now() -
    lastSync <
    TRANSFER_CACHE_SECONDS *
    1000
  ) {

    return {

      source:
        "D1",

      refreshed:
        false,
    };
  }


  const acquired =
    await acquireLock(

      env,

      "transfer-live-sync",

      20
    );


  if (!acquired) {

    return {

      source:
        "D1-SYNC-IN-PROGRESS",

      refreshed:
        false,
    };
  }


  try {

    const lastAgain =
      Number(
        await getMeta(
          env,
          "transfers_last_sync_ms"
        ) || 0
      );


    if (
      lastAgain &&
      Date.now() -
      lastAgain <
      TRANSFER_CACHE_SECONDS *
      1000
    ) {

      return {

        source:
          "D1",

        refreshed:
          false,
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

      source:
        "GOOGLE->D1",

      refreshed:
        true,

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
   MANUAL MASTER SYNC
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


  const statements = [

    env.DB.prepare(`
      DELETE FROM branches
      WHERE brand = 'bart'
    `),
  ];


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


  const transfers =
    await readTransfersGoogle(
      env
    );


  await saveTransfersToD1(
    env,
    transfers
  );


  await setMeta(
    env,
    "bart_last_sync",
    now
  );


  return jsonResponse({

    success:
      true,

    message:
      "BART database refreshed.",

    branches:
      branches.length,

    transfers:
      transfers.length,

    lastSync:
      now,
  });
}


/* ============================================================
   LOGIN
============================================================ */

async function bartLogin(
  request,
  env
) {

  await ensureDatabase(
    env
  );


  const body =
    await request.json();


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
    );


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


  const hash =
    await hashPassword(
      password
    );


  if (
    hash !==
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
   PENDING TRANSFERS
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
        status,
        updated_at

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

  const items =
    String(
      transfer.items ||
      ""
    )
      .replace(
        /â€¢/g,
        "•"
      )
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
    String(
      transfer.quantities ||
      ""
    )
      .split("\n")
      .map(
        (value) =>
          value.trim()
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

    let item =
      items[i];


    if (
      item.includes(
        "]"
      )
    ) {

      item =
        item
          .split("]")
          .slice(1)
          .join("]")
          .trim();
    }


    item =
      item
        .split(
          " ("
        )[0]
        .trim();


    cart.push({

      item,

      qty:
        quantities[i],
    });
  }


  return cart;
}


/* ============================================================
   MODIFY STOCK
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


  const targetDate =
    getJeddahYesterdayISO();


  const headers =
    rows[0] ||
    [];


  const columnIndex =
    headers.indexOf(
      targetDate
    );


  if (
    columnIndex === -1
  ) {

    throw new Error(
      `Stock date ${targetDate} not found.`
    );
  }


  const itemRows =
    new Map();


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const item =
      String(
        rows[i]?.[0] ||
        ""
      ).trim();


    if (item) {

      itemRows.set(
        item,
        i
      );
    }
  }


  const updates = [];


  const letter =
    columnNumberToLetters(
      columnIndex + 1
    );


  for (
    const entry of cart
  ) {

    if (
      !itemRows.has(
        entry.item
      )
    ) {

      continue;
    }


    const rowIndex =
      itemRows.get(
        entry.item
      );


    const raw =
      rows[
        rowIndex
      ]?.[
        columnIndex
      ];


    const current =
      Number(
        String(
          raw ?? ""
        )
          .replace(
            /,/g,
            ""
          )
          .trim() ||
        0
      ) ||
      0;


    const qty =
      Number(
        entry.qty
      ) ||
      0;


    const next =
      mode ===
      "subtract"

        ? current -
          qty

        : current +
          qty;


    updates.push({

      range:
        `Stocks!${letter}${rowIndex + 1}`,

      values:
        [[next]],
    });
  }


  if (!updates.length) {

    throw new Error(
      "Transfer items not found."
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


  const headers =
    (
      rows[0] ||
      []
    ).map(
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


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    if (
      String(
        rows[i]?.[
          idIndex
        ] ||
        ""
      ).trim() ===
      transferId
    ) {

      return {

        row:
          i + 1,

        statusColumn:
          statusIndex + 1,
      };
    }
  }


  return null;
}


/* ============================================================
   TRANSFER STATUS WRITE
============================================================ */

async function updateTransferStatus(
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
      "Transfer not found."
    );
  }


  const letter =
    columnNumberToLetters(
      location.statusColumn
    );


  await batchWriteSheet(

    env,

    env.MASTER_SHEET_ID,

    [
      {

        range:
          `Transfers!${letter}${location.row}`,

        values:
          [[status]],
      },
    ]
  );
}


/* ============================================================
   ACCEPT / REJECT
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
          "Invalid transfer action.",
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


  const status =
    action ===
    "accept"

      ? "Accepted"

      : "Rejected";


  await updateTransferStatus(

    env,

    transferId,

    status
  );


  await env.DB.prepare(`
    UPDATE transfers

    SET
      status = ?,
      updated_at = ?

    WHERE id = ?
  `)
    .bind(

      status,

      new Date()
        .toISOString(),

      transferId
    )
    .run();


  if (
    action ===
    "reject"
  ) {

    const cart =
      parseTransferItems(
        transfer
      );


    const originCode =
      transfer.origin
        .split(
          " - "
        )[0];


    const destinationCode =
      transfer.destination
        .split(
          " - "
        )[0];


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


    await modifyBranchStock(

      env,

      origin.sheet_id,

      cart,

      "add"
    );


    await modifyBranchStock(

      env,

      destination.sheet_id,

      cart,

      "subtract"
    );


    await env.DB.prepare(`
      DELETE FROM stock_cache
      WHERE branch_code IN (?, ?)
    `)
      .bind(
        originCode,
        destinationCode
      )
      .run();


    await env.DB.prepare(`
      DELETE FROM stock_record_cache
      WHERE branch_code IN (?, ?)
    `)
      .bind(
        originCode,
        destinationCode
      )
      .run();
  }


  return jsonResponse({

    success:
      true,

    status,

    message:
      action ===
      "accept"

        ? "Transfer accepted successfully."

        : "Transfer rejected and stock reversal completed.",
  });
}


/* ============================================================
   STOCK VIEW
============================================================ */

function parseStockViewData(
  rows
) {

  const headers =
    rows[0] ||
    [];


  const columns =
    headers.slice(1);


  const daily = [];

  const weekly = [];


  let section =
    null;


  for (
    const row of rows
  ) {

    const text =
      (row || [])
        .join(" ")
        .trim()
        .toLowerCase();


    if (
      text.includes(
        "daily item"
      )
    ) {

      section =
        "daily";

      continue;
    }


    if (
      text.includes(
        "weekly item"
      )
    ) {

      section =
        "weekly";

      continue;
    }


    if (
      !section ||
      !row?.[0]
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
      columns.length
    ) {

      values.push("");
    }


    const object = {
      Item:
        item,
    };


    let total = 0;


    columns.forEach(
      (
        column,
        index
      ) => {

        if (
          index < 2
        ) {

          object[
            column
          ] =
            values[index] ??
            "";

        } else {

          const num =
            Number(
              values[index] ||
              0
            );


          const safe =
            Number.isFinite(
              num
            )

              ? num

              : 0;


          object[
            column
          ] =
            safe;


          total +=
            safe;
        }
      }
    );


    object.Total =
      total;


    if (
      section ===
      "daily"
    ) {

      daily.push(
        object
      );

    } else {

      weekly.push(
        object
      );
    }
  }


  return {

    daily,

    weekly,
  };
}


async function getStockView(
  env,
  branchCode,
  force = false
) {

  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch?.sheet_id) {

    throw new Error(
      "Branch SheetID missing."
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
    !force &&
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
}


/* ============================================================
   STOCK STRUCTURE
============================================================ */

function findSectionIndex(
  values,
  name
) {

  const target =
    name
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
      target
    ) {

      return i;
    }
  }


  return null;
}


function buildStockRecordData(
  sheet
) {

  const columnA =
    sheet.map(
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
      "Daily or Weekly section missing."
    );
  }


  function sectionItems(
    mode
  ) {

    const items = [];


    const start =
      mode ===
      "daily"

        ? dailyStart + 1

        : weeklyStart + 1;


    const end =
      mode ===
      "daily"

        ? weeklyStart

        : sheet.length;


    for (
      let i = start;
      i < end;
      i++
    ) {

      const row =
        sheet[i] ||
        [];


      const name =
        String(
          row[0] ||
          ""
        ).trim();


      if (!name) {

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
          i + 1,
      });
    }


    return items;
  }


  const bakery = [];


  for (
    let i = 1;
    i < sheet.length;
    i++
  ) {

    const row =
      sheet[i] ||
      [];


    const sku =
      String(
        row[1] ||
        ""
      ).trim();


    if (
      BAKERY_SKUS.has(
        sku
      )
    ) {

      bakery.push({

        name:
          String(
            row[0] ||
            ""
          ).trim(),

        sku,

        uom:
          String(
            row[2] ||
            ""
          ).trim(),

        row:
          i + 1,
      });
    }
  }


  return {

    daily:
      sectionItems(
        "daily"
      ),

    weekly:
      sectionItems(
        "weekly"
      ),

    bakery,

    dailyStart,

    weeklyStart,
  };
}


/* ============================================================
   STOCK RECORD STRUCTURE CACHE
============================================================ */

async function loadStockRecordStructure(
  env,
  branchCode,
  force = false
) {

  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch?.sheet_id) {

    throw new Error(
      "Branch SheetID missing."
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
   DUPLICATE CHECK
============================================================ */

function stockAlreadySubmitted(
  sheet,
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
    sheet[0] ||
    [];


  const column =
    headers.indexOf(
      date
    );


  if (
    column === -1
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

      : sheet.length;


  for (
    let row = start;
    row < end;
    row++
  ) {

    if (
      String(
        sheet[row]?.[
          column
        ] ||
        ""
      ).trim()
    ) {

      return true;
    }
  }


  return false;
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


  const draftRows =
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
    draftRows.results ||
    []
  ) {

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
   DRAFT
============================================================ */

function makeStockDraftKey(
  branch,
  date,
  mode
) {

  return (
    `${branch}_` +
    `${date}_` +
    `${mode}`
  );
}


async function saveStockDraft(
  env,
  body
) {

  const branch =
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
    );


  const mode =
    String(
      body.mode ||
      ""
    )
      .trim()
      .toLowerCase();


  const values =
    body.values ||
    {};


  const key =
    makeStockDraftKey(
      branch,
      date,
      mode
    );


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

      key,
      branch,
      date,
      mode,

      JSON.stringify(
        values
      ),

      Date.now()
    )
    .run();


  return {

    success:
      true,
  };
}


async function deleteStockDraft(
  env,
  branch,
  date,
  mode
) {

  await env.DB.prepare(`
    DELETE FROM stock_drafts
    WHERE draft_key = ?
  `)
    .bind(
      makeStockDraftKey(
        branch,
        date,
        mode
      )
    )
    .run();


  return {

    success:
      true,
  };
}


/* ============================================================
   STOCK RECORD SUBMIT
============================================================ */

async function submitStockRecord(
  env,
  body
) {

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
    );


  const mode =
    String(
      body.mode ||
      ""
    )
      .trim()
      .toLowerCase();


  const values =
    body.values ||
    {};


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  const sheet =
    await getSheetValues(

      env,

      branch.sheet_id,

      "Stocks!A:ZZ"
    );


  const structure =
    buildStockRecordData(
      sheet
    );


  if (
    stockAlreadySubmitted(
      sheet,
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
        "Data for this date has already been submitted.",
    };
  }


  const items =
    structure[
      mode
    ];


  const missing = [];


  for (
    const item of items
  ) {

    if (
      !String(
        values[
          item.name
        ] ??
        ""
      ).trim()
    ) {

      missing.push(
        item.name
      );
    }
  }


  if (
    missing.length
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
        "Some quantities are empty.",
    };
  }


  const headers =
    sheet[0] ||
    [];


  let dateIndex =
    headers.indexOf(
      date
    );


  const updates = [];


  if (
    dateIndex === -1
  ) {

    dateIndex =
      headers.length;


    const letter =
      columnNumberToLetters(
        dateIndex + 1
      );


    updates.push({

      range:
        `Stocks!${letter}1`,

      values:
        [[date]],
    });
  }


  const letter =
    columnNumberToLetters(
      dateIndex + 1
    );


  const itemRows =
    new Map();


  sheet.forEach(
    (
      row,
      index
    ) => {

      const name =
        String(
          row?.[0] ||
          ""
        ).trim();


      if (name) {

        itemRows.set(
          name,
          index + 1
        );
      }
    }
  );


  for (
    const item of items
  ) {

    const row =
      itemRows.get(
        item.name
      );


    if (!row) {

      continue;
    }


    updates.push({

      range:
        `Stocks!${letter}${row}`,

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
  }


  await batchWriteSheet(

    env,

    branch.sheet_id,

    updates
  );


  await deleteStockDraft(

    env,

    branchCode,

    date,

    mode
  );


  await env.DB.prepare(`
    DELETE FROM stock_cache
    WHERE branch_code = ?
  `)
    .bind(
      branchCode
    )
    .run();


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

    transactionId:
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
        .toUpperCase(),

    submissionTime:
      new Date()
        .toISOString(),

    mode,

    date,
  };
}


/* ============================================================
   STOCK TRANSFER INIT
============================================================ */

function buildTransferItemsFromSheet(
  rows
) {

  const structure =
    buildStockRecordData(
      rows
    );


  const targetDate =
    getJeddahYesterdayISO();


  const headers =
    rows[0] ||
    [];


  const dateIndex =
    headers.indexOf(
      targetDate
    );


  function prepare(
    items
  ) {

    return items.map(
      (item) => {

        const raw =
          dateIndex >= 0
            ? rows[
                item.row -
                1
              ]?.[
                dateIndex
              ]

            : 0;


        const available =
          Number(
            String(
              raw ?? ""
            )
              .replace(
                /,/g,
                ""
              )
              .trim() ||
            0
          ) ||
          0;


        return {

          name:
            item.name,

          sku:
            item.sku,

          uom:
            item.uom,

          available,
        };
      }
    );
  }


  return {

    targetDate,

    dateAvailable:
      dateIndex !== -1,

    daily:
      prepare(
        structure.daily
      ),

    weekly:
      prepare(
        structure.weekly
      ),
  };
}


async function stockTransferInit(
  env,
  branchCode
) {

  const origin =
    await getBartBranch(
      env,
      branchCode
    );


  const loaded =
    await loadStockRecordStructure(

      env,

      branchCode
    );


  const stock =
    buildTransferItemsFromSheet(
      loaded.sheetData
    );


  const branchRows =
    await env.DB.prepare(`
      SELECT
        code,
        name

      FROM branches

      WHERE brand = 'bart'

      ORDER BY code
    `).all();


  const destinations =
    (
      branchRows.results ||
      []
    )

    /* don't transfer to yourself */
    .filter(
      (branch) =>
        branch.code !==
        origin.code
    )

    .map(
      (branch) => ({

        code:
          branch.code,

        name:
          branch.name,

        label:
          `${branch.code} - ${branch.name}`,
      })
    );


  return {

    success:
      true,

    source:
      loaded.source,

    origin: {

      code:
        origin.code,

      name:
        origin.name,

      label:
        `${origin.code} - ${origin.name}`,
    },

    targetDate:
      stock.targetDate,

    dateAvailable:
      stock.dateAvailable,

    items: {

      daily:
        stock.daily,

      weekly:
        stock.weekly,
    },

    destinations,
  };
}


/* ============================================================
   CART NORMALIZER
============================================================ */

function normalizeTransferCart(
  rawCart
) {

  const merged =
    new Map();


  for (
    const raw of
    Array.isArray(
      rawCart
    )
      ? rawCart
      : []
  ) {

    const item =
      String(
        raw.item ||
        ""
      ).trim();


    const qty =
      Math.trunc(
        Number(
          raw.qty
        )
      );


    if (
      !item ||
      !Number.isFinite(
        qty
      ) ||
      qty < 1
    ) {

      continue;
    }


    if (
      merged.has(
        item
      )
    ) {

      merged.get(
        item
      ).qty +=
        qty;

    } else {

      merged.set(
        item,
        {

          item,

          sku:
            String(
              raw.sku ||
              ""
            ),

          uom:
            String(
              raw.uom ||
              ""
            ),

          qty,
        }
      );
    }
  }


  return Array.from(
    merged.values()
  );
}


/* ============================================================
   MOVEMENT PLAN
============================================================ */

function buildStockMovementPlan(
  rows,
  cart,
  mode
) {

  const targetDate =
    getJeddahYesterdayISO();


  const headers =
    rows[0] ||
    [];


  const columnIndex =
    headers.indexOf(
      targetDate
    );


  if (
    columnIndex === -1
  ) {

    throw new Error(
      `Column for ${targetDate} not found.`
    );
  }


  const itemRows =
    new Map();


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const item =
      String(
        rows[i]?.[0] ||
        ""
      ).trim();


    if (item) {

      itemRows.set(
        item,
        i
      );
    }
  }


  const shortages = [];

  const missing = [];

  const updates = [];

  const rollback = [];


  const letter =
    columnNumberToLetters(
      columnIndex + 1
    );


  for (
    const entry of cart
  ) {

    if (
      !itemRows.has(
        entry.item
      )
    ) {

      missing.push(
        entry.item
      );

      continue;
    }


    const rowIndex =
      itemRows.get(
        entry.item
      );


    const raw =
      rows[
        rowIndex
      ]?.[
        columnIndex
      ];


    const current =
      Number(
        String(
          raw ?? ""
        )
          .replace(
            /,/g,
            ""
          )
          .trim() ||
        0
      ) ||
      0;


    if (
      mode ===
      "subtract" &&
      current <
      entry.qty
    ) {

      shortages.push({

        item:
          entry.item,

        have:
          current,

        need:
          entry.qty,
      });


      continue;
    }


    const next =
      mode ===
      "subtract"

        ? current -
          entry.qty

        : current +
          entry.qty;


    const range =
      `Stocks!${letter}${rowIndex + 1}`;


    updates.push({

      range,

      values:
        [[next]],
    });


    rollback.push({

      range,

      values:
        [[current]],
    });
  }


  return {

    targetDate,

    updates,

    rollback,

    shortages,

    missing,
  };
}


/* ============================================================
   TRANSFER ID
============================================================ */

function generateTransferId() {

  const now =
    getJeddahNow();


  const date =

    `${now.getFullYear()}` +

    `${String(
      now.getMonth() + 1
    ).padStart(2, "0")}` +

    `${String(
      now.getDate()
    ).padStart(2, "0")}`;


  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


  let suffix = "";


  for (
    let i = 0;
    i < 4;
    i++
  ) {

    suffix +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];
  }


  return (
    `TR-${date}-${suffix}`
  );
}


/* ============================================================
   CREATE TRANSFER
============================================================ */

async function createStockTransfer(
  env,
  body
) {

  const originCode =
    String(
      body.originBranch ||
      ""
    )
      .trim()
      .toUpperCase();


  const destinationCode =
    String(
      body.destinationBranch ||
      ""
    )
      .trim()
      .toUpperCase();


  const reason =
    String(
      body.reason ||
      ""
    );


  const cart =
    normalizeTransferCart(
      body.cart
    );


  if (
    !originCode ||
    !destinationCode
  ) {

    return {

      success:
        false,

      message:
        "Origin and destination are required.",
    };
  }


  if (
    originCode ===
    destinationCode
  ) {

    return {

      success:
        false,

      message:
        "Origin and destination cannot be the same branch.",
    };
  }


  if (!cart.length) {

    return {

      success:
        false,

      message:
        "Transfer cart is empty.",
    };
  }


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

    return {

      success:
        false,

      message:
        "Origin or destination SheetID missing.",
    };
  }


  /*
    LIVE GOOGLE READS
  */

  const [
    originRows,
    destinationRows,
  ] =
    await Promise.all([

      getSheetValues(

        env,

        origin.sheet_id,

        "Stocks!A:ZZ"
      ),

      getSheetValues(

        env,

        destination.sheet_id,

        "Stocks!A:ZZ"
      ),
    ]);


  const originPlan =
    buildStockMovementPlan(

      originRows,

      cart,

      "subtract"
    );


  const destinationPlan =
    buildStockMovementPlan(

      destinationRows,

      cart,

      "add"
    );


  if (
    originPlan.shortages.length
  ) {

    return {

      success:
        false,

      insufficient:
        true,

      items:
        originPlan.shortages,

      message:
        "Insufficient stock.",
    };
  }


  if (
    originPlan.missing.length ||
    destinationPlan.missing.length
  ) {

    return {

      success:
        false,

      missingItems:
        true,

      originMissing:
        originPlan.missing,

      destinationMissing:
        destinationPlan.missing,

      message:
        "Some stock items are missing.",
    };
  }


  const transferId =
    generateTransferId();


  const timestamp =
    formatJeddahTimestamp();


  const originLabel =
    `${origin.code} - ${origin.name}`;


  const destinationLabel =
    `${destination.code} - ${destination.name}`;


  let originWritten =
    false;


  let destinationWritten =
    false;


  try {

    /*
      1. SUBTRACT ORIGIN
    */

    await batchWriteSheet(

      env,

      origin.sheet_id,

      originPlan.updates
    );


    originWritten =
      true;


    /*
      2. ADD DESTINATION
    */

    await batchWriteSheet(

      env,

      destination.sheet_id,

      destinationPlan.updates
    );


    destinationWritten =
      true;


    /*
      BUILD TRANSFER TEXT
    */

    const itemsText =
      cart
        .map(
          (entry) =>
            `• [${entry.sku}] ` +
            `${entry.item} ` +
            `(${entry.qty} ${entry.uom})`
        )
        .join("\n");


    const quantitiesText =
      cart
        .map(
          (entry) =>
            String(
              entry.qty
            )
        )
        .join("\n");


    /*
      3. APPEND TO MASTER TRANSFERS
    */

    await appendSheetRow(

      env,

      env.MASTER_SHEET_ID,

      "Transfers!A:H",

      [

        transferId,

        originLabel,

        destinationLabel,

        itemsText,

        quantitiesText,

        reason,

        "Pending",

        timestamp,
      ]
    );


    /*
      4. IMMEDIATE D1 INSERT
    */

    await env.DB.prepare(`
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

      ON CONFLICT(id)
      DO UPDATE SET

        origin =
          excluded.origin,

        destination =
          excluded.destination,

        items =
          excluded.items,

        quantities =
          excluded.quantities,

        reason =
          excluded.reason,

        status =
          excluded.status,

        updated_at =
          excluded.updated_at
    `)
      .bind(

        transferId,

        originLabel,

        destinationLabel,

        itemsText,

        quantitiesText,

        reason,

        "Pending",

        new Date()
          .toISOString()
      )
      .run();


    await setMeta(

      env,

      "transfers_last_sync_ms",

      Date.now()
    );


    /*
      INVALIDATE STOCK CACHES
    */

    await env.DB.prepare(`
      DELETE FROM stock_cache
      WHERE branch_code IN (?, ?)
    `)
      .bind(
        originCode,
        destinationCode
      )
      .run();


    await env.DB.prepare(`
      DELETE FROM stock_record_cache
      WHERE branch_code IN (?, ?)
    `)
      .bind(
        originCode,
        destinationCode
      )
      .run();


    return {

      success:
        true,

      transferId,

      origin:
        originLabel,

      destination:
        destinationLabel,

      timestamp,

      targetDate:
        originPlan.targetDate,

      items:
        cart,

      message:
        "Transfer completed successfully.",
    };

  } catch (error) {

    console.error(
      "TRANSFER FAILURE:",
      error
    );


    /*
      ROLLBACK DESTINATION
    */

    if (
      destinationWritten
    ) {

      try {

        await batchWriteSheet(

          env,

          destination.sheet_id,

          destinationPlan.rollback
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Destination rollback failed:",
          rollbackError
        );
      }
    }


    /*
      ROLLBACK ORIGIN
    */

    if (
      originWritten
    ) {

      try {

        await batchWriteSheet(

          env,

          origin.sheet_id,

          originPlan.rollback
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Origin rollback failed:",
          rollbackError
        );
      }
    }


    return {

      success:
        false,

      message:
        `Transfer failed: ${
          error?.message ||
          "Unknown error"
        }`,
    };
  }
}


/* ============================================================
   TRANSFER HISTORY
============================================================ */

async function getTransferHistory(
  env,
  branchCode,
  limit = 3,
  offset = 0
) {

  await ensureTransfersFresh(
    env
  );


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  const label =
    `${branch.code} - ${branch.name}`;


  const count =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS total

      FROM transfers

      WHERE
        origin = ?
        OR destination = ?
    `)
      .bind(
        label,
        label
      )
      .first();


  const rows =
    await env.DB.prepare(`
      SELECT
        id,
        origin,
        destination,
        items,
        quantities,
        reason,
        status,
        updated_at

      FROM transfers

      WHERE
        origin = ?
        OR destination = ?

      ORDER BY updated_at DESC

      LIMIT ?
      OFFSET ?
    `)
      .bind(
        label,
        label,
        limit,
        offset
      )
      .all();


  return {

    success:
      true,

    total:
      Number(
        count?.total ||
        0
      ),

    transfers:
      rows.results ||
      [],
  };
}


/* ============================================================
   BART STAFF SCHEDULE MODULE V8
   Add these functions ABOVE export default in worker/index.js
============================================================ */

const STAFF_SCHEDULE_FALLBACK_ID =
  "1UtHUn7miqYzaP-NnrwMR_5wnSgLnaYPRQX2c4I7_9B0";

const STAFF_SCHEDULE_TAB =
  "StaffSchedule";

const STAFF_SCHEDULE_CACHE_SECONDS =
  300;

const STAFF_SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STAFF_ROLE_OPTIONS = [
  "Team-Member",
  "Acting_Team_Leader",
  "Team_Leader",
  "Acting_Supervisor",
  "Supervisor",
  "Branch_Manager",
];

function getStaffScheduleSheetId(env) {
  return (
    env.STAFF_SCHEDULE_SHEET_ID ||
    STAFF_SCHEDULE_FALLBACK_ID
  );
}

function parseScheduleDate(isoDate) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(isoDate || "")
    );

  if (!match) {
    throw new Error(
      "Invalid date. Expected YYYY-MM-DD."
    );
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function formatScheduleISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function scheduleWeekMeta(isoDate) {
  const selected =
    parseScheduleDate(isoDate);

  const weekStart =
    new Date(selected);

  weekStart.setDate(
    selected.getDate() -
    selected.getDay()
  );

  const dayLabels = {};

  STAFF_SCHEDULE_DAYS.forEach((day, index) => {
    const date = new Date(weekStart);
    date.setDate(
      weekStart.getDate() + index
    );

    dayLabels[day] =
      `${day} (${date.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
        }
      )})`;
  });

  const comparison =
    new Date(2026, 5, 1);

  const weekDiff =
    Math.floor(
      (weekStart - comparison) /
      (7 * 24 * 60 * 60 * 1000)
    );

  return {
    weekStartISO:
      formatScheduleISO(weekStart),

    weekStartDisplay:
      weekStart.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      ),

    dayLabels,

    otHeader:
      weekDiff === 0
        ? "Over-Time"
        : `Over-Time ${weekDiff}`,
  };
}

function findEmployeeIdColumn(headers) {
  const normalized =
    headers.map(normalizeHeader);

  const candidates = [
    "employeeid",
    "staffid",
    "empid",
    "id",
  ];

  for (const name of candidates) {
    const index =
      normalized.indexOf(name);

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function scheduleShiftOT(value) {
  const match =
    /\(OT\s+(\d+(?:\.\d+)?)\s*h\)/i.exec(
      String(value || "")
    );

  return match
    ? Number(match[1]) || 0
    : 0;
}

function scheduleEmployeeOT(shifts) {
  return STAFF_SCHEDULE_DAYS.reduce(
    (total, day) =>
      total +
      scheduleShiftOT(
        shifts?.[day]
      ),
    0
  );
}

async function readStaffScheduleSheet(env) {
  return getSheetValues(
    env,
    getStaffScheduleSheetId(env),
    `${STAFF_SCHEDULE_TAB}!A:ZZ`
  );
}

function scheduleCacheKey(
  branchCode,
  weekStartISO
) {
  return `${branchCode}|${weekStartISO}`;
}

async function invalidateStaffScheduleCache(
  env,
  branchCodes = []
) {
  for (
    const branchCode of
    Array.from(
      new Set(
        branchCodes
          .filter(Boolean)
          .map((code) =>
            String(code)
              .trim()
              .toUpperCase()
          )
      )
    )
  ) {
    await env.DB.prepare(`
      DELETE FROM schedule_cache
      WHERE cache_key LIKE ?
    `)
      .bind(
        `${branchCode}|%`
      )
      .run();
  }
}

function parseStaffScheduleRows(
  rows,
  branchCode,
  selectedDate
) {
  if (!rows?.length) {
    throw new Error(
      "StaffSchedule sheet is empty."
    );
  }

  const headers = rows[0] || [];
  const normalized =
    headers.map(normalizeHeader);

  const branchIndex =
    normalized.indexOf("branch");
  const nameIndex =
    normalized.indexOf("name");
  const roleIndex =
    normalized.indexOf("role");
  const employeeIdIndex =
    findEmployeeIdColumn(headers);

  if (
    branchIndex < 0 ||
    nameIndex < 0 ||
    roleIndex < 0
  ) {
    throw new Error(
      "StaffSchedule requires Branch, Name and Role columns."
    );
  }

  const week =
    scheduleWeekMeta(selectedDate);

  const dayIndexes =
    Object.fromEntries(
      STAFF_SCHEDULE_DAYS.map((day) => [
        day,
        headers.indexOf(
          week.dayLabels[day]
        ),
      ])
    );

  const overtimeIndex =
    headers.indexOf(
      week.otHeader
    );

  let submitted = false;
  const employees = [];

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index] || [];

const rowBranch =
  String(
    row[branchIndex] || ""
  )
    .trim()
    .toUpperCase();

const cleanBranchCode =
  String(
    branchCode || ""
  )
    .trim()
    .toUpperCase();

/*
  Accept:
  B001
  B001 - MOHAMMADIYAH
  B001 MOHAMMADIYAH
  B001-MOHAMMADIYAH
*/
const branchMatches =
  rowBranch === cleanBranchCode ||
  rowBranch.startsWith(
    `${cleanBranchCode} `
  ) ||
  rowBranch.startsWith(
    `${cleanBranchCode}-`
  ) ||
  rowBranch.startsWith(
    `${cleanBranchCode} -`
  );

if (!branchMatches) {
  continue;
}

    const name =
      String(
        row[nameIndex] || ""
      ).trim();

    if (!name) {
      continue;
    }

    const shifts = {};

    for (
      const day of
      STAFF_SCHEDULE_DAYS
    ) {
      const column =
        dayIndexes[day];

      const value =
        column >= 0
          ? String(
              row[column] || ""
            )
          : "";

      shifts[day] = value;

      if (value.trim()) {
        submitted = true;
      }
    }

    employees.push({
      rowNumber:
        index + 1,

      employeeId:
        employeeIdIndex >= 0
          ? String(
              row[employeeIdIndex] || ""
            ).trim()
          : "",

      name,

      role:
        String(
          row[roleIndex] || ""
        ).trim(),

      shifts,

      overtime:
        overtimeIndex >= 0
          ? String(
              row[overtimeIndex] || ""
            ).trim()
          : `${scheduleEmployeeOT(
              shifts
            )} hrs`,
    });
  }

  return {
    week,
    headers,
    employees,
    submitted,
  };
}

async function getStaffScheduleInit(
  env,
  branchCode,
  selectedDate,
  force = false
) {
  const branch =
    await getBartBranch(
      env,
      branchCode
    );

  if (!branch) {
    throw new Error(
      "Branch not found."
    );
  }

  const week =
    scheduleWeekMeta(
      selectedDate
    );

  const key =
    scheduleCacheKey(
      branchCode,
      week.weekStartISO
    );

  const now =
    Math.floor(Date.now() / 1000);

  if (!force) {
    const cached =
      await env.DB.prepare(`
        SELECT
          payload,
          synced_at
        FROM schedule_cache
        WHERE cache_key = ?
        LIMIT 1
      `)
        .bind(key)
        .first();

    if (
      cached &&
      now -
        Number(cached.synced_at) <
        STAFF_SCHEDULE_CACHE_SECONDS
    ) {
      return {
        success: true,
        source: "D1",
        branch: {
          code: branch.code,
          name: branch.name,
        },
        ...JSON.parse(
          cached.payload
        ),
      };
    }
  }

  const rows =
    await readStaffScheduleSheet(env);

  const parsed =
    parseStaffScheduleRows(
      rows,
      branchCode,
      selectedDate
    );

  const branchRows =
    await env.DB.prepare(`
      SELECT
        code,
        name
      FROM branches
      WHERE brand = 'bart'
      ORDER BY code ASC
    `).all();

  const payload = {
    ...parsed,
    roles:
      STAFF_ROLE_OPTIONS,

    destinations:
      (branchRows.results || [])
        .filter(
          (item) =>
            item.code !==
            branchCode
        )
        .map((item) => ({
          code: item.code,
          name: item.name,
          label:
            `${item.code} - ${item.name}`,
        })),
  };

  await env.DB.prepare(`
    INSERT INTO schedule_cache (
      cache_key,
      payload,
      synced_at
    )
    VALUES (?, ?, ?)
    ON CONFLICT(cache_key)
    DO UPDATE SET
      payload = excluded.payload,
      synced_at = excluded.synced_at
  `)
    .bind(
      key,
      JSON.stringify(payload),
      now
    )
    .run();

  return {
    success: true,
    source: "GOOGLE->D1",
    branch: {
      code: branch.code,
      name: branch.name,
    },
    ...payload,
  };
}

async function ensureStaffScheduleHeaders(
  env,
  rows,
  week
) {
  const headers =
    [...(rows[0] || [])];

  const updates = [];

  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {
    const header =
      week.dayLabels[day];

    if (
      !headers.includes(header)
    ) {
      const column =
        headers.length + 1;

      updates.push({
        range:
          `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
            column
          )}1`,

        values:
          [[header]],
      });

      headers.push(header);
    }
  }

  if (
    !headers.includes(
      week.otHeader
    )
  ) {
    const column =
      headers.length + 1;

    updates.push({
      range:
        `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
          column
        )}1`,

      values:
        [[week.otHeader]],
    });

    headers.push(
      week.otHeader
    );
  }

  if (updates.length) {
    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(env),
      updates
    );
  }

  return headers;
}

async function submitStaffSchedule(
  env,
  body
) {
  const branchCode =
    String(
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();

  const selectedDate =
    String(
      body.selectedDate || ""
    ).trim();

  const employees =
    Array.isArray(
      body.employees
    )
      ? body.employees
      : [];

  if (
    !branchCode ||
    !selectedDate ||
    !employees.length
  ) {
    return {
      success: false,
      message:
        "Branch, date and employees are required.",
    };
  }

  const rows =
    await readStaffScheduleSheet(env);

  const current =
    parseStaffScheduleRows(
      rows,
      branchCode,
      selectedDate
    );

  if (current.submitted) {
    return {
      success: false,
      duplicate: true,
      message:
        "This week's schedule has already been submitted for this branch.",
    };
  }

  const week =
    scheduleWeekMeta(
      selectedDate
    );

  const headers =
    await ensureStaffScheduleHeaders(
      env,
      rows,
      week
    );

  const normalized =
    headers.map(normalizeHeader);

  const branchIndex =
    normalized.indexOf("branch");
  const nameIndex =
    normalized.indexOf("name");
  const roleIndex =
    normalized.indexOf("role");

  if (
    branchIndex < 0 ||
    nameIndex < 0 ||
    roleIndex < 0
  ) {
    throw new Error(
      "StaffSchedule requires Branch, Name and Role."
    );
  }

  const employeeIdIndex =
    findEmployeeIdColumn(
      headers
    );

  const sheetRows =
    rows.slice(1);

  const updates = [];

  for (
    const employee of employees
  ) {
    const name =
      String(
        employee.name || ""
      ).trim();

    if (!name) {
      continue;
    }

    let rowNumber = null;

    for (
      let index = 0;
      index < sheetRows.length;
      index++
    ) {
      const row =
        sheetRows[index] || [];

      const branchMatches =
        String(
          row[branchIndex] || ""
        )
          .trim()
          .toUpperCase() ===
        branchCode;

      const idMatches =
        employeeIdIndex >= 0 &&
        employee.employeeId &&
        String(
          row[employeeIdIndex] || ""
        ).trim() ===
        String(
          employee.employeeId
        ).trim();

      const nameMatches =
        String(
          row[nameIndex] || ""
        ).trim() ===
        name;

      if (
        branchMatches &&
        (
          idMatches ||
          nameMatches
        )
      ) {
        rowNumber =
          index + 2;
        break;
      }
    }

    if (!rowNumber) {
      rowNumber =
        sheetRows.length + 2;

      sheetRows.push([]);

      updates.push(
        {
          range:
            `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
              branchIndex + 1
            )}${rowNumber}`,
          values:
            [[branchCode]],
        },
        {
          range:
            `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
              nameIndex + 1
            )}${rowNumber}`,
          values:
            [[name]],
        },
        {
          range:
            `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
              roleIndex + 1
            )}${rowNumber}`,
          values:
            [[employee.role || ""]],
        }
      );

      if (
        employeeIdIndex >= 0 &&
        employee.employeeId
      ) {
        updates.push({
          range:
            `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
              employeeIdIndex + 1
            )}${rowNumber}`,
          values:
            [[employee.employeeId]],
        });
      }
    } else {
      updates.push({
        range:
          `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
            roleIndex + 1
          )}${rowNumber}`,
        values:
          [[employee.role || ""]],
      });
    }

    for (
      const day of
      STAFF_SCHEDULE_DAYS
    ) {
      const columnIndex =
        headers.indexOf(
          week.dayLabels[day]
        );

      if (
        columnIndex < 0
      ) {
        continue;
      }

      updates.push({
        range:
          `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
            columnIndex + 1
          )}${rowNumber}`,

        values:
          [[
            String(
              employee.shifts?.[day] ||
              ""
            ),
          ]],
      });
    }

    const otIndex =
      headers.indexOf(
        week.otHeader
      );

    if (
      otIndex >= 0
    ) {
      const total =
        scheduleEmployeeOT(
          employee.shifts || {}
        );

      updates.push({
        range:
          `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
            otIndex + 1
          )}${rowNumber}`,

        values:
          [[
            total > 0
              ? `${total} hrs`
              : "0 hrs",
          ]],
      });
    }
  }

  if (!updates.length) {
    return {
      success: false,
      message:
        "No schedule values to submit.",
    };
  }

  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(env),
    updates
  );

  await invalidateStaffScheduleCache(
    env,
    [branchCode]
  );

  return {
    success: true,
    weekStart:
      week.weekStartISO,
    weekStartDisplay:
      week.weekStartDisplay,
    employees:
      employees.length,
    submittedAt:
      formatJeddahTimestamp(),
    message:
      "Schedule submitted successfully.",
  };
}

async function ensureEmployeeIdHeader(
  env,
  rows
) {
  const headers =
    [...(rows[0] || [])];

  let employeeIdIndex =
    findEmployeeIdColumn(
      headers
    );

  if (
    employeeIdIndex !== -1
  ) {
    return {
      headers,
      employeeIdIndex,
    };
  }

  employeeIdIndex =
    headers.length;

  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(env),
    [
      {
        range:
          `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
            employeeIdIndex + 1
          )}1`,
        values:
          [["Employee ID"]],
      },
    ]
  );

  headers.push(
    "Employee ID"
  );

  return {
    headers,
    employeeIdIndex,
  };
}

async function addStaffScheduleEmployee(
  env,
  body
) {
  const branchCode =
    String(
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();

  const employeeId =
    String(
      body.employeeId || ""
    ).trim();

  const name =
    String(
      body.name || ""
    ).trim();

  const role =
    String(
      body.role || ""
    ).trim();

  if (
    !branchCode ||
    !name ||
    !role
  ) {
    return {
      success: false,
      message:
        "Branch, employee name and role are required.",
    };
  }

  if (
    !STAFF_ROLE_OPTIONS.includes(
      role
    )
  ) {
    return {
      success: false,
      message:
        "Invalid employee role.",
    };
  }

  const rows =
    await readStaffScheduleSheet(env);

  const {
    headers,
    employeeIdIndex,
  } =
    await ensureEmployeeIdHeader(
      env,
      rows
    );

  const normalized =
    headers.map(normalizeHeader);

  const branchIndex =
    normalized.indexOf("branch");
  const nameIndex =
    normalized.indexOf("name");
  const roleIndex =
    normalized.indexOf("role");

  if (
    branchIndex < 0 ||
    nameIndex < 0 ||
    roleIndex < 0
  ) {
    throw new Error(
      "StaffSchedule requires Branch, Name and Role."
    );
  }

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index] || [];

    if (
      employeeId &&
      String(
        row[employeeIdIndex] || ""
      ).trim() ===
      employeeId
    ) {
      return {
        success: false,
        message:
          "This Employee ID already exists.",
      };
    }

    if (
      String(
        row[branchIndex] || ""
      )
        .trim()
        .toUpperCase() ===
        branchCode &&
      String(
        row[nameIndex] || ""
      )
        .trim()
        .toLowerCase() ===
        name.toLowerCase()
    ) {
      return {
        success: false,
        message:
          "This employee already exists in the branch.",
      };
    }
  }

  const row =
    new Array(
      headers.length
    ).fill("");

  row[branchIndex] =
    branchCode;

  row[nameIndex] =
    name;

  row[roleIndex] =
    role;

  row[employeeIdIndex] =
    employeeId;

  await appendSheetRow(
    env,
    getStaffScheduleSheetId(env),
    `${STAFF_SCHEDULE_TAB}!A:ZZ`,
    row
  );

  await invalidateStaffScheduleCache(
    env,
    [branchCode]
  );

  return {
    success: true,
    employee: {
      employeeId,
      name,
      role,
      branchCode,
    },
    message:
      `${name} added to ${branchCode}.`,
  };
}

function findStaffScheduleEmployeeRow(
  rows,
  branchCode,
  body
) {
  const headers =
    rows[0] || [];

  const normalized =
    headers.map(normalizeHeader);

  const branchIndex =
    normalized.indexOf("branch");
  const nameIndex =
    normalized.indexOf("name");
  const roleIndex =
    normalized.indexOf("role");
  const employeeIdIndex =
    findEmployeeIdColumn(
      headers
    );

  if (
    branchIndex < 0 ||
    nameIndex < 0 ||
    roleIndex < 0
  ) {
    throw new Error(
      "StaffSchedule requires Branch, Name and Role."
    );
  }

  const wantedId =
    String(
      body.employeeId || ""
    ).trim();

  const wantedName =
    String(
      body.name || ""
    ).trim();

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index] || [];

    if (
      String(
        row[branchIndex] || ""
      )
        .trim()
        .toUpperCase() !==
      branchCode
    ) {
      continue;
    }

    if (
      wantedId &&
      employeeIdIndex >= 0 &&
      String(
        row[employeeIdIndex] || ""
      ).trim() ===
      wantedId
    ) {
      return {
        rowNumber:
          index + 1,
        row,
        headers,
        branchIndex,
        nameIndex,
        roleIndex,
        employeeIdIndex,
      };
    }

    if (
      wantedName &&
      String(
        row[nameIndex] || ""
      )
        .trim()
        .toLowerCase() ===
      wantedName.toLowerCase()
    ) {
      return {
        rowNumber:
          index + 1,
        row,
        headers,
        branchIndex,
        nameIndex,
        roleIndex,
        employeeIdIndex,
      };
    }
  }

  return null;
}

async function removeStaffScheduleEmployee(
  env,
  body
) {
  const branchCode =
    String(
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();

  const reason =
    String(
      body.reason || ""
    )
      .trim()
      .toLowerCase();

  const destinationBranch =
    String(
      body.destinationBranch || ""
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "transfer",
      "terminated",
      "contract_finished",
    ].includes(reason)
  ) {
    return {
      success: false,
      message:
        "Invalid employee action.",
    };
  }

  const rows =
    await readStaffScheduleSheet(env);

  const match =
    findStaffScheduleEmployeeRow(
      rows,
      branchCode,
      body
    );

  if (!match) {
    return {
      success: false,
      message:
        "Employee not found in this branch.",
    };
  }

  const {
    rowNumber,
    row,
    branchIndex,
    nameIndex,
    roleIndex,
    employeeIdIndex,
  } = match;

  const name =
    String(
      row[nameIndex] ||
      body.name ||
      ""
    ).trim();

  if (
    reason === "transfer"
  ) {
    if (
      !destinationBranch ||
      destinationBranch ===
      branchCode
    ) {
      return {
        success: false,
        message:
          "Select another destination branch.",
      };
    }

    const destination =
      await getBartBranch(
        env,
        destinationBranch
      );

    if (!destination) {
      return {
        success: false,
        message:
          "Destination branch not found.",
      };
    }

    /*
      Move the same employee row to the destination.
      Historical weekly columns stay attached to the same row.
    */
    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(env),
      [
        {
          range:
            `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
              branchIndex + 1
            )}${rowNumber}`,
          values:
            [[destinationBranch]],
        },
      ]
    );

    await invalidateStaffScheduleCache(
      env,
      [
        branchCode,
        destinationBranch,
      ]
    );

    return {
      success: true,
      action:
        "transfer",
      destinationBranch,
      message:
        `${name} transferred to ${destinationBranch}.`,
    };
  }

  /*
    For Terminated / Contract Finished:
    keep the historical row but remove it from active branch filtering.
  */

  const statusBranch =
    reason === "terminated"
      ? "TERMINATED"
      : "CONTRACT_FINISHED";

  const updates = [
    {
      range:
        `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
          branchIndex + 1
        )}${rowNumber}`,
      values:
        [[statusBranch]],
    },
  ];

  if (
    reason ===
      "contract_finished" &&
    employeeIdIndex >= 0
  ) {
    updates.push({
      range:
        `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
          employeeIdIndex + 1
        )}${rowNumber}`,
      values:
        [[""]],
    });
  }

  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(env),
    updates
  );

  await invalidateStaffScheduleCache(
    env,
    [branchCode]
  );

  return {
    success: true,
    action:
      reason,
    message:
      reason === "terminated"
        ? `${name} removed from the active branch as terminated.`
        : `${name} marked contract finished and Employee ID cleared.`,
  };
}

/* ============================================================
   DATABASE STATUS
============================================================ */

async function databaseStatus(
  env
) {

  const branches =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM branches
      WHERE brand = 'bart'
    `)
      .first();


  const transfers =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM transfers
    `)
      .first();


  const drafts =
    await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM stock_drafts
    `)
      .first();


  return jsonResponse({

    success:
      true,

    database:
      "D1",

    bartBranches:
      Number(
        branches?.total ||
        0
      ),

    transfers:
      Number(
        transfers?.total ||
        0
      ),

    stockDrafts:
      Number(
        drafts?.total ||
        0
      ),

    lastSync:
      await getMeta(
        env,
        "bart_last_sync"
      ),

    googleCalled:
      false,
  });
}


/* ============================================================
   STAFF EMPLOYEE VACATION
============================================================ */

async function setStaffEmployeeVacation(
  env,
  body
) {
  const branchCode =
    String(
      body.branchCode ||
      ""
    )
      .trim()
      .toUpperCase();

  const selectedDate =
    String(
      body.selectedDate ||
      ""
    ).trim();

  if (
    !branchCode ||
    !selectedDate
  ) {
    return {
      success: false,
      message:
        "Branch and selected week are required.",
    };
  }

  const rows =
    await readStaffScheduleSheet(
      env
    );

  const match =
    findStaffScheduleEmployeeRow(
      rows,
      branchCode,
      body
    );

  if (!match) {
    return {
      success: false,
      message:
        "Employee not found in this branch.",
    };
  }

  const week =
    scheduleWeekMeta(
      selectedDate
    );

  const headers =
    await ensureStaffScheduleHeaders(
      env,
      rows,
      week
    );

  const updates = [];

  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {
    const columnIndex =
      headers.indexOf(
        week.dayLabels[day]
      );

    if (columnIndex < 0) {
      continue;
    }

    updates.push({
      range:
        `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
          columnIndex + 1
        )}${match.rowNumber}`,
      values:
        [["VACATION"]],
    });
  }

  const overtimeIndex =
    headers.indexOf(
      week.otHeader
    );

  if (overtimeIndex >= 0) {
    updates.push({
      range:
        `${STAFF_SCHEDULE_TAB}!${columnNumberToLetters(
          overtimeIndex + 1
        )}${match.rowNumber}`,
      values:
        [["0 hrs"]],
    });
  }

  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(env),
    updates
  );

  await invalidateStaffScheduleCache(
    env,
    [branchCode]
  );

  const employeeName =
    String(
      match.row[match.nameIndex] ||
      body.name ||
      ""
    ).trim();

  return {
    success: true,
    action: "vacation",
    employee: employeeName,
    branchCode,
    weekStart:
      week.weekStartISO,
    message:
      `${employeeName} marked VACATION for the full week.`,
  };
}


/* ============================================================
   WORKER
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

    // 👇 PASTE IT HERE

    if (url.pathname.startsWith("/api/mooma/")) {
      return handleMoomaRequest(request, env);
    }




     

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

      await ensureDatabase(
        env
      );


      /* ======================================================
         TEST
      ====================================================== */

      if (
        url.pathname ===
        "/api/test"
      ) {

        return jsonResponse({

          success:
            true,

          version:
            "BART-STAFF-SCHEDULE-V8",

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

            stockTransfer:
              true,

            staffSchedule:
              true,

            employeeMovement:
              true,

            employeeVacation:
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

            STAFF_SCHEDULE_SHEET_ID:
              Boolean(
                env.STAFF_SCHEDULE_SHEET_ID ||
                STAFF_SCHEDULE_FALLBACK_ID
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
         MANUAL DATABASE SYNC
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
         BRANCH LIST
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/branches" &&
        request.method ===
        "GET"
      ) {

        const rows =
          await env.DB.prepare(`
            SELECT
              code,
              name

            FROM branches

            WHERE brand = 'bart'

            ORDER BY code
          `).all();


        return jsonResponse({

          success:
            true,

          source:
            "D1",

          googleCalled:
            false,

          count:
            rows.results?.length ||
            0,

          branches:
            rows.results ||
            [],
        });
      }


      /* ======================================================
         LOGIN
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
         PENDING TRANSFERS
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/pending-transfers" &&
        request.method ===
        "GET"
      ) {

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        const result =
          await getPendingTransfers(
            env,
            branch
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
         TRANSFER RESPONSE
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

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStockView(
            env,
            branch,
            force
          );


        return jsonResponse({

          success:
            true,

          branch,

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
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-record/init" &&
        request.method ===
        "GET"
      ) {

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        const date =
          String(
            url.searchParams.get(
              "date"
            ) ||
            ""
          );


        return jsonResponse(
          await stockRecordInit(
            env,
            branch,
            date
          )
        );
      }


      /* ======================================================
         SAVE DRAFT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-record/draft" &&
        request.method ===
        "POST"
      ) {

        return jsonResponse(
          await saveStockDraft(
            env,
            await request.json()
          )
        );
      }


      /* ======================================================
         DELETE DRAFT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-record/draft" &&
        request.method ===
        "DELETE"
      ) {

        const body =
          await request.json();


        return jsonResponse(
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
            ),

            String(
              body.mode ||
              ""
            )
              .trim()
              .toLowerCase()
          )
        );
      }


      /* ======================================================
         STOCK RECORD SUBMIT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-record/submit" &&
        request.method ===
        "POST"
      ) {

        const result =
          await submitStockRecord(
            env,
            await request.json()
          );


        return jsonResponse(

          result,

          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         STOCK TRANSFER INIT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-transfer/init" &&
        request.method ===
        "GET"
      ) {

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        return jsonResponse(
          await stockTransferInit(
            env,
            branch
          )
        );
      }


      /* ======================================================
         STOCK TRANSFER HISTORY
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-transfer/history" &&
        request.method ===
        "GET"
      ) {

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        const limit =
          Math.min(
            Math.max(
              Number(
                url.searchParams.get(
                  "limit"
                ) ||
                3
              ),
              1
            ),
            50
          );


        const offset =
          Math.max(
            Number(
              url.searchParams.get(
                "offset"
              ) ||
              0
            ),
            0
          );


        return jsonResponse(
          await getTransferHistory(

            env,

            branch,

            limit,

            offset
          )
        );
      }


      /* ======================================================
         CREATE STOCK TRANSFER
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/stock-transfer/create" &&
        request.method ===
        "POST"
      ) {

        const result =
          await createStockTransfer(
            env,
            await request.json()
          );


        return jsonResponse(

          result,

          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         STAFF SCHEDULE INIT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/schedule/init" &&
        request.method ===
        "GET"
      ) {

        const branch =
          String(
            url.searchParams.get(
              "branch"
            ) ||
            ""
          )
            .trim()
            .toUpperCase();


        const date =
          String(
            url.searchParams.get(
              "date"
            ) ||
            ""
          ).trim();


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStaffScheduleInit(
            env,
            branch,
            date,
            force
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 400
        );
      }


      /* ======================================================
         STAFF SCHEDULE SUBMIT
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/schedule/submit" &&
        request.method ===
        "POST"
      ) {

        const result =
          await submitStaffSchedule(
            env,
            await request.json()
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         STAFF ADD EMPLOYEE
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/schedule/employee/add" &&
        request.method ===
        "POST"
      ) {

        const result =
          await addStaffScheduleEmployee(
            env,
            await request.json()
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         STAFF REMOVE / TRANSFER EMPLOYEE
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/schedule/employee/remove" &&
        request.method ===
        "POST"
      ) {

        const result =
          await removeStaffScheduleEmployee(
            env,
            await request.json()
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         STAFF EMPLOYEE VACATION
      ====================================================== */

      if (
        url.pathname ===
        "/api/staff/bart/schedule/employee/vacation" &&
        request.method ===
        "POST"
      ) {

        const result =
          await setStaffEmployeeVacation(
            env,
            await request.json()
          );

        return jsonResponse(
          result,
          result.success
            ? 200
            : 409
        );
      }


      /* ======================================================
         FRONTEND
      ====================================================== */

      if (
        env.ASSETS
      ) {

        return env.ASSETS.fetch(
          request
        );
      }


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
        "DAM WORKER ERROR:",
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
