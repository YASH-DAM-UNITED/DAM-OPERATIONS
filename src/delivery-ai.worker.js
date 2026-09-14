import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";

const MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct";

let processor = null;
let model = null;
let loadingPromise = null;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function progressToPercent(info) {
  if (typeof info?.progress === "number") return Math.max(0, Math.min(100, Math.round(info.progress)));
  if (typeof info?.loaded === "number" && typeof info?.total === "number" && info.total > 0) {
    return Math.max(0, Math.min(100, Math.round((info.loaded / info.total) * 100)));
  }
  return null;
}

async function ensureWebGPU() {
  if (!self.navigator?.gpu) throw new Error("WebGPU is not available on this browser/device.");
  const adapter = await self.navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter is available on this device.");
  return adapter;
}

async function loadModel() {
  if (model && processor) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await ensureWebGPU();
    post("status", { stage: "model", message: "Preparing local AI model…" });

    processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: (info) => {
        const percent = progressToPercent(info);
        post("model-progress", {
          percent,
          file: info?.file || "",
          status: info?.status || "",
        });
      },
    });

    model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
      device: "webgpu",
      dtype: {
        embed_tokens: "fp16",
        vision_encoder: "q4",
        decoder_model_merged: "q4",
      },
      progress_callback: (info) => {
        const percent = progressToPercent(info);
        post("model-progress", {
          percent,
          file: info?.file || "",
          status: info?.status || "",
        });
      },
    });

    post("model-ready", { modelId: MODEL_ID });
  })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

const EXTRACTION_PROMPT = `
You are a strict document extraction engine for DAM delivery notes.
Read the attached delivery note image carefully and return ONLY valid JSON. No markdown, no explanation.

Rules:
1. Read every visible physical product row. Do not silently omit a row.
2. SKU is the code inside square brackets, for example [CB134] or [S046]. Return it without brackets.
3. Product name: keep English text only. Ignore Arabic characters/text. If a spaced dash " - " appears after the English product name, stop there.
4. ORDERED and DELIVERED each contain quantity, UOM, and sometimes size.
5. Examples: "1.00 Bottle 500 ml" => qty 1, uom "BOTTLE", size "500 ML". "6.00 Pcs" => qty 6, uom "PCS", size "". "6.00 Gallon 4.5L" => qty 6, uom "GALLON", size "4.5 L".
6. Preserve uncertain rows and set needsReview=true rather than deleting them.
7. Do not invent values that are not visible. Use empty string for unreadable text and null for unreadable quantities.
8. The top fields are deliveryNote, shippingDate, source, destination.

Return exactly this JSON shape:
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

async function scanImage(arrayBuffer, mimeType) {
  await loadModel();

  post("status", { stage: "scan", message: "Local AI is reading the delivery note…" });

  const blob = new Blob([arrayBuffer], { type: mimeType || "image/jpeg" });
  const image = await RawImage.fromBlob(blob);

  const messages = [
    {
      role: "user",
      content: [
        { type: "image" },
        { type: "text", text: EXTRACTION_PROMPT },
      ],
    },
  ];

  const text = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });

  const inputs = await processor(text, [image], {
    do_image_splitting: true,
  });

  let outputText = "";
  const started = performance.now();

  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      outputText += chunk;
      post("stream", { chunk, text: outputText });
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: 1100,
    do_sample: false,
    streamer,
  });

  const elapsedMs = Math.round(performance.now() - started);
  post("result", { text: outputText.trim(), elapsedMs });
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "load") {
      await loadModel();
      return;
    }
    if (msg.type === "scan") {
      await scanImage(msg.arrayBuffer, msg.mimeType);
      return;
    }
  } catch (error) {
    post("error", {
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
  }
};
