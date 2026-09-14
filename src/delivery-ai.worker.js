import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";

/* ============================================================
   DAM LOCAL DELIVERY NOTE AI
   ============================================================ */

const MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct";

const HF_BASE =
  `https://huggingface.co/${MODEL_ID}/resolve/main`;

let processor = null;
let model = null;
let loadingPromise = null;

/* ============================================================
   MESSAGE HELPER
   ============================================================ */

function post(type, payload = {}) {
  self.postMessage({
    type,
    ...payload,
  });
}

/* ============================================================
   PROGRESS
   ============================================================ */

function progressToPercent(info) {
  if (
    typeof info?.progress === "number"
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(info.progress)
      )
    );
  }

  if (
    typeof info?.loaded === "number" &&
    typeof info?.total === "number" &&
    info.total > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (info.loaded / info.total) * 100
        )
      )
    );
  }

  return null;
}

/* ============================================================
   ERROR FORMATTER
   ============================================================ */

function errorMessage(error) {
  if (!error) {
    return "Unknown error";
  }

  if (error instanceof Error) {
    return error.message || String(error);
  }

  return String(error);
}

function stageError(stage, error) {
  const message = errorMessage(error);

  console.error(
    `[DAM LOCAL AI] ${stage}:`,
    error
  );

  throw new Error(
    `${stage} FAILED — ${message}`
  );
}

/* ============================================================
   WEBGPU CHECK
   ============================================================ */

async function ensureWebGPU() {
  post("status", {
    stage: "webgpu",
    message:
      "Checking WebGPU compatibility…",
  });

  if (!self.navigator?.gpu) {
    throw new Error(
      "WEBGPU CHECK FAILED — WebGPU is not available on this browser/device."
    );
  }

  let adapter;

  try {
    adapter =
      await self.navigator.gpu.requestAdapter({
        powerPreference:
          "high-performance",
      });
  } catch (error) {
    stageError(
      "WEBGPU ADAPTER",
      error
    );
  }

  if (!adapter) {
    throw new Error(
      "WEBGPU ADAPTER FAILED — Browser reports WebGPU, but no usable GPU adapter was returned."
    );
  }

  post("status", {
    stage: "webgpu",
    message:
      "WebGPU adapter ready ✓",
  });

  return adapter;
}

/* ============================================================
   HUGGING FACE CONNECTION TEST
   ============================================================ */

async function testHuggingFaceConnection() {
  post("status", {
    stage: "network",
    message:
      "Checking AI model connection…",
  });

  const testUrl =
    `${HF_BASE}/config.json`;

  let response;

  try {
    response = await fetch(
      testUrl,
      {
        method: "GET",
        cache: "no-store",
      }
    );
  } catch (error) {
    throw new Error(
      `HUGGING FACE CONNECTION FAILED — ${errorMessage(
        error
      )}. The browser could not reach huggingface.co. This may be caused by network blocking, CSP/connect-src restrictions, DNS filtering, firewall, or browser security policy.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `HUGGING FACE CONNECTION FAILED — HTTP ${response.status} ${response.statusText}`
    );
  }

  post("status", {
    stage: "network",
    message:
      "Hugging Face connection ready ✓",
  });
}

/* ============================================================
   PROGRESS CALLBACK
   ============================================================ */

function modelProgress(info) {
  const percent =
    progressToPercent(info);

  post("model-progress", {
    percent,
    file:
      info?.file ||
      info?.name ||
      "",
    status:
      info?.status ||
      "",
  });
}

/* ============================================================
   LOAD LOCAL AI
   ============================================================ */

async function loadModel() {
  if (
    model &&
    processor
  ) {
    post("model-ready", {
      modelId: MODEL_ID,
    });

    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise =
    (async () => {
      /*
       * STEP 1 — GPU
       */
      await ensureWebGPU();

      /*
       * STEP 2 — NETWORK
       */
      await testHuggingFaceConnection();

      /*
       * STEP 3 — PROCESSOR
       */
      post("status", {
        stage: "processor",
        message:
          "Downloading AI processor…",
      });

      try {
        processor =
          await AutoProcessor.from_pretrained(
            MODEL_ID,
            {
              progress_callback:
                modelProgress,
            }
          );
      } catch (error) {
        stageError(
          "PROCESSOR DOWNLOAD",
          error
        );
      }

      post("status", {
        stage: "processor",
        message:
          "AI processor ready ✓",
      });

      /*
       * STEP 4 — MODEL
       *
       * IMPORTANT:
       * SmolVLM WebGPU uses fp32 for embed_tokens.
       * q4 is used for the larger vision/decoder components.
       */
      post("status", {
        stage: "model",
        message:
          "Downloading local vision model… First load can take some time.",
      });

      try {
        model =
          await AutoModelForVision2Seq.from_pretrained(
            MODEL_ID,
            {
              device:
                "webgpu",

              dtype: {
                /*
                 * DO NOT change this back to fp16.
                 */
                embed_tokens:
                  "fp32",

                vision_encoder:
                  "q4",

                decoder_model_merged:
                  "q4",
              },

              progress_callback:
                modelProgress,
            }
          );
      } catch (error) {
        stageError(
          "MODEL DOWNLOAD / GPU INITIALIZATION",
          error
        );
      }

      /*
       * READY
       */
      post("status", {
        stage: "ready",
        message:
          "Local delivery-note AI ready ✓",
      });

      post("model-ready", {
        modelId: MODEL_ID,
      });
    })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/* ============================================================
   DAM DELIVERY NOTE PROMPT
   ============================================================ */

const EXTRACTION_PROMPT = `
You are a strict document extraction engine for DAM delivery notes.

Read the attached delivery note image carefully.

Return ONLY valid JSON.
Do not return markdown.
Do not return code fences.
Do not explain anything.

IMPORTANT DOCUMENT RULES:

1. Read EVERY visible physical product row.

2. Never silently remove a row just because part of it is unclear.

3. SKU:
   The SKU is normally the code inside square brackets.
   Example:
   [CB134] -> CB134
   [S046] -> S046

4. Product:
   Keep English product text only.
   Ignore Arabic characters and Arabic text.

5. If the product contains a spaced separator:
   " - "
   then the English product name normally ends before that separator.

6. ORDERED and DELIVERED are separate table columns.

7. Each ORDERED or DELIVERED value may contain:
   quantity
   UOM
   size

Examples:

"1.00 Bottle 500 ml"
becomes:
qty = 1
uom = "BOTTLE"
size = "500 ML"

"6.00 Pcs"
becomes:
qty = 6
uom = "PCS"
size = ""

"6.00 Gallon 4.5L"
becomes:
qty = 6
uom = "GALLON"
size = "4.5 L"

8. Do NOT combine UOM and size.

Wrong:
uom = "Bottle 500 ml"

Correct:
uom = "BOTTLE"
size = "500 ML"

9. If any row is uncertain:
   preserve the row
   and set needsReview = true.

10. Never invent unreadable values.

11. For unreadable text use "".

12. For unreadable numeric quantity use null.

13. Header fields:

deliveryNote
shippingDate
source
destination

14. Maintain the physical top-to-bottom order of product rows.

RETURN EXACTLY THIS STRUCTURE:

{
  "deliveryNote": "",
  "shippingDate": "",
  "source": "",
  "destination": "",
  "items": [
    {
      "sku": "",
      "product": "",
      "orderedQty": null,
      "orderedUom": "",
      "orderedSize": "",
      "deliveredQty": null,
      "deliveredUom": "",
      "deliveredSize": "",
      "needsReview": false
    }
  ]
}
`;

/* ============================================================
   SCAN IMAGE
   ============================================================ */

async function scanImage(
  arrayBuffer,
  mimeType
) {
  await loadModel();

  if (!arrayBuffer) {
    throw new Error(
      "IMAGE ERROR — No image data was received by the AI worker."
    );
  }

  post("status", {
    stage: "scan",
    message:
      "Local AI is reading the delivery note…",
  });

  /*
   * CREATE IMAGE
   */
  let image;

  try {
    const blob =
      new Blob(
        [arrayBuffer],
        {
          type:
            mimeType ||
            "image/jpeg",
        }
      );

    image =
      await RawImage.fromBlob(
        blob
      );
  } catch (error) {
    stageError(
      "IMAGE DECODING",
      error
    );
  }

  /*
   * CHAT INPUT
   */
  const messages = [
    {
      role: "user",

      content: [
        {
          type: "image",
        },

        {
          type: "text",
          text:
            EXTRACTION_PROMPT,
        },
      ],
    },
  ];

  /*
   * CHAT TEMPLATE
   */
  let text;

  try {
    text =
      processor.apply_chat_template(
        messages,
        {
          add_generation_prompt:
            true,
        }
      );
  } catch (error) {
    stageError(
      "CHAT TEMPLATE",
      error
    );
  }

  /*
   * PROCESS IMAGE + TEXT
   */
  let inputs;

  try {
    inputs =
      await processor(
        text,
        [image],
        {
          do_image_splitting:
            true,
        }
      );
  } catch (error) {
    stageError(
      "IMAGE PROCESSING",
      error
    );
  }

  let outputText = "";

  const started =
    performance.now();

  /*
   * STREAM GENERATED TEXT
   */
  const streamer =
    new TextStreamer(
      processor.tokenizer,
      {
        skip_prompt:
          true,

        skip_special_tokens:
          true,

        callback_function:
          (chunk) => {
            outputText +=
              chunk;

            post(
              "stream",
              {
                chunk,
                text:
                  outputText,
              }
            );
          },
      }
    );

  /*
   * GENERATE
   */
  try {
    await model.generate({
      ...inputs,

      max_new_tokens:
        1100,

      do_sample:
        false,

      streamer,
    });
  } catch (error) {
    stageError(
      "AI GENERATION",
      error
    );
  }

  const elapsedMs =
    Math.round(
      performance.now() -
        started
    );

  post("result", {
    text:
      outputText.trim(),

    elapsedMs,
  });
}

/* ============================================================
   WORKER MESSAGES
   ============================================================ */

self.onmessage =
  async (event) => {
    const msg =
      event.data || {};

    try {
      /*
       * LOAD MODEL
       */
      if (
        msg.type ===
        "load"
      ) {
        await loadModel();

        return;
      }

      /*
       * SCAN
       */
      if (
        msg.type ===
        "scan"
      ) {
        await scanImage(
          msg.arrayBuffer,
          msg.mimeType
        );

        return;
      }

      throw new Error(
        `Unknown worker command: ${String(
          msg.type
        )}`
      );
    } catch (error) {
      console.error(
        "[DAM LOCAL AI ERROR]",
        error
      );

      post("error", {
        message:
          errorMessage(
            error
          ),

        stack:
          error?.stack ||
          "",
      });
    }
  };
