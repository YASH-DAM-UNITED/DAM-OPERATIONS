/* ============================================================
   DAM OPERATIONS BACKEND
   BART STAFF

   React
     ↓
   Cloudflare Worker
     ↓
   D1 = repeated/live reads
   Google Sheets = controlled source/writes
============================================================ */

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";


/* ============================================================
   RESPONSE HELPERS
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

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json",
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
      "D1 binding 'DB' is missing."
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
    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();


  /*
    Mirrors MASTERBRANCHSHEET -> Transfers
  */

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
}


/* ============================================================
   PASSWORD HASHING
============================================================ */

async function hashPassword(password) {
  const bytes =
    new TextEncoder().encode(
      String(password ?? "")
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


/* ============================================================
   GOOGLE SERVICE ACCOUNTS
============================================================ */

function getGoogleAccounts(env) {
  const accounts = [];

  if (
    env.GOOGLE_CLIENT_EMAIL &&
    env.GOOGLE_PRIVATE_KEY
  ) {
    accounts.push({
      id: "google-1",
      email: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
    });
  }

  if (
    env.GOOGLE_CLIENT_EMAIL_2 &&
    env.GOOGLE_PRIVATE_KEY_2
  ) {
    accounts.push({
      id: "google-2",
      email: env.GOOGLE_CLIENT_EMAIL_2,
      privateKey: env.GOOGLE_PRIVATE_KEY_2,
    });
  }

  if (!accounts.length) {
    throw new Error(
      "No Google service accounts configured."
    );
  }

  return accounts;
}


/* ============================================================
   GOOGLE JWT HELPERS
============================================================ */

function base64UrlEncodeString(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function arrayBufferToBase64Url(buffer) {
  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function pemToArrayBuffer(pem) {
  if (!pem) {
    throw new Error(
      "Google private key missing."
    );
  }

  const normalized =
    String(pem)
      .replace(/\\n/g, "\n")
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
      .replace(/\s/g, "");

  if (!clean) {
    throw new Error(
      "Google private key is empty."
    );
  }

  const binary = atob(clean);

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
    alg: "RS256",
    typ: "JWT",
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


  const headerEncoded =
    base64UrlEncodeString(
      JSON.stringify(header)
    );


  const claimsEncoded =
    base64UrlEncodeString(
      JSON.stringify(claims)
    );


  const unsignedJWT =
    `${headerEncoded}.${claimsEncoded}`;


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
        method: "POST",

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


  const data =
    await response.json();


  if (!response.ok) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Google authentication failed."
    );
  }


  tokenCache.set(
    account.id,
    {
      token:
        data.access_token,

      expiresAt:
        now +
        (
          data.expires_in ||
          3600
        ) *
          1000,
    }
  );


  return data.access_token;
}


/* ============================================================
   GOOGLE DUAL CONNECTION
============================================================ */

let googleCounter = 0;


function rotatedGoogleAccounts(
  env
) {
  const accounts =
    getGoogleAccounts(env);

  const index =
    googleCounter %
    accounts.length;

  googleCounter++;

  return [
    ...accounts.slice(index),
    ...accounts.slice(0, index),
  ];
}


async function googleRequest(
  env,
  makeRequest
) {
  const accounts =
    rotatedGoogleAccounts(env);

  let lastError = null;


  for (
    const account of accounts
  ) {
    try {

      const token =
        await getGoogleAccessToken(
          account
        );


      const response =
        await makeRequest(
          token,
          account
        );


      if (
        response.status === 429 ||
        response.status === 403
      ) {

        lastError =
          new Error(
            `${account.id} quota/rate limited`
          );

        continue;
      }


      return response;

    } catch (error) {

      lastError =
        error;

      console.error(
        account.id,
        error
      );
    }
  }


  throw (
    lastError ||
    new Error(
      "All Google connections failed."
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

      (token) =>
        fetch(
          url,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        )
    );


  const data =
    await response.json();


  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Google read failed."
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

      (token) =>
        fetch(
          url,
          {
            method: "POST",

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
        )
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
   HEADER NORMALIZER
============================================================ */

function normalizeHeader(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}


/* ============================================================
   READ MASTER BRANCHES
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
      "Branch columns missing."
    );
  }


  const branches = [];


  for (
    const row of
    rows.slice(1)
  ) {

    const code =
      String(
        row[codeIndex] || ""
      )
        .trim()
        .toUpperCase();


    if (
      !code.startsWith("B")
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
          row[nameIndex] || ""
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
   READ TRANSFERS MASTER
============================================================ */

async function readTransfersMaster(
  env
) {

  /*
    Your Python reads:
    MASTERBRANCHSHEET -> Transfers
  */

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


  function index(name) {
    return headers.indexOf(
      normalizeHeader(name)
    );
  }


  const idIndex =
    index("ID");

  const originIndex =
    index("Origin");

  const destinationIndex =
    index("Destination");

  const itemsIndex =
    index("Items");

  const qtyIndex =
    index("Quantities");

  const reasonIndex =
    index("Reason");

  const statusIndex =
    index("Status");


  if (
    idIndex === -1 ||
    originIndex === -1 ||
    destinationIndex === -1
  ) {
    throw new Error(
      "Transfers sheet required columns missing."
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
            row[idIndex] || ""
          ).trim(),

        origin:
          String(
            row[originIndex] || ""
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
          qtyIndex >= 0
            ? String(
                row[
                  qtyIndex
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
   ADMIN KEY
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
   REFRESH DATABASE
   GOOGLE -> D1
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
        success: false,
        message:
          "Invalid admin sync key.",
      },
      401
    );
  }


  await ensureDatabase(
    env
  );


  /*
    ONE controlled refresh:

    Branches + Transfers
  */

  const [
    branches,
    transfers,
  ] =
    await Promise.all([
      readBartMaster(env),
      readTransfersMaster(env),
    ]);


  const now =
    new Date()
      .toISOString();


  const statements = [];


  /* BRANCHES */

  statements.push(
    env.DB.prepare(`
      DELETE FROM branches
      WHERE brand = ?
    `).bind(
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
      `).bind(
        branch.code,
        branch.brand,
        branch.name,
        branch.sheetId,
        branch.passwordHash,
        now
      )
    );
  }


  /* TRANSFERS */

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

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
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


  statements.push(
    env.DB.prepare(`
      INSERT INTO system_meta (
        key,
        value,
        updated_at
      )

      VALUES (?, ?, ?)

      ON CONFLICT(key)
      DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(
      "bart_last_sync",
      now,
      now
    )
  );


  await env.DB.batch(
    statements
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
   BART BRANCH LIST
   D1 ONLY
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
   D1 ONLY
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


  const entered =
    await hashPassword(
      password
    );


  if (
    entered !==
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
   D1 ONLY
============================================================ */

async function getPendingTransfers(
  env,
  branchCode
) {

  await ensureDatabase(
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
    return [];
  }


  /*
    Old Streamlit compares full:
    B001 - BRANCH NAME
  */

  const fullBranch =
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
        fullBranch
      )
      .all();


  return (
    result.results ||
    []
  );
}


/* ============================================================
   TRANSFER ITEM PARSER

   PORTED FROM PYTHON
============================================================ */

function parseTransferItems(
  transfer
) {

  const itemsText =
    String(
      transfer.items || ""
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
              "• ",
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


  const size =
    Math.min(
      items.length,
      quantities.length
    );


  for (
    let i = 0;
    i < size;
    i++
  ) {

    let item =
      items[i];


    if (
      item.includes("]")
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
        .split(" (")[0]
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
        65 + remainder
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

   Same format as Python:
   YYYY-MM-DD
============================================================ */

function yesterdayDate() {

  const d =
    new Date();


  d.setUTCDate(
    d.getUTCDate() - 1
  );


  return d
    .toISOString()
    .slice(0, 10);
}


/* ============================================================
   MODIFY BRANCH STOCK

   add / subtract

   Preserves Python behavior.
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


  const itemNames =
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
      itemNames.indexOf(
        entry.item
      );


    if (
      rowIndex === -1
    ) {
      continue;
    }


    const currentRaw =
      rows[rowIndex]?.[
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
      parseInt(
        entry.qty,
        10
      );


    const newValue =
      mode === "subtract"
        ? current - qty
        : current + qty;


    const column =
      columnNumberToLetters(
        dateIndex + 1
      );


    const sheetRow =
      rowIndex + 1;


    updates.push({
      range:
        `Stocks!${column}${sheetRow}`,

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
}


/* ============================================================
   FIND TRANSFER ROW IN GOOGLE
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


  if (!rows.length) {
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
      "Transfers ID/Status columns missing."
    );
  }


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    if (
      String(
        rows[i][idIndex] ||
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
   UPDATE TRANSFER STATUS IN GOOGLE
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
      body.transferId || ""
    ).trim();


  const action =
    String(
      body.action || ""
    )
      .trim()
      .toLowerCase();


  if (
    !transferId ||
    ![
      "accept",
      "reject",
    ].includes(action)
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
    action === "accept"
      ? "Accepted"
      : "Rejected";


  /*
    ACCEPT:

    Old Python only changes status.
  */

  if (
    action === "accept"
  ) {

    await updateGoogleTransferStatus(
      env,
      transferId,
      "Accepted"
    );


    await env.DB.prepare(`
      UPDATE transfers

      SET
        status = ?,
        updated_at = ?

      WHERE id = ?
    `)
      .bind(
        "Accepted",
        new Date()
          .toISOString(),
        transferId
      )
      .run();


    return jsonResponse({
      success:
        true,

      status:
        "Accepted",
    });
  }


  /*
    REJECT:

    1. Parse cart
    2. Get origin/destination codes
    3. Find SheetIDs from D1
    4. Add stock back to origin
    5. Subtract from destination
    6. Mark Google transfer Rejected
    7. Mark D1 transfer Rejected
  */


  const cart =
    parseTransferItems(
      transfer
    );


  const originCode =
    String(
      transfer.origin
    )
      .split(" - ")[0]
      .trim();


  const destinationCode =
    String(
      transfer.destination
    )
      .split(" - ")[0]
      .trim();


  const origin =
    await env.DB.prepare(`
      SELECT
        sheet_id

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
      SELECT
        sheet_id

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
      "Origin or destination SheetID unavailable."
    );
  }


  /*
    SAME AS OLD PYTHON:

    add back origin
  */

  await modifyBranchStock(
    env,
    origin.sheet_id,
    cart,
    "add"
  );


  /*
    remove destination
  */

  await modifyBranchStock(
    env,
    destination.sheet_id,
    cart,
    "subtract"
  );


  /*
    Update master transfer
  */

  await updateGoogleTransferStatus(
    env,
    transferId,
    "Rejected"
  );


  /*
    Update D1
  */

  await env.DB.prepare(`
    UPDATE transfers

    SET
      status = ?,
      updated_at = ?

    WHERE id = ?
  `)
    .bind(
      "Rejected",
      new Date()
        .toISOString(),
      transferId
    )
    .run();


  return jsonResponse({
    success:
      true,

    status:
      "Rejected",

    message:
      "Stock returned to origin and removed from destination.",
  });
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


  const branches =
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


  const transfers =
    await env.DB.prepare(`
      SELECT
        COUNT(*) total

      FROM transfers
    `)
      .first();


  const sync =
    await env.DB.prepare(`
      SELECT
        value

      FROM system_meta

      WHERE key = ?
    `)
      .bind(
        "bart_last_sync"
      )
      .first();


  return jsonResponse({
    success:
      true,

    database:
      "D1",

    bartBranches:
      Number(
        branches?.total || 0
      ),

    transfers:
      Number(
        transfers?.total || 0
      ),

    lastSync:
      sync?.value || null,

    googleCalled:
      false,
  });
}


/* ============================================================
   MAIN WORKER
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


    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,

          headers:
            corsHeaders(),
        }
      );
    }


    try {

      /* TEST */

      if (
        url.pathname ===
        "/api/test"
      ) {

        return jsonResponse({
          success:
            true,

          version:
            "BART-STAFF-V4",

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


      /* DATABASE STATUS */

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


      /* REFRESH DATABASE */

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


      /* BART BRANCHES */

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


      /* BART LOGIN */

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


      /* PENDING TRANSFERS */

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


        const transfers =
          await getPendingTransfers(
            env,
            branchCode
          );


        return jsonResponse({
          success:
            true,

          source:
            "D1",

          googleCalled:
            false,

          count:
            transfers.length,

          transfers,
        });
      }


      /* ACCEPT / REJECT TRANSFER */

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


      /* FRONTEND */

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
