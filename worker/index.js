/* =========================================================
   DAM OPERATIONS BACKEND
   Cloudflare Worker + D1 + Google Sheets
========================================================= */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets " +
  "https://www.googleapis.com/auth/drive";

/* =========================================================
   RESPONSES
========================================================= */

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

/* =========================================================
   D1 DATABASE
========================================================= */

async function ensureDatabase(env) {
  if (!env.DB) {
    throw new Error(
      "D1 binding DB is missing."
    );
  }

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      code TEXT PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      sheet_id TEXT,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_branches_brand
    ON branches(brand);

    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

/* =========================================================
   PASSWORD HASHING
========================================================= */

async function hashPassword(password) {
  const bytes =
    new TextEncoder().encode(
      String(password || "")
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((b) =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

/* =========================================================
   GOOGLE ACCOUNTS
========================================================= */

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

/* =========================================================
   JWT HELPERS
========================================================= */

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

/* =========================================================
   GOOGLE TOKEN CACHE
========================================================= */

const tokenCache = new Map();

async function getGoogleAccessToken(
  account
) {
  const cached =
    tokenCache.get(
      account.id
    );

  const now =
    Date.now();

  if (
    cached &&
    cached.token &&
    cached.expiresAt >
      now + 60000
  ) {
    return cached.token;
  }

  const unixNow =
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
      unixNow,

    exp:
      unixNow + 3600,
  };

  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(header)
    );

  const encodedClaims =
    base64UrlEncodeString(
      JSON.stringify(claims)
    );

  const unsignedToken =
    `${encodedHeader}.${encodedClaims}`;

  const privateKey =
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

      privateKey,

      new TextEncoder().encode(
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
        (data.expires_in || 3600) *
          1000,
    }
  );

  return data.access_token;
}

/* =========================================================
   DUAL GOOGLE CONNECTION + FAILOVER
========================================================= */

let accountCounter = 0;

function rotateAccounts(env) {
  const accounts =
    getGoogleAccounts(env);

  const start =
    accountCounter %
    accounts.length;

  accountCounter++;

  return [
    ...accounts.slice(start),
    ...accounts.slice(0, start),
  ];
}

async function googleRequest(
  env,
  requestFactory
) {
  const accounts =
    rotateAccounts(env);

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

      if (
        response.status === 429 ||
        response.status === 403
      ) {
        console.warn(
          `${account.id} quota/rate issue`
        );

        lastError =
          new Error(
            `${account.id} rate limited`
          );

        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `Google account ${account.id} failed`,
        error
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "All Google accounts failed."
    )
  );
}

/* =========================================================
   GOOGLE SHEET READ
========================================================= */

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
          "Google read:",
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

/* =========================================================
   HEADER NORMALIZER
========================================================= */

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

/* =========================================================
   GOOGLE → BART BRANCH DATA
========================================================= */

async function readBartMasterFromGoogle(
  env
) {
  if (!env.MASTER_SHEET_ID) {
    throw new Error(
      "MASTER_SHEET_ID missing."
    );
  }

  const rows =
    await getSheetValues(
      env,
      env.MASTER_SHEET_ID,
      "Sheet1!A:D"
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
      "BranchCode or BranchName column missing."
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

    const name =
      String(
        row[nameIndex] || ""
      ).trim();

    const sheetId =
      sheetIdIndex >= 0
        ? String(
            row[sheetIdIndex] || ""
          ).trim()
        : "";

    const password =
      passwordIndex >= 0
        ? String(
            row[passwordIndex] || ""
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

/* =========================================================
   ADMIN KEY
========================================================= */

function adminAuthorized(
  request,
  env
) {
  if (!env.ADMIN_SYNC_KEY) {
    return false;
  }

  const supplied =
    request.headers.get(
      "X-Admin-Key"
    );

  return (
    supplied ===
    env.ADMIN_SYNC_KEY
  );
}

/* =========================================================
   SYNC GOOGLE → D1

   THIS IS THE ONLY NORMAL BRANCH-MASTER
   ENDPOINT THAT CALLS GOOGLE.
========================================================= */

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

  await ensureDatabase(env);

  const branches =
    await readBartMasterFromGoogle(
      env
    );

  if (!branches.length) {
    throw new Error(
      "No BART branches returned from Google."
    );
  }

  const now =
    new Date().toISOString();

  const statements = [];

  statements.push(
    env.DB.prepare(`
      DELETE FROM branches
      WHERE brand = ?
    `).bind("bart")
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
    success: true,

    message:
      "BART database refreshed.",

    count:
      branches.length,

    lastSync:
      now,
  });
}

/* =========================================================
   D1 BART BRANCH LIST

   GOOGLE CALLS = 0
========================================================= */

async function getBartBranchesFromD1(
  env
) {
  await ensureDatabase(env);

  const result =
    await env.DB.prepare(`
      SELECT
        code,
        name
      FROM branches
      WHERE brand = ?
      ORDER BY code ASC
    `)
      .bind("bart")
      .all();

  return result.results || [];
}

/* =========================================================
   D1 LOGIN

   GOOGLE CALLS = 0
========================================================= */

async function loginBart(
  request,
  env
) {
  await ensureDatabase(env);

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
      body.branchCode || ""
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
          "Branch and password required.",
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

    branch: {
      code:
        branch.code,

      name:
        branch.name,
    },
  });
}

/* =========================================================
   D1 DATABASE STATUS
========================================================= */

async function databaseStatus(env) {
  await ensureDatabase(env);

  const count =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS total
      FROM branches
      WHERE brand = ?
    `)
      .bind("bart")
      .first();

  const sync =
    await env.DB.prepare(`
      SELECT value
      FROM system_meta
      WHERE key = ?
    `)
      .bind(
        "bart_last_sync"
      )
      .first();

  return jsonResponse({
    success: true,

    bartBranches:
      Number(
        count?.total || 0
      ),

    lastSync:
      sync?.value || null,
  });
}

/* =========================================================
   MAIN WORKER
========================================================= */

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
      /* ===================================================
         TEST
      =================================================== */

      if (
        url.pathname ===
        "/api/test"
      ) {
        return jsonResponse({
          success: true,

          message:
            "DAM Operations backend is working",

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

      /* ===================================================
         DATABASE STATUS
      =================================================== */

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

      /* ===================================================
         GOOGLE → D1 MANUAL SYNC
      =================================================== */

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

      /* ===================================================
         BART BRANCHES

         D1 ONLY
      =================================================== */

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

          count:
            branches.length,

          branches,
        });
      }

      /* ===================================================
         BART LOGIN

         D1 ONLY
      =================================================== */

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

      /* ===================================================
         FRONTEND
      =================================================== */

      if (env.ASSETS) {
        return env.ASSETS.fetch(
          request
        );
      }

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
