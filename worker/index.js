/* ============================================================
   DAM OPERATIONS
   BART STAFF BACKEND

   VERSION:
   BART-STAFF-SCHEDULE-V8
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

async function readMasterBranches(
  env
) {

  if (!env.MASTER_SHEET_ID) {
    throw new Error(
      "MASTER_SHEET_ID is missing."
    );
  }


  const rows =
    await getSheetValues(
      env,
      env.MASTER_SHEET_ID,
      "Sheet1!A:Z"
    );


  if (
    !rows ||
    rows.length < 2
  ) {

    return [];
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  const codeIndex =
    headers.findIndex(
      (header) =>
        [
          "branchcode",
          "code",
        ].includes(
          header
        )
    );


  const nameIndex =
    headers.findIndex(
      (header) =>
        [
          "branchname",
          "name",
        ].includes(
          header
        )
    );


  const sheetIndex =
    headers.findIndex(
      (header) =>
        [
          "sheetid",
          "spreadsheetid",
          "googlesheetid",
        ].includes(
          header
        )
    );


  const passwordIndex =
    headers.findIndex(
      (header) =>
        [
          "password",
          "branchpassword",
          "pass",
        ].includes(
          header
        )
    );


  if (
    codeIndex < 0 ||
    nameIndex < 0
  ) {

    throw new Error(
      "Branch Code / Branch Name columns not found in MASTERBRANCHSHEET."
    );
  }


  const branches = [];


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i] ||
      [];


    const code =
      String(
        row[codeIndex] ||
        ""
      )
        .trim()
        .toUpperCase();


    const name =
      String(
        row[nameIndex] ||
        ""
      )
        .trim()
        .toUpperCase();


    const sheetId =
      sheetIndex >= 0
        ? String(
            row[sheetIndex] ||
            ""
          ).trim()
        : "";


    const password =
      passwordIndex >= 0
        ? String(
            row[passwordIndex] ||
            ""
          ).trim()
        : "";


    /*
      Only BART branches.
      B001, B002, B003...
    */

    if (
      !/^B\d+/i.test(
        code
      )
    ) {
      continue;
    }


    if (
      !code ||
      !name
    ) {
      continue;
    }


    branches.push({
      code,
      name,
      sheetId,
      password,
    });
  }


  return branches;
}


/* ============================================================
   MASTER TRANSFER READ
============================================================ */

async function readMasterTransfers(
  env
) {

  if (!env.MASTER_SHEET_ID) {
    throw new Error(
      "MASTER_SHEET_ID is missing."
    );
  }


  let rows = [];


  /*
    Transfer tab names may differ between
    versions of the master workbook.

    Try the known tab names.
  */

  const ranges = [
    "Stock Transfer!A:Z",
    "StockTransfer!A:Z",
    "Transfers!A:Z",
  ];


  let lastError =
    null;


  for (
    const range of ranges
  ) {

    try {

      rows =
        await getSheetValues(
          env,
          env.MASTER_SHEET_ID,
          range
        );


      if (
        rows &&
        rows.length > 0
      ) {
        break;
      }

    } catch (error) {

      lastError =
        error;
    }
  }


  if (
    !rows ||
    rows.length === 0
  ) {

    if (lastError) {
      console.log(
        "Transfer sheet read warning:",
        lastError.message
      );
    }


    return [];
  }


  const headers =
    rows[0].map(
      normalizeHeader
    );


  function findHeader(
    possibilities
  ) {

    return headers.findIndex(
      (header) =>
        possibilities.includes(
          header
        )
    );
  }


  const idIndex =
    findHeader([
      "transferid",
      "id",
      "transactionid",
      "txid",
    ]);


  const originIndex =
    findHeader([
      "origin",
      "originbranch",
      "frombranch",
      "from",
    ]);


  const destinationIndex =
    findHeader([
      "destination",
      "destinationbranch",
      "tobranch",
      "to",
    ]);


  const itemsIndex =
    findHeader([
      "items",
      "item",
      "itemdetails",
      "products",
    ]);


  const quantityIndex =
    findHeader([
      "quantities",
      "quantity",
      "qty",
    ]);


  const reasonIndex =
    findHeader([
      "reason",
      "date",
      "transferdate",
      "datetime",
      "timestamp",
    ]);


  const statusIndex =
    findHeader([
      "status",
      "transferstatus",
    ]);


  if (
    idIndex < 0 ||
    originIndex < 0 ||
    destinationIndex < 0
  ) {

    throw new Error(
      "Transfer sheet required columns not found."
    );
  }


  const transfers = [];


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i] ||
      [];


    const id =
      String(
        row[idIndex] ||
        ""
      ).trim();


    if (!id) {
      continue;
    }


    transfers.push({

      id,

      origin:
        String(
          row[originIndex] ||
          ""
        ).trim(),

      destination:
        String(
          row[destinationIndex] ||
          ""
        ).trim(),

      items:
        itemsIndex >= 0
          ? String(
              row[itemsIndex] ||
              ""
            )
          : "",

      quantities:
        quantityIndex >= 0
          ? String(
              row[quantityIndex] ||
              ""
            )
          : "",

      reason:
        reasonIndex >= 0
          ? String(
              row[reasonIndex] ||
              ""
            )
          : "",

      status:
        statusIndex >= 0
          ? String(
              row[statusIndex] ||
              "Pending"
            ).trim()
          : "Pending",
    });
  }


  return transfers;
}


/* ============================================================
   SYNC BART BRANCHES TO D1
============================================================ */

async function syncBartBranches(
  env
) {

  const branches =
    await readMasterBranches(
      env
    );


  const now =
    new Date()
      .toISOString();


  for (
    const branch of branches
  ) {

    const passwordHash =
      await hashPassword(
        branch.password
      );


    await env.DB.prepare(`
      INSERT INTO branches (
        code,
        brand,
        name,
        sheet_id,
        password_hash,
        updated_at
      )

      VALUES (
        ?,
        'bart',
        ?,
        ?,
        ?,
        ?
      )

      ON CONFLICT(code)
      DO UPDATE SET

        brand =
          excluded.brand,

        name =
          excluded.name,

        sheet_id =
          excluded.sheet_id,

        password_hash =
          excluded.password_hash,

        updated_at =
          excluded.updated_at
    `)
      .bind(
        branch.code,
        branch.name,
        branch.sheetId,
        passwordHash,
        now
      )
      .run();
  }


  /*
    Remove BART branches that no longer exist
    in MASTERBRANCHSHEET.
  */

  if (
    branches.length > 0
  ) {

    const placeholders =
      branches
        .map(
          () => "?"
        )
        .join(",");


    await env.DB.prepare(`
      DELETE FROM branches

      WHERE
        brand = 'bart'

        AND code NOT IN (
          ${placeholders}
        )
    `)
      .bind(
        ...branches.map(
          (branch) =>
            branch.code
        )
      )
      .run();
  }


  return branches.length;
}


/* ============================================================
   SYNC TRANSFERS TO D1
============================================================ */

async function syncBartTransfers(
  env
) {

  const transfers =
    await readMasterTransfers(
      env
    );


  const now =
    new Date()
      .toISOString();


  for (
    const transfer of transfers
  ) {

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

      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )

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
        transfer.id,
        transfer.origin,
        transfer.destination,
        transfer.items,
        transfer.quantities,
        transfer.reason,
        transfer.status,
        now
      )
      .run();
  }


  return transfers.length;
}


/* ============================================================
   COMPLETE BART DATABASE SYNC
============================================================ */

async function syncBartDatabase(
  request,
  env
) {

  const adminKey =
    request.headers.get(
      "X-Admin-Key"
    );


  if (
    !env.ADMIN_SYNC_KEY ||
    adminKey !==
      env.ADMIN_SYNC_KEY
  ) {

    return jsonResponse(
      {
        success:
          false,

        message:
          "Unauthorized.",
      },
      401
    );
  }


  const locked =
    await acquireLock(
      env,
      "bart_full_sync",
      60
    );


  if (!locked) {

    return jsonResponse(
      {
        success:
          false,

        message:
          "BART database sync already running.",
      },
      409
    );
  }


  try {

    const branches =
      await syncBartBranches(
        env
      );


    const transfers =
      await syncBartTransfers(
        env
      );


    const lastSync =
      new Date()
        .toISOString();


    await setMeta(
      env,
      "bart_last_sync",
      lastSync
    );


    return jsonResponse({
      success:
        true,

      message:
        "BART database refreshed.",

      branches,

      transfers,

      lastSync,
    });

  } finally {

    await releaseLock(
      env,
      "bart_full_sync"
    );
  }
}


/* ============================================================
   DATABASE STATUS
============================================================ */

async function databaseStatus(
  env
) {

  const branchCount =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count

      FROM branches

      WHERE brand = 'bart'
    `).first();


  const transferCount =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM transfers
    `).first();


  const lastSync =
    await getMeta(
      env,
      "bart_last_sync"
    );


  return jsonResponse({

    success:
      true,

    database:
      "D1",

    bartBranches:
      Number(
        branchCount?.count ||
        0
      ),

    transfers:
      Number(
        transferCount?.count ||
        0
      ),

    lastSync,

    googleCalled:
      false,
  });
}


/* ============================================================
   GET BART BRANCH
============================================================ */

async function getBartBranch(
  env,
  branchCode
) {

  return await env.DB.prepare(`
    SELECT
      code,
      name,
      sheet_id,
      password_hash

    FROM branches

    WHERE
      brand = 'bart'
      AND code = ?

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

  const body =
    await request.json();


  const branchCode =
    String(
      body.branchCode ||
      body.branch ||
      ""
    )
      .trim()
      .toUpperCase();


  const password =
    String(
      body.password ||
      ""
    );


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


  const incomingHash =
    await hashPassword(
      password
    );


  if (
    incomingHash !==
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
   BRANCH CODE FROM TEXT
============================================================ */

function extractBranchCode(
  value
) {

  const text =
    String(
      value ||
      ""
    )
      .trim()
      .toUpperCase();


  const match =
    text.match(
      /\bB\d{3,}\b/
    );


  return match
    ? match[0]
    : "";
}


/* ============================================================
   LIVE TRANSFER CACHE
============================================================ */

let transferMemoryCache = {
  loadedAt:
    0,

  transfers:
    [],
};


/* ============================================================
   REFRESH LIVE TRANSFERS

   IMPORTANT:
   Transfers use a short cache so branch dashboard polling
   does NOT hit Google every 15 seconds for every branch.

   The first request after cache expiry refreshes Google.
   Other branches then use that same fresh result.
============================================================ */

async function refreshLiveTransfers(
  env
) {

  const now =
    Date.now();


  if (
    transferMemoryCache.loadedAt &&
    now -
      transferMemoryCache.loadedAt <
      TRANSFER_CACHE_SECONDS *
      1000
  ) {

    return {
      transfers:
        transferMemoryCache.transfers,

      source:
        "MEMORY",

      googleCalled:
        false,

      ageSeconds:
        Math.floor(
          (
            now -
            transferMemoryCache.loadedAt
          ) /
          1000
        ),
    };
  }


  const locked =
    await acquireLock(
      env,
      "live_transfer_sync",
      15
    );


  /*
    Another request is already refreshing.
    Return D1 immediately.
  */

  if (!locked) {

    const rows =
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

        ORDER BY updated_at DESC
      `).all();


    return {
      transfers:
        rows.results ||
        [],

      source:
        "D1",

      googleCalled:
        false,

      ageSeconds:
        null,
    };
  }


  try {

    const transfers =
      await readMasterTransfers(
        env
      );


    const updatedAt =
      new Date()
        .toISOString();


    for (
      const transfer of transfers
    ) {

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

        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )

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
          transfer.id,
          transfer.origin,
          transfer.destination,
          transfer.items,
          transfer.quantities,
          transfer.reason,
          transfer.status,
          updatedAt
        )
        .run();
    }


    transferMemoryCache = {
      loadedAt:
        now,

      transfers,
    };


    return {
      transfers,

      source:
        "GOOGLE",

      googleCalled:
        true,

      ageSeconds:
        0,
    };

  } catch (error) {

    /*
      Google failure should NOT kill the branch dashboard.
      Fall back to D1.
    */

    console.error(
      "Live transfer refresh failed:",
      error
    );


    const rows =
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

        ORDER BY updated_at DESC
      `).all();


    return {
      transfers:
        rows.results ||
        [],

      source:
        "D1-FALLBACK",

      googleCalled:
        false,

      ageSeconds:
        null,
    };

  } finally {

    await releaseLock(
      env,
      "live_transfer_sync"
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

  if (!branchCode) {

    return {
      transfers:
        [],

      freshness: {
        source:
          "NONE",

        googleCalled:
          false,
      },
    };
  }


  const live =
    await refreshLiveTransfers(
      env
    );


  const pending =
    live.transfers.filter(
      (transfer) => {

        const destination =
          extractBranchCode(
            transfer.destination
          );


        const status =
          String(
            transfer.status ||
            ""
          )
            .trim()
            .toLowerCase();


        return (
          destination ===
            branchCode &&
          status ===
            "pending"
        );
      }
    );


  return {

    transfers:
      pending,

    freshness: {

      source:
        live.source,

      googleCalled:
        live.googleCalled,

      ageSeconds:
        live.ageSeconds,
    },
  };
}


/* ============================================================
   FIND TRANSFER ROW IN GOOGLE
============================================================ */

async function findTransferGoogleRow(
  env,
  transferId
) {

  const possibleRanges = [
    "Stock Transfer!A:Z",
    "StockTransfer!A:Z",
    "Transfers!A:Z",
  ];


  for (
    const range of possibleRanges
  ) {

    try {

      const rows =
        await getSheetValues(
          env,
          env.MASTER_SHEET_ID,
          range
        );


      if (
        !rows ||
        rows.length < 2
      ) {
        continue;
      }


      const headers =
        rows[0].map(
          normalizeHeader
        );


      const idIndex =
        headers.findIndex(
          (header) =>
            [
              "transferid",
              "id",
              "transactionid",
              "txid",
            ].includes(
              header
            )
        );


      const statusIndex =
        headers.findIndex(
          (header) =>
            [
              "status",
              "transferstatus",
            ].includes(
              header
            )
        );


      if (
        idIndex < 0 ||
        statusIndex < 0
      ) {
        continue;
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
            ] ||
            ""
          ).trim() ===
          transferId
        ) {

          const tabName =
            range.split(
              "!"
            )[0];


          return {
            rowNumber:
              i + 1,

            statusColumn:
              statusIndex +
              1,

            tabName,
          };
        }
      }

    } catch (error) {

      console.log(
        "Transfer lookup range failed:",
        range,
        error.message
      );
    }
  }


  return null;
}


/* ============================================================
   RESPOND TO TRANSFER
============================================================ */

async function respondTransfer(
  request,
  env
) {

  const body =
    await request.json();


  const transferId =
    String(
      body.transferId ||
      body.id ||
      ""
    ).trim();


  const branchCode =
    String(
      body.branchCode ||
      body.branch ||
      ""
    )
      .trim()
      .toUpperCase();


  const action =
    String(
      body.action ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    !transferId ||
    !branchCode ||
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
          "Invalid transfer response.",
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
    extractBranchCode(
      transfer.destination
    ) !==
    branchCode
  ) {

    return jsonResponse(
      {
        success:
          false,

        message:
          "Transfer does not belong to this branch.",
      },
      403
    );
  }


  const currentStatus =
    String(
      transfer.status ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    currentStatus !==
    "pending"
  ) {

    return jsonResponse(
      {
        success:
          false,

        message:
          `Transfer already ${transfer.status}.`,
      },
      409
    );
  }


  const newStatus =
    action ===
    "accept"
      ? "Accepted"
      : "Rejected";


  /*
    Update Google first.
  */

  const googleRow =
    await findTransferGoogleRow(
      env,
      transferId
    );


  if (!googleRow) {

    return jsonResponse(
      {
        success:
          false,

        message:
          "Transfer row not found in Google Sheet.",
      },
      404
    );
  }


  const statusColumn =
    columnNumberToLetters(
      googleRow.statusColumn
    );


  await batchWriteSheet(
    env,
    env.MASTER_SHEET_ID,
    [
      {
        range:
          `${googleRow.tabName}!` +
          `${statusColumn}${googleRow.rowNumber}`,

        values:
          [[newStatus]],
      },
    ]
  );


  /*
    Then update D1.
  */

  await env.DB.prepare(`
    UPDATE transfers

    SET
      status = ?,
      updated_at = ?

    WHERE id = ?
  `)
    .bind(
      newStatus,
      new Date()
        .toISOString(),
      transferId
    )
    .run();


  /*
    Clear memory transfer cache so the next poll
    sees the change immediately.
  */

  transferMemoryCache = {
    loadedAt:
      0,

    transfers:
      [],
  };


  return jsonResponse({

    success:
      true,

    transferId,

    status:
      newStatus,

    message:
      `Transfer ${newStatus.toLowerCase()} successfully.`,
  });
}


/* ============================================================
   STOCK HELPERS
============================================================ */

function cleanSKU(value) {
  return String(
    value || ""
  )
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}


function numericValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }


  const cleaned =
    String(value)
      .replace(/,/g, "")
      .trim();


  const number =
    Number(cleaned);


  return Number.isFinite(number)
    ? number
    : 0;
}


function normalizeStockDate(value) {

  const text =
    String(
      value || ""
    ).trim();


  if (!text) {
    return "";
  }


  /*
    Already ISO
  */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    return text;
  }


  /*
    DD/MM/YYYY
  */

  let match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (match) {

    return [
      match[3],
      String(
        match[2]
      ).padStart(2, "0"),
      String(
        match[1]
      ).padStart(2, "0"),
    ].join("-");
  }


  /*
    DD-MM-YYYY
  */

  match =
    text.match(
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/
    );


  if (match) {

    return [
      match[3],
      String(
        match[2]
      ).padStart(2, "0"),
      String(
        match[1]
      ).padStart(2, "0"),
    ].join("-");
  }


  /*
    Google / JS parsable date fallback
  */

  const parsed =
    new Date(text);


  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {

    return [
      parsed.getFullYear(),

      String(
        parsed.getMonth() + 1
      ).padStart(2, "0"),

      String(
        parsed.getDate()
      ).padStart(2, "0"),
    ].join("-");
  }


  return text;
}


/* ============================================================
   STOCK SHEET RANGE
============================================================ */

async function readBranchStockSheet(
  env,
  branch
) {

  if (!branch) {

    throw new Error(
      "Branch not found."
    );
  }


  if (!branch.sheet_id) {

    throw new Error(
      `${branch.code} does not have a Google Sheet ID.`
    );
  }


  /*
    Branch stock files have historically used
    different stock tab names.

    Try known possibilities.
  */

  const ranges = [

    "Stocks!A:ZZ",

    "Stock!A:ZZ",

    "Sheet1!A:ZZ",
  ];


  let lastError =
    null;


  for (
    const range of ranges
  ) {

    try {

      const rows =
        await getSheetValues(
          env,
          branch.sheet_id,
          range
        );


      if (
        rows &&
        rows.length
      ) {

        return {
          rows,
          range,
          tabName:
            range.split(
              "!"
            )[0],
        };
      }

    } catch (error) {

      lastError =
        error;


      console.log(
        `Stock range ${range} failed for ${branch.code}:`,
        error.message
      );
    }
  }


  throw (
    lastError ||
    new Error(
      `Unable to read stock sheet for ${branch.code}.`
    )
  );
}


/* ============================================================
   DETECT STOCK DATE COLUMN
============================================================ */

function findStockDateColumn(
  headerRow,
  wantedDate
) {

  if (
    !Array.isArray(
      headerRow
    )
  ) {

    return -1;
  }


  const normalizedWanted =
    normalizeStockDate(
      wantedDate
    );


  for (
    let index = 0;
    index < headerRow.length;
    index++
  ) {

    const value =
      normalizeStockDate(
        headerRow[index]
      );


    if (
      value ===
      normalizedWanted
    ) {

      return index;
    }
  }


  return -1;
}


/* ============================================================
   STOCK SECTION DETECTION
============================================================ */

function detectStockSection(
  value
) {

  const normalized =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");


  if (
    normalized.includes(
      "DAILY ITEM"
    ) ||
    normalized ===
      "DAILY"
  ) {

    return "DAILY";
  }


  if (
    normalized.includes(
      "WEEKLY ITEM"
    ) ||
    normalized ===
      "WEEKLY"
  ) {

    return "WEEKLY";
  }


  return null;
}


/* ============================================================
   PARSE BRANCH STOCK
============================================================ */

function parseBranchStockRows(
  rows,
  wantedDate
) {

  if (
    !rows ||
    rows.length === 0
  ) {

    return {
      date:
        wantedDate,

      dateFound:
        false,

      dateColumn:
        -1,

      daily:
        [],

      weekly:
        [],

      all:
        [],
    };
  }


  /*
    Branch stock layout:

    Column A = Item / section marker
    Column B = SKU
    Column C = Date marker / structural column
    Column D = UOM

    Date quantities begin from later columns.

    We search the first few rows for the requested
    date instead of assuming a fixed row.
  */

  let dateHeaderRowIndex =
    -1;

  let dateColumn =
    -1;


  const headerSearchLimit =
    Math.min(
      rows.length,
      10
    );


  for (
    let rowIndex = 0;
    rowIndex < headerSearchLimit;
    rowIndex++
  ) {

    const found =
      findStockDateColumn(
        rows[rowIndex],
        wantedDate
      );


    if (
      found !== -1
    ) {

      dateHeaderRowIndex =
        rowIndex;

      dateColumn =
        found;

      break;
    }
  }


  let currentSection =
    null;


  const daily =
    [];

  const weekly =
    [];

  const all =
    [];


  for (
    let rowIndex = 0;
    rowIndex < rows.length;
    rowIndex++
  ) {

    const row =
      rows[rowIndex] ||
      [];


    const itemName =
      String(
        row[0] ||
        ""
      ).trim();


    const section =
      detectStockSection(
        itemName
      );


    if (section) {

      currentSection =
        section;

      continue;
    }


    const sku =
      cleanSKU(
        row[1]
      );


    const uom =
      String(
        row[3] ||
        ""
      ).trim();


    /*
      Ignore blank structural rows.
    */

    if (
      !itemName &&
      !sku
    ) {

      continue;
    }


    /*
      Ignore header-like rows.
    */

    const normalizedItem =
      normalizeHeader(
        itemName
      );


    if (
      [
        "item",
        "itemname",
        "description",
        "product",
        "productname",
      ].includes(
        normalizedItem
      )
    ) {

      continue;
    }


    if (
      !currentSection
    ) {

      /*
        Some files can contain item rows before
        a visible section marker.

        Do not silently classify those.
      */

      continue;
    }


    const quantity =
      dateColumn >= 0
        ? numericValue(
            row[
              dateColumn
            ]
          )
        : 0;


    const item = {

      rowNumber:
        rowIndex + 1,

      item:
        itemName,

      name:
        itemName,

      sku,

      uom,

      quantity,

      qty:
        quantity,

      section:
        currentSection,

      type:
        currentSection,

      bakery:
        BAKERY_SKUS.has(
          sku
        ),
    };


    all.push(
      item
    );


    if (
      currentSection ===
      "DAILY"
    ) {

      daily.push(
        item
      );

    } else if (
      currentSection ===
      "WEEKLY"
    ) {

      weekly.push(
        item
      );
    }
  }


  return {

    date:
      wantedDate,

    dateFound:
      dateColumn >= 0,

    dateHeaderRow:
      dateHeaderRowIndex >= 0
        ? dateHeaderRowIndex + 1
        : null,

    dateColumn:
      dateColumn >= 0
        ? dateColumn + 1
        : -1,

    daily,

    weekly,

    all,
  };
}


/* ============================================================
   D1 STOCK VIEW CACHE
============================================================ */

async function getStockCache(
  env,
  branchCode
) {

  return await env.DB.prepare(`
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
}


async function saveStockCache(
  env,
  branchCode,
  payload
) {

  const now =
    Math.floor(
      Date.now() /
      1000
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
        payload
      ),
      now
    )
    .run();


  return now;
}


/* ============================================================
   STOCK VIEW
============================================================ */

async function getStockView(
  env,
  branchCode,
  wantedDate,
  force = false
) {

  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {
      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const date =
    wantedDate ||
    getJeddahYesterdayISO();


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  /*
    Use D1 cache first.

    Cache payload includes the date.
    Therefore don't return yesterday's cache
    for another selected date.
  */

  if (!force) {

    const cached =
      await getStockCache(
        env,
        branchCode
      );


    if (cached) {

      try {

        const payload =
          JSON.parse(
            cached.payload
          );


        const age =
          now -
          Number(
            cached.synced_at ||
            0
          );


        if (
          payload?.date ===
            date &&
          age <
            STOCK_VIEW_CACHE_SECONDS
        ) {

          return {
            success:
              true,

            source:
              "D1",

            googleCalled:
              false,

            cacheAgeSeconds:
              age,

            branch: {
              code:
                branch.code,

              name:
                branch.name,
            },

            ...payload,
          };
        }

      } catch (error) {

        console.log(
          "Invalid stock cache:",
          error.message
        );
      }
    }
  }


  /*
    Cache miss / force refresh:
    read branch Google Sheet once.
  */

  const sheet =
    await readBranchStockSheet(
      env,
      branch
    );


  const parsed =
    parseBranchStockRows(
      sheet.rows,
      date
    );


  const payload = {

    date:
      parsed.date,

    dateFound:
      parsed.dateFound,

    dateHeaderRow:
      parsed.dateHeaderRow,

    dateColumn:
      parsed.dateColumn,

    tabName:
      sheet.tabName,

    daily:
      parsed.daily,

    weekly:
      parsed.weekly,

    all:
      parsed.all,

    syncedAt:
      new Date()
        .toISOString(),
  };


  await saveStockCache(
    env,
    branchCode,
    payload
  );


  return {

    success:
      true,

    source:
      "GOOGLE->D1",

    googleCalled:
      true,

    cacheAgeSeconds:
      0,

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },

    ...payload,
  };
}


/* ============================================================
   STOCK RECORD CACHE
============================================================ */

async function getStockRecordCache(
  env,
  branchCode
) {

  return await env.DB.prepare(`
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
}


async function saveStockRecordCache(
  env,
  branchCode,
  payload
) {

  const now =
    Math.floor(
      Date.now() /
      1000
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
        payload
      ),

      now
    )
    .run();


  return now;
}


/* ============================================================
   STOCK RECORD INIT
============================================================ */

async function getStockRecordInit(
  env,
  branchCode,
  wantedDate,
  force = false
) {

  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {
      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const date =
    wantedDate ||
    getJeddahYesterdayISO();


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  if (!force) {

    const cached =
      await getStockRecordCache(
        env,
        branchCode
      );


    if (cached) {

      try {

        const payload =
          JSON.parse(
            cached.payload
          );


        const age =
          now -
          Number(
            cached.synced_at ||
            0
          );


        if (
          payload?.date ===
            date &&
          age <
            STOCK_RECORD_CACHE_SECONDS
        ) {

          return {
            success:
              true,

            source:
              "D1",

            googleCalled:
              false,

            cacheAgeSeconds:
              age,

            branch: {
              code:
                branch.code,

              name:
                branch.name,
            },

            ...payload,
          };
        }

      } catch (error) {

        console.log(
          "Invalid stock record cache:",
          error.message
        );
      }
    }
  }


  const sheet =
    await readBranchStockSheet(
      env,
      branch
    );


  const parsed =
    parseBranchStockRows(
      sheet.rows,
      date
    );


  /*
    Stock Record page needs the item master
    regardless of whether the date column already exists.

    Quantity is still included because it allows the UI
    to show already-recorded values when applicable.
  */

  const payload = {

    date:
      date,

    tabName:
      sheet.tabName,

    dateFound:
      parsed.dateFound,

    dateHeaderRow:
      parsed.dateHeaderRow,

    dateColumn:
      parsed.dateColumn,

    daily:
      parsed.daily,

    weekly:
      parsed.weekly,

    items:
      parsed.all,

    syncedAt:
      new Date()
        .toISOString(),
  };


  await saveStockRecordCache(
    env,
    branchCode,
    payload
  );


  return {

    success:
      true,

    source:
      "GOOGLE->D1",

    googleCalled:
      true,

    cacheAgeSeconds:
      0,

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },

    ...payload,
  };
}


/* ============================================================
   STOCK DRAFT KEY
============================================================ */

function stockDraftKey(
  branchCode,
  stockDate,
  mode
) {

  return [
    branchCode,
    stockDate,
    String(
      mode ||
      "DAILY"
    ).toUpperCase(),
  ].join("|");
}


/* ============================================================
   SAVE STOCK DRAFT
============================================================ */

async function saveStockDraft(
  env,
  body
) {

  const branchCode =
    String(
      body.branchCode ||
      body.branch ||
      ""
    )
      .trim()
      .toUpperCase();


  const stockDate =
    String(
      body.stockDate ||
      body.date ||
      ""
    ).trim();


  const mode =
    String(
      body.mode ||
      "DAILY"
    )
      .trim()
      .toUpperCase();


  const entries =
    Array.isArray(
      body.entries
    )
      ? body.entries
      : [];


  if (
    !branchCode ||
    !stockDate
  ) {

    return {
      success:
        false,

      message:
        "Branch and stock date are required.",
    };
  }


  if (
    ![
      "DAILY",
      "WEEKLY",
    ].includes(
      mode
    )
  ) {

    return {
      success:
        false,

      message:
        "Invalid stock mode.",
    };
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {
      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const key =
    stockDraftKey(
      branchCode,
      stockDate,
      mode
    );


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  const payload = {
    entries,
  };


  await env.DB.prepare(`
    INSERT INTO stock_drafts (
      draft_key,
      branch_code,
      stock_date,
      mode,
      payload,
      updated_at
    )

    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )

    ON CONFLICT(draft_key)
    DO UPDATE SET

      payload =
        excluded.payload,

      updated_at =
        excluded.updated_at
  `)
    .bind(
      key,
      branchCode,
      stockDate,
      mode,
      JSON.stringify(
        payload
      ),
      now
    )
    .run();


  return {

    success:
      true,

    saved:
      entries.length,

    branchCode,

    stockDate,

    mode,

    message:
      "Draft saved.",
  };
}


/* ============================================================
   GET STOCK DRAFT
============================================================ */

async function getStockDraft(
  env,
  branchCode,
  stockDate,
  mode
) {

  const key =
    stockDraftKey(
      branchCode,
      stockDate,
      mode
    );


  const row =
    await env.DB.prepare(`
      SELECT
        payload,
        updated_at

      FROM stock_drafts

      WHERE draft_key = ?

      LIMIT 1
    `)
      .bind(
        key
      )
      .first();


  if (!row) {

    return {

      success:
        true,

      exists:
        false,

      entries:
        [],
    };
  }


  let payload = {};


  try {

    payload =
      JSON.parse(
        row.payload
      );

  } catch {

    payload = {};
  }


  return {

    success:
      true,

    exists:
      true,

    entries:
      Array.isArray(
        payload.entries
      )
        ? payload.entries
        : [],

    updatedAt:
      Number(
        row.updated_at ||
        0
      ),
  };
}


/* ============================================================
   DELETE STOCK DRAFT
============================================================ */

async function deleteStockDraft(
  env,
  branchCode,
  stockDate,
  mode
) {

  const key =
    stockDraftKey(
      branchCode,
      stockDate,
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

    message:
      "Draft cleared.",
  };
}


/* ============================================================
   FIND / CREATE DATE COLUMN FOR STOCK SUBMISSION
============================================================ */

async function ensureStockDateColumn(
  env,
  branch,
  tabName,
  rows,
  stockDate
) {

  /*
    First search existing date.
  */

  const searchLimit =
    Math.min(
      rows.length,
      10
    );


  for (
    let rowIndex = 0;
    rowIndex < searchLimit;
    rowIndex++
  ) {

    const existing =
      findStockDateColumn(
        rows[rowIndex],
        stockDate
      );


    if (
      existing !== -1
    ) {

      return {
        headerRow:
          rowIndex + 1,

        column:
          existing + 1,

        created:
          false,
      };
    }
  }


  /*
    Date not found.

    Determine the date-header row.

    Most BART stock sheets use row 1.
    If another date-like header exists in the first
    few rows, use that row instead.
  */

  let headerRowIndex =
    0;


  for (
    let rowIndex = 0;
    rowIndex < searchLimit;
    rowIndex++
  ) {

    const row =
      rows[rowIndex] ||
      [];


    const hasDate =
      row.some(
        (cell) =>
          /^\d{4}-\d{2}-\d{2}$/.test(
            normalizeStockDate(
              cell
            )
          )
      );


    if (hasDate) {

      headerRowIndex =
        rowIndex;

      break;
    }
  }


  const headerRow =
    rows[
      headerRowIndex
    ] || [];


  /*
    Do not put stock dates inside A-D structural columns.

    At minimum start at E.
  */

  let newColumn =
    Math.max(
      headerRow.length + 1,
      5
    );


  /*
    If there are trailing blanks in parsed Google values,
    headerRow.length already naturally points after the last
    populated value.
  */

  const columnLetter =
    columnNumberToLetters(
      newColumn
    );


  await batchWriteSheet(
    env,
    branch.sheet_id,
    [
      {
        range:
          `${tabName}!` +
          `${columnLetter}${headerRowIndex + 1}`,

        values:
          [[stockDate]],
      },
    ]
  );


  return {

    headerRow:
      headerRowIndex + 1,

    column:
      newColumn,

    created:
      true,
  };
}


/* ============================================================
   SUBMIT STOCK RECORD
============================================================ */

async function submitStockRecord(
  env,
  body
) {

  const branchCode =
    String(
      body.branchCode ||
      body.branch ||
      ""
    )
      .trim()
      .toUpperCase();


  const stockDate =
    String(
      body.stockDate ||
      body.date ||
      ""
    ).trim();


  const mode =
    String(
      body.mode ||
      "DAILY"
    )
      .trim()
      .toUpperCase();


  const entries =
    Array.isArray(
      body.entries
    )
      ? body.entries
      : [];


  if (
    !branchCode ||
    !stockDate
  ) {

    return {
      success:
        false,

      message:
        "Branch and stock date are required.",
    };
  }


  if (
    ![
      "DAILY",
      "WEEKLY",
    ].includes(
      mode
    )
  ) {

    return {
      success:
        false,

      message:
        "Invalid stock mode.",
    };
  }


  if (
    entries.length === 0
  ) {

    return {
      success:
        false,

      message:
        "No stock entries supplied.",
    };
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {
      success:
        false,

      message:
        "Branch not found.",
    };
  }


  if (!branch.sheet_id) {

    return {
      success:
        false,

      message:
        "Branch Google Sheet ID is missing.",
    };
  }


  const lockKey =
    `stock_submit_${branchCode}_${stockDate}_${mode}`;


  const locked =
    await acquireLock(
      env,
      lockKey,
      30
    );


  if (!locked) {

    return {
      success:
        false,

      message:
        "This stock submission is already being processed.",
    };
  }


  try {

    const sheet =
      await readBranchStockSheet(
        env,
        branch
      );


    const parsed =
      parseBranchStockRows(
        sheet.rows,
        stockDate
      );


    /*
      Build valid row map from the actual Google Sheet.

      Never trust a row number supplied by frontend without
      confirming that the SKU belongs to the expected section.
    */

    const allowedItems =
      mode === "DAILY"
        ? parsed.daily
        : parsed.weekly;


    const bySKU =
      new Map();


    const byRow =
      new Map();


    for (
      const item of allowedItems
    ) {

      if (item.sku) {

        bySKU.set(
          item.sku,
          item
        );
      }


      byRow.set(
        Number(
          item.rowNumber
        ),
        item
      );
    }


    const dateColumn =
      await ensureStockDateColumn(
        env,
        branch,
        sheet.tabName,
        sheet.rows,
        stockDate
      );


    const columnLetter =
      columnNumberToLetters(
        dateColumn.column
      );


    const updates =
      [];


    const acceptedEntries =
      [];


    for (
      const entry of entries
    ) {

      const sku =
        cleanSKU(
          entry.sku
        );


      const requestedRow =
        Number(
          entry.rowNumber ||
          entry.row ||
          0
        );


      let item =
        null;


      if (
        sku &&
        bySKU.has(
          sku
        )
      ) {

        item =
          bySKU.get(
            sku
          );

      } else if (
        requestedRow &&
        byRow.has(
          requestedRow
        )
      ) {

        item =
          byRow.get(
            requestedRow
          );
      }


      if (!item) {

        continue;
      }


      const quantity =
        numericValue(
          entry.quantity ??
          entry.qty ??
          entry.value
        );


      updates.push({
        range:
          `${sheet.tabName}!` +
          `${columnLetter}${item.rowNumber}`,

        values:
          [[quantity]],
      });


      acceptedEntries.push({

        rowNumber:
          item.rowNumber,

        sku:
          item.sku,

        item:
          item.item,

        uom:
          item.uom,

        quantity,
      });
    }


    if (
      updates.length === 0
    ) {

      return {
        success:
          false,

        message:
          "No valid stock rows were found for submission.",
      };
    }


    /*
      One Google batch write for the entire submission.
    */

    await batchWriteSheet(
      env,
      branch.sheet_id,
      updates
    );


    /*
      Clear both caches because Google is now newer than D1.
    */

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


    /*
      Remove saved draft after successful submission.
    */

    await deleteStockDraft(
      env,
      branchCode,
      stockDate,
      mode
    );


    return {

      success:
        true,

      branch: {
        code:
          branch.code,

        name:
          branch.name,
      },

      stockDate,

      mode,

      count:
        acceptedEntries.length,

      entries:
        acceptedEntries,

      submittedAt:
        formatJeddahTimestamp(),

      message:
        `${mode} stock submitted successfully.`,
    };

  } finally {

    await releaseLock(
      env,
      lockKey
    );
  }
}


/* ============================================================
   REFRESH STOCK CACHE
============================================================ */

async function refreshStockData(
  env,
  branchCode,
  wantedDate
) {

  /*
    Force Google read and rebuild both D1 views.
  */

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


  const stockView =
    await getStockView(
      env,
      branchCode,
      wantedDate,
      true
    );


  const stockRecord =
    await getStockRecordInit(
      env,
      branchCode,
      wantedDate,
      true
    );


  return {

    success:
      true,

    branchCode,

    date:
      wantedDate,

    stockView,

    stockRecord,

    message:
      "Branch stock database refreshed.",
  };
}
/* ============================================================
   STAFF SCHEDULE CONFIG
============================================================ */

const STAFF_SCHEDULE_FALLBACK_ID =
  "1UtHUn7miqYzaP-NnrwMR_5wnSgLnaYPRQX2c4I7_9B0";

const STAFF_SCHEDULE_TAB =
  "StaffSchedule";

const STAFF_SCHEDULE_CACHE_SECONDS =
  5 * 60;

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


/* ============================================================
   STAFF SCHEDULE SHEET ID
============================================================ */

function getStaffScheduleSheetId(
  env
) {

  return (
    env.STAFF_SCHEDULE_SHEET_ID ||
    STAFF_SCHEDULE_FALLBACK_ID
  );
}


/* ============================================================
   STAFF SCHEDULE DATE HELPERS
============================================================ */

function parseScheduleDate(
  isoDate
) {

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      String(
        isoDate || ""
      )
    );


  if (!match) {

    throw new Error(
      "Invalid schedule date."
    );
  }


  return new Date(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


function formatScheduleISO(
  date
) {

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


/* ============================================================
   GET SUNDAY WEEK START
============================================================ */

function getScheduleWeekMeta(
  selectedDate
) {

  const selected =
    parseScheduleDate(
      selectedDate
    );


  const weekStart =
    new Date(
      selected
    );


  weekStart.setDate(
    selected.getDate() -
    selected.getDay()
  );


  const dayLabels =
    {};


  STAFF_SCHEDULE_DAYS.forEach(
    (
      day,
      index
    ) => {

      const current =
        new Date(
          weekStart
        );


      current.setDate(
        weekStart.getDate() +
        index
      );


      const shortDate =
        current.toLocaleDateString(
          "en-GB",
          {
            day:
              "2-digit",

            month:
              "short",
          }
        );


      dayLabels[
        day
      ] =
        `${day} (${shortDate})`;
    }
  );


  /*
    Keep old Streamlit OT column behavior.
  */

  const comparisonDate =
    new Date(
      2026,
      5,
      1
    );


  const weekDiff =
    Math.floor(
      (
        weekStart -
        comparisonDate
      ) /
      (
        7 *
        24 *
        60 *
        60 *
        1000
      )
    );


  const otHeader =
    weekDiff === 0
      ? "Over-Time"
      : `Over-Time ${weekDiff}`;


  return {

    weekStartISO:
      formatScheduleISO(
        weekStart
      ),

    weekStartDisplay:
      weekStart.toLocaleDateString(
        "en-GB",
        {
          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric",
        }
      ),

    dayLabels,

    otHeader,
  };
}


/* ============================================================
   EMPLOYEE ID COLUMN
============================================================ */

function findEmployeeIdColumn(
  headers
) {

  const normalized =
    headers.map(
      normalizeHeader
    );


  const possibilities = [

    "employeeid",

    "staffid",

    "empid",

    "id",
  ];


  for (
    const possibility of
    possibilities
  ) {

    const index =
      normalized.indexOf(
        possibility
      );


    if (
      index !== -1
    ) {

      return index;
    }
  }


  return -1;
}


/* ============================================================
   OVERTIME
============================================================ */

function scheduleShiftOvertime(
  value
) {

  const match =
    /\(OT\s+(\d+(?:\.\d+)?)\s*h\)/i.exec(
      String(
        value || ""
      )
    );


  if (!match) {

    return 0;
  }


  return (
    Number(
      match[1]
    ) ||
    0
  );
}


function scheduleEmployeeOvertime(
  shifts
) {

  let total =
    0;


  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {

    total +=
      scheduleShiftOvertime(
        shifts?.[
          day
        ]
      );
  }


  return total;
}


/* ============================================================
   READ STAFF SCHEDULE GOOGLE SHEET
============================================================ */

async function readStaffScheduleSheet(
  env
) {

  return await getSheetValues(
    env,
    getStaffScheduleSheetId(
      env
    ),
    `${STAFF_SCHEDULE_TAB}!A:ZZ`
  );
}


/* ============================================================
   SCHEDULE CACHE KEY
============================================================ */

function staffScheduleCacheKey(
  branchCode,
  weekStartISO
) {

  return (
    `${branchCode}|` +
    `${weekStartISO}`
  );
}


/* ============================================================
   CLEAR SCHEDULE CACHE
============================================================ */

async function invalidateStaffScheduleCache(
  env,
  branchCodes = []
) {

  const uniqueCodes =
    Array.from(
      new Set(
        branchCodes
          .filter(
            Boolean
          )
          .map(
            (code) =>
              String(
                code
              )
                .trim()
                .toUpperCase()
          )
      )
    );


  for (
    const code of
    uniqueCodes
  ) {

    await env.DB.prepare(`
      DELETE FROM schedule_cache

      WHERE cache_key LIKE ?
    `)
      .bind(
        `${code}|%`
      )
      .run();
  }
}


/* ============================================================
   PARSE STAFF SCHEDULE
============================================================ */

function parseStaffScheduleRows(
  rows,
  branchCode,
  selectedDate
) {

  if (
    !Array.isArray(
      rows
    ) ||
    rows.length === 0
  ) {

    throw new Error(
      "StaffSchedule sheet is empty."
    );
  }


  const headers =
    rows[0] ||
    [];


  const normalized =
    headers.map(
      normalizeHeader
    );


  const branchIndex =
    normalized.indexOf(
      "branch"
    );


  const nameIndex =
    normalized.indexOf(
      "name"
    );


  const roleIndex =
    normalized.indexOf(
      "role"
    );


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
      "StaffSchedule must contain Branch, Name and Role columns."
    );
  }


  const week =
    getScheduleWeekMeta(
      selectedDate
    );


  const dayIndexes =
    {};


  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {

    dayIndexes[
      day
    ] =
      headers.indexOf(
        week.dayLabels[
          day
        ]
      );
  }


  const overtimeIndex =
    headers.indexOf(
      week.otHeader
    );


  const employees =
    [];


  let submitted =
    false;


  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {

    const row =
      rows[
        rowIndex
      ] ||
      [];


    const rowBranch =
      String(
        row[
          branchIndex
        ] ||
        ""
      )
        .trim()
        .toUpperCase();


    if (
      rowBranch !==
      branchCode
    ) {

      continue;
    }


    const name =
      String(
        row[
          nameIndex
        ] ||
        ""
      ).trim();


    if (!name) {

      continue;
    }


    const shifts =
      {};


    for (
      const day of
      STAFF_SCHEDULE_DAYS
    ) {

      const columnIndex =
        dayIndexes[
          day
        ];


      const shift =
        columnIndex >= 0
          ? String(
              row[
                columnIndex
              ] ||
              ""
            )
          : "";


      shifts[
        day
      ] =
        shift;


      if (
        shift.trim()
      ) {

        submitted =
          true;
      }
    }


    const overtime =
      overtimeIndex >= 0
        ? String(
            row[
              overtimeIndex
            ] ||
            ""
          ).trim()
        : `${scheduleEmployeeOvertime(
            shifts
          )} hrs`;


    employees.push({

      rowNumber:
        rowIndex + 1,

      employeeId:
        employeeIdIndex >= 0
          ? String(
              row[
                employeeIdIndex
              ] ||
              ""
            ).trim()
          : "",

      name,

      role:
        String(
          row[
            roleIndex
          ] ||
          ""
        ).trim(),

      shifts,

      overtime,
    });
  }


  return {

    headers,

    branchIndex,

    nameIndex,

    roleIndex,

    employeeIdIndex,

    week,

    submitted,

    employees,
  };
}


/* ============================================================
   STAFF SCHEDULE INIT
============================================================ */

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

    return {
      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const week =
    getScheduleWeekMeta(
      selectedDate
    );


  const cacheKey =
    staffScheduleCacheKey(
      branchCode,
      week.weekStartISO
    );


  const now =
    Math.floor(
      Date.now() /
      1000
    );


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
        .bind(
          cacheKey
        )
        .first();


    if (cached) {

      const age =
        now -
        Number(
          cached.synced_at ||
          0
        );


      if (
        age <
        STAFF_SCHEDULE_CACHE_SECONDS
      ) {

        try {

          const payload =
            JSON.parse(
              cached.payload
            );


          return {

            success:
              true,

            source:
              "D1",

            googleCalled:
              false,

            cacheAgeSeconds:
              age,

            branch: {
              code:
                branch.code,

              name:
                branch.name,
            },

            ...payload,
          };

        } catch (error) {

          console.log(
            "Schedule cache parse warning:",
            error.message
          );
        }
      }
    }
  }


  const rows =
    await readStaffScheduleSheet(
      env
    );


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


  const destinations =
    (
      branchRows.results ||
      []
    )
      .filter(
        (item) =>
          item.code !==
          branchCode
      )
      .map(
        (item) => ({

          code:
            item.code,

          name:
            item.name,

          label:
            `${item.code} - ${item.name}`,
        })
      );


  const payload = {

    week:
      parsed.week,

    employees:
      parsed.employees,

    submitted:
      parsed.submitted,

    roles:
      STAFF_ROLE_OPTIONS,

    destinations,

    syncedAt:
      new Date()
        .toISOString(),
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

      payload =
        excluded.payload,

      synced_at =
        excluded.synced_at
  `)
    .bind(

      cacheKey,

      JSON.stringify(
        payload
      ),

      now
    )
    .run();


  return {

    success:
      true,

    source:
      "GOOGLE->D1",

    googleCalled:
      true,

    cacheAgeSeconds:
      0,

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },

    ...payload,
  };
}


/* ============================================================
   ENSURE WEEK COLUMNS
============================================================ */

async function ensureStaffScheduleWeekHeaders(
  env,
  rows,
  week
) {

  const headers =
    [
      ...(
        rows[0] ||
        []
      ),
    ];


  const updates =
    [];


  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {

    const expected =
      week.dayLabels[
        day
      ];


    if (
      headers.includes(
        expected
      )
    ) {

      continue;
    }


    const columnNumber =
      headers.length +
      1;


    const columnLetter =
      columnNumberToLetters(
        columnNumber
      );


    updates.push({

      range:
        `${STAFF_SCHEDULE_TAB}!` +
        `${columnLetter}1`,

      values:
        [[expected]],
    });


    headers.push(
      expected
    );
  }


  if (
    !headers.includes(
      week.otHeader
    )
  ) {

    const columnNumber =
      headers.length +
      1;


    const columnLetter =
      columnNumberToLetters(
        columnNumber
      );


    updates.push({

      range:
        `${STAFF_SCHEDULE_TAB}!` +
        `${columnLetter}1`,

      values:
        [[
          week.otHeader
        ]],
    });


    headers.push(
      week.otHeader
    );
  }


  if (
    updates.length > 0
  ) {

    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(
        env
      ),
      updates
    );
  }


  return headers;
}


/* ============================================================
   SUBMIT STAFF SCHEDULE
============================================================ */

async function submitStaffSchedule(
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


  const employees =
    Array.isArray(
      body.employees
    )
      ? body.employees
      : [];


  if (
    !branchCode ||
    !selectedDate
  ) {

    return {

      success:
        false,

      message:
        "Branch and schedule date are required.",
    };
  }


  if (
    employees.length ===
    0
  ) {

    return {

      success:
        false,

      message:
        "No employees supplied.",
    };
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {

      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const lockKey =
    `schedule_submit_${branchCode}_${selectedDate}`;


  const locked =
    await acquireLock(
      env,
      lockKey,
      40
    );


  if (!locked) {

    return {

      success:
        false,

      message:
        "Schedule is already being submitted.",
    };
  }


  try {

    const rows =
      await readStaffScheduleSheet(
        env
      );


    const existing =
      parseStaffScheduleRows(
        rows,
        branchCode,
        selectedDate
      );


    /*
      Preserve old duplicate-week protection.
    */

    if (
      existing.submitted
    ) {

      return {

        success:
          false,

        duplicate:
          true,

        message:
          "This week's schedule has already been submitted for this branch.",
      };
    }


    const week =
      getScheduleWeekMeta(
        selectedDate
      );


    const headers =
      await ensureStaffScheduleWeekHeaders(
        env,
        rows,
        week
      );


    const normalized =
      headers.map(
        normalizeHeader
      );


    const branchIndex =
      normalized.indexOf(
        "branch"
      );


    const nameIndex =
      normalized.indexOf(
        "name"
      );


    const roleIndex =
      normalized.indexOf(
        "role"
      );


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
        "StaffSchedule must contain Branch, Name and Role."
      );
    }


    const updates =
      [];


    for (
      const employee of
      employees
    ) {

      const employeeName =
        String(
          employee.name ||
          ""
        ).trim();


      if (!employeeName) {

        continue;
      }


      const employeeId =
        String(
          employee.employeeId ||
          ""
        ).trim();


      /*
        Find the actual row in Google.
      */

      let rowNumber =
        null;


      for (
        let index = 1;
        index < rows.length;
        index++
      ) {

        const row =
          rows[
            index
          ] ||
          [];


        const sameBranch =
          String(
            row[
              branchIndex
            ] ||
            ""
          )
            .trim()
            .toUpperCase() ===
          branchCode;


        if (!sameBranch) {

          continue;
        }


        const rowEmployeeId =
          employeeIdIndex >= 0
            ? String(
                row[
                  employeeIdIndex
                ] ||
                ""
              ).trim()
            : "";


        const rowName =
          String(
            row[
              nameIndex
            ] ||
            ""
          ).trim();


        if (
          (
            employeeId &&
            rowEmployeeId ===
              employeeId
          ) ||
          (
            !employeeId &&
            rowName.toLowerCase() ===
              employeeName.toLowerCase()
          )
        ) {

          rowNumber =
            index + 1;

          break;
        }
      }


      /*
        Employee isn't in sheet yet.
        Create a new row.
      */

      if (!rowNumber) {

        rowNumber =
          rows.length +
          1;


        const newRow =
          new Array(
            headers.length
          ).fill(
            ""
          );


        newRow[
          branchIndex
        ] =
          branchCode;


        newRow[
          nameIndex
        ] =
          employeeName;


        newRow[
          roleIndex
        ] =
          String(
            employee.role ||
            ""
          );


        if (
          employeeIdIndex >=
          0
        ) {

          newRow[
            employeeIdIndex
          ] =
            employeeId;
        }


        await appendSheetRow(
          env,
          getStaffScheduleSheetId(
            env
          ),
          `${STAFF_SCHEDULE_TAB}!A:ZZ`,
          newRow
        );


        /*
          Because append adds one row,
          add placeholder locally too.
        */

        rows.push(
          newRow
        );
      }


      /*
        Role can be updated from Edit Mode.
      */

      const roleColumn =
        columnNumberToLetters(
          roleIndex + 1
        );


      updates.push({

        range:
          `${STAFF_SCHEDULE_TAB}!` +
          `${roleColumn}${rowNumber}`,

        values:
          [[
            String(
              employee.role ||
              ""
            ),
          ]],
      });


      /*
        Employee ID
      */

      if (
        employeeIdIndex >= 0
      ) {

        const employeeIdColumn =
          columnNumberToLetters(
            employeeIdIndex +
            1
          );


        updates.push({

          range:
            `${STAFF_SCHEDULE_TAB}!` +
            `${employeeIdColumn}${rowNumber}`,

          values:
            [[employeeId]],
        });
      }


      /*
        Sunday - Saturday
      */

      for (
        const day of
        STAFF_SCHEDULE_DAYS
      ) {

        const header =
          week.dayLabels[
            day
          ];


        const columnIndex =
          headers.indexOf(
            header
          );


        if (
          columnIndex < 0
        ) {

          continue;
        }


        const columnLetter =
          columnNumberToLetters(
            columnIndex + 1
          );


        const shift =
          String(
            employee.shifts?.[
              day
            ] ||
            ""
          );


        updates.push({

          range:
            `${STAFF_SCHEDULE_TAB}!` +
            `${columnLetter}${rowNumber}`,

          values:
            [[shift]],
        });
      }


      /*
        Weekly overtime.
      */

      const overtimeIndex =
        headers.indexOf(
          week.otHeader
        );


      if (
        overtimeIndex >= 0
      ) {

        const totalOT =
          scheduleEmployeeOvertime(
            employee.shifts ||
            {}
          );


        const overtimeColumn =
          columnNumberToLetters(
            overtimeIndex +
            1
          );


        updates.push({

          range:
            `${STAFF_SCHEDULE_TAB}!` +
            `${overtimeColumn}${rowNumber}`,

          values:
            [[
              `${totalOT} hrs`,
            ]],
        });
      }
    }


    if (
      updates.length === 0
    ) {

      return {

        success:
          false,

        message:
          "No schedule updates found.",
      };
    }


    /*
      One batch update.
    */

    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(
        env
      ),
      updates
    );


    await invalidateStaffScheduleCache(
      env,
      [
        branchCode,
      ]
    );


    return {

      success:
        true,

      branchCode,

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

  } finally {

    await releaseLock(
      env,
      lockKey
    );
  }
}


/* ============================================================
   ENSURE EMPLOYEE ID COLUMN
============================================================ */

async function ensureEmployeeIdHeader(
  env,
  rows
) {

  const headers =
    [
      ...(
        rows[0] ||
        []
      ),
    ];


  let index =
    findEmployeeIdColumn(
      headers
    );


  if (
    index >= 0
  ) {

    return {

      headers,

      employeeIdIndex:
        index,
    };
  }


  /*
    Add Employee ID column automatically.
  */

  index =
    headers.length;


  const columnLetter =
    columnNumberToLetters(
      index + 1
    );


  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(
      env
    ),
    [
      {
        range:
          `${STAFF_SCHEDULE_TAB}!` +
          `${columnLetter}1`,

        values:
          [[
            "Employee ID",
          ]],
      },
    ]
  );


  headers.push(
    "Employee ID"
  );


  return {

    headers,

    employeeIdIndex:
      index,
  };
}


/* ============================================================
   ADD NEW EMPLOYEE
============================================================ */

async function addStaffScheduleEmployee(
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


  const employeeId =
    String(
      body.employeeId ||
      ""
    ).trim();


  const name =
    String(
      body.name ||
      ""
    ).trim();


  const role =
    String(
      body.role ||
      ""
    ).trim();


  if (
    !branchCode ||
    !name ||
    !role
  ) {

    return {

      success:
        false,

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

      success:
        false,

      message:
        "Invalid employee role.",
    };
  }


  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {

      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const rows =
    await readStaffScheduleSheet(
      env
    );


  const employeeIdInfo =
    await ensureEmployeeIdHeader(
      env,
      rows
    );


  const headers =
    employeeIdInfo.headers;


  const employeeIdIndex =
    employeeIdInfo.employeeIdIndex;


  const normalized =
    headers.map(
      normalizeHeader
    );


  const branchIndex =
    normalized.indexOf(
      "branch"
    );


  const nameIndex =
    normalized.indexOf(
      "name"
    );


  const roleIndex =
    normalized.indexOf(
      "role"
    );


  if (
    branchIndex < 0 ||
    nameIndex < 0 ||
    roleIndex < 0
  ) {

    throw new Error(
      "StaffSchedule must contain Branch, Name and Role."
    );
  }


  /*
    Duplicate checks.
  */

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {

    const row =
      rows[
        index
      ] ||
      [];


    const existingEmployeeId =
      String(
        row[
          employeeIdIndex
        ] ||
        ""
      ).trim();


    if (
      employeeId &&
      existingEmployeeId &&
      existingEmployeeId ===
        employeeId
    ) {

      return {

        success:
          false,

        message:
          "This Employee ID already exists.",
      };
    }


    const existingBranch =
      String(
        row[
          branchIndex
        ] ||
        ""
      )
        .trim()
        .toUpperCase();


    const existingName =
      String(
        row[
          nameIndex
        ] ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      existingBranch ===
        branchCode &&
      existingName ===
        name.toLowerCase()
    ) {

      return {

        success:
          false,

        message:
          "This employee already exists in this branch.",
      };
    }
  }


  const newRow =
    new Array(
      headers.length
    ).fill(
      ""
    );


  newRow[
    branchIndex
  ] =
    branchCode;


  newRow[
    nameIndex
  ] =
    name;


  newRow[
    roleIndex
  ] =
    role;


  newRow[
    employeeIdIndex
  ] =
    employeeId;


  await appendSheetRow(
    env,
    getStaffScheduleSheetId(
      env
    ),
    `${STAFF_SCHEDULE_TAB}!A:ZZ`,
    newRow
  );


  await invalidateStaffScheduleCache(
    env,
    [
      branchCode,
    ]
  );


  return {

    success:
      true,

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


/* ============================================================
   FIND EMPLOYEE ROW
============================================================ */

function findStaffScheduleEmployeeRow(
  rows,
  branchCode,
  body
) {

  const headers =
    rows[0] ||
    [];


  const normalized =
    headers.map(
      normalizeHeader
    );


  const branchIndex =
    normalized.indexOf(
      "branch"
    );


  const nameIndex =
    normalized.indexOf(
      "name"
    );


  const roleIndex =
    normalized.indexOf(
      "role"
    );


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
      "StaffSchedule must contain Branch, Name and Role."
    );
  }


  const requestedId =
    String(
      body.employeeId ||
      ""
    ).trim();


  const requestedName =
    String(
      body.name ||
      ""
    )
      .trim()
      .toLowerCase();


  for (
    let index = 1;
    index < rows.length;
    index++
  ) {

    const row =
      rows[
        index
      ] ||
      [];


    const rowBranch =
      String(
        row[
          branchIndex
        ] ||
        ""
      )
        .trim()
        .toUpperCase();


    if (
      rowBranch !==
      branchCode
    ) {

      continue;
    }


    const rowEmployeeId =
      employeeIdIndex >= 0
        ? String(
            row[
              employeeIdIndex
            ] ||
            ""
          ).trim()
        : "";


    const rowName =
      String(
        row[
          nameIndex
        ] ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      requestedId &&
      rowEmployeeId ===
        requestedId
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
      !requestedId &&
      requestedName &&
      rowName ===
        requestedName
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


/* ============================================================
   EMPLOYEE REMOVE / TRANSFER
============================================================ */

async function removeStaffScheduleEmployee(
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


  const reason =
    String(
      body.reason ||
      ""
    )
      .trim()
      .toLowerCase();


  const destinationBranch =
    String(
      body.destinationBranch ||
      ""
    )
      .trim()
      .toUpperCase();


  if (
    ![
      "transfer",
      "terminated",
      "contract_finished",
    ].includes(
      reason
    )
  ) {

    return {

      success:
        false,

      message:
        "Invalid employee action.",
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

      success:
        false,

      message:
        "Employee not found in this branch.",
    };
  }


  const {

    rowNumber,

    row,

    branchIndex,

    nameIndex,

    employeeIdIndex,

  } =
    match;


  const name =
    String(
      row[
        nameIndex
      ] ||
      body.name ||
      ""
    ).trim();


  /* ==========================================================
     TRANSFER EMPLOYEE
  ========================================================== */

  if (
    reason ===
    "transfer"
  ) {

    if (
      !destinationBranch
    ) {

      return {

        success:
          false,

        message:
          "Destination branch is required.",
      };
    }


    if (
      destinationBranch ===
      branchCode
    ) {

      return {

        success:
          false,

        message:
          "Employee is already in this branch.",
      };
    }


    const destination =
      await getBartBranch(
        env,
        destinationBranch
      );


    if (!destination) {

      return {

        success:
          false,

        message:
          "Destination branch not found.",
      };
    }


    const branchColumn =
      columnNumberToLetters(
        branchIndex + 1
      );


    /*
      Move the SAME row by changing Branch.

      This automatically makes employee disappear
      from current branch and appear in destination.
    */

    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(
        env
      ),
      [
        {
          range:
            `${STAFF_SCHEDULE_TAB}!` +
            `${branchColumn}${rowNumber}`,

          values:
            [[
              destinationBranch,
            ]],
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

      success:
        true,

      action:
        "transfer",

      fromBranch:
        branchCode,

      destinationBranch,

      employee:
        name,

      message:
        `${name} transferred from ${branchCode} to ${destinationBranch}.`,
    };
  }


  /* ==========================================================
     TERMINATED
  ========================================================== */

  if (
    reason ===
    "terminated"
  ) {

    const branchColumn =
      columnNumberToLetters(
        branchIndex + 1
      );


    /*
      Preserve historical schedule row.
      Employee simply leaves active branch.
    */

    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(
        env
      ),
      [
        {
          range:
            `${STAFF_SCHEDULE_TAB}!` +
            `${branchColumn}${rowNumber}`,

          values:
            [[
              "TERMINATED",
            ]],
        },
      ]
    );


    await invalidateStaffScheduleCache(
      env,
      [
        branchCode,
      ]
    );


    return {

      success:
        true,

      action:
        "terminated",

      employee:
        name,

      message:
        `${name} removed from active staff as terminated.`,
    };
  }


  /* ==========================================================
     CONTRACT FINISHED
  ========================================================== */

  if (
    reason ===
    "contract_finished"
  ) {

    const updates =
      [];


    const branchColumn =
      columnNumberToLetters(
        branchIndex + 1
      );


    updates.push({

      range:
        `${STAFF_SCHEDULE_TAB}!` +
        `${branchColumn}${rowNumber}`,

      values:
        [[
          "CONTRACT_FINISHED",
        ]],
    });


    /*
      User specifically requested:
      delete / clear employee ID when contract is finished.
    */

    if (
      employeeIdIndex >=
      0
    ) {

      const employeeIdColumn =
        columnNumberToLetters(
          employeeIdIndex +
          1
        );


      updates.push({

        range:
          `${STAFF_SCHEDULE_TAB}!` +
          `${employeeIdColumn}${rowNumber}`,

        values:
          [[""]],
      });
    }


    await batchWriteSheet(
      env,
      getStaffScheduleSheetId(
        env
      ),
      updates
    );


    await invalidateStaffScheduleCache(
      env,
      [
        branchCode,
      ]
    );


    return {

      success:
        true,

      action:
        "contract_finished",

      employee:
        name,

      employeeIdCleared:
        employeeIdIndex >=
        0,

      message:
        `${name} marked contract finished and Employee ID removed.`,
    };
  }


  return {

    success:
      false,

    message:
      "Unknown employee action.",
  };
}


/* ============================================================
   VACATION EMPLOYEE

   Vacation does NOT delete or transfer employee.

   Sunday-Saturday of the selected week is written
   as VACATION.

   This is separate from permanent removal.
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

      success:
        false,

      message:
        "Branch and week are required.",
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

      success:
        false,

      message:
        "Employee not found in this branch.",
    };
  }


  const week =
    getScheduleWeekMeta(
      selectedDate
    );


  const headers =
    await ensureStaffScheduleWeekHeaders(
      env,
      rows,
      week
    );


  const updates =
    [];


  for (
    const day of
    STAFF_SCHEDULE_DAYS
  ) {

    const header =
      week.dayLabels[
        day
      ];


    const columnIndex =
      headers.indexOf(
        header
      );


    if (
      columnIndex < 0
    ) {

      continue;
    }


    const columnLetter =
      columnNumberToLetters(
        columnIndex +
        1
      );


    updates.push({

      range:
        `${STAFF_SCHEDULE_TAB}!` +
        `${columnLetter}${match.rowNumber}`,

      values:
        [[
          "VACATION",
        ]],
    });
  }


  const overtimeIndex =
    headers.indexOf(
      week.otHeader
    );


  if (
    overtimeIndex >= 0
  ) {

    const overtimeColumn =
      columnNumberToLetters(
        overtimeIndex +
        1
      );


    updates.push({

      range:
        `${STAFF_SCHEDULE_TAB}!` +
        `${overtimeColumn}${match.rowNumber}`,

      values:
        [[
          "0 hrs",
        ]],
    });
  }


  await batchWriteSheet(
    env,
    getStaffScheduleSheetId(
      env
    ),
    updates
  );


  await invalidateStaffScheduleCache(
    env,
    [
      branchCode,
    ]
  );


  const employeeName =
    String(
      match.row[
        match.nameIndex
      ] ||
      body.name ||
      ""
    ).trim();


  return {

    success:
      true,

    action:
      "vacation",

    employee:
      employeeName,

    branchCode,

    weekStart:
      week.weekStartISO,

    message:
      `${employeeName} marked VACATION for the full week.`,
  };
}


/* ============================================================
   STOCK TRANSFER HELPERS
============================================================ */

function normalizeTransferCart(
  rawCart
) {

  const merged =
    new Map();


  const cart =
    Array.isArray(
      rawCart
    )
      ? rawCart
      : [];


  for (
    const rawItem of cart
  ) {

    const item =
      String(
        rawItem.item ||
        rawItem.name ||
        ""
      ).trim();


    const sku =
      cleanSKU(
        rawItem.sku
      );


    const uom =
      String(
        rawItem.uom ||
        ""
      ).trim();


    const quantity =
      Math.trunc(
        numericValue(
          rawItem.quantity ??
          rawItem.qty
        )
      );


    if (
      !item ||
      quantity <= 0
    ) {

      continue;
    }


    const key =
      sku ||
      item.toLowerCase();


    if (
      merged.has(
        key
      )
    ) {

      const existing =
        merged.get(
          key
        );


      existing.quantity +=
        quantity;


      continue;
    }


    merged.set(
      key,
      {

        item,

        sku,

        uom,

        quantity,
      }
    );
  }


  return Array.from(
    merged.values()
  );
}


/* ============================================================
   GENERATE TRANSFER ID
============================================================ */

function generateTransferId() {

  const now =
    getJeddahNow();


  const date =

    `${now.getFullYear()}` +

    `${String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}` +

    `${String(
      now.getDate()
    ).padStart(
      2,
      "0"
    )}`;


  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


  let suffix =
    "";


  for (
    let index = 0;
    index < 4;
    index++
  ) {

    suffix +=
      characters[
        Math.floor(
          Math.random() *
          characters.length
        )
      ];
  }


  return (
    `TR-${date}-${suffix}`
  );
}


/* ============================================================
   BUILD STOCK ITEM MAP
============================================================ */

function buildStockItemMap(
  rows,
  targetDate
) {

  const parsed =
    parseBranchStockRows(
      rows,
      targetDate
    );


  const bySKU =
    new Map();


  const byName =
    new Map();


  for (
    const item of
    parsed.all
  ) {

    if (
      item.sku
    ) {

      bySKU.set(
        cleanSKU(
          item.sku
        ),
        item
      );
    }


    if (
      item.item
    ) {

      byName.set(
        String(
          item.item
        )
          .trim()
          .toLowerCase(),
        item
      );
    }
  }


  return {

    parsed,

    bySKU,

    byName,
  };
}


/* ============================================================
   BUILD STOCK MOVEMENT
============================================================ */

function buildStockMovement(
  stockMap,
  cart,
  mode
) {

  const updates =
    [];


  const rollback =
    [];


  const missing =
    [];


  const insufficient =
    [];


  const column =
    stockMap.parsed.dateColumn;


  if (
    column < 1
  ) {

    throw new Error(
      `Stock date ${stockMap.parsed.date} not found.`
    );
  }


  const columnLetter =
    columnNumberToLetters(
      column
    );


  for (
    const entry of cart
  ) {

    let item =
      null;


    if (
      entry.sku &&
      stockMap.bySKU.has(
        cleanSKU(
          entry.sku
        )
      )
    ) {

      item =
        stockMap.bySKU.get(
          cleanSKU(
            entry.sku
          )
        );

    } else if (
      stockMap.byName.has(
        entry.item
          .trim()
          .toLowerCase()
      )
    ) {

      item =
        stockMap.byName.get(
          entry.item
            .trim()
            .toLowerCase()
        );
    }


    if (!item) {

      missing.push({
        item:
          entry.item,

        sku:
          entry.sku,
      });


      continue;
    }


    const current =
      numericValue(
        item.quantity
      );


    const quantity =
      numericValue(
        entry.quantity
      );


    if (
      mode ===
        "subtract" &&
      current <
        quantity
    ) {

      insufficient.push({

        item:
          item.item,

        sku:
          item.sku,

        available:
          current,

        requested:
          quantity,
      });


      continue;
    }


    const nextValue =
      mode ===
      "subtract"
        ? current -
          quantity
        : current +
          quantity;


    const range =
      `${columnLetter}${item.rowNumber}`;


    updates.push({

      rowNumber:
        item.rowNumber,

      item:
        item.item,

      sku:
        item.sku,

      current,

      quantity,

      nextValue,

      range,
    });


    rollback.push({

      rowNumber:
        item.rowNumber,

      range,

      originalValue:
        current,
    });
  }


  return {

    updates,

    rollback,

    missing,

    insufficient,
  };
}


/* ============================================================
   STOCK TRANSFER INIT
============================================================ */

async function getStockTransferInit(
  env,
  branchCode,
  force = false
) {

  const origin =
    await getBartBranch(
      env,
      branchCode
    );


  if (!origin) {

    return {

      success:
        false,

      message:
        "Origin branch not found.",
    };
  }


  const targetDate =
    getJeddahYesterdayISO();


  const stock =
    await getStockView(
      env,
      branchCode,
      targetDate,
      force
    );


  if (
    !stock.success
  ) {

    return stock;
  }


  const branches =
    await env.DB.prepare(`
      SELECT
        code,
        name

      FROM branches

      WHERE brand = 'bart'

      ORDER BY code ASC
    `).all();


  const destinations =
    (
      branches.results ||
      []
    )
      .filter(
        (item) =>
          item.code !==
          branchCode
      )
      .map(
        (item) => ({

          code:
            item.code,

          name:
            item.name,

          label:
            `${item.code} - ${item.name}`,
        })
      );


  return {

    success:
      true,

    source:
      stock.source,

    googleCalled:
      stock.googleCalled,

    origin: {

      code:
        origin.code,

      name:
        origin.name,

      label:
        `${origin.code} - ${origin.name}`,
    },

    targetDate,

    dateAvailable:
      stock.dateFound,

    items: {

      daily:
        stock.daily ||
        [],

      weekly:
        stock.weekly ||
        [],
    },

    destinations,
  };
}


/* ============================================================
   FIND TRANSFER TAB FOR APPEND
============================================================ */

async function findTransferTab(
  env
) {

  const candidates = [

    "Stock Transfer",

    "StockTransfer",

    "Transfers",
  ];


  for (
    const tab of
    candidates
  ) {

    try {

      await getSheetValues(
        env,
        env.MASTER_SHEET_ID,
        `${tab}!A1:A2`
      );


      return tab;

    } catch {

      /* try next */
    }
  }


  throw new Error(
    "No transfer tab found in master Google Sheet."
  );
}


/* ============================================================
   CREATE STOCK TRANSFER
============================================================ */

async function createStockTransfer(
  env,
  body
) {

  const originCode =
    String(
      body.originBranch ||
      body.branchCode ||
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
    ).trim();


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


  if (
    cart.length ===
    0
  ) {

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
    !origin ||
    !destination
  ) {

    return {

      success:
        false,

      message:
        "Origin or destination branch not found.",
    };
  }


  if (
    !origin.sheet_id ||
    !destination.sheet_id
  ) {

    return {

      success:
        false,

      message:
        "Origin or destination Google Sheet ID is missing.",
    };
  }


  const targetDate =
    getJeddahYesterdayISO();


  const lockKey =
    `transfer_${originCode}_${destinationCode}`;


  const locked =
    await acquireLock(
      env,
      lockKey,
      45
    );


  if (!locked) {

    return {

      success:
        false,

      message:
        "Another stock transfer is already being processed.",
    };
  }


  let originWritten =
    false;


  let destinationWritten =
    false;


  let originSheet =
    null;


  let destinationSheet =
    null;


  let originMovement =
    null;


  let destinationMovement =
    null;


  try {

    [
      originSheet,
      destinationSheet,
    ] =
      await Promise.all([

        readBranchStockSheet(
          env,
          origin
        ),

        readBranchStockSheet(
          env,
          destination
        ),
      ]);


    const originMap =
      buildStockItemMap(
        originSheet.rows,
        targetDate
      );


    const destinationMap =
      buildStockItemMap(
        destinationSheet.rows,
        targetDate
      );


    if (
      !originMap.parsed
        .dateFound
    ) {

      return {

        success:
          false,

        message:
          `Origin stock date ${targetDate} not found.`,
      };
    }


    if (
      !destinationMap.parsed
        .dateFound
    ) {

      return {

        success:
          false,

        message:
          `Destination stock date ${targetDate} not found.`,
      };
    }


    originMovement =
      buildStockMovement(
        originMap,
        cart,
        "subtract"
      );


    destinationMovement =
      buildStockMovement(
        destinationMap,
        cart,
        "add"
      );


    if (
      originMovement
        .missing
        .length ||
      destinationMovement
        .missing
        .length
    ) {

      return {

        success:
          false,

        missingItems:
          true,

        originMissing:
          originMovement
            .missing,

        destinationMissing:
          destinationMovement
            .missing,

        message:
          "Some transfer items do not exist in one of the branch stock sheets.",
      };
    }


    if (
      originMovement
        .insufficient
        .length
    ) {

      return {

        success:
          false,

        insufficient:
          true,

        items:
          originMovement
            .insufficient,

        message:
          "Insufficient stock in origin branch.",
      };
    }


    const originWrites =
      originMovement
        .updates
        .map(
          (item) => ({

            range:
              `${originSheet.tabName}!${item.range}`,

            values:
              [[
                item.nextValue,
              ]],
          })
        );


    const destinationWrites =
      destinationMovement
        .updates
        .map(
          (item) => ({

            range:
              `${destinationSheet.tabName}!${item.range}`,

            values:
              [[
                item.nextValue,
              ]],
          })
        );


    /*
      SUBTRACT ORIGIN
    */

    await batchWriteSheet(
      env,
      origin.sheet_id,
      originWrites
    );


    originWritten =
      true;


    /*
      ADD DESTINATION
    */

    await batchWriteSheet(
      env,
      destination.sheet_id,
      destinationWrites
    );


    destinationWritten =
      true;


    const transferId =
      generateTransferId();


    const originLabel =
      `${origin.code} - ${origin.name}`;


    const destinationLabel =
      `${destination.code} - ${destination.name}`;


    const itemsText =
      cart
        .map(
          (entry) =>

            `• [${entry.sku}] ` +

            `${entry.item} ` +

            `(${entry.quantity} ${entry.uom})`
        )
        .join(
          "\n"
        );


    const quantitiesText =
      cart
        .map(
          (entry) =>
            String(
              entry.quantity
            )
        )
        .join(
          "\n"
        );


    const timestamp =
      formatJeddahTimestamp();


    const transferTab =
      await findTransferTab(
        env
      );


    /*
      Write transfer record.
    */

    await appendSheetRow(
      env,
      env.MASTER_SHEET_ID,
      `${transferTab}!A:Z`,
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
      D1 copy.
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

      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
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


    /*
      Invalidate both stock caches.
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


    /*
      Force transfer poll to refresh.
    */

    transferMemoryCache = {

      loadedAt:
        0,

      transfers:
        [],
    };


    return {

      success:
        true,

      transferId,

      origin:
        originLabel,

      destination:
        destinationLabel,

      targetDate,

      items:
        cart,

      timestamp,

      message:
        "Stock transfer completed successfully.",
    };

  } catch (error) {

    console.error(
      "STOCK TRANSFER FAILURE:",
      error
    );


    /*
      DESTINATION ROLLBACK
    */

    if (
      destinationWritten &&
      destinationMovement
    ) {

      try {

        await batchWriteSheet(
          env,
          destination.sheet_id,

          destinationMovement
            .rollback
            .map(
              (item) => ({

                range:
                  `${destinationSheet.tabName}!${item.range}`,

                values:
                  [[
                    item.originalValue,
                  ]],
              })
            )
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
      ORIGIN ROLLBACK
    */

    if (
      originWritten &&
      originMovement
    ) {

      try {

        await batchWriteSheet(
          env,
          origin.sheet_id,

          originMovement
            .rollback
            .map(
              (item) => ({

                range:
                  `${originSheet.tabName}!${item.range}`,

                values:
                  [[
                    item.originalValue,
                  ]],
              })
            )
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

  } finally {

    await releaseLock(
      env,
      lockKey
    );
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

  const branch =
    await getBartBranch(
      env,
      branchCode
    );


  if (!branch) {

    return {

      success:
        false,

      message:
        "Branch not found.",
    };
  }


  const label =
    `${branch.code} - ${branch.name}`;


  const countRow =
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
        countRow?.total ||
        0
      ),

    transfers:
      rows.results ||
      [],
  };
}


/* ============================================================
   FINAL WORKER
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
         MANUAL DATABASE REFRESH
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
         BART BRANCHES
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

            ORDER BY code ASC
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
         TRANSFER ACCEPT / REJECT
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


        const date =
          String(
            url.searchParams.get(
              "date"
            ) ||
            getJeddahYesterdayISO()
          ).trim();


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStockView(
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
         FORCE STOCK REFRESH
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-refresh" &&
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
            getJeddahYesterdayISO()
          ).trim();


        return jsonResponse(
          await refreshStockData(
            env,
            branch,
            date
          )
        );
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
            getJeddahYesterdayISO()
          ).trim();


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStockRecordInit(
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
         GET STOCK DRAFT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/draft" &&
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


        const mode =
          String(
            url.searchParams.get(
              "mode"
            ) ||
            "DAILY"
          )
            .trim()
            .toUpperCase();


        return jsonResponse(
          await getStockDraft(
            env,
            branch,
            date,
            mode
          )
        );
      }


      /* ======================================================
         SAVE STOCK DRAFT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/draft" &&
        request.method ===
          "POST"
      ) {

        const result =
          await saveStockDraft(
            env,
            await request.json()
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 400
        );
      }


      /* ======================================================
         DELETE STOCK DRAFT
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/stock-record/draft" &&
        request.method ===
          "DELETE"
      ) {

        const body =
          await request.json();


        const branch =
          String(
            body.branchCode ||
            body.branch ||
            ""
          )
            .trim()
            .toUpperCase();


        const date =
          String(
            body.stockDate ||
            body.date ||
            ""
          ).trim();


        const mode =
          String(
            body.mode ||
            "DAILY"
          )
            .trim()
            .toUpperCase();


        return jsonResponse(
          await deleteStockDraft(
            env,
            branch,
            date,
            mode
          )
        );
      }


      /* ======================================================
         SUBMIT STOCK RECORD
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


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStockTransferInit(
            env,
            branch,
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


        const result =
          await getTransferHistory(
            env,
            branch,
            limit,
            offset
          );


        return jsonResponse(
          result,
          result.success
            ? 200
            : 400
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
            getJeddahYesterdayISO()
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
         STAFF VACATION
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
         FRONTEND ASSETS
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
