/* ============================================================
   DNVISION ENGINE
   ------------------------------------------------------------
   Main-thread controller for DNVisionWorker.js

   Scanner
      ↓
   DNVisionEngine
      ↓
   Web Worker
      ↓
   SmolVLM + WebGPU
============================================================ */


/* ============================================================
   WORKER STATE
============================================================ */

let worker = null;

let workerReadyPromise = null;

let requestCounter = 0;

const pendingRequests =
  new Map();


/* ============================================================
   CREATE / GET WORKER
============================================================ */

function getDNVisionWorker() {
  if (worker) {
    return worker;
  }


  console.log(
    "DNVision: creating WebGPU worker..."
  );


  worker =
    new Worker(
      new URL(
        "./DNVisionWorker.js",
        import.meta.url
      ),
      {
        type: "module",
      }
    );


  /* ----------------------------------------------------------
     WORKER MESSAGE
  ---------------------------------------------------------- */

  worker.addEventListener(
    "message",
    handleWorkerMessage
  );


  /* ----------------------------------------------------------
     WORKER ERROR
  ---------------------------------------------------------- */

  worker.addEventListener(
    "error",
    (event) => {
      console.error(
        "DNVision worker crashed:",
        event
      );


      const message =
        event?.message ||
        "DNVision worker crashed.";


      rejectAllRequests(
        message
      );


      resetWorker();
    }
  );


  return worker;
}


/* ============================================================
   HANDLE WORKER MESSAGES
============================================================ */

function handleWorkerMessage(
  event
) {
  const data =
    event.data || {};


  console.log(
    "DNVision worker message:",
    data
  );


  /* ----------------------------------------------------------
     WORKER STARTED
  ---------------------------------------------------------- */

  if (
    data.type ===
    "worker-ready"
  ) {
    return;
  }


  /* ----------------------------------------------------------
     PROGRESS MESSAGE

     Progress messages do not always contain
     a request ID, because model loading can
     be shared by multiple operations.

     Send progress to all active requests.
  ---------------------------------------------------------- */

  if (
    data.type ===
    "progress"
  ) {
    for (
      const request
      of pendingRequests.values()
    ) {
      request.onProgress?.({
        stage:
          data.stage,

        progress:
          typeof data.progress ===
          "number"
            ? data.progress
            : null,

        file:
          data.file || "",

        status:
          data.status || "",

        message:
          data.message ||
          "DNVision working...",
      });
    }


    return;
  }


  /* ----------------------------------------------------------
     FIND REQUEST
  ---------------------------------------------------------- */

  const id =
    data.id;


  if (!id) {
    return;
  }


  const request =
    pendingRequests.get(
      id
    );


  if (!request) {
    return;
  }


  /* ----------------------------------------------------------
     MODEL LOADED
  ---------------------------------------------------------- */

  if (
    data.type ===
    "loaded"
  ) {
    pendingRequests.delete(
      id
    );


    request.resolve({
      loaded:
        true,

      model:
        data.model,

      device:
        data.device,
    });


    return;
  }


  /* ----------------------------------------------------------
     INFERENCE RESULT
  ---------------------------------------------------------- */

  if (
    data.type ===
    "result"
  ) {
    pendingRequests.delete(
      id
    );


    request.resolve({
      answer:
        data.answer || "",

      raw:
        data.raw || "",

      model:
        data.model || "",

      device:
        data.device ||
        "webgpu",
    });


    return;
  }


  /* ----------------------------------------------------------
     ERROR
  ---------------------------------------------------------- */

  if (
    data.type ===
    "error"
  ) {
    pendingRequests.delete(
      id
    );


    request.reject(
      new Error(
        data.message ||
        "DNVision worker error"
      )
    );
  }
}


/* ============================================================
   SEND REQUEST
============================================================ */

function sendWorkerRequest(
  type,
  payload = {},
  onProgress
) {
  const activeWorker =
    getDNVisionWorker();


  const id =
    `dnvision-${Date.now()}-${++requestCounter}`;


  return new Promise(
    (
      resolve,
      reject
    ) => {

      pendingRequests.set(
        id,
        {
          resolve,
          reject,
          onProgress,
        }
      );


      try {
        activeWorker.postMessage({
          id,
          type,
          ...payload,
        });

      } catch (error) {

        pendingRequests.delete(
          id
        );


        reject(
          error
        );
      }
    }
  );
}


/* ============================================================
   PRELOAD DNVISION
============================================================ */

export async function loadDNVisionEngine(
  onProgress
) {
  if (workerReadyPromise) {
    return workerReadyPromise;
  }


  workerReadyPromise =
    sendWorkerRequest(
      "load",
      {},
      onProgress
    );


  try {

    const result =
      await workerReadyPromise;


    console.log(
      "DNVision model loaded:",
      result
    );


    return result;

  } catch (error) {

    workerReadyPromise =
      null;


    console.error(
      "DNVision model load failed:",
      error
    );


    throw new Error(
      `DNVision model load failed: ${
        getErrorMessage(
          error
        )
      }`
    );
  }
}


/* ============================================================
   ASK DNVISION
============================================================ */

export async function askDNVision(
  preparedBlob,
  question,
  onProgress
) {
  if (!preparedBlob) {
    throw new Error(
      "No prepared delivery note image."
    );
  }


  const instruction =
    String(
      question || ""
    ).trim();


  if (!instruction) {
    throw new Error(
      "DNVision instruction is empty."
    );
  }


  /* ----------------------------------------------------------
     CHECK WEBGPU
  ---------------------------------------------------------- */

  if (
    !navigator?.gpu
  ) {
    throw new Error(
      "WebGPU is not available on this browser."
    );
  }


  try {

    onProgress?.({
      stage:
        "starting",

      progress:
        null,

      message:
        "Starting DNVision...",
    });


    /* --------------------------------------------------------
       LOAD MODEL FIRST

       The worker caches the model, so after the
       first successful load this does not reload
       everything for every scan.
    -------------------------------------------------------- */

    await loadDNVisionEngine(
      onProgress
    );


    /* --------------------------------------------------------
       SEND IMAGE TO WORKER
    -------------------------------------------------------- */

    onProgress?.({
      stage:
        "sending",

      progress:
        null,

      message:
        "Sending delivery note to DNVision...",
    });


    const result =
      await sendWorkerRequest(
        "infer",
        {
          imageBlob:
            preparedBlob,

          instruction,
        },
        onProgress
      );


    const answer =
      String(
        result?.answer ||
        ""
      ).trim();


    console.log(
      "DNVision final result:",
      result
    );


    onProgress?.({
      stage:
        "complete",

      progress:
        100,

      message:
        "DNVision scan complete",
    });


    return {
      question:
        instruction,

      answer,

      raw:
        result?.raw ||
        "",

      model:
        result?.model ||
        "HuggingFaceTB/SmolVLM-256M-Instruct",

      device:
        result?.device ||
        "webgpu",
    };

  } catch (error) {

    console.error(
      "DNVision inference failed:",
      error
    );


    /*
      Avoid producing:

      DNVision failed:
      DNVision model load failed:
      DNVision failed...

      Keep the final error readable.
    */

    const message =
      getErrorMessage(
        error
      );


    if (
      message.startsWith(
        "DNVision model load failed:"
      )
    ) {
      throw new Error(
        message
      );
    }


    throw new Error(
      `DNVision failed: ${message}`
    );
  }
}


/* ============================================================
   READY STATUS
============================================================ */

export function isDNVisionReady() {
  return Boolean(
    workerReadyPromise
  );
}


/* ============================================================
   MODEL INFORMATION
============================================================ */

export function getDNVisionModelInfo() {
  return {
    id:
      "HuggingFaceTB/SmolVLM-256M-Instruct",

    device:
      "webgpu",

    architecture:
      "web-worker",

    dtype: {
      embed_tokens:
        "fp16",

      vision_encoder:
        "q4",

      decoder_model_merged:
        "q4",
    },

    workerCreated:
      Boolean(
        worker
      ),

    loaded:
      Boolean(
        workerReadyPromise
      ),
  };
}


/* ============================================================
   RESET DNVISION
============================================================ */

export function resetDNVisionEngine() {
  rejectAllRequests(
    "DNVision engine reset."
  );


  resetWorker();
}


/* ============================================================
   INTERNAL WORKER RESET
============================================================ */

function resetWorker() {
  if (worker) {

    try {
      worker.removeEventListener(
        "message",
        handleWorkerMessage
      );


      worker.terminate();

    } catch (error) {
      console.warn(
        "DNVision worker cleanup:",
        error
      );
    }
  }


  worker =
    null;

  workerReadyPromise =
    null;
}


/* ============================================================
   REJECT ACTIVE REQUESTS
============================================================ */

function rejectAllRequests(
  message
) {
  for (
    const [
      id,
      request,
    ]
    of pendingRequests.entries()
  ) {
    request.reject(
      new Error(
        message
      )
    );


    pendingRequests.delete(
      id
    );
  }
}


/* ============================================================
   ERROR MESSAGE
============================================================ */

function getErrorMessage(
  error
) {
  if (
    typeof error?.message ===
      "string" &&
    error.message.trim()
  ) {
    return error.message;
  }


  if (
    typeof error ===
    "string"
  ) {
    return error;
  }


  try {
    return JSON.stringify(
      error
    );

  } catch {

    return String(
      error ||
      "Unknown DNVision error"
    );
  }
}
