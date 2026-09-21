// DNVisionDeviceCheck.js
// ---------------------------------------------------------
// Purpose:
// Check whether the current device/browser can run
// DNVision locally.
//
// NO AI model is downloaded here.
// NO API is called.
// NO payment/service is used.
// ---------------------------------------------------------


/* ============================================================
   MAIN DEVICE CHECK
============================================================ */

export async function checkDNVisionDevice() {
  const result = {
    browser: getBrowserName(),

    platform:
      navigator.platform ||
      "Unknown",

    userAgent:
      navigator.userAgent ||
      "",

    webGPU: false,

    gpuAdapter: false,

    gpuName: "",

    wasm: supportsWasm(),

    hardwareConcurrency:
      navigator.hardwareConcurrency ||
      null,

    deviceMemory:
      navigator.deviceMemory ||
      null,

    recommendedMode:
      "UNKNOWN",

    message:
      "",
  };


  /* ==========================================================
     WEBGPU CHECK
  ========================================================== */

  if (
    "gpu" in navigator &&
    navigator.gpu
  ) {
    result.webGPU = true;

    try {
      const adapter =
        await navigator.gpu.requestAdapter({
          powerPreference:
            "high-performance",
        });


      if (adapter) {
        result.gpuAdapter =
          true;


        /*
          Adapter information availability
          differs between browsers.

          We don't depend on it.
        */

        try {
          if (
            typeof adapter.info ===
            "object"
          ) {
            const info =
              adapter.info;

            result.gpuName =
              info.description ||
              info.device ||
              info.architecture ||
              info.vendor ||
              "";
          }
        } catch {
          // GPU name is optional.
        }
      }

    } catch (error) {
      console.warn(
        "DNVision WebGPU adapter check failed:",
        error
      );

      result.gpuAdapter =
        false;
    }
  }


  /* ==========================================================
     RECOMMEND EXECUTION MODE
  ========================================================== */

  if (
    result.webGPU &&
    result.gpuAdapter
  ) {
    result.recommendedMode =
      "WEBGPU";

    result.message =
      "This device can use GPU acceleration for DNVision.";
  }

  else if (result.wasm) {
    result.recommendedMode =
      "WASM";

    result.message =
      "WebGPU is unavailable. DNVision can attempt CPU/WASM mode.";
  }

  else {
    result.recommendedMode =
      "UNSUPPORTED";

    result.message =
      "This browser does not currently provide the required local AI capabilities.";
  }


  return result;
}


/* ============================================================
   WEBASSEMBLY CHECK
============================================================ */

function supportsWasm() {
  try {
    if (
      typeof WebAssembly !==
      "object"
    ) {
      return false;
    }


    if (
      typeof WebAssembly.instantiate !==
      "function"
    ) {
      return false;
    }


    /*
      Tiny valid WebAssembly module.
      We only compile it to verify WASM support.
    */

    const module =
      new WebAssembly.Module(
        new Uint8Array([
          0x00,
          0x61,
          0x73,
          0x6d,
          0x01,
          0x00,
          0x00,
          0x00,
        ])
      );


    return (
      module instanceof
      WebAssembly.Module
    );

  } catch {
    return false;
  }
}


/* ============================================================
   BASIC BROWSER NAME
============================================================ */

function getBrowserName() {
  const ua =
    navigator.userAgent ||
    "";


  if (
    /Edg\//i.test(ua)
  ) {
    return "Microsoft Edge";
  }


  if (
    /OPR\//i.test(ua) ||
    /Opera/i.test(ua)
  ) {
    return "Opera";
  }


  if (
    /CriOS/i.test(ua)
  ) {
    return "Chrome iOS";
  }


  if (
    /FxiOS/i.test(ua)
  ) {
    return "Firefox iOS";
  }


  if (
    /Chrome/i.test(ua)
  ) {
    return "Google Chrome";
  }


  if (
    /Firefox/i.test(ua)
  ) {
    return "Mozilla Firefox";
  }


  if (
    /Safari/i.test(ua)
  ) {
    return "Safari";
  }


  return "Unknown Browser";
}


/* ============================================================
   SHORT DISPLAY VERSION
============================================================ */

export function getDNVisionDeviceSummary(
  result
) {
  if (!result) {
    return null;
  }


  return {
    browser:
      result.browser,

    webGPU:
      result.webGPU
        ? "YES"
        : "NO",

    gpuAdapter:
      result.gpuAdapter
        ? "AVAILABLE"
        : "NOT AVAILABLE",

    wasm:
      result.wasm
        ? "YES"
        : "NO",

    memory:
      result.deviceMemory
        ? `${result.deviceMemory} GB`
        : "Browser did not report",

    cpuThreads:
      result.hardwareConcurrency
        ? String(
            result.hardwareConcurrency
          )
        : "Browser did not report",

    mode:
      result.recommendedMode,

    message:
      result.message,
  };
}
