/* =========================================================
   DAM OPERATIONS - CLOUDFLARE WORKER BACKEND
========================================================= */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets " +
  "https://www.googleapis.com/auth/drive";


/* =========================================================
   CORS
========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,

    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}


/* =========================================================
   BASE64 URL ENCODING
========================================================= */

function base64UrlEncodeString(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


/* =========================================================
   GOOGLE PRIVATE KEY CONVERTER
========================================================= */

function pemToArrayBuffer(pem) {
  if (!pem) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is missing from Cloudflare."
    );
  }

  /*
    Supports BOTH:

    -----BEGIN PRIVATE KEY-----
    ABC...
    -----END PRIVATE KEY-----

    AND

    -----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n
  */

  const normalizedPem = String(pem)
    .replace(/\\n/g, "\n")
    .trim();

  if (
    !normalizedPem.includes(
      "-----BEGIN PRIVATE KEY-----"
    )
  ) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY does not contain BEGIN PRIVATE KEY."
    );
  }

  if (
    !normalizedPem.includes(
      "-----END PRIVATE KEY-----"
    )
  ) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY does not contain END PRIVATE KEY."
    );
  }

  const clean = normalizedPem
    .replace(
      "-----BEGIN PRIVATE KEY-----",
      ""
    )
    .replace(
      "-----END PRIVATE KEY-----",
      ""
    )
    .replace(/\s/g, "");

  if (!clean) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY contains no key data."
    );
  }

  let binary;

  try {
    binary = atob(clean);
  } catch (error) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY contains invalid Base64 data."
    );
  }

  const bytes = new Uint8Array(
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
   CHECK REQUIRED ENVIRONMENT VARIABLES
========================================================= */

function validateGoogleEnvironment(env) {
  if (!env.GOOGLE_CLIENT_EMAIL) {
    throw new Error(
      "GOOGLE_CLIENT_EMAIL is missing from Cloudflare."
    );
  }

  if (!env.GOOGLE_PRIVATE_KEY) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is missing from Cloudflare."
    );
  }

  if (!env.MASTER_SHEET_ID) {
    throw new Error(
      "MASTER_SHEET_ID is missing from Cloudflare."
    );
  }
}


/* =========================================================
   GET GOOGLE ACCESS TOKEN
========================================================= */

async function getGoogleAccessToken(env) {
  validateGoogleEnvironment(env);

  const now = Math.floor(
    Date.now() / 1000
  );

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,

    scope: GOOGLE_SCOPE,

    aud: GOOGLE_TOKEN_URL,

    iat: now,

    exp: now + 3600,
  };

  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(header)
    );

  const encodedClaim =
    base64UrlEncodeString(
      JSON.stringify(claim)
    );

  const unsignedToken =
    `${encodedHeader}.${encodedClaim}`;

  let privateKey;

  try {
    privateKey =
      await crypto.subtle.importKey(
        "pkcs8",

        pemToArrayBuffer(
          env.GOOGLE_PRIVATE_KEY
        ),

        {
          name:
            "RSASSA-PKCS1-v1_5",

          hash: "SHA-256",
        },

        false,

        ["sign"]
      );
  } catch (error) {
    console.error(
      "PRIVATE KEY IMPORT ERROR:",
      error
    );

    throw new Error(
      "Google private key could not be imported. Check GOOGLE_PRIVATE_KEY formatting."
    );
  }

  const signature =
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",

      privateKey,

      new TextEncoder().encode(
        unsignedToken
      )
    );

  const encodedSignature =
    arrayBufferToBase64Url(
      signature
    );

  const jwt =
    `${unsignedToken}.${encodedSignature}`;

  const tokenResponse =
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

            assertion: jwt,
          }),
      }
    );

  const tokenData =
    await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error(
      "GOOGLE TOKEN ERROR:",
      tokenData
    );

    throw new Error(
      `Google authentication failed: ${
        tokenData.error_description ||
        tokenData.error ||
        "Unknown Google authentication error"
      }`
    );
  }

  if (!tokenData.access_token) {
    throw new Error(
      "Google did not return an access token."
    );
  }

  return tokenData.access_token;
}


/* =========================================================
   READ GOOGLE SHEET
========================================================= */

async function getSheetValues(
  env,
  range
) {
  const accessToken =
    await getGoogleAccessToken(
      env
    );

  const encodedSheetId =
    encodeURIComponent(
      env.MASTER_SHEET_ID
    );

  const encodedRange =
    encodeURIComponent(range);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodedSheetId}/values/${encodedRange}`;

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    });

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "GOOGLE SHEETS ERROR:",
      data
    );

    throw new Error(
      `Google Sheets failed: ${
        data?.error?.message ||
        "Unable to read MASTER sheet."
      }`
    );
  }

  return data.values || [];
}


/* =========================================================
   NORMALIZE HEADER
========================================================= */

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}


/* =========================================================
   LOAD BART BRANCHES
========================================================= */

async function getBartBranches(env) {
  /*
    IMPORTANT:

    This assumes your MASTER spreadsheet
    tab is called:

    Sheet1

    And reads columns A:D.
  */

  const rows =
    await getSheetValues(
      env,
      "Sheet1!A:D"
    );

  if (!rows.length) {
    return [];
  }

  const rawHeaders =
    rows[0] || [];

  const headers =
    rawHeaders.map(
      normalizeHeader
    );

  const branchCodeIndex =
    headers.indexOf(
      "branchcode"
    );

  const branchNameIndex =
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
    branchCodeIndex === -1
  ) {
    throw new Error(
      "BranchCode column was not found in Sheet1."
    );
  }

  if (
    branchNameIndex === -1
  ) {
    throw new Error(
      "BranchName column was not found in Sheet1."
    );
  }

  const branches = rows
    .slice(1)

    .map((row) => {
      const code =
        String(
          row[
            branchCodeIndex
          ] || ""
        )
          .trim()
          .toUpperCase();

      const name =
        String(
          row[
            branchNameIndex
          ] || ""
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

      return {
        code,
        name,

        /*
          PRIVATE SERVER DATA

          These are NOT sent
          to React.
        */

        _sheetId: sheetId,
        _password: password,
      };
    })

    .filter(
      (branch) =>
        branch.code &&
        branch.code.startsWith(
          "B"
        )
    );

  return branches;
}


/* =========================================================
   PUBLIC BART BRANCH LIST
========================================================= */

async function getPublicBartBranches(
  env
) {
  const branches =
    await getBartBranches(
      env
    );

  return branches.map(
    (branch) => ({
      code: branch.code,
      name: branch.name,
    })
  );
}


/* =========================================================
   BART LOGIN
========================================================= */

async function authenticateBart(
  request,
  env
) {
  let body;

  try {
    body =
      await request.json();
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message:
          "Invalid request body.",
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
          "Branch code and password are required.",
      },
      400
    );
  }

  const branches =
    await getBartBranches(
      env
    );

  const branch =
    branches.find(
      (item) =>
        item.code ===
        branchCode
    );

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

  if (!branch._password) {
    return jsonResponse(
      {
        success: false,

        message:
          "No password is configured for this branch.",
      },
      500
    );
  }

  if (
    branch._password !==
    password
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

  /*
    IMPORTANT:

    We intentionally DO NOT
    send SheetID or Password
    back to the browser.
  */

  return jsonResponse({
    success: true,

    message:
      "Authentication successful.",

    branch: {
      code: branch.code,
      name: branch.name,
    },
  });
}


/* =========================================================
   MAIN CLOUDFLARE WORKER
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

    /* =====================================================
       CORS PREFLIGHT
    ===================================================== */

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
         API TEST + SECRET CHECK
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

            MASTER_SHEET_ID:
              Boolean(
                env.MASTER_SHEET_ID
              ),
          },
        });
      }

      /* ===================================================
         GOOGLE CONNECTION TEST
      =================================================== */

      if (
        url.pathname ===
          "/api/google/test" &&
        request.method ===
          "GET"
      ) {
        const token =
          await getGoogleAccessToken(
            env
          );

        return jsonResponse({
          success: true,

          message:
            "Google authentication is working.",

          /*
            Never return the
            actual token.
          */

          tokenReceived:
            Boolean(token),
        });
      }

      /* ===================================================
         GET BART BRANCHES
      =================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/branches" &&
        request.method ===
          "GET"
      ) {
        const branches =
          await getPublicBartBranches(
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
      =================================================== */

      if (
        url.pathname ===
          "/api/staff/bart/login" &&
        request.method ===
          "POST"
      ) {
        return await authenticateBart(
          request,
          env
        );
      }

      /* ===================================================
         REACT FRONTEND
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
        "DAM OPERATIONS API ERROR:",
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
