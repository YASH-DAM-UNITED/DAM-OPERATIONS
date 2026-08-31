
/* DAM OPERATIONS — MOOMA MODULAR BACKEND V3 */

const GT = "https://oauth2.googleapis.com/token";
const GS = "https://www.googleapis.com/auth/spreadsheets";
const MASTER = "Sheet1";
const STOCK = "Stocks";
const SCHEDULE = "StaffSchedule";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ROLES = [
  "Team-Member",
  "Acting_Team_Leader",
  "Team_Leader",
  "Acting_Supervisor",
  "Supervisor",
  "Branch_Manager",
];

const BAKERY = new Set([
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

let TC = null;

/* ============================================================
   RESPONSE / GENERAL HELPERS
   ============================================================ */

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
});

const J = (x, s = 200) =>
  new Response(JSON.stringify(x, null, 2), {
    status: s,
    headers: {
      "Content-Type": "application/json",
      ...cors(),
    },
  });

const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+|_|-/g, "");

const col = (n) => {
  let s = "";

  while (n) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }

  return s;
};

const idx = (h, n) => {
  const a = h.map(norm);

  for (const x of n) {
    const i = a.indexOf(norm(x));

    if (i >= 0) {
      return i;
    }
  }

  return -1;
};

/* ============================================================
   GOOGLE AUTHENTICATION
   ============================================================ */

const b64 = (s) =>
  btoa(s)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const buf64 = (b) => {
  let s = "";

  for (const x of new Uint8Array(b)) {
    s += String.fromCharCode(x);
  }

  return b64(s);
};

function pem(p) {
  const c = String(p || "")
    .replace(/\\n/g, "\n")
    .replace(
      /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
      ""
    );

  if (!c) {
    throw Error("MOOMA private key missing.");
  }

  const x = atob(c);
  const u = new Uint8Array(x.length);

  for (let i = 0; i < x.length; i++) {
    u[i] = x.charCodeAt(i);
  }

  return u.buffer;
}

async function token(env) {
  const now = Date.now();

  if (TC?.exp > now + 60000) {
    return TC.token;
  }

  const email = env.MOOMA_GOOGLE_CLIENT_EMAIL;
  const key = env.MOOMA_GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw Error("MOOMA Google credentials missing.");
  }

  const t = Math.floor(now / 1000);

  const a = b64(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  );

  const b = b64(
    JSON.stringify({
      iss: email,
      scope: GS,
      aud: GT,
      iat: t,
      exp: t + 3600,
    })
  );

  const u = `${a}.${b}`;

  const k = await crypto.subtle.importKey(
    "pkcs8",
    pem(key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    k,
    new TextEncoder().encode(u)
  );

  const r = await fetch(GT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${u}.${buf64(sig)}`,
    }),
  });

  const x = await r.json();

  if (!r.ok) {
    throw Error(
      x.error_description ||
        x.error ||
        "Google authentication failed."
    );
  }

  TC = {
    token: x.access_token,
    exp: now + (x.expires_in || 3600) * 1000,
  };

  return TC.token;
}

/* ============================================================
   GOOGLE SHEETS HELPERS
   ============================================================ */

async function read(env, id, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      id
    )}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${await token(env)}`,
      },
    }
  );

  const x = await r.json();

  if (!r.ok) {
    throw Error(x?.error?.message || "Google read failed.");
  }

  return x.values || [];
}

async function write(env, id, data) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      id
    )}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token(env)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data,
      }),
    }
  );

  const x = await r.json();

  if (!r.ok) {
    throw Error(x?.error?.message || "Google write failed.");
  }

  return x;
}

async function append(env, id, range, row) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      id
    )}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token(env)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  const x = await r.json();

  if (!r.ok) {
    throw Error(x?.error?.message || "Google append failed.");
  }

  return x;
}

const mid = (e) => {
  if (!e.MOOMA_MASTER_SHEET_ID) {
    throw Error("MOOMA_MASTER_SHEET_ID missing.");
  }

  return e.MOOMA_MASTER_SHEET_ID;
};

/* ============================================================
   D1 DRAFT DATABASE
   ============================================================ */

async function ensureDB(env) {
  if (!env.DB) {
    return;
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS mooma_drafts (
      draft_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

/* ============================================================
   BRANCHES
   ============================================================ */

async function branchRows(env) {
  const r = await read(env, mid(env), `${MASTER}!A:Z`);

  if (!r.length) {
    return [];
  }

  const h = r[0];

  const ci = idx(h, ["BranchCode", "Branch Code"]);
  const ni = idx(h, ["BranchName", "Branch Name"]);
  const si = idx(h, ["SheetID", "Sheet ID"]);
  const pi = idx(h, ["Password"]);

  if (ci < 0 || ni < 0) {
    throw Error("MOOMA master requires BranchCode and BranchName.");
  }

  return r
    .slice(1)
    .map((x) => ({
      code: String(x[ci] || "")
        .trim()
        .toUpperCase(),

      name: String(x[ni] || "").trim(),

      sheetId:
        si >= 0
          ? String(x[si] || "").trim()
          : "",

      password:
        pi >= 0
          ? String(x[pi] || "")
          : "",
    }))
    .filter((x) => x.code.startsWith("M") && x.name);
}

async function getBranch(e, c) {
  return (
    (await branchRows(e)).find(
      (x) => x.code === String(c).toUpperCase()
    ) || null
  );
}

/* ============================================================
   DATE
   ============================================================ */

function jedYesterday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value])
  );

  const d = new Date(
    `${p.year}-${p.month}-${p.day}T12:00:00Z`
  );

  d.setUTCDate(d.getUTCDate() - 1);

  return d.toISOString().slice(0, 10);
}

/* ============================================================
   STOCK STRUCTURE
   ============================================================ */

function structure(r) {
  const A = r.map((x) =>
    String(x?.[0] || "")
      .trim()
      .toUpperCase()
  );

  const d = A.indexOf("DAILY ITEM");
  const w = A.indexOf("WEEKLY ITEM");

  if (d < 0 || w < 0) {
    throw Error(
      "DAILY ITEM / WEEKLY ITEM sections missing."
    );
  }

  const sec = (a, b) =>
    r
      .slice(a, b)
      .map((x, i) => ({
        name: String(x[0] || "").trim(),
        sku: String(x[1] || "").trim(),
        uom: String(x[2] || "").trim(),
        row: a + i + 1,
      }))
      .filter((x) => x.name);

  const bakery = [];

  r.forEach((x, i) => {
    const sku = String(x?.[1] || "").trim();

    if (BAKERY.has(sku)) {
      bakery.push({
        name: String(x[0] || "").trim(),
        sku,
        uom: String(x[2] || "").trim(),
        row: i + 1,
      });
    }
  });

  return {
    daily: sec(d + 1, w),
    weekly: sec(w + 1, r.length),
    bakery,
    dailyStart: d,
    weeklyStart: w,
  };
}

function view(r) {
  const h = r[0] || [];
  const cols = h.slice(1);

  const daily = [];
  const weekly = [];

  let s = null;

  for (const row of r) {
    const t = (row || [])
      .join(" ")
      .toLowerCase();

    if (t.includes("daily item")) {
      s = "daily";
      continue;
    }

    if (t.includes("weekly item")) {
      s = "weekly";
      continue;
    }

    if (!s || !row?.[0]) {
      continue;
    }

    const o = {
      Item: String(row[0]).trim(),
    };

    let total = 0;

    cols.forEach((c, i) => {
      const v = row[i + 1] ?? "";

      if (i < 2) {
        o[c] = v;
      } else {
        const n =
          Number(
            String(v).replace(/,/g, "")
          ) || 0;

        o[c] = n;
        total += n;
      }
    });

    o.Total = total;

    (s === "daily" ? daily : weekly).push(o);
  }

  return {
    daily,
    weekly,
  };
}

/* ============================================================
   DRAFTS
   ============================================================ */

async function draftGet(env, k) {
  if (!env.DB) {
    return null;
  }

  const x = await env.DB
    .prepare(`
      SELECT payload, updated_at
      FROM mooma_drafts
      WHERE draft_key=?
    `)
    .bind(k)
    .first();

  return x
    ? {
        values: JSON.parse(x.payload),
        updatedAt: x.updated_at,
      }
    : null;
}

async function draftSet(env, k, v) {
  if (!env.DB) {
    return;
  }

  await ensureDB(env);

  await env.DB
    .prepare(`
      INSERT INTO mooma_drafts(
        draft_key,
        payload,
        updated_at
      )
      VALUES(?,?,?)
      ON CONFLICT(draft_key)
      DO UPDATE SET
        payload=excluded.payload,
        updated_at=excluded.updated_at
    `)
    .bind(
      k,
      JSON.stringify(v),
      Date.now()
    )
    .run();
}

async function draftDel(env, k) {
  if (env.DB) {
    await env.DB
      .prepare(`
        DELETE FROM mooma_drafts
        WHERE draft_key=?
      `)
      .bind(k)
      .run();
  }
}

/* ============================================================
   STOCK RECORD
   ============================================================ */

async function stockInit(env, c, date) {
  const b = await getBranch(env, c);

  if (!b?.sheetId) {
    throw Error("Branch SheetID missing.");
  }

  const r = await read(
    env,
    b.sheetId,
    `${STOCK}!A:ZZ`
  );

  const s = structure(r);
  const ci = (r[0] || []).indexOf(date);

  const dup = {
    daily: false,
    weekly: false,
    bakery: false,
  };

  if (ci >= 0) {
    for (
      let i = s.dailyStart + 1;
      i < s.weeklyStart;
      i++
    ) {
      if (String(r[i]?.[ci] || "").trim()) {
        dup.daily = true;
      }
    }

    for (
      let i = s.weeklyStart + 1;
      i < r.length;
      i++
    ) {
      if (String(r[i]?.[ci] || "").trim()) {
        dup.weekly = true;
      }
    }
  }

  return {
    success: true,

    branch: {
      code: b.code,
      name: b.name,
    },

    items: {
      daily: s.daily,
      weekly: s.weekly,
      bakery: s.bakery,
    },

    duplicate: dup,

    drafts: {
      daily: await draftGet(
        env,
        `${c}|${date}|daily`
      ),

      weekly: await draftGet(
        env,
        `${c}|${date}|weekly`
      ),

      bakery: await draftGet(
        env,
        `${c}|${date}|bakery`
      ),
    },
  };
}

async function stockSubmit(env, b) {
  const br = await getBranch(
    env,
    b.branchCode
  );

  if (!br?.sheetId) {
    throw Error("Branch SheetID missing.");
  }

  const r = await read(
    env,
    br.sheetId,
    `${STOCK}!A:ZZ`
  );

  const s = structure(r);
  const h = r[0] || [];

  let ci = h.indexOf(b.date);
  const u = [];

  if (ci < 0) {
    ci = h.length;

    u.push({
      range: `${STOCK}!${col(ci + 1)}1`,
      values: [[b.date]],
    });
  }

  for (const it of s[b.mode] || []) {
    if (
      Object.prototype.hasOwnProperty.call(
        b.values || {},
        it.row
      )
    ) {
      u.push({
        range: `${STOCK}!${col(ci + 1)}${it.row}`,
        values: [
          [
            Number(
              b.values[it.row]
            ) || 0,
          ],
        ],
      });
    }
  }

  if (u.length < 1) {
    return {
      success: false,
      message: "No values to submit.",
    };
  }

  await write(env, br.sheetId, u);

  await draftDel(
    env,
    `${b.branchCode}|${b.date}|${b.mode}`
  );

  return {
    success: true,
    message: `${String(
      b.mode
    ).toUpperCase()} stock submitted successfully.`,
  };
}

/* ============================================================
   TRANSFERS
   ============================================================ */

async function transferSheet(env) {
  try {
    return await read(
      env,
      mid(env),
      "Transfers!A:Z"
    );
  } catch {
    return [];
  }
}

async function transferHeaders(env) {
  let r = await transferSheet(env);

  if (r.length) {
    return r;
  }

  await write(env, mid(env), [
    {
      range: "Transfers!A1:H1",
      values: [
        [
          "ID",
          "Origin",
          "Destination",
          "Items",
          "Quantities",
          "Reason",
          "Status",
          "Timestamp",
        ],
      ],
    },
  ]);

  return [
    [
      "ID",
      "Origin",
      "Destination",
      "Items",
      "Quantities",
      "Reason",
      "Status",
      "Timestamp",
    ],
  ];
}

function parseCart(t) {
  const a = String(t.items || "")
    .replace(/â€¢/g, "•")
    .split("\n")
    .map((x) =>
      x
        .replace(/^•\s*/, "")
        .trim()
    )
    .filter(Boolean);

  const q = String(t.quantities || "")
    .split("\n")
    .map((x) => Number(x) || 0);

  return a.map((name, i) => ({
    name: name.replace(
      /\s*\[[^\]]*\]\s*$/,
      ""
    ),

    sku:
      (
        name.match(
          /\[([^\]]+)\]/
        ) || []
      )[1] || "",

    qty: q[i] || 0,
  }));
}

async function applyStock(
  env,
  br,
  cart,
  mode
) {
  const r = await read(
    env,
    br.sheetId,
    `${STOCK}!A:ZZ`
  );

  const s = structure(r);
  const date = jedYesterday();

  const ci = (r[0] || []).indexOf(date);

  if (ci < 0) {
    throw Error(
      `Stock date ${date} not found in ${br.code}.`
    );
  }

  const list = [
    ...s.daily,
    ...s.weekly,
  ];

  const u = [];

  for (const x of cart) {
    const it = list.find(
      (y) =>
        (x.sku && y.sku === x.sku) ||
        y.name === x.name
    );

    if (!it) {
      continue;
    }

    const cur =
      Number(
        String(
          r[it.row - 1]?.[ci] ?? 0
        ).replace(/,/g, "")
      ) || 0;

    const next =
      mode === "add"
        ? cur + Number(x.qty)
        : cur - Number(x.qty);

    u.push({
      range: `${STOCK}!${col(
        ci + 1
      )}${it.row}`,
      values: [[next]],
    });
  }

  if (!u.length) {
    throw Error(
      `No transfer items matched ${br.code} stock.`
    );
  }

  await write(env, br.sheetId, u);
}

async function createTransfer(env, b) {
  const o = await getBranch(
    env,
    b.originBranch
  );

  const d = await getBranch(
    env,
    b.destinationBranch
  );

  if (!o?.sheetId || !d?.sheetId) {
    throw Error(
      "Origin or destination SheetID missing."
    );
  }

  const cart = (b.items || []).filter(
    (x) => Number(x.qty) > 0
  );

  if (!cart.length) {
    return {
      success: false,
      message:
        "Add at least one transfer quantity.",
    };
  }

  let originDone = false;

  try {
    await applyStock(
      env,
      o,
      cart,
      "subtract"
    );

    originDone = true;

    await applyStock(
      env,
      d,
      cart,
      "add"
    );

    await transferHeaders(env);

    const id = `MTR-${Date.now()}`;

    await append(
      env,
      mid(env),
      "Transfers!A:H",
      [
        id,

        `${o.code} - ${o.name}`,

        `${d.code} - ${d.name}`,

        cart
          .map(
            (x) =>
              `• ${x.name} [${
                x.sku || ""
              }]`
          )
          .join("\n"),

        cart
          .map((x) => x.qty)
          .join("\n"),

        b.reason || "",

        "Pending",

        new Date().toISOString(),
      ]
    );

    return {
      success: true,
      id,
      message:
        "MOOMA transfer created successfully.",
    };
  } catch (e) {
    if (originDone) {
      try {
        await applyStock(
          env,
          o,
          cart,
          "add"
        );
      } catch {}
    }

    throw e;
  }
}

function transferObjects(r) {
  if (r.length < 2) {
    return [];
  }

  const h = r[0];
  const I = (n) => idx(h, [n]);

  return r
    .slice(1)
    .map((x, i) => ({
      rowNumber: i + 2,

      id: String(
        x[I("ID")] || ""
      ),

      origin: String(
        x[I("Origin")] || ""
      ),

      destination: String(
        x[I("Destination")] || ""
      ),

      items: String(
        x[I("Items")] || ""
      ),

      quantities: String(
        x[I("Quantities")] || ""
      ),

      reason: String(
        x[I("Reason")] || ""
      ),

      status: String(
        x[I("Status")] || "Pending"
      ),

      updated_at: String(
        x[I("Timestamp")] || ""
      ),
    }))
    .filter((x) => x.id);
}

async function respond(env, b) {
  const r = await transferSheet(env);
  const a = transferObjects(r);

  const t = a.find(
    (x) => x.id === b.transferId
  );

  if (!t) {
    throw Error("Transfer not found.");
  }

  if (t.status !== "Pending") {
    return {
      success: false,
      message:
        "Transfer already processed.",
    };
  }

  const h = r[0];
  const si = idx(h, ["Status"]);

  const status =
    b.action === "accept"
      ? "Accepted"
      : "Rejected";

  if (status === "Rejected") {
    const oc =
      t.origin.split(" - ")[0];

    const dc =
      t.destination.split(" - ")[0];

    const o = await getBranch(env, oc);
    const d = await getBranch(env, dc);

    const cart = parseCart(t);

    await applyStock(
      env,
      o,
      cart,
      "add"
    );

    await applyStock(
      env,
      d,
      cart,
      "subtract"
    );
  }

  await write(env, mid(env), [
    {
      range: `Transfers!${col(
        si + 1
      )}${t.rowNumber}`,
      values: [[status]],
    },
  ]);

  return {
    success: true,
    status,

    message:
      status === "Accepted"
        ? "Transfer accepted successfully."
        : "Transfer rejected and stock reversal completed.",
  };
}

/* ============================================================
   SCHEDULE DATE HELPERS
   ============================================================ */

function parseDate(s) {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      s
    );

  if (!m) {
    throw Error("Invalid date.");
  }

  return new Date(
    +m[1],
    +m[2] - 1,
    +m[3]
  );
}

const iso = (d) =>
  `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function week(s) {
  const d = parseDate(s);
  const w = new Date(d);

  w.setDate(
    d.getDate() - d.getDay()
  );

  const labels = {};

  DAYS.forEach((x, i) => {
    const z = new Date(w);

    z.setDate(
      w.getDate() + i
    );

    labels[x] =
      `${x} (` +
      z.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
        }
      ) +
      ")";
  });

  const diff = Math.floor(
    (w - new Date(2026, 5, 1)) /
      (7 * 86400000)
  );

  return {
    weekStartISO: iso(w),

    weekStartDisplay:
      w.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      ),

    dayLabels: labels,

    otHeader:
      diff === 0
        ? "Over-Time"
        : `Over-Time ${diff}`,
  };
}

/* ============================================================
   STAFF SCHEDULE
   ============================================================ */

const eid = (h) =>
  idx(h, [
    "Employee ID",
    "EmployeeID",
    "Staff ID",
    "Emp ID",
    "ID",
  ]);

function parseSched(r, c, date) {
  if (!r.length) {
    throw Error(
      "StaffSchedule is empty."
    );
  }

  const h = r[0];

  const bi = idx(h, ["Branch"]);
  const ni = idx(h, ["Name"]);
  const ri = idx(h, ["Role"]);
  const ei = eid(h);

  const w = week(date);

  const di = Object.fromEntries(
    DAYS.map((d) => [
      d,
      h.indexOf(w.dayLabels[d]),
    ])
  );

  const oi = h.indexOf(
    w.otHeader
  );

  if (
    bi < 0 ||
    ni < 0 ||
    ri < 0
  ) {
    throw Error(
      "StaffSchedule requires Branch, Name and Role."
    );
  }

  let submitted = false;
  const employees = [];

  for (
    let i = 1;
    i < r.length;
    i++
  ) {
    const row = r[i] || [];

    const rb = String(
      row[bi] || ""
    )
      .trim()
      .toUpperCase();

    if (
      !(
        rb === c ||
        rb.startsWith(`${c} `) ||
        rb.startsWith(`${c}-`)
      )
    ) {
      continue;
    }

    const name = String(
      row[ni] || ""
    ).trim();

    if (!name) {
      continue;
    }

    const shifts = {};

    DAYS.forEach((d) => {
      shifts[d] =
        di[d] >= 0
          ? String(
              row[di[d]] || ""
            )
          : "";

      if (shifts[d].trim()) {
        submitted = true;
      }
    });

    employees.push({
      rowNumber: i + 1,

      employeeId:
        ei >= 0
          ? String(
              row[ei] || ""
            ).trim()
          : "",

      name,

      role: String(
        row[ri] || ""
      ).trim(),

      shifts,

      overtime:
        oi >= 0
          ? String(
              row[oi] || ""
            ).trim()
          : "0 hrs",
    });
  }

  return {
    week: w,
    headers: h,
    employees,
    submitted,
  };
}

async function schedRows(e) {
  return read(
    e,
    mid(e),
    `${SCHEDULE}!A:ZZ`
  );
}

async function ensureSchedHeaders(
  e,
  r,
  w
) {
  const h = [...(r[0] || [])];
  const u = [];

  for (const d of DAYS) {
    if (
      !h.includes(
        w.dayLabels[d]
      )
    ) {
      u.push({
        range: `${SCHEDULE}!${col(
          h.length + 1
        )}1`,

        values: [
          [w.dayLabels[d]],
        ],
      });

      h.push(w.dayLabels[d]);
    }
  }

  if (
    !h.includes(w.otHeader)
  ) {
    u.push({
      range: `${SCHEDULE}!${col(
        h.length + 1
      )}1`,

      values: [[w.otHeader]],
    });

    h.push(w.otHeader);
  }

  if (u.length) {
    await write(
      e,
      mid(e),
      u
    );
  }

  return h;
}

function ot(sh) {
  let t = 0;

  DAYS.forEach((d) => {
    const m =
      /\(OT\s+(\d+(?:\.\d+)?)\s*h\)/i.exec(
        String(sh?.[d] || "")
      );

    if (m) {
      t += Number(m[1]) || 0;
    }
  });

  return t;
}

async function schedSubmit(e, b) {
  const r = await schedRows(e);

  const p = parseSched(
    r,
    b.branchCode,
    b.selectedDate
  );

  if (p.submitted) {
    return {
      success: false,
      message:
        "This week's schedule has already been submitted for this branch.",
    };
  }

  const w = week(
    b.selectedDate
  );

  const h =
    await ensureSchedHeaders(
      e,
      r,
      w
    );

  const bi = idx(h, ["Branch"]);
  const ni = idx(h, ["Name"]);
  const ri = idx(h, ["Role"]);
  const ei = eid(h);

  const u = [];

  for (
    const emp of
    b.employees || []
  ) {
    let rn = null;

    for (
      let i = 1;
      i < r.length;
      i++
    ) {
      const row = r[i] || [];

      if (
        String(
          row[bi] || ""
        )
          .trim()
          .toUpperCase() !==
        b.branchCode
      ) {
        continue;
      }

      if (
        (
          ei >= 0 &&
          emp.employeeId &&
          String(
            row[ei] || ""
          ).trim() ===
            String(
              emp.employeeId
            )
        ) ||
        String(
          row[ni] || ""
        ).trim() ===
          String(
            emp.name || ""
          ).trim()
      ) {
        rn = i + 1;
        break;
      }
    }

    if (!rn) {
      rn = r.length + 1;

      r.push([]);

      u.push(
        {
          range: `${SCHEDULE}!${col(
            bi + 1
          )}${rn}`,
          values: [
            [b.branchCode],
          ],
        },
        {
          range: `${SCHEDULE}!${col(
            ni + 1
          )}${rn}`,
          values: [
            [emp.name],
          ],
        }
      );
    }

    u.push({
      range: `${SCHEDULE}!${col(
        ri + 1
      )}${rn}`,

      values: [
        [
          emp.role ||
            "Team-Member",
        ],
      ],
    });

    if (
      ei >= 0 &&
      emp.employeeId
    ) {
      u.push({
        range: `${SCHEDULE}!${col(
          ei + 1
        )}${rn}`,

        values: [
          [emp.employeeId],
        ],
      });
    }

    for (const d of DAYS) {
      const ci =
        h.indexOf(
          w.dayLabels[d]
        );

      u.push({
        range: `${SCHEDULE}!${col(
          ci + 1
        )}${rn}`,

        values: [
          [
            emp.shifts?.[d] ||
              "",
          ],
        ],
      });
    }

    u.push({
      range: `${SCHEDULE}!${col(
        h.indexOf(
          w.otHeader
        ) + 1
      )}${rn}`,

      values: [
        [
          `${ot(
            emp.shifts
          )} hrs`,
        ],
      ],
    });
  }

  await write(
    e,
    mid(e),
    u
  );

  return {
    success: true,
    message:
      "Schedule submitted successfully.",
    weekStartDisplay:
      w.weekStartDisplay,
  };
}

/* ============================================================
   EMPLOYEE MANAGEMENT
   ============================================================ */

async function addEmployee(e, b) {
  let r = await schedRows(e);
  let h = r[0] || [];

  const bi = idx(h, ["Branch"]);
  const ni = idx(h, ["Name"]);
  const ri = idx(h, ["Role"]);

  let ei = eid(h);

  if (ei < 0) {
    ei = h.length;

    await write(
      e,
      mid(e),
      [
        {
          range: `${SCHEDULE}!${col(
            ei + 1
          )}1`,
          values: [
            ["Employee ID"],
          ],
        },
      ]
    );

    h.push("Employee ID");
  }

  const row =
    Array(h.length).fill("");

  row[bi] = b.branchCode;
  row[ni] = b.name;
  row[ri] =
    b.role || "Team-Member";
  row[ei] =
    b.employeeId || "";

  await append(
    e,
    mid(e),
    `${SCHEDULE}!A:ZZ`,
    row
  );

  return {
    success: true,
    message: `${b.name} added successfully.`,
  };
}

async function findEmployee(e, b) {
  const r = await schedRows(e);
  const h = r[0] || [];

  const bi = idx(h, ["Branch"]);
  const ni = idx(h, ["Name"]);
  const ei = eid(h);

  for (
    let i = 1;
    i < r.length;
    i++
  ) {
    const row = r[i] || [];

    if (
      String(
        row[bi] || ""
      )
        .trim()
        .toUpperCase() !==
      b.branchCode
    ) {
      continue;
    }

    if (
      (
        ei >= 0 &&
        b.employeeId &&
        String(
          row[ei] || ""
        ).trim() ===
          String(
            b.employeeId
          )
      ) ||
      String(
        row[ni] || ""
      ).trim() ===
        String(
          b.name || ""
        ).trim()
    ) {
      return {
        r,
        h,
        row,
        rowNumber: i + 1,
        bi,
        ni,
        ei,
      };
    }
  }

  throw Error(
    "Employee not found."
  );
}

async function employeeRemove(
  e,
  b
) {
  const m =
    await findEmployee(e, b);

  if (
    b.reason === "transfer"
  ) {
    if (!b.destinationBranch) {
      throw Error(
        "Destination branch required."
      );
    }

    await write(
      e,
      mid(e),
      [
        {
          range: `${SCHEDULE}!${col(
            m.bi + 1
          )}${m.rowNumber}`,

          values: [
            [
              b.destinationBranch,
            ],
          ],
        },
      ]
    );

    return {
      success: true,
      message: `${b.name} transferred to ${b.destinationBranch}.`,
    };
  }

  const u = [
    {
      range: `${SCHEDULE}!${col(
        m.bi + 1
      )}${m.rowNumber}`,

      values: [[""]],
    },
  ];

  if (
    b.reason ===
      "contract_finished" &&
    m.ei >= 0
  ) {
    u.push({
      range: `${SCHEDULE}!${col(
        m.ei + 1
      )}${m.rowNumber}`,

      values: [[""]],
    });
  }

  await write(
    e,
    mid(e),
    u
  );

  return {
    success: true,
    message: `${b.name} removed from active branch.`,
  };
}

async function vacation(e, b) {
  const m =
    await findEmployee(e, b);

  const w = week(
    b.selectedDate
  );

  const h =
    await ensureSchedHeaders(
      e,
      m.r,
      w
    );

  const u = [];

  for (const d of DAYS) {
    const ci =
      h.indexOf(
        w.dayLabels[d]
      );

    u.push({
      range: `${SCHEDULE}!${col(
        ci + 1
      )}${m.rowNumber}`,

      values: [["VACATION"]],
    });
  }

  u.push({
    range: `${SCHEDULE}!${col(
      h.indexOf(
        w.otHeader
      ) + 1
    )}${m.rowNumber}`,

    values: [["0 hrs"]],
  });

  await write(
    e,
    mid(e),
    u
  );

  return {
    success: true,
    message: `${b.name} marked VACATION for the full week.`,
  };
}

/* ============================================================
   MOOMA API ROUTER
   ============================================================ */

export async function handleMoomaRequest(
  request,
  env
) {
  const u = new URL(request.url);

  if (
    request.method === "OPTIONS"
  ) {
    return new Response(null, {
      status: 204,
      headers: cors(),
    });
  }

  try {
    await ensureDB(env);

    const p = u.pathname;

    /* ---------------- TEST ---------------- */

    if (
      p === "/api/mooma/test"
    ) {
      return J({
        success: true,
        version:
          "MOOMA-BACKEND-V3",
        message:
          "MOOMA backend connected",

        envCheck: {
          MOOMA_GOOGLE_CLIENT_EMAIL:
            !!env.MOOMA_GOOGLE_CLIENT_EMAIL,

          MOOMA_GOOGLE_PRIVATE_KEY:
            !!env.MOOMA_GOOGLE_PRIVATE_KEY,

          MOOMA_MASTER_SHEET_ID:
            !!env.MOOMA_MASTER_SHEET_ID,
        },
      });
    }

    /* ---------------- BRANCHES ---------------- */

    if (
      p ===
      "/api/mooma/branches"
    ) {
      const a =
        await branchRows(env);

      return J({
        success: true,
        source: "MOOMA-GOOGLE",
        count: a.length,

        branches: a.map(
          ({
            password,
            ...x
          }) => x
        ),
      });
    }

    /* ---------------- LOGIN ---------------- */

    if (
      p ===
        "/api/mooma/login" &&
      request.method === "POST"
    ) {
      const b =
        await request.json();

      const br =
        await getBranch(
          env,
          b.branchCode
        );

      if (!br) {
        return J(
          {
            success: false,
            message:
              "Branch not found.",
          },
          404
        );
      }

      if (
        String(
          b.password || ""
        ) !==
        String(
          br.password || ""
        )
      ) {
        return J(
          {
            success: false,
            message:
              "Incorrect password.",
          },
          401
        );
      }

      return J({
        success: true,

        branch: {
          code: br.code,
          name: br.name,
        },
      });
    }

    /* ---------------- DATABASE STATUS ---------------- */

    if (
      p ===
      "/api/mooma/database-status"
    ) {
      return J({
        success: true,
        source: "MOOMA-GOOGLE",

        branches:
          (
            await branchRows(
              env
            )
          ).length,

        transfers:
          transferObjects(
            await transferSheet(
              env
            )
          ).length,

        drafts: 0,

        lastSync:
          new Date().toISOString(),
      });
    }

    /* ---------------- SYNC ---------------- */

    if (
      p === "/api/mooma/sync" &&
      request.method === "POST"
    ) {
      return J({
        success: true,

        message:
          "MOOMA data reads live from Google Sheets.",

        branches:
          (
            await branchRows(
              env
            )
          ).length,

        transfers:
          transferObjects(
            await transferSheet(
              env
            )
          ).length,
      });
    }

    /* ---------------- STOCK VIEW ---------------- */

    if (
      p ===
      "/api/mooma/stock-view"
    ) {
      const br =
        await getBranch(
          env,
          String(
            u.searchParams.get(
              "branch"
            ) || ""
          ).toUpperCase()
        );

      if (!br?.sheetId) {
        throw Error(
          "Branch SheetID missing."
        );
      }

      return J({
        success: true,
        source: "MOOMA-GOOGLE",

        syncedAt:
          Math.floor(
            Date.now() / 1000
          ),

        stock: view(
          await read(
            env,
            br.sheetId,
            `${STOCK}!A:ZZ`
          )
        ),
      });
    }

    /* ---------------- STOCK RECORD INIT ---------------- */

    if (
      p ===
      "/api/mooma/stock-record/init"
    ) {
      return J(
        await stockInit(
          env,

          String(
            u.searchParams.get(
              "branch"
            ) || ""
          ).toUpperCase(),

          String(
            u.searchParams.get(
              "date"
            ) || ""
          )
        )
      );
    }

    /* ---------------- STOCK DRAFT SAVE ---------------- */

    if (
      p ===
        "/api/mooma/stock-record/draft" &&
      request.method === "POST"
    ) {
      const b =
        await request.json();

      await draftSet(
        env,

        `${b.branchCode}|${b.date}|${b.mode}`,

        b.values || {}
      );

      return J({
        success: true,
        message:
          "Draft saved.",
      });
    }

    /* ---------------- STOCK DRAFT DELETE ---------------- */

    if (
      p ===
        "/api/mooma/stock-record/draft" &&
      request.method ===
        "DELETE"
    ) {
      const b =
        await request.json();

      await draftDel(
        env,
        `${b.branchCode}|${b.date}|${b.mode}`
      );

      return J({
        success: true,
        message:
          "Draft deleted.",
      });
    }

    /* ---------------- STOCK SUBMIT ---------------- */

    if (
      p ===
        "/api/mooma/stock-record/submit" &&
      request.method === "POST"
    ) {
      const x =
        await stockSubmit(
          env,
          await request.json()
        );

      return J(
        x,
        x.success ? 200 : 409
      );
    }

    /* ---------------- TRANSFER INIT ---------------- */

    if (
      p ===
      "/api/mooma/stock-transfer/init"
    ) {
      const c = String(
        u.searchParams.get(
          "branch"
        ) || ""
      ).toUpperCase();

      const br =
        await getBranch(env, c);

      const all =
        await branchRows(env);

      if (!br?.sheetId) {
        throw Error(
          "Branch SheetID missing."
        );
      }

      const s = structure(
        await read(
          env,
          br.sheetId,
          `${STOCK}!A:ZZ`
        )
      );

      return J({
        success: true,

        branch: {
          code: br.code,
          name: br.name,
        },

        destinations:
          all
            .filter(
              (x) =>
                x.code !== c
            )
            .map((x) => ({
              code: x.code,
              name: x.name,
            })),

        items: [
          ...s.daily,
          ...s.weekly,
        ].filter(
          (x, i, a) =>
            a.findIndex(
              (y) =>
                y.row === x.row
            ) === i
        ),
      });
    }

    /* ---------------- TRANSFER CREATE ---------------- */

    if (
      p ===
        "/api/mooma/stock-transfer/create" &&
      request.method === "POST"
    ) {
      const x =
        await createTransfer(
          env,
          await request.json()
        );

      return J(
        x,
        x.success ? 200 : 409
      );
    }

    /* ---------------- TRANSFER HISTORY ---------------- */

    if (
      p ===
      "/api/mooma/stock-transfer/history"
    ) {
      const c = String(
        u.searchParams.get(
          "branch"
        ) || ""
      ).toUpperCase();

      const limit = Math.min(
        50,
        Number(
          u.searchParams.get(
            "limit"
          ) || 10
        )
      );

      const a =
        transferObjects(
          await transferSheet(
            env
          )
        )
          .filter(
            (x) =>
              x.origin.startsWith(
                c
              ) ||
              x.destination.startsWith(
                c
              )
          )
          .reverse();

      return J({
        success: true,
        total: a.length,

        transfers:
          a.slice(0, limit),
      });
    }

    /* ---------------- PENDING TRANSFERS ---------------- */

    if (
      p ===
      "/api/mooma/pending-transfers"
    ) {
      const c = String(
        u.searchParams.get(
          "branch"
        ) || ""
      ).toUpperCase();

      const a =
        transferObjects(
          await transferSheet(
            env
          )
        ).filter(
          (x) =>
            x.destination.startsWith(
              c
            ) &&
            x.status ===
              "Pending"
        );

      return J({
        success: true,
        count: a.length,
        transfers: a,
      });
    }

    /* ---------------- TRANSFER RESPOND ---------------- */

    if (
      p ===
        "/api/mooma/transfer/respond" &&
      request.method === "POST"
    ) {
      const x =
        await respond(
          env,
          await request.json()
        );

      return J(
        x,
        x.success ? 200 : 409
      );
    }

    /* ---------------- SCHEDULE INIT ---------------- */

    if (
      p ===
      "/api/mooma/schedule/init"
    ) {
      const c = String(
        u.searchParams.get(
          "branch"
        ) || ""
      ).toUpperCase();

      const date = String(
        u.searchParams.get(
          "date"
        ) || ""
      );

      const br =
        await getBranch(env, c);

      const r =
        await schedRows(env);

      const x = parseSched(
        r,
        c,
        date
      );

      const all =
        await branchRows(env);

      return J({
        success: true,
        source: "MOOMA-GOOGLE",

        branch: {
          code: br.code,
          name: br.name,
        },

        ...x,

        roles: ROLES,

        destinations:
          all
            .filter(
              (y) =>
                y.code !== c
            )
            .map((y) => ({
              code: y.code,
              name: y.name,
              label: `${y.code} - ${y.name}`,
            })),
      });
    }

    /* ---------------- SCHEDULE SUBMIT ---------------- */

    if (
      p ===
        "/api/mooma/schedule/submit" &&
      request.method === "POST"
    ) {
      const x =
        await schedSubmit(
          env,
          await request.json()
        );

      return J(
        x,
        x.success ? 200 : 409
      );
    }

    /* ---------------- EMPLOYEE ADD ---------------- */

    if (
      p ===
        "/api/mooma/schedule/employee/add" &&
      request.method === "POST"
    ) {
      return J(
        await addEmployee(
          env,
          await request.json()
        )
      );
    }

    /* ---------------- EMPLOYEE REMOVE ---------------- */

    if (
      p ===
        "/api/mooma/schedule/employee/remove" &&
      request.method === "POST"
    ) {
      return J(
        await employeeRemove(
          env,
          await request.json()
        )
      );
    }

    /* ---------------- VACATION ---------------- */

    if (
      p ===
        "/api/mooma/schedule/employee/vacation" &&
      request.method === "POST"
    ) {
      return J(
        await vacation(
          env,
          await request.json()
        )
      );
    }

    /* ---------------- NOT FOUND ---------------- */

    return J(
      {
        success: false,
        message:
          "MOOMA route not found.",
      },
      404
    );
  } catch (e) {
    console.error(
      "MOOMA BACKEND ERROR",
      e
    );

    return J(
      {
        success: false,
        message:
          e?.message ||
          "MOOMA backend error.",
      },
      500
    );
  }
}

