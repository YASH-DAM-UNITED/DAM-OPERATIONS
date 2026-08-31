/* ============================================================
   MOOMA API CLIENT
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

export const MOOMA_API = {
  branches: "/api/mooma/branches",

  login: "/api/mooma/login",

  stockItems: "/api/mooma/stock/items",

  stockRecord: "/api/mooma/stock/record",

  stockView: "/api/mooma/stock/view",

  transferItems: "/api/mooma/transfer/items",

  createTransfer: "/api/mooma/transfer/create",

  pendingTransfers: "/api/mooma/transfer/pending",

  transferAction: "/api/mooma/transfer/action",

  transferHistory: "/api/mooma/transfer/history",

  schedule: "/api/mooma/schedule",

  saveSchedule: "/api/mooma/schedule/save",
};


/* ============================================================
   GENERIC REQUEST
============================================================ */

export async function moomaRequest(
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
      "[MOOMA API] Network error:",
      error
    );

    throw new Error(
      "Unable to connect to MOOMA network."
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
      "[MOOMA API] Invalid JSON:",
      raw
    );

    throw new Error(
      `MOOMA server returned invalid data. HTTP ${response.status}`
    );
  }


  if (!response.ok) {
    throw new Error(
      data?.message ||
        `MOOMA request failed. HTTP ${response.status}`
    );
  }


  if (
    data &&
    data.success === false
  ) {
    throw new Error(
      data.message ||
        "MOOMA operation failed."
    );
  }


  return data;
}


/* ============================================================
   GET REQUEST
============================================================ */

export async function moomaGet(
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


  return moomaRequest(
    finalUrl,
    {
      method: "GET",
    }
  );
}


/* ============================================================
   POST REQUEST
============================================================ */

export async function moomaPost(
  url,
  body = {}
) {
  return moomaRequest(
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
   ------------------------------------------------------------
   IMPORTANT MOOMA RULE:

   Whenever the user performs an action,
   move them to the newly active section.
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
            "mooma-active-focus"
          );


          window.setTimeout(
            () => {
              element?.classList.remove(
                "mooma-active-focus"
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

export async function getMoomaBranches() {
  return moomaGet(
    MOOMA_API.branches
  );
}


/* ============================================================
   LOGIN
============================================================ */

export async function loginMoomaBranch(
  branchCode,
  password
) {
  return moomaPost(
    MOOMA_API.login,
    {
      branchCode,
      password,
    }
  );
}


/* ============================================================
   STOCK ITEMS
============================================================ */

export async function getMoomaStockItems({
  branchCode,
  type,
  date,
}) {
  return moomaGet(
    MOOMA_API.stockItems,
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

export async function saveMoomaStockRecord({
  branchCode,
  type,
  date,
  items,
}) {
  return moomaPost(
    MOOMA_API.stockRecord,
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

export async function getMoomaStockView({
  branchCode,
  type,
  date,
}) {
  return moomaGet(
    MOOMA_API.stockView,
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

export async function getMoomaTransferItems({
  branchCode,
}) {
  return moomaGet(
    MOOMA_API.transferItems,
    {
      branchCode,
    }
  );
}


/* ============================================================
   CREATE STOCK TRANSFER
============================================================ */

export async function createMoomaTransfer({
  fromBranch,
  toBranch,
  items,
  note = "",
}) {
  return moomaPost(
    MOOMA_API.createTransfer,
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

   USED DIRECTLY BY MOOMA DASHBOARD.
============================================================ */

export async function getMoomaPendingTransfers(
  branchCode
) {
  return moomaGet(
    MOOMA_API.pendingTransfers,
    {
      branchCode,
    }
  );
}


/* ============================================================
   ACCEPT TRANSFER
============================================================ */

export async function acceptMoomaTransfer({
  transferId,
  branchCode,
}) {
  return moomaPost(
    MOOMA_API.transferAction,
    {
      transferId,
      branchCode,
      action:
        "ACCEPT",
    }
  );
}


/* ============================================================
   REJECT TRANSFER
============================================================ */

export async function rejectMoomaTransfer({
  transferId,
  branchCode,
}) {
  return moomaPost(
    MOOMA_API.transferAction,
    {
      transferId,
      branchCode,
      action:
        "REJECT",
    }
  );
}


/* ============================================================
   TRANSFER HISTORY
============================================================ */

export async function getMoomaTransferHistory(
  branchCode
) {
  return moomaGet(
    MOOMA_API.transferHistory,
    {
      branchCode,
    }
  );
}


/* ============================================================
   STAFF SCHEDULE
============================================================ */

export async function getMoomaSchedule({
  branchCode,
  week,
}) {
  return moomaGet(
    MOOMA_API.schedule,
    {
      branchCode,
      week,
    }
  );
}


/* ============================================================
   SAVE STAFF SCHEDULE
============================================================ */

export async function saveMoomaSchedule({
  branchCode,
  week,
  schedule,
}) {
  return moomaPost(
    MOOMA_API.saveSchedule,
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


  return `MOOMA-${branchCode}-${stamp}-${random}`;
}
