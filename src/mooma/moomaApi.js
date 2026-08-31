/* ============================================================
   DAM OPERATIONS — MOOMA API
   Frontend API Layer

   Matches:
   worker/moomaBackend.js
============================================================ */


/* ============================================================
   API BASE
============================================================ */

/*
 * Keep empty if frontend + Worker are served
 * from the same domain.
 *
 * Example final request:
 * /api/mooma/branches
 */
const API_BASE = "";


/* ============================================================
   MOOMA ROUTES
============================================================ */

export const MOOMA_API = {
  /* SYSTEM */
  test: "/api/mooma/test",
  branches: "/api/mooma/branches",
  login: "/api/mooma/login",
  databaseStatus: "/api/mooma/database-status",
  sync: "/api/mooma/sync",

  /* STOCK VIEW */
  stockView: "/api/mooma/stock-view",

  /* STOCK RECORD */
  stockRecordInit:
    "/api/mooma/stock-record/init",

  stockRecordDraft:
    "/api/mooma/stock-record/draft",

  stockRecordSubmit:
    "/api/mooma/stock-record/submit",

  /* STOCK TRANSFER */
  stockTransferInit:
    "/api/mooma/stock-transfer/init",

  stockTransferCreate:
    "/api/mooma/stock-transfer/create",

  stockTransferHistory:
    "/api/mooma/stock-transfer/history",

  /* DASHBOARD TRANSFERS */
  pendingTransfers:
    "/api/mooma/pending-transfers",

  transferRespond:
    "/api/mooma/transfer/respond",

  /* STAFF SCHEDULE */
  scheduleInit:
    "/api/mooma/schedule/init",

  scheduleSubmit:
    "/api/mooma/schedule/submit",

  employeeAdd:
    "/api/mooma/schedule/employee/add",

  employeeRemove:
    "/api/mooma/schedule/employee/remove",

  employeeVacation:
    "/api/mooma/schedule/employee/vacation",
};


/* ============================================================
   URL BUILDER
============================================================ */

function buildUrl(
  path,
  params = {}
) {
  const url =
    new URL(
      `${API_BASE}${path}`,
      window.location.origin
    );

  Object.entries(
    params
  ).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  return url.toString();
}


/* ============================================================
   RESPONSE PARSER
============================================================ */

async function parseResponse(
  response
) {
  let data;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `Invalid server response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `MOOMA request failed (${response.status}).`
    );
  }

  /*
   * Some backend routes deliberately
   * return success:false with status
   * codes such as 409.
   *
   * If a success:false somehow arrives
   * with HTTP 200, still treat it as
   * an application error.
   */
  if (
    data?.success === false
  ) {
    throw new Error(
      data?.message ||
        "MOOMA operation failed."
    );
  }

  return data;
}


/* ============================================================
   GENERIC GET
============================================================ */

export async function moomaGet(
  path,
  params = {}
) {
  const url =
    buildUrl(
      path,
      params
    );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  return parseResponse(
    response
  );
}


/* ============================================================
   GENERIC POST
============================================================ */

export async function moomaPost(
  path,
  body = {}
) {
  const response =
    await fetch(
      buildUrl(path),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),
      }
    );

  return parseResponse(
    response
  );
}


/* ============================================================
   GENERIC DELETE
============================================================ */

export async function moomaDelete(
  path,
  body = {}
) {
  const response =
    await fetch(
      buildUrl(path),
      {
        method:
          "DELETE",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),
      }
    );

  return parseResponse(
    response
  );
}


/* ============================================================
   TEST CONNECTION
============================================================ */

export async function testMoomaConnection() {
  return moomaGet(
    MOOMA_API.test
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

export async function loginMoomaBranch({
  branchCode,
  password,
}) {
  return moomaPost(
    MOOMA_API.login,
    {
      branchCode,
      password,
    }
  );
}


/* ============================================================
   DATABASE STATUS
============================================================ */

export async function getMoomaDatabaseStatus() {
  return moomaGet(
    MOOMA_API.databaseStatus
  );
}


/* ============================================================
   SYNC
============================================================ */

export async function syncMoomaDatabase() {
  return moomaPost(
    MOOMA_API.sync,
    {}
  );
}


/* ============================================================
   STOCK VIEW
============================================================ */

export async function getMoomaStockView(
  branchCode
) {
  return moomaGet(
    MOOMA_API.stockView,
    {
      /*
       * Backend expects:
       * ?branch=M001
       */
      branch:
        branchCode,
    }
  );
}


/* ============================================================
   STOCK RECORD — INITIALIZE
============================================================ */

export async function getMoomaStockRecordInit({
  branchCode,
  date,
}) {
  return moomaGet(
    MOOMA_API.stockRecordInit,
    {
      branch:
        branchCode,

      date,
    }
  );
}


/* ============================================================
   STOCK RECORD — SAVE DRAFT
============================================================ */

export async function saveMoomaStockDraft({
  branchCode,
  date,
  mode,
  values,
}) {
  return moomaPost(
    MOOMA_API.stockRecordDraft,
    {
      branchCode,
      date,
      mode,
      values:
        values || {},
    }
  );
}


/* ============================================================
   STOCK RECORD — DELETE DRAFT
============================================================ */

export async function deleteMoomaStockDraft({
  branchCode,
  date,
  mode,
}) {
  return moomaDelete(
    MOOMA_API.stockRecordDraft,
    {
      branchCode,
      date,
      mode,
    }
  );
}


/* ============================================================
   STOCK RECORD — SUBMIT
============================================================ */

export async function submitMoomaStockRecord({
  branchCode,
  date,
  mode,
  values,
}) {
  return moomaPost(
    MOOMA_API.stockRecordSubmit,
    {
      branchCode,
      date,
      mode,

      values:
        values || {},
    }
  );
}


/* ============================================================
   STOCK TRANSFER — INITIALIZE
============================================================ */

export async function getMoomaStockTransferInit(
  branchCode
) {
  return moomaGet(
    MOOMA_API.stockTransferInit,
    {
      branch:
        branchCode,
    }
  );
}


/* ============================================================
   STOCK TRANSFER — CREATE
============================================================ */

export async function createMoomaStockTransfer({
  originBranch,
  destinationBranch,
  items,
  reason,
}) {
  return moomaPost(
    MOOMA_API.stockTransferCreate,
    {
      originBranch,
      destinationBranch,

      items:
        Array.isArray(items)
          ? items
          : [],

      reason:
        reason || "",
    }
  );
}


/* ============================================================
   STOCK TRANSFER — HISTORY
============================================================ */

export async function getMoomaStockTransferHistory(
  branchCode,
  limit = 10
) {
  return moomaGet(
    MOOMA_API.stockTransferHistory,
    {
      branch:
        branchCode,

      limit,
    }
  );
}


/* ============================================================
   DASHBOARD — PENDING INCOMING TRANSFERS
============================================================ */

export async function getMoomaPendingTransfers(
  branchCode
) {
  return moomaGet(
    MOOMA_API.pendingTransfers,
    {
      /*
       * IMPORTANT:
       *
       * Backend expects:
       *
       * /api/mooma/pending-transfers
       * ?branch=M001
       */
      branch:
        branchCode,
    }
  );
}


/* ============================================================
   DASHBOARD — ACCEPT TRANSFER
============================================================ */

export async function acceptMoomaTransfer({
  transferId,
}) {
  if (!transferId) {
    throw new Error(
      "Transfer ID is required."
    );
  }

  return moomaPost(
    MOOMA_API.transferRespond,
    {
      transferId,

      /*
       * Backend expects lowercase
       * "accept"
       */
      action:
        "accept",
    }
  );
}


/* ============================================================
   DASHBOARD — REJECT TRANSFER
============================================================ */

export async function rejectMoomaTransfer({
  transferId,
}) {
  if (!transferId) {
    throw new Error(
      "Transfer ID is required."
    );
  }

  return moomaPost(
    MOOMA_API.transferRespond,
    {
      transferId,

      /*
       * Backend expects lowercase
       * "reject"
       */
      action:
        "reject",
    }
  );
}


/* ============================================================
   GENERIC TRANSFER RESPONSE
============================================================ */

export async function respondMoomaTransfer({
  transferId,
  action,
}) {
  if (!transferId) {
    throw new Error(
      "Transfer ID is required."
    );
  }

  const normalizedAction =
    String(
      action || ""
    )
      .trim()
      .toLowerCase();

  if (
    normalizedAction !==
      "accept" &&
    normalizedAction !==
      "reject"
  ) {
    throw new Error(
      "Transfer action must be accept or reject."
    );
  }

  return moomaPost(
    MOOMA_API.transferRespond,
    {
      transferId,
      action:
        normalizedAction,
    }
  );
}


/* ============================================================
   STAFF SCHEDULE — INITIALIZE
============================================================ */

export async function getMoomaScheduleInit({
  branchCode,
  date,
}) {
  return moomaGet(
    MOOMA_API.scheduleInit,
    {
      branch:
        branchCode,

      date,
    }
  );
}


/* ============================================================
   STAFF SCHEDULE — SUBMIT
============================================================ */

export async function submitMoomaSchedule({
  branchCode,
  selectedDate,
  employees,
}) {
  return moomaPost(
    MOOMA_API.scheduleSubmit,
    {
      branchCode,
      selectedDate,

      employees:
        Array.isArray(
          employees
        )
          ? employees
          : [],
    }
  );
}


/* ============================================================
   STAFF SCHEDULE — ADD EMPLOYEE
============================================================ */

export async function addMoomaEmployee({
  branchCode,
  employeeId,
  name,
  role,
}) {
  return moomaPost(
    MOOMA_API.employeeAdd,
    {
      branchCode,

      employeeId:
        employeeId || "",

      name,

      role:
        role ||
        "Team-Member",
    }
  );
}


/* ============================================================
   STAFF SCHEDULE — REMOVE / TRANSFER EMPLOYEE
============================================================ */

export async function removeMoomaEmployee({
  branchCode,
  employeeId,
  name,
  reason,
  destinationBranch,
}) {
  return moomaPost(
    MOOMA_API.employeeRemove,
    {
      branchCode,

      employeeId:
        employeeId || "",

      name:
        name || "",

      reason,

      destinationBranch:
        destinationBranch ||
        "",
    }
  );
}


/* ============================================================
   STAFF SCHEDULE — VACATION
============================================================ */

export async function setMoomaEmployeeVacation({
  branchCode,
  employeeId,
  name,
  selectedDate,
}) {
  return moomaPost(
    MOOMA_API.employeeVacation,
    {
      branchCode,

      employeeId:
        employeeId || "",

      name:
        name || "",

      selectedDate,
    }
  );
}


/* ============================================================
   ACTIVE SECTION AUTO-SCROLL
============================================================ */

/*
 * Universal helper:
 *
 * Whenever the user opens something,
 * submits something, accepts/rejects,
 * or activates a section, call:
 *
 * activeScroll(ref)
 *
 * This keeps the active operation
 * visible automatically.
 */

export function activeScroll(
  target,
  options = {}
) {
  const {
    delay = 80,
    block = "start",
    behavior = "smooth",
  } = options;

  window.setTimeout(
    () => {
      let element =
        null;

      /*
       * React ref
       */
      if (
        target?.current
      ) {
        element =
          target.current;
      }

      /*
       * Direct DOM element
       */
      else if (
        target instanceof
        HTMLElement
      ) {
        element =
          target;
      }

      /*
       * CSS selector
       */
      else if (
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

      element.scrollIntoView({
        behavior,
        block,
        inline:
          "nearest",
      });
    },
    delay
  );
}


/* ============================================================
   SCROLL TO TOP
============================================================ */

export function moomaScrollTop(
  behavior = "smooth"
) {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior,
  });
}


/* ============================================================
   EXPORT DEFAULT
============================================================ */

export default {
  MOOMA_API,

  testMoomaConnection,

  getMoomaBranches,
  loginMoomaBranch,

  getMoomaDatabaseStatus,
  syncMoomaDatabase,

  getMoomaStockView,

  getMoomaStockRecordInit,
  saveMoomaStockDraft,
  deleteMoomaStockDraft,
  submitMoomaStockRecord,

  getMoomaStockTransferInit,
  createMoomaStockTransfer,
  getMoomaStockTransferHistory,

  getMoomaPendingTransfers,
  acceptMoomaTransfer,
  rejectMoomaTransfer,
  respondMoomaTransfer,

  getMoomaScheduleInit,
  submitMoomaSchedule,

  addMoomaEmployee,
  removeMoomaEmployee,
  setMoomaEmployeeVacation,

  activeScroll,
  moomaScrollTop,
};s
