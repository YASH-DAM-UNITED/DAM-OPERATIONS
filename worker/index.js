/* ============================================================
   DAM OPERATIONS BACKEND
   Cloudflare Worker + D1 + Google Sheets

   NORMAL APP:
   React -> Worker -> D1

   MANUAL SYNC:
   Google Sheets -> Worker -> D1
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
   D1 DATABASE SETUP
============================================================ */
async function ensureDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding 'DB' is missing.");
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS branches (
      code TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      sheet_id TEXT,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_branches_brand
     ON branches(brand)`
  ).run();

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )`
  ).run();
}
/* ============================================================
   PASSWORD HASH
============================================================ */

async function hashPassword(password) {
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

  // GOOGLE ACCOUNT 1
  if (
    env.GOOGLE_CLIENT_EMAIL &&
    env.GOOGLE_PRIVATE_KEY
  ) {
    accounts.push({
      id: "google-1",
      email:
        env.GOOGLE_CLIENT_EMAIL,
      privateKey:
        env.GOOGLE_PRIVATE_KEY,
    });
  }

  // GOOGLE ACCOUNT 2
  if (
    env.GOOGLE_CLIENT_EMAIL_2 &&
    env.GOOGLE_PRIVATE_KEY_2
  ) {
    accounts.push({
      id: "google-2",
      email:
        env.GOOGLE_CLIENT_EMAIL_2,
      privateKey:
        env.GOOGLE_PRIVATE_KEY_2,
    });
  }

  if (accounts.length === 0) {
    throw new Error(
      "No Google service account configured."
    );
  }

  return accounts;
}


/* ============================================================
   BASE64 / PRIVATE KEY HELPERS
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
   GOOGLE ACCESS TOKEN CACHE
============================================================ */

const tokenCache = new Map();


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
    alg: "RS256",
    typ: "JWT",
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
      nowSeconds + 3600,
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

      new TextEncoder().encode(
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
        (result.expires_in || 3600) *
          1000,
    }
  );


  return result.access_token;
}


/* ============================================================
   DUAL GOOGLE ACCOUNT ROTATION
============================================================ */

let googleAccountCounter = 0;


function getRotatedAccounts(env) {
  const accounts =
    getGoogleAccounts(env);

  const startIndex =
    googleAccountCounter %
    accounts.length;

  googleAccountCounter++;

  return [
    ...accounts.slice(
      startIndex
    ),

    ...accounts.slice(
      0,
      startIndex
    ),
  ];
}


/* ============================================================
   GOOGLE REQUEST WITH FAILOVER
============================================================ */

async function googleRequest(
  env,
  requestFactory
) {
  const accounts =
    getRotatedAccounts(env);

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
        await requestFactory(
          token,
          account
        );


      /*
        If Google says quota/rate limit,
        try the next account.
      */

      if (
        response.status === 429 ||
        response.status === 403
      ) {
        const errorText =
          await response
            .clone()
            .text();

        console.warn(
          `${account.id} Google limit/error:`,
          errorText
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
        `${account.id} failed:`,
        error
      );

      lastError =
        error;
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
   GOOGLE SHEETS READ
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

      async (
        token,
        account
      ) => {

        console.log(
          "Google READ using:",
          account.id
        );

        return fetch(
          url,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
      }
    );


  const result =
    await response.json();


  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      "Google Sheets read failed."
    );
  }


  return (
    result.values || []
  );
}


/* ============================================================
   GOOGLE SHEETS BATCH WRITE
   FOR STOCK SUBMISSION LATER
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

      async (
        token,
        account
      ) => {

        console.log(
          "Google WRITE using:",
          account.id
        );


        return fetch(
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
   READ BART MASTER FROM GOOGLE

   EXPECTED COLUMNS:

   BranchCode
   BranchName
   SheetID
   Password
============================================================ */

async function readBartMasterFromGoogle(
  env
) {

  if (
    !env.MASTER_SHEET_ID
  ) {
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
    rows.length === 0
  ) {
    throw new Error(
      "Master sheet returned no data."
    );
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
    codeIndex === -1
  ) {
    throw new Error(
      "BranchCode column not found."
    );
  }


  if (
    nameIndex === -1
  ) {
    throw new Error(
      "BranchName column not found."
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


    /*
      Only BART branches.
    */

    if (
      !/^B\d+/i.test(code)
    ) {
      continue;
    }


    const name =
      String(
        row[nameIndex] || ""
      ).trim();


    const sheetId =
      sheetIdIndex >= 0
        ? String(
            row[
              sheetIdIndex
            ] || ""
          ).trim()
        : "";


    const password =
      passwordIndex >= 0
        ? String(
            row[
              passwordIndex
            ] || ""
          ).trim()
        : "";


    const passwordHash =
      await hashPassword(
        password
      );


    branches.push({
      code,
      brand: "bart",
      name,
      sheetId,
      passwordHash,
    });
  }


  return branches;
}


/* ============================================================
   ADMIN AUTHORIZATION
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


  const providedKey =
    request.headers.get(
      "X-Admin-Key"
    );


  return (
    providedKey ===
    env.ADMIN_SYNC_KEY
  );
}


/* ============================================================
   GOOGLE -> D1 SYNC

   GOOGLE IS CALLED HERE.
   NORMAL PAGE REFRESH DOES NOT CALL THIS.
============================================================ */

async function syncBart(
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


  const branches =
    await readBartMasterFromGoogle(
      env
    );


  if (
    branches.length === 0
  ) {
    throw new Error(
      "No BART branches found in Google Sheets."
    );
  }


  const now =
    new Date()
      .toISOString();


  const statements = [];


  /*
    Remove old BART cache.
  */

  statements.push(
    env.DB.prepare(`
      DELETE FROM branches
      WHERE brand = ?
    `)
      .bind(
        "bart"
      )
  );


  /*
    Insert fresh branches.
  */

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


  /*
    Save last sync time.
  */

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
    `)
      .bind(
        "bart_last_sync",
        now,
        now
      )
  );


  await env.DB.batch(
    statements
  );


  return jsonResponse({
    success: true,

    message:
      "BART Google data synced to D1 successfully.",

    count:
      branches.length,

    lastSync:
      now,
  });
}


/* ============================================================
   GET BART BRANCHES FROM D1

   GOOGLE CALLS = ZERO
============================================================ */

async function getBartBranchesFromD1(
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
    result.results || []
  );
}


/* ============================================================
   BART LOGIN FROM D1

   GOOGLE CALLS = ZERO
============================================================ */

async function loginBart(
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
        success: false,

        message:
          "Invalid request.",
      },

      400
    );
  }


  const branchCode =
    String(
      body.branchCode ||
      body.code ||
      ""
    )
      .trim()
      .toUpperCase();


  const password =
    String(
      body.password || ""
    ).trim();


  if (
    !branchCode ||
    !password
  ) {

    return jsonResponse(
      {
        success: false,

        message:
          "Branch and password are required.",
      },

      400
    );
  }


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
        success: false,

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
        success: false,

        message:
          "Incorrect password.",
      },

      401
    );
  }


  return jsonResponse({
    success: true,

    message:
      "Login successful.",

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },
  });
}


/* ============================================================
   DATABASE STATUS

   GOOGLE CALLS = ZERO
============================================================ */

async function databaseStatus(
  env
) {

  await ensureDatabase(
    env
  );


  const count =
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
    success: true,

    database:
      "D1",

    bartBranches:
      Number(
        count?.total || 0
      ),

    lastSync:
      sync?.value || null,

    googleCalled:
      false,
  });
}


/* ============================================================
   MAIN CLOUDFLARE WORKER

   IMPORTANT:
   ALL RETURN STATEMENTS ARE INSIDE fetch().
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
          status: 204,

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
          success: true,

          version:
            "D1-BACKEND-V3-SQL-FIX",

          message:
            "NEW D1 WORKER IS ACTIVE",

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
         D1 ONLY
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
         MANUAL GOOGLE -> D1 SYNC
      ====================================================== */

      if (
        url.pathname ===
          "/api/admin/sync-bart" &&

        request.method ===
          "POST"
      ) {

        return await syncBart(
          request,
          env
        );
      }


      /* ======================================================
         BART BRANCH LIST
         D1 ONLY
         GOOGLE CALLS = 0
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/branches" &&

        request.method ===
          "GET"
      ) {

        const branches =
          await getBartBranchesFromD1(
            env
          );


        return jsonResponse({
          success: true,

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
         D1 ONLY
         GOOGLE CALLS = 0
      ====================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/login" &&

        request.method ===
          "POST"
      ) {

        return await loginBart(
          request,
          env
        );
      }


      /* ======================================================
         FRONTEND / REACT
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
          success: false,

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
          success: false,

          message:
            error?.message ||
            "Internal server error.",
        },

        500
      );
    }
  },
};
