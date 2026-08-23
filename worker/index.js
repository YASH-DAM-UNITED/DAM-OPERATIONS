const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

function base64UrlEncode(input) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
    .replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(clean);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));

  const unsignedToken = `${encodedHeader}.${encodedClaim}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("Google token error:", tokenData);

    throw new Error("Unable to authenticate with Google.");
  }

  return tokenData.access_token;
}

async function getSheetValues(env, range) {
  const accessToken = await getGoogleAccessToken(env);

  const encodedRange = encodeURIComponent(range);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/` +
    `${env.MASTER_SHEET_ID}/values/${encodedRange}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Sheets API error:", data);

    throw new Error("Unable to read Google Sheet.");
  }

  return data.values || [];
}

async function getBartBranches(env) {
  /*
    Change "Sheet1" below ONLY if your
    MASTERBRANCHSHEET tab has another name.

    We read A:D:

    A = BranchCode
    B = BranchName
    C = SheetID
    D = Password

    If your columns are different,
    we'll adjust next.
  */

  const rows = await getSheetValues(env, "Sheet1!A:D");

  if (!rows.length) {
    return [];
  }

  const headers = rows[0];

  const branchCodeIndex = headers.indexOf("BranchCode");
  const branchNameIndex = headers.indexOf("BranchName");
  const sheetIdIndex = headers.indexOf("SheetID");
  const passwordIndex = headers.indexOf("Password");

  if (branchCodeIndex === -1 || branchNameIndex === -1) {
    throw new Error(
      "MASTERBRANCHSHEET must contain BranchCode and BranchName columns."
    );
  }

  const branches = rows
    .slice(1)
    .filter((row) => {
      const code = String(row[branchCodeIndex] || "")
        .trim()
        .toUpperCase();

      return code.startsWith("B");
    })
    .map((row) => ({
      /*
        IMPORTANT:

        Password + SheetID are deliberately NOT returned
        to React.
      */

      code: String(row[branchCodeIndex] || "").trim(),
      name: String(row[branchNameIndex] || "").trim(),

      _sheetId:
        sheetIdIndex >= 0
          ? String(row[sheetIdIndex] || "").trim()
          : "",

      _password:
        passwordIndex >= 0
          ? String(row[passwordIndex] || "")
          : "",
    }));

  return branches;
}

async function publicBartBranches(env) {
  const branches = await getBartBranches(env);

  return branches.map((branch) => ({
    code: branch.code,
    name: branch.name,
  }));
}

async function authenticateBart(request, env) {
  const body = await request.json();

  const branchCode = String(body.branchCode || "")
    .trim()
    .toUpperCase();

  const password = String(body.password || "");

  if (!branchCode || !password) {
    return Response.json(
      {
        success: false,
        message: "Branch code and password are required.",
      },
      {
        status: 400,
      }
    );
  }

  const branches = await getBartBranches(env);

  const branch = branches.find(
    (item) => item.code.toUpperCase() === branchCode
  );

  if (!branch) {
    return Response.json(
      {
        success: false,
        message: "Branch not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (branch._password !== password) {
    return Response.json(
      {
        success: false,
        message: "Incorrect password.",
      },
      {
        status: 401,
      }
    );
  }

  /*
    SheetID remains SERVER SIDE.

    Later we will store it in the session/D1.
  */

  return Response.json({
    success: true,

    branch: {
      code: branch.code,
      name: branch.name,
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,

    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ================================================
       CORS PREFLIGHT
    ================================================= */

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      /* ================================================
         TEST
      ================================================= */

      if (url.pathname === "/api/test") {
        return jsonResponse({
          success: true,
          message: "DAM Operations backend is working",
        });
      }

      /* ================================================
         BART BRANCHES
      ================================================= */

      if (
        url.pathname === "/api/staff/bart/branches" &&
        request.method === "GET"
      ) {
        const branches = await publicBartBranches(env);

        return jsonResponse({
          success: true,
          count: branches.length,
          branches,
        });
      }

      /* ================================================
         BART LOGIN
      ================================================= */

      if (
        url.pathname === "/api/staff/bart/login" &&
        request.method === "POST"
      ) {
        const result = await authenticateBart(request, env);

        /*
          authenticateBart already creates Response
        */

        return new Response(result.body, {
          status: result.status,

          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(),
          },
        });
      }

      /* ================================================
         REACT WEBSITE
      ================================================= */

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("DAM API ERROR:", error);

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
