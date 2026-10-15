/* ============================================================
   GLOR API CLIENT
   ------------------------------------------------------------
   Shared API layer for:
   - Branches
   - Login
   - Stock Record
   - Stock View
   - Stock Transfer
   - Pending Transfers
   - Accept / Reject
   - Staff Schedule
   ============================================================ */


/* ============================================================
   API ROUTES
============================================================ */

export const GLOR_API = {
  branches: "/api/glor/branches",

  login: "/api/glor/login",

  stockItems: "/api/glor/stock/items",

  stockRecord: "/api/glor/stock/record",

  stockView: "/api/glor/stock/view",

  transferItems: "/api/glor/transfer/items",

  createTransfer: "/api/glor/transfer/create",

  pendingTransfers: "/api/glor/pending-transfers",

  transferAction: "/api/glor/transfer/respond",

  transferHistory: "/api/glor/transfer/history",

  schedule: "/api/glor/schedule",

  saveSchedule: "/api/glor/schedule/save",
};


/* ============================================================
   GENERIC REQUEST
============================================================ */

export async function glorRequest(
  url,
  options = {}
) {
  let response;

  try {
    response = await fetch(
      url,
      {
        cache: "no-store",

        ...options,

        headers: {
          Accept:
            "application/json",

          ...(options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          ...(options.headers ||
            {}),
        },
      }
    );
  } catch (error) {
    console.error(
      "[GLOR API] Network error:",
      error
    );

    throw new Error(
      "Unable to connect to GLOR network."
    );
  }


  const raw =
    await response.text();


  let data = null;


  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    console.error(
      "[GLOR API] Invalid JSON:",
      raw
    );

    throw new Error(
      `GLOR server returned invalid data. HTTP ${response.status}`
    );
  }


  if (!response.ok) {
    throw new Error(
      data?.message ||
        `GLOR request failed. HTTP ${response.status}`
    );
  }


  if (
    data &&
    data.success === false
  ) {
    throw new Error(
      data.message ||
        "GLOR operation failed."
    );
  }


  return data;
}


/* ============================================================
   GET REQUEST
============================================================ */

export async function glorGet(
  url,
  params = {}
) {
  const query =
    new URLSearchParams();


  Object.entries(
    params
  ).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        );
      }
    }
  );


  const queryString =
    query.toString();


  const finalUrl =
    queryString
      ? `${url}?${queryString}`
      : url;


  return glorRequest(
    finalUrl,
    {
      method: "GET",
    }
  );
}


/* ============================================================
   POST REQUEST
============================================================ */

export async function glorPost(
  url,
  body = {}
) {
  return glorRequest(
    url,
    {
      method: "POST",

      body:
        JSON.stringify(
          body
        ),
    }
  );
}


/* ============================================================
   UNIVERSAL ACTIVE SECTION
============================================================ */

export function activeScroll(
  target,
  options = {}
) {
  const {
    delay = 100,
    block = "center",
  } = options;


  window.requestAnimationFrame(
    () => {
      window.setTimeout(
        () => {
          let element = null;


          if (
            target?.current
          ) {
            element =
              target.current;
          } else if (
            target instanceof
            HTMLElement
          ) {
            element =
              target;
          } else if (
            typeof target ===
            "string"
          ) {
            element =
              document.querySelector(
                target
              );
          }


          if (!element) {
            return;
          }


          element.scrollIntoView(
            {
              behavior:
                "smooth",

              block,
            }
          );


          element.classList.add(
            "glor-active-focus"
          );


          window.setTimeout(
            () => {
              element?.classList.remove(
                "glor-active-focus"
              );
            },
            1100
          );
        },
        delay
      );
    }
  );
}


/* ============================================================
   BRANCHES
============================================================ */

export async function getGlorBranches() {
  return glorGet(
    GLOR_API.branches
  );
}


/* ============================================================
   LOGIN
============================================================ */

export async function loginGlorBranch(
  branchCode,
  password
) {
  return glorPost(
    GLOR_API.login,
    {
      branchCode,
      password,
    }
  );
}


/* ============================================================
   STOCK ITEMS
============================================================ */

export async function getGlorStockItems({
  branchCode,
  type,
  date,
}) {
  return glorGet(
    GLOR_API.stockItems,
    {
      branchCode,
      type,
      date,
    }
  );
}


/* ============================================================
   SAVE STOCK RECORD
============================================================ */

export async function saveGlorStockRecord({
  branchCode,
  type,
  date,
  items,
}) {
  return glorPost(
    GLOR_API.stockRecord,
    {
      branchCode,
      type,
      date,
      items,
    }
  );
}


/* ============================================================
   STOCK VIEW
============================================================ */

export async function getGlorStockView({
  branchCode,
  type,
  date,
}) {
  return glorGet(
    GLOR_API.stockView,
    {
      branchCode,
      type,
      date,
    }
  );
}


/* ============================================================
   TRANSFER ITEMS
============================================================ */

export async function getGlorTransferItems({
  branchCode,
}) {
  return glorGet(
    GLOR_API.transferItems,
    {
      branchCode,
    }
  );
}


/* ============================================================
   CREATE STOCK TRANSFER
============================================================ */

export async function createGlorTransfer({
  fromBranch,
  toBranch,
  items,
  note = "",
}) {
  return glorPost(
    GLOR_API.createTransfer,
    {
      fromBranch,
      toBranch,
      items,
      note,
    }
  );
}


/* ============================================================
   PENDING / INCOMING TRANSFERS
============================================================ */

export async function getGlorPendingTransfers(
  branchCode
) {
  return glorGet(
    GLOR_API.pendingTransfers,
    {
      branch:
        branchCode,
    }
  );
}


/* ============================================================
   ACCEPT TRANSFER
============================================================ */

export async function acceptGlorTransfer({
  transferId,
}) {
  if (!transferId) {
    throw new Error(
      "Transfer ID is required."
    );
  }


  return glorPost(
    GLOR_API.transferAction,
    {
      transferId,

      action:
        "accept",
    }
  );
}


/* ============================================================
   REJECT TRANSFER
============================================================ */

export async function rejectGlorTransfer({
  transferId,
}) {
  if (!transferId) {
    throw new Error(
      "Transfer ID is required."
    );
  }


  return glorPost(
    GLOR_API.transferAction,
    {
      transferId,

      action:
        "reject",
    }
  );
}


/* ============================================================
   TRANSFER HISTORY
============================================================ */

export async function getGlorTransferHistory(
  branchCode
) {
  return glorGet(
    GLOR_API.transferHistory,
    {
      branchCode,
    }
  );
}


/* ============================================================
   STAFF SCHEDULE
============================================================ */

export async function getGlorSchedule({
  branchCode,
  week,
}) {
  return glorGet(
    GLOR_API.schedule,
    {
      branchCode,
      week,
    }
  );
}


/* ============================================================
   SAVE STAFF SCHEDULE
============================================================ */

export async function saveGlorSchedule({
  branchCode,
  week,
  schedule,
}) {
  return glorPost(
    GLOR_API.saveSchedule,
    {
      branchCode,
      week,
      schedule,
    }
  );
}


/* ============================================================
   DATE HELPERS
============================================================ */

export function getTodayISO() {
  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


/* ============================================================
   NUMBER HELPERS
============================================================ */

export function cleanQuantity(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }


  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }


  return number;
}


/* ============================================================
   TRANSFER STATUS
============================================================ */

export function normalizeTransferStatus(
  value
) {
  const status =
    String(
      value || ""
    )
      .trim()
      .toUpperCase();


  if (
    status ===
    "ACCEPTED"
  ) {
    return "ACCEPTED";
  }


  if (
    status ===
    "REJECTED"
  ) {
    return "REJECTED";
  }


  return "PENDING";
}


/* ============================================================
   TRANSFER ID
============================================================ */

export function makeTransferId(
  branchCode = "M"
) {
  const now =
    new Date();


  const stamp =
    [
      now.getFullYear(),

      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getHours()
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getMinutes()
      ).padStart(
        2,
        "0"
      ),

      String(
        now.getSeconds()
      ).padStart(
        2,
        "0"
      ),
    ].join("");


  const random =
    Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase();


  return `GLOR-${branchCode}-${stamp}-${random}`;
}
