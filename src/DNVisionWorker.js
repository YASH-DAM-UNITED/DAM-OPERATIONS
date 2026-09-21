import {
  AutoProcessor,
  AutoModelForVision2Seq,
  RawImage,
} from "@huggingface/transformers";


/* ============================================================
   DNVISION WEBGPU WORKER
============================================================ */

const MODEL_ID =
  "HuggingFaceTB/SmolVLM-256M-Instruct";

let processor = null;
let model = null;
let loadingPromise = null;


/* ============================================================
   SEND MESSAGE TO MAIN PAGE
============================================================ */

function send(type, data = {}) {
  self.postMessage({
    type,
    ...data,
  });
}


/* ============================================================
   PROGRESS
============================================================ */

function progressCallback(info) {
  console.log(
    "DNVision Worker Model:",
    info
  );

  let progress = null;

  if (
    typeof info?.progress ===
    "number"
  ) {
    progress = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          info.progress
        )
      )
    );
  }


  send("progress", {
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
  });
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
        send("progress", {
          stage:
            "processor",

          progress: null,

          message:
            "Loading DNVision processor...",
        });


        processor =
          await AutoProcessor.from_pretrained(
            MODEL_ID
          );


        send("progress", {
          stage:
            "model",

          progress: null,

          message:
            "Loading DNVision WebGPU model...",
        });


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


        send("progress", {
          stage:
            "ready",

          progress: 100,

          message:
            "DNVision model ready",
        });


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
   CONVERT BLOB TO RAW IMAGE
============================================================ */

async function blobToRawImage(blob) {
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


  send("progress", {
    stage:
      "image",

    progress: null,

    message:
      "Preparing delivery note image...",
  });


  const image =
    await blobToRawImage(
      imageBlob
    );


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


  /*
    SmolVLM processor creates the
    model-specific image placeholders.
  */

  send("progress", {
    stage:
      "prompt",

    progress: null,

    message:
      "Preparing DNVision instruction...",
  });


  const text =
    engine.processor.apply_chat_template(
      messages,
      {
        add_generation_prompt:
          true,
      }
    );


  console.log(
    "DNVision Worker Prompt:",
    text
  );


  /*
    Process BOTH image and prompt.
  */

  send("progress", {
    stage:
      "processing",

    progress: null,

    message:
      "Processing delivery note...",
  });


  const inputs =
    await engine.processor(
      text,
      [image]
    );


  /*
    Generate response.
  */

  send("progress", {
    stage:
      "inference",

    progress: null,

    message:
      "DNVision is reading the delivery note...",
  });


  const generatedIds =
    await engine.model.generate({
      ...inputs,

      max_new_tokens:
        80,

      do_sample:
        false,
    });


  /*
    We only want newly-generated tokens.

    The input IDs are normally included
    at the beginning of generate().
  */

  let outputIds =
    generatedIds;


  try {
    const inputLength =
      inputs.input_ids?.dims?.[
        inputs.input_ids.dims.length - 1
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


  send("progress", {
    stage:
      "decode",

    progress: null,

    message:
      "Decoding DNVision result...",
  });


  let decoded =
    engine.processor.tokenizer.batch_decode(
      outputIds,
      {
        skip_special_tokens:
          true,
      }
    );


  let answer =
    Array.isArray(decoded)
      ? decoded[0] || ""
      : String(
          decoded || ""
        );


  answer =
    answer.trim();


  /*
    Fallback:
    if token trimming was unavailable,
    clean common prompt text.
  */

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


  send("progress", {
    stage:
      "complete",

    progress: 100,

    message:
      "DNVision scan complete",
  });


  return {
    answer,

    raw:
      Array.isArray(decoded)
        ? decoded
        : [decoded],

    model:
      MODEL_ID,

    device:
      "webgpu",
  };
}


/* ============================================================
   WORKER MESSAGE LISTENER
============================================================ */

self.addEventListener(
  "message",

  async (event) => {
    const data =
      event.data || {};


    const {
      id,
      type,
    } = data;


    try {

      /* ------------------------------------------------------
         MODEL TEST / PRELOAD
      ------------------------------------------------------ */

      if (
        type ===
        "load"
      ) {
        await loadModel();


        send("loaded", {
          id,

          model:
            MODEL_ID,

          device:
            "webgpu",
        });


        return;
      }


      /* ------------------------------------------------------
         RUN IMAGE INFERENCE
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


        send("result", {
          id,

          ...result,
        });


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


      send("error", {
        id,

        message:
          error?.message ||
          String(
            error ||
              "Unknown DNVision error"
          ),
      });
    }
  }
);


/* ============================================================
   WORKER STARTED
============================================================ */

send("worker-ready", {
  message:
    "DNVision WebGPU worker started",
});
