import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
  env,
} from "@huggingface/transformers";


/* ============================================================
   DNVISION WEBGPU WORKER
============================================================ */

const MODEL_ID =
  "HuggingFaceTB/SmolVLM-256M-Instruct";


/*
  IMPORTANT

  Transformers.js normally downloads from:

  https://huggingface.co/...

  We instead route model downloads through:

  /api/dnvision-model/...

  This avoids the browser-side Hugging Face
  fetch/CORS problem we identified.
*/

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;


/*
  remoteHost must be an absolute URL because this
  code runs inside a Web Worker.

  self.location.origin is our DAM Operations domain.
*/

env.remoteHost =
  `${self.location.origin}/api/dnvision-model/`;


/*
  Our Cloudflare route already represents:

  HuggingFaceTB/SmolVLM-256M-Instruct/resolve/main/

  Therefore Transformers.js should NOT append
  the normal Hugging Face model path again.
*/

env.remotePathTemplate =
  "";


let processor = null;
let model = null;
let loadingPromise = null;


/* ============================================================
   SEND MESSAGE
============================================================ */

function send(
  type,
  data = {}
) {
  self.postMessage({
    type,
    ...data,
  });
}


/* ============================================================
   PROGRESS
============================================================ */

function progressCallback(
  info
) {
  console.log(
    "DNVision Worker Model:",
    info
  );


  let progress = null;


  if (
    typeof info?.progress ===
    "number"
  ) {
    progress =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            info.progress
          )
        )
      );
  }


  send(
    "progress",
    {
      stage:
        "model-download",

      progress,

      file:
        info?.file || "",

      status:
        info?.status || "",

      message:
        progress !== null
          ? `Loading DNVision ${progress}%`
          : "Loading DNVision model...",
    }
  );
}


/* ============================================================
   LOAD MODEL
============================================================ */

async function loadModel() {

  if (
    processor &&
    model
  ) {
    return {
      processor,
      model,
    };
  }


  if (loadingPromise) {
    return loadingPromise;
  }


  loadingPromise =
    (async () => {

      try {

        console.log(
          "DNVision remote host:",
          env.remoteHost
        );


        console.log(
          "DNVision remote template:",
          env.remotePathTemplate
        );


        /* ----------------------------------------------------
           PROCESSOR
        ---------------------------------------------------- */

        send(
          "progress",
          {
            stage:
              "processor",

            progress:
              null,

            message:
              "Loading DNVision processor...",
          }
        );


        processor =
          await AutoProcessor.from_pretrained(
            MODEL_ID
          );


        console.log(
          "DNVision processor loaded."
        );


        /* ----------------------------------------------------
           MODEL
        ---------------------------------------------------- */

        send(
          "progress",
          {
            stage:
              "model",

            progress:
              null,

            message:
              "Loading DNVision WebGPU model...",
          }
        );


        model =
          await AutoModelForVision2Seq.from_pretrained(
            MODEL_ID,
            {
              device:
                "webgpu",

              dtype: {
                embed_tokens:
                  "fp16",

                vision_encoder:
                  "q4",

                decoder_model_merged:
                  "q4",
              },

              progress_callback:
                progressCallback,
            }
          );


        console.log(
          "DNVision model loaded."
        );


        send(
          "progress",
          {
            stage:
              "ready",

            progress:
              100,

            message:
              "DNVision model ready",
          }
        );


        return {
          processor,
          model,
        };

      } catch (error) {

        processor = null;
        model = null;
        loadingPromise = null;


        console.error(
          "DNVision Worker Load Error:",
          error
        );


        throw error;
      }
    })();


  return loadingPromise;
}


/* ============================================================
   BLOB → RAW IMAGE
============================================================ */

async function blobToRawImage(
  blob
) {

  if (!blob) {
    throw new Error(
      "No delivery note image received."
    );
  }


  return await RawImage.fromBlob(
    blob
  );
}


/* ============================================================
   RUN VISION
============================================================ */

async function runVision(
  imageBlob,
  instruction
) {

  const engine =
    await loadModel();


  send(
    "progress",
    {
      stage:
        "image",

      progress:
        null,

      message:
        "Preparing delivery note image...",
    }
  );


  const image =
    await blobToRawImage(
      imageBlob
    );


  /* ==========================================================
     CHAT
  ========================================================== */

  const messages = [
    {
      role:
        "user",

      content: [
        {
          type:
            "image",
        },

        {
          type:
            "text",

          text:
            instruction,
        },
      ],
    },
  ];


  send(
    "progress",
    {
      stage:
        "prompt",

      progress:
        null,

      message:
        "Preparing DNVision instruction...",
    }
  );


  const text =
    engine.processor.apply_chat_template(
      messages,
      {
        add_generation_prompt:
          true,
      }
    );


  console.log(
    "DNVision prompt:",
    text
  );


  /* ==========================================================
     PROCESS IMAGE + TEXT
  ========================================================== */

  send(
    "progress",
    {
      stage:
        "processing",

      progress:
        null,

      message:
        "Processing delivery note...",
    }
  );


  const inputs =
    await engine.processor(
      text,
      [image]
    );


  /* ==========================================================
     INFERENCE
  ========================================================== */

  send(
    "progress",
    {
      stage:
        "inference",

      progress:
        null,

      message:
        "DNVision is reading the delivery note...",
    }
  );


  const generatedIds =
    await engine.model.generate({
      ...inputs,

      max_new_tokens:
        700,

      do_sample:
        false,
    });


  /* ==========================================================
     REMOVE INPUT TOKENS
  ========================================================== */

  let outputIds =
    generatedIds;


  try {

    const inputLength =
      inputs.input_ids?.dims?.[
        inputs.input_ids.dims.length -
        1
      ];


    if (
      inputLength &&
      generatedIds?.slice
    ) {

      outputIds =
        generatedIds.slice(
          null,
          [
            inputLength,
            null,
          ]
        );
    }

  } catch (error) {

    console.warn(
      "DNVision output trimming skipped:",
      error
    );
  }


  /* ==========================================================
     DECODE
  ========================================================== */

  send(
    "progress",
    {
      stage:
        "decode",

      progress:
        null,

      message:
        "Decoding DNVision result...",
    }
  );


  const decoded =
    engine.processor.tokenizer.batch_decode(
      outputIds,
      {
        skip_special_tokens:
          true,
      }
    );


  let answer =
    Array.isArray(
      decoded
    )
      ? decoded[0] || ""
      : String(
          decoded || ""
        );


  answer =
    answer.trim();


  /* ==========================================================
     CLEAN OUTPUT
  ========================================================== */

  if (
    instruction &&
    answer.includes(
      instruction
    )
  ) {

    const position =
      answer.lastIndexOf(
        instruction
      );


    answer =
      answer
        .slice(
          position +
          instruction.length
        )
        .trim();
  }


  answer =
    answer
      .replace(
        /^(assistant|assistant:)\s*/i,
        ""
      )
      .replace(
        /^[:\-\s]+/,
        ""
      )
      .trim();


  send(
    "progress",
    {
      stage:
        "complete",

      progress:
        100,

      message:
        "DNVision scan complete",
    }
  );


  return {
    answer,

    raw:
      Array.isArray(
        decoded
      )
        ? decoded
        : [decoded],

    model:
      MODEL_ID,

    device:
      "webgpu",
  };
}


/* ============================================================
   MESSAGE LISTENER
============================================================ */

self.addEventListener(
  "message",

  async (
    event
  ) => {

    const data =
      event.data || {};


    const {
      id,
      type,
    } = data;


    try {

      /* ------------------------------------------------------
         LOAD MODEL
      ------------------------------------------------------ */

      if (
        type ===
        "load"
      ) {

        await loadModel();


        send(
          "loaded",
          {
            id,

            model:
              MODEL_ID,

            device:
              "webgpu",
          }
        );


        return;
      }


      /* ------------------------------------------------------
         INFERENCE
      ------------------------------------------------------ */

      if (
        type ===
        "infer"
      ) {

        const instruction =
          String(
            data.instruction ||
            ""
          ).trim();


        if (!instruction) {
          throw new Error(
            "DNVision instruction is empty."
          );
        }


        if (!data.imageBlob) {
          throw new Error(
            "DNVision image is missing."
          );
        }


        const result =
          await runVision(
            data.imageBlob,
            instruction
          );


        send(
          "result",
          {
            id,
            ...result,
          }
        );


        return;
      }


      throw new Error(
        `Unknown DNVision worker command: ${type}`
      );

    } catch (error) {

      console.error(
        "DNVision Worker Error:",
        error
      );


      send(
        "error",
        {
          id,

          message:
            error?.message ||
            String(
              error ||
              "Unknown DNVision error"
            ),
        }
      );
    }
  }
);


/* ============================================================
   WORKER STARTED
============================================================ */

send(
  "worker-ready",
  {
    message:
      "DNVision WebGPU worker started",
  }
);
