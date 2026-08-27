/* ============================================================
   DAM OPERATIONS
   BART STAFF BACKEND

   React
      ↓
   Cloudflare Worker
      ↓
   D1 Cache + Google Sheets

   MASTER DATA:
   Manual Google -> D1 sync

   TRANSFERS:
   Automatic short live cache (~15 sec)

   STOCK VIEW:
   Per-branch cache (~30 min)

============================================================ */


/* ============================================================
   CONFIG
============================================================ */

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

const TRANSFER_CACHE_SECONDS = 15;

const STOCK_CACHE_SECONDS =
  30 * 60;


/* ============================================================
   RESPONSE
============================================================ */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
      "Content-Type, X-Admin-Key",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
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
   D1 DATABASE
============================================================ */

async function ensureDatabase(env) {

  if (!env.DB) {
    throw new Error(
      "D1 binding DB is missing."
    );
  }


  /* BRANCH MASTER */

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
    CREATE INDEX IF NOT EXISTS
    idx_branches_brand
    ON branches(brand)
  `).run();


  /* TRANSFERS */

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


  /* STOCK VIEW CACHE */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stock_cache (
      branch_code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )
  `).run();


  /* GENERAL META */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();


  /*
    Prevent 40 branches from
    refreshing Google simultaneously.
  */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sync_locks (
      key TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )
  `).run();

/* ============================================================
   STOCK RECORD CACHE
============================================================ */

await env.DB.prepare(`
  CREATE TABLE IF NOT EXISTS stock_record_cache (
    branch_code TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    synced_at INTEGER NOT NULL
  )
`).run();


/* ============================================================
   STOCK RECORD DRAFTS

   Persistent across browser refresh / device session.
============================================================ */

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








   
}


/* ============================================================
   PASSWORD HASH
============================================================ */

async function hashPassword(
  password
) {

  const encoded =
    new TextEncoder().encode(
      String(password ?? "")
    );


  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );


  return Array.from(
    new Uint8Array(digest)
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


  /* CONNECTION 1 */

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


  /* CONNECTION 2 */

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


  if (!accounts.length) {

    throw new Error(
      "No Google service account configured."
    );
  }


  return accounts;
}


/* ============================================================
   GOOGLE JWT
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


  const unsignedToken =
    `${encodedHeader}.${encodedClaims}`;


  const key =
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

      key,

      new TextEncoder()
        .encode(
          unsignedToken
        )
    );


  const jwt =
    `${unsignedToken}.` +
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
   DUAL GOOGLE CONNECTION
============================================================ */

let googleCounter = 0;


function rotatedGoogleAccounts(
  env
) {

  const accounts =
    getGoogleAccounts(env);


  const start =
    googleCounter %
    accounts.length;


  googleCounter++;


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
  requestFactory
) {

  const accounts =
    rotatedGoogleAccounts(env);


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
        Try second account on
        quota/rate error.
      */

      if (
        response.status === 429 ||
        response.status === 403
      ) {

        lastError =
          new Error(
            `${account.id} rate limited`
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
      "Google Sheet read failed."
    );
  }


  return data.values || [];
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
      "Google write failed."
    );
  }


  return result;
}


/* ============================================================
   HEADER NORMALIZATION
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
   MASTER BRANCH DATA
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
      "BranchCode / BranchName missing."
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
        sheetIdIndex >= 0

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
   READ TRANSFERS GOOGLE
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


  const findIndex =
    (name) =>
      headers.indexOf(
        normalizeHeader(name)
      );


  const idIndex =
    findIndex("ID");


  const originIndex =
    findIndex("Origin");


  const destinationIndex =
    findIndex(
      "Destination"
    );


  const itemsIndex =
    findIndex("Items");


  const quantitiesIndex =
    findIndex(
      "Quantities"
    );


  const reasonIndex =
    findIndex("Reason");


  const statusIndex =
    findIndex("Status");


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
          row[idIndex] || ""
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
      })
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
      Date.now() / 1000
    );


  const expires =
    now + seconds;


  const result =
    await env.DB.prepare(`
      INSERT INTO sync_locks (
        key,
        expires_at
      )

      VALUES (?, ?)

      ON CONFLICT(key)
      DO UPDATE SET
        expires_at = excluded.expires_at

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
    .bind(key)
    .run();
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
      .bind(key)
      .first();


  return (
    result?.value ||
    null
  );
}


/* ============================================================
   SAVE TRANSFERS TO D1
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

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
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
   AUTOMATIC LIVE TRANSFERS

   Maximum desired age:
   ~15 seconds.

   40 branch opens do NOT mean
   40 Google reads.
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


  const age =
    Date.now() -
    previous;


  if (
    previous &&
    age <
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
    Try to become the ONE request
    allowed to refresh Google.
  */

  const acquired =
    await acquireLock(
      env,
      "transfer-live-sync",
      20
    );


  if (!acquired) {

    /*
      Another request is already
      refreshing Google.

      We serve D1 immediately.
    */

    return {
      refreshed:
        false,

      source:
        "D1-WAITING-FOR-SYNC",
    };
  }


  try {

    /*
      Re-check freshness after
      acquiring lock.
    */

    const again =
      Number(
        await getMeta(
          env,
          "transfers_last_sync_ms"
        ) || 0
      );


    if (
      again &&
      Date.now() -
        again <
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
   MANUAL BRANCH DATABASE REFRESH
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

        VALUES (
          ?, ?, ?, ?, ?, ?
        )
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
    Also get Transfers once.

    But transfers do NOT depend
    on this button afterward.
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

      ORDER BY code
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
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();


  const password =
    String(
      body.password || ""
    ).trim();


  const branch =
    await env.DB.prepare(`
      SELECT
        code,
        name,
        password_hash

      FROM branches

      WHERE
        code = ?
        AND brand = ?

      LIMIT 1
    `)
      .bind(
        branchCode,
        "bart"
      )
      .first();


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
   LIVE PENDING TRANSFERS
============================================================ */

async function getPendingTransfers(
  env,
  branchCode
) {

  /*
    THIS automatically checks whether
    transfer cache needs Google refresh.
  */

  const freshness =
    await ensureTransfersFresh(
      env
    );


  const branch =
    await env.DB.prepare(`
      SELECT
        code,
        name

      FROM branches

      WHERE code = ?

      LIMIT 1
    `)
      .bind(
        branchCode
      )
      .first();


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
   TRANSFER PARSER

   SAME BEHAVIOR AS STREAMLIT
============================================================ */

function parseTransferItems(
  transfer
) {

  const itemsText =
    String(
      transfer.items || ""
    )
      .replace(
        /â€¢/g,
        "•"
      );


  const quantitiesText =
    String(
      transfer.quantities || ""
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
          .split(
            "]",
            2
          )[1]
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
   COLUMN NUMBER -> A1
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
   YESTERDAY DATE
============================================================ */

function yesterdayDate() {

  const now =
    new Date();


  now.setUTCDate(
    now.getUTCDate() -
    1
  );


  return now
    .toISOString()
    .slice(
      0,
      10
    );
}


/* ============================================================
   STOCK REVERSAL
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


  if (!rows.length) {

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


  const itemColumn =
    rows.map(
      (row) =>
        String(
          row[0] || ""
        ).trim()
    );


  const updates = [];


  for (
    const entry of cart
  ) {

    const rowIndex =
      itemColumn.indexOf(
        entry.item
      );


    if (
      rowIndex === -1
    ) {

      continue;
    }


    const oldValue =
      rows[
        rowIndex
      ]?.[
        dateIndex
      ];


    const current =
      oldValue &&
      String(
        oldValue
      ).trim()

        ? Number(
            oldValue
          )

        : 0;


    const quantity =
      Number(
        entry.qty
      ) || 0;


    const newValue =
      mode === "subtract"

        ? current -
          quantity

        : current +
          quantity;


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


  if (!updates.length) {

    throw new Error(
      "Transfer items not found in Stocks sheet."
    );
  }


  await batchWriteSheet(

    env,

    spreadsheetId,

    updates
  );


  /*
    Stock changed:
    delete branch stock cache.
  */

  return true;
}


/* ============================================================
   FIND GOOGLE TRANSFER ROW
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


  if (
    idIndex === -1 ||
    statusIndex === -1
  ) {

    throw new Error(
      "Transfers ID / Status column missing."
    );
  }


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    if (
      String(
        rows[i][
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
      "Transfer not found in Google."
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


  const status =
    action ===
    "accept"

      ? "Accepted"

      : "Rejected";


  /*
    Preserve old Streamlit order:

    1. Change Transfer status
    2. If rejected perform reversal
  */

  await updateGoogleTransferStatus(

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
      String(
        transfer.origin
      )
        .split(
          " - "
        )[0]
        .trim();


    const destinationCode =
      String(
        transfer.destination
      )
        .split(
          " - "
        )[0]
        .trim();


    const origin =
      await env.DB.prepare(`
        SELECT sheet_id
        FROM branches
        WHERE code = ?
        LIMIT 1
      `)
        .bind(
          originCode
        )
        .first();


    const destination =
      await env.DB.prepare(`
        SELECT sheet_id
        FROM branches
        WHERE code = ?
        LIMIT 1
      `)
        .bind(
          destinationCode
        )
        .first();


    if (
      !origin?.sheet_id ||
      !destination?.sheet_id
    ) {

      throw new Error(
        "Origin or destination SheetID missing."
      );
    }


    /* ADD BACK ORIGIN */

    await modifyBranchStock(

      env,

      origin.sheet_id,

      cart,

      "add"
    );


    /* REMOVE DESTINATION */

    await modifyBranchStock(

      env,

      destination.sheet_id,

      cart,

      "subtract"
    );


    /*
      Clear stock caches because
      quantities changed.
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
   STOCK VIEW PARSER

   Ported from fetch_stock_data()
============================================================ */

function parseStockData(
  data
) {

  if (
    !data ||
    !data.length
  ) {

    return {
      headers: [],
      daily: [],
      weekly: [],
    };
  }


  const headers =
    data[0];


  const dateColumns =
    headers.slice(1);


  const daily = [];
  const weekly = [];


  let currentSection =
    null;


  for (
    const row of data
  ) {

    const rowText =
      row
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


    const rowValues =
      row.slice(1);


    const values = [
      ...rowValues,
    ];


    while (
      values.length <
      dateColumns.length
    ) {

      values.push("");
    }


    const cleaned = [];
    let total = 0;


    for (
      let i = 0;
      i <
      dateColumns.length;
      i++
    ) {

      const value =
        values[i] ?? "";


      /*
        SAME AS PYTHON:
        first 2 fields stay as-is.
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


      const safeNumber =
        Number.isFinite(
          number
        )

          ? number

          : 0;


      cleaned.push(
        safeNumber
      );


      total +=
        safeNumber;
    }


    const rowObject = {
      Item:
        item,
    };


    dateColumns.forEach(
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

    headers:
      [
        "Item",
        ...dateColumns,
        "Total",
      ],

    daily,

    weekly,
  };
}


/* ============================================================
   STOCK VIEW

   D1 cache:
   30 minutes per branch
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
    await env.DB.prepare(`
      SELECT
        code,
        name,
        sheet_id

      FROM branches

      WHERE code = ?

      LIMIT 1
    `)
      .bind(
        branchCode
      )
      .first();


  if (
    !branch ||
    !branch.sheet_id
  ) {

    throw new Error(
      "Branch SheetID not found."
    );
  }


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


  const now =
    Math.floor(
      Date.now() /
      1000
    );


  if (
    !forceRefresh &&
    cached &&
    now -
      Number(
        cached.synced_at
      ) <
      STOCK_CACHE_SECONDS
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


  /*
    Prevent duplicate Google reads
    for same branch.
  */

  const lockKey =
    `stock-${branchCode}`;


  const acquired =
    await acquireLock(
      env,
      lockKey,
      20
    );


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
      parseStockData(
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
        COUNT(*) total

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
        COUNT(*) total

      FROM transfers
    `)
      .first();


  const lastSync =
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

    lastSync,

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
   WORKER
============================================================ */

export default {








/* ============================================================
   STOCK RECORD
============================================================ */

const STOCK_RECORD_CACHE_SECONDS = 120;


/* ============================================================
   BAKERY SKUS

   EXACT LIST FROM OLD STREAMLIT
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
   FIND SECTION
============================================================ */

function findSectionIndex(
  values,
  sectionName
) {
  const target =
    String(sectionName)
      .trim()
      .toUpperCase();

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    if (
      String(values[i] || "")
        .trim()
        .toUpperCase() ===
      target
    ) {
      return i;
    }
  }

  return null;
}


/* ============================================================
   BUILD STOCK RECORD STRUCTURE

   Same Daily / Weekly / Bakery logic
   as Streamlit.
============================================================ */

function buildStockRecordData(
  sheetData
) {
  if (
    !Array.isArray(sheetData) ||
    !sheetData.length
  ) {
    throw new Error(
      "Stocks sheet returned empty data."
    );
  }

  const columnA =
    sheetData.map(
      (row) =>
        String(
          row?.[0] || ""
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


  function normalItems(
    mode
  ) {
    const items = [];

    const start =
      mode === "daily"
        ? dailyStart + 1
        : weeklyStart + 1;

    const end =
      mode === "daily"
        ? weeklyStart
        : sheetData.length;

    for (
      let index = start;
      index < end;
      index++
    ) {
      const row =
        sheetData[index] || [];

      const name =
        String(
          row[0] || ""
        ).trim();

      if (!name) {
        continue;
      }

      const upper =
        name.toUpperCase();

      if (
        upper === "DAILY ITEM" ||
        upper === "WEEKLY ITEM"
      ) {
        continue;
      }

      items.push({
        name,

        sku:
          String(
            row[1] || ""
          ).trim(),

        uom:
          String(
            row[2] || ""
          ).trim(),

        row:
          index + 1,
      });
    }

    return items;
  }


  /*
    Bakery scans entire sheet and
    checks Column B against fixed SKUs.
  */

  const bakery = [];

  for (
    let index = 1;
    index < sheetData.length;
    index++
  ) {
    const row =
      sheetData[index] || [];

    const name =
      String(
        row[0] || ""
      ).trim();

    const sku =
      String(
        row[1] || ""
      ).trim();

    if (
      name &&
      BAKERY_SKUS.has(sku)
    ) {
      bakery.push({
        name,
        sku,

        uom:
          String(
            row[2] || ""
          ).trim(),

        row:
          index + 1,
      });
    }
  }


  return {
    headers:
      sheetData[0] || [],

    daily:
      normalItems("daily"),

    weekly:
      normalItems("weekly"),

    bakery,

    dailyStart,
    weeklyStart,
  };
}


/* ============================================================
   DUPLICATE CHECK

   Bakery NEVER blocks duplicates.
============================================================ */

function stockAlreadySubmitted(
  sheetData,
  structure,
  mode,
  date
) {
  if (
    mode === "bakery"
  ) {
    return false;
  }

  const headers =
    sheetData[0] || [];

  const columnIndex =
    headers.indexOf(date);

  if (
    columnIndex === -1
  ) {
    return false;
  }

  const start =
    mode === "daily"
      ? structure.dailyStart + 1
      : structure.weeklyStart + 1;

  const end =
    mode === "daily"
      ? structure.weeklyStart
      : sheetData.length;

  for (
    let rowIndex = start;
    rowIndex < end;
    rowIndex++
  ) {
    const row =
      sheetData[rowIndex] || [];

    if (
      columnIndex <
        row.length &&
      String(
        row[columnIndex] || ""
      ).trim()
    ) {
      return true;
    }
  }

  return false;
}


/* ============================================================
   GET BRANCH SHEET ID
============================================================ */

async function getBartBranchForStock(
  env,
  branchCode
) {
  return env.DB.prepare(`
    SELECT
      code,
      name,
      sheet_id

    FROM branches

    WHERE
      code = ?
      AND brand = 'bart'

    LIMIT 1
  `)
    .bind(branchCode)
    .first();
}


/* ============================================================
   LOAD STOCK RECORD STRUCTURE

   D1 cache for 2 minutes.
============================================================ */

async function loadStockRecordStructure(
  env,
  branchCode,
  force = false
) {
  await ensureDatabase(env);

  const branch =
    await getBartBranchForStock(
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
      Date.now() / 1000
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
      .bind(branchCode)
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
      source: "D1",

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
      JSON.stringify(rows),
      now
    )
    .run();


  return {
    branch,
    source: "GOOGLE->D1",
    sheetData: rows,
  };
}


/* ============================================================
   STOCK RECORD INIT

   Returns:
   Daily items
   Weekly items
   Bakery items
   Duplicate flags
   Existing drafts
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


  const draftsResult =
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
    draftsResult.results || []
  ) {
    try {
      drafts[draft.mode] = {
        values:
          JSON.parse(
            draft.payload
          ),

        updatedAt:
          draft.updated_at,
      };
    } catch {
      // ignore broken draft
    }
  }


  return {
    success: true,

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
   DRAFT KEY
============================================================ */

function makeStockDraftKey(
  branchCode,
  date,
  mode
) {
  return `${branchCode}_${date}_${mode}`;
}


/* ============================================================
   SAVE DRAFT
============================================================ */

async function saveStockDraft(
  env,
  body
) {
  const branchCode =
    String(
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();

  const date =
    String(
      body.date || ""
    ).trim();

  const mode =
    String(
      body.mode || ""
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
    ].includes(mode)
  ) {
    throw new Error(
      "Invalid draft information."
    );
  }


  const key =
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
      key,
      branchCode,
      date,
      mode,
      JSON.stringify(values),
      now
    )
    .run();


  return {
    success: true,
    savedAt: now,
  };
}


/* ============================================================
   DELETE DRAFT
============================================================ */

async function deleteStockDraft(
  env,
  branchCode,
  date,
  mode
) {
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
    .bind(key)
    .run();


  return {
    success: true,
  };
}


/* ============================================================
   GOOGLE STOCK SUBMISSION

   IMPORTANT:
   This ALWAYS fetches LIVE Google sheet
   before final submission.

   D1 cache is NOT trusted for final write.
============================================================ */

async function submitStockRecord(
  env,
  body
) {
  await ensureDatabase(env);


  const branchCode =
    String(
      body.branchCode || ""
    )
      .trim()
      .toUpperCase();

  const date =
    String(
      body.date || ""
    ).trim();

  const mode =
    String(
      body.mode || ""
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
    ].includes(mode)
  ) {
    throw new Error(
      "Invalid submission information."
    );
  }


  const branch =
    await getBartBranchForStock(
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


  /*
    FINAL submission always checks
    live Google data.

    Prevents discrepancy even if cache
    was slightly old.
  */

  const liveSheet =
    await getSheetValues(
      env,
      branch.sheet_id,
      "Stocks!A:ZZ"
    );


  const structure =
    buildStockRecordData(
      liveSheet
    );


  /*
    Re-check duplicate at server side.
  */

  if (
    stockAlreadySubmitted(
      liveSheet,
      structure,
      mode,
      date
    )
  ) {
    return {
      success: false,

      duplicate: true,

      message:
        "Data for this date has already been submitted. No rewrite is possible.",
    };
  }


  const modeItems =
    structure[mode];


  if (
    !Array.isArray(modeItems) ||
    !modeItems.length
  ) {
    throw new Error(
      "No stock items available for this mode."
    );
  }


  /*
    Validate ALL expected items.

    Same principle as Streamlit:
    no missing or non-numeric quantities.
  */

  const missing = [];
  const invalid = [];


  for (
    const item of modeItems
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
      !/^\d+$/.test(value)
    ) {
      invalid.push(
        item.name
      );
    }
  }


  if (
    invalid.length
  ) {
    return {
      success: false,

      validation: true,

      type: "invalid",

      items: invalid,

      message:
        "Some quantities contain non-numeric values.",
    };
  }


  if (
    missing.length
  ) {
    return {
      success: false,

      validation: true,

      type: "missing",

      items: missing,

      message:
        "Some quantities are still empty.",
    };
  }


  /*
    Find existing date column,
    or create next column.
  */

  const headers =
    liveSheet[0] || [];


  let dateColumnIndex =
    headers.indexOf(date);


  let googleColumnNumber;


  const updates = [];


  if (
    dateColumnIndex === -1
  ) {
    dateColumnIndex =
      headers.length;

    googleColumnNumber =
      dateColumnIndex + 1;

    const dateColumnLetter =
      columnNumberToLetters(
        googleColumnNumber
      );

    updates.push({
      range:
        `Stocks!${dateColumnLetter}1`,

      values:
        [[date]],
    });
  } else {
    googleColumnNumber =
      dateColumnIndex + 1;
  }


  /*
    LIVE Column A mapping.

    Equivalent to write_sheet.col_values(1)
    from Streamlit.
  */

  const itemToRow =
    new Map();


  liveSheet.forEach(
    (row, index) => {
      const item =
        String(
          row?.[0] || ""
        ).trim();

      if (item) {
        itemToRow.set(
          item,
          index + 1
        );
      }
    }
  );


  const columnLetter =
    columnNumberToLetters(
      googleColumnNumber
    );


  for (
    const item of modeItems
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
  }


  if (
    updates.length === 0
  ) {
    throw new Error(
      "No stock cells available to update."
    );
  }


  /*
    ONE Google batch write.
  */

  await batchWriteSheet(
    env,
    branch.sheet_id,
    updates
  );


  const transactionId =
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();


  const submissionTime =
    new Date()
      .toISOString();


  /*
    Clear draft.
  */

  await deleteStockDraft(
    env,
    branchCode,
    date,
    mode
  );


  /*
    Stock has changed.

    Clear BOTH stock caches.
  */

  await env.DB.prepare(`
    DELETE FROM stock_cache
    WHERE branch_code = ?
  `)
    .bind(branchCode)
    .run();


  await env.DB.prepare(`
    DELETE FROM stock_record_cache
    WHERE branch_code = ?
  `)
    .bind(branchCode)
    .run();


  return {
    success: true,

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
      updates.length -
      (
        headers.indexOf(
          date
        ) === -1
          ? 1
          : 0
      ),
  };
}











   

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(
        request.url
      );


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

      /* ==============================================
         TEST
      ============================================== */

      if (
        url.pathname ===
        "/api/test"
      ) {

        return jsonResponse({

          success:
            true,

          version:
            "BART-LIVE-V5",

          message:
            "BART live-transfer + stock-view backend active",

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


      /* ==============================================
         DATABASE STATUS
      ============================================== */

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


      /* ==============================================
         MANUAL MASTER REFRESH
      ============================================== */

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


      /* ==============================================
         BRANCH LIST
      ============================================== */

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


      /* ==============================================
         LOGIN
      ============================================== */

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


      /* ==============================================
         LIVE PENDING TRANSFERS

         Auto Google refresh when cache stale.
      ============================================== */

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


      /* ==============================================
         ACCEPT / REJECT
      ============================================== */

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


      /* ==============================================
         STOCK VIEW

         Example:
         /api/staff/bart/stock-view?branch=B022

         Force refresh:
         ?branch=B022&refresh=1
      ============================================== */

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


        const force =
          url.searchParams.get(
            "refresh"
          ) ===
          "1";


        const result =
          await getStockView(
            env,
            branchCode,
            force
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


      /* ==============================================
         REACT FRONTEND
      ============================================== */

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
        "DAM BACKEND:",
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
