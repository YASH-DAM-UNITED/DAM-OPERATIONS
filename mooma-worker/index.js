const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function pemToArrayBuffer(pem) {
  const normalized = String(pem || "")
    .replace(/\\n/g, "\n")
    .trim();

  const clean = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  if (!clean) {
    throw new Error(
      "Google private key missing."
    );
  }

  const binary = atob(clean);

  const bytes =
    new Uint8Array(binary.length);

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

let tokenCache = null;

async function getGoogleAccessToken(env) {
  const now = Date.now();

  if (
    tokenCache?.token &&
    tokenCache.expiresAt >
      now + 60000
  ) {
    return tokenCache.token;
  }

  const timestamp =
    Math.floor(now / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claims = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: timestamp,
    exp: timestamp + 3600,
  };

  const encodedHeader =
    base64UrlEncodeString(
      JSON.stringify(header)
    );

  const encodedClaims =
    base64UrlEncodeString(
      JSON.stringify(claims)
    );

  const unsignedJWT =
    `${encodedHeader}.${encodedClaims}`;

  const importedKey =
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

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.error_description ||
      result.error ||
      "Google authentication failed."
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

async function getSheetValues(
  env,
  spreadsheetId,
  range
) {
  const token =
    await getGoogleAccessToken(env);

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
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },
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

  return data.values || [];
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}

async function readMoomaBranches(env) {
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
        row[codeIndex] || ""
      )
        .trim()
        .toUpperCase();

    /*
      MOOMA branches should use M codes:
      M001
      M002
      M003
      ...
    */
    if (
      !code.startsWith("M")
    ) {
      continue;
    }

    const name =
      String(
        row[nameIndex] || ""
      ).trim();

    if (!name) {
      continue;
    }

    branches.push({
      code,
      name,
    });
  }

  return branches;
}

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
      if (
        url.pathname ===
        "/"
      ) {
        return jsonResponse({
          success: true,
          version:
            "MOOMA-WORKER-V1",
          message:
            "MOOMA backend active",
        });
      }

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
          success: true,
          count:
            branches.length,
          branches,
        });
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
        "MOOMA Worker error:",
        error
      );

      return jsonResponse(
        {
          success: false,
          message:
            error?.message ||
            "MOOMA backend error.",
        },
        500
      );
    }
  },
};
