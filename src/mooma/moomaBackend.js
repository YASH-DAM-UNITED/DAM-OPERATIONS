/* ============================================================
   DAM OPERATIONS
   MOOMA BACKEND MODULE

   This file is imported by:
   worker/index.js

   Public routes:
   /api/mooma/test
   /api/mooma/branches
============================================================ */


/* ============================================================
   CONFIG
============================================================ */

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

const MOOMA_MASTER_TAB =
  "Sheet1";


/* ============================================================
   RESPONSE
============================================================ */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Headers":
      "Content-Type",

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
   HELPERS
============================================================ */

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}


function findHeaderIndex(
  headers,
  candidates
) {
  const normalized =
    headers.map(
      normalizeHeader
    );

  for (
    const candidate of candidates
  ) {
    const index =
      normalized.indexOf(
        normalizeHeader(
          candidate
        )
      );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
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
      "MOOMA Google private key missing."
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

let tokenCache = null;


async function getGoogleAccessToken(
  env
) {
  const email =
    String(
      env.MOOMA_GOOGLE_CLIENT_EMAIL ||
      ""
    ).trim();

  const privateKey =
    String(
      env.MOOMA_GOOGLE_PRIVATE_KEY ||
      ""
    );

  if (!email) {
    throw new Error(
      "MOOMA_GOOGLE_CLIENT_EMAIL is missing."
    );
  }

  if (!privateKey) {
    throw new Error(
      "MOOMA_GOOGLE_PRIVATE_KEY is missing."
    );
  }


  const now =
    Date.now();


  if (
    tokenCache?.token &&
    tokenCache.expiresAt >
      now + 60000
  ) {
    return tokenCache.token;
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
      email,

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
        privateKey
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
      "MOOMA Google authentication failed."
    );
  }


  tokenCache = {
    token:
      result.access_token,

    expiresAt:
      now +
      (
        result.expires_in ||
        3600
      ) *
      1000,
  };


  return result.access_token;
}


/* ============================================================
   GOOGLE SHEETS READ
============================================================ */

async function getSheetValues(
  env,
  spreadsheetId,
  range
) {
  const token =
    await getGoogleAccessToken(
      env
    );


  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${encodeURIComponent(
      spreadsheetId
    )}/values/` +
    `${encodeURIComponent(
      range
    )}`;


  const response =
    await fetch(
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


  const result =
    await response.json();


  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      "MOOMA Google Sheets read failed."
    );
  }


  return (
    result.values ||
    []
  );
}


/* ============================================================
   MASTER SHEET
============================================================ */

function getMasterSheetId(
  env
) {
  const id =
    String(
      env.MOOMA_MASTER_SHEET_ID ||
      ""
    ).trim();

  if (!id) {
    throw new Error(
      "MOOMA_MASTER_SHEET_ID is missing."
    );
  }

  return id;
}


/* ============================================================
   READ MOOMA BRANCHES
============================================================ */

async function readMoomaBranches(
  env
) {
  const rows =
    await getSheetValues(
      env,

      getMasterSheetId(
        env
      ),

      `${MOOMA_MASTER_TAB}!A:Z`
    );


  if (!rows.length) {
    return [];
  }


  const headers =
    rows[0] || [];


  const codeIndex =
    findHeaderIndex(
      headers,
      [
        "BranchCode",
        "Branch Code",
        "Code",
      ]
    );


  const nameIndex =
    findHeaderIndex(
      headers,
      [
        "BranchName",
        "Branch Name",
        "Name",
      ]
    );


  if (codeIndex === -1) {
    throw new Error(
      "BranchCode column not found in MOOMA master sheet."
    );
  }


  if (nameIndex === -1) {
    throw new Error(
      "BranchName column not found in MOOMA master sheet."
    );
  }


  const branches = [];


  for (
    let index = 1;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index] || [];


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
      ).trim();


    if (
      !code ||
      !name
    ) {
      continue;
    }


    /*
      MOOMA branch codes:
      M001
      M002
      M003
      ...
    */

    if (
      !code.startsWith(
        "M"
      )
    ) {
      continue;
    }


    branches.push({
      code,
      name,
    });
  }


  branches.sort(
    (a, b) =>
      a.code.localeCompare(
        b.code,
        undefined,
        {
          numeric: true,
        }
      )
  );


  return branches;
}


/* ============================================================
   MAIN MOOMA ROUTER

   worker/index.js hands all /api/mooma/*
   requests to this function.
============================================================ */

export async function handleMoomaRequest(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );


  /* ======================================================
     OPTIONS
  ====================================================== */

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

    /* ====================================================
       TEST
    ==================================================== */

    if (
      url.pathname ===
      "/api/mooma/test" &&
      request.method ===
      "GET"
    ) {
      return jsonResponse({
        success:
          true,

        version:
          "MOOMA-BACKEND-V1",

        message:
          "MOOMA backend connected",

        envCheck: {
          MOOMA_GOOGLE_CLIENT_EMAIL:
            Boolean(
              env.MOOMA_GOOGLE_CLIENT_EMAIL
            ),

          MOOMA_GOOGLE_PRIVATE_KEY:
            Boolean(
              env.MOOMA_GOOGLE_PRIVATE_KEY
            ),

          MOOMA_MASTER_SHEET_ID:
            Boolean(
              env.MOOMA_MASTER_SHEET_ID
            ),
        },
      });
    }


    /* ====================================================
       BRANCH DIRECTORY
    ==================================================== */

    if (
      url.pathname ===
        "/api/mooma/branches" &&

      request.method ===
        "GET"
    ) {
      const branches =
        await readMoomaBranches(
          env
        );


      return jsonResponse({
        success:
          true,

        source:
          "MOOMA-GOOGLE",

        count:
          branches.length,

        branches,
      });
    }


    /* ====================================================
       UNKNOWN MOOMA ROUTE
    ==================================================== */

    return jsonResponse(
      {
        success:
          false,

        message:
          "MOOMA route not found.",
      },
      404
    );

  } catch (error) {

    console.error(
      "MOOMA BACKEND ERROR:",
      error
    );


    return jsonResponse(
      {
        success:
          false,

        message:
          error?.message ||
          "MOOMA backend failed.",
      },
      500
    );
  }
}
