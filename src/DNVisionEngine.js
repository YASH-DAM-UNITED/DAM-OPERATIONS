import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForVision2Seq,
  RawImage,
  env,
} from "@huggingface/transformers";


/* ============================================================
   DNVISION CONFIG
============================================================ */

const DNVISION_MODEL =
  "HuggingFaceTB/SmolVLM-256M-Instruct";

const DNVISION_DEVICE =
  "webgpu";


/* ============================================================
   TRANSFORMERS.JS ENVIRONMENT
============================================================ */

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;


/* ============================================================
   ENGINE CACHE
============================================================ */

let processor = null;
let tokenizer = null;
let model = null;

let loadingPromise = null;


/* ============================================================
   LOAD DNVISION ENGINE
============================================================ */

export async function loadDNVisionEngine(
  onProgress
) {
  if (
    processor &&
    tokenizer &&
    model
  ) {
    onProgress?.({
      stage: "ready",
      progress: 100,
      message: "DNVision AI ready",
    });

    return {
      processor,
      tokenizer,
      model,
    };
  }


  if (loadingPromise) {
    return loadingPromise;
  }


  loadingPromise =
    loadDNVisionModel(
      onProgress
    );


  try {
    const engine =
      await loadingPromise;

    return engine;

  } catch (error) {
    processor = null;
    tokenizer = null;
    model = null;

    loadingPromise = null;

    throw error;
  }
}


/* ============================================================
   ACTUAL MODEL LOADING
============================================================ */

async function loadDNVisionModel(
  onProgress
) {
  try {

    /* --------------------------------------------------------
       START
    -------------------------------------------------------- */

    onProgress?.({
      stage: "starting",
      progress: 0,
      message:
        "Starting DNVision WebGPU...",
    });


    /* --------------------------------------------------------
       PROCESSOR
    -------------------------------------------------------- */

    onProgress?.({
      stage: "processor",
      progress: null,
      message:
        "Loading DNVision image processor...",
    });


    processor =
      await AutoProcessor.from_pretrained(
        DNVISION_MODEL,
        {
          progress_callback:
            createProgressHandler(
              onProgress,
              "processor"
            ),
        }
      );


    /* --------------------------------------------------------
       TOKENIZER
    -------------------------------------------------------- */

    onProgress?.({
      stage: "tokenizer",
      progress: null,
      message:
        "Loading DNVision tokenizer...",
    });


    tokenizer =
      await AutoTokenizer.from_pretrained(
        DNVISION_MODEL,
        {
          progress_callback:
            createProgressHandler(
              onProgress,
              "tokenizer"
            ),
        }
      );


    /* --------------------------------------------------------
       VISION MODEL

       IMPORTANT:
       Do NOT use:

           dtype: "q4"

       for the whole multimodal model.

       SmolVLM contains separate components.
    -------------------------------------------------------- */

    onProgress?.({
      stage: "model",
      progress: null,
      message:
        "Loading DNVision WebGPU vision model...",
    });


    model =
      await AutoModelForVision2Seq.from_pretrained(
        DNVISION_MODEL,
        {
          device:
            DNVISION_DEVICE,

          dtype: {
            embed_tokens:
              "fp16",

            vision_encoder:
              "q4",

            decoder_model_merged:
              "q4",
          },

          progress_callback:
            createProgressHandler(
              onProgress,
              "model"
            ),
        }
      );


    /* --------------------------------------------------------
       READY
    -------------------------------------------------------- */

    onProgress?.({
      stage: "ready",
      progress: 100,
      message:
        "DNVision WebGPU model ready",
    });


    console.log(
      "DNVision ENGINE READY"
    );


    return {
      processor,
      tokenizer,
      model,
    };

  } catch (error) {

    console.error(
      "DNVision MODEL LOAD ERROR:",
      error
    );


    processor = null;
    tokenizer = null;
    model = null;


    const message =
      getErrorMessage(
        error
      );


    throw new Error(
      `DNVision model load failed: ${message}`
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


  if (!question?.trim()) {
    throw new Error(
      "DNVision instruction is empty."
    );
  }


  try {

    /* --------------------------------------------------------
       LOAD ENGINE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "loading",
      progress: null,
      message:
        "Loading DNVision...",
    });


    const engine =
      await loadDNVisionEngine(
        onProgress
      );


    /* --------------------------------------------------------
       IMAGE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "image",
      progress: null,
      message:
        "Loading delivery note image...",
    });


    const image =
      await RawImage.fromBlob(
        preparedBlob
      );


    /* --------------------------------------------------------
       CLEAN QUESTION
    -------------------------------------------------------- */

    const cleanQuestion =
      String(question)
        .replace(
          /[<>]/g,
          ""
        )
        .trim();


    /* --------------------------------------------------------
       CHAT MESSAGE
    -------------------------------------------------------- */

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
              cleanQuestion,
          },
        ],
      },
    ];


    /* --------------------------------------------------------
       CHAT TEMPLATE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "prompt",
      progress: null,
      message:
        "Preparing DNVision instruction...",
    });


    const prompt =
      engine.processor
        .apply_chat_template
      ? engine.processor
          .apply_chat_template(
            messages,
            {
              add_generation_prompt:
                true,
            }
          )
      : engine.tokenizer
          .apply_chat_template(
            messages,
            {
              tokenize:
                false,

              add_generation_prompt:
                true,
            }
          );


    console.log(
      "DNVision PROMPT:",
      prompt
    );


    /* --------------------------------------------------------
       PROCESS IMAGE + TEXT
    -------------------------------------------------------- */

    onProgress?.({
      stage: "processing",
      progress: null,
      message:
        "Preparing delivery note for AI...",
    });


    let inputs;


    /*
      Newer multimodal processors can
      receive both the image and text.
    */

    try {

      inputs =
        await engine.processor(
          prompt,
          [image]
        );

    } catch (firstError) {

      console.warn(
        "DNVision combined processor fallback:",
        firstError
      );


      /*
        Compatibility fallback for
        Transformers.js builds where
        processor() only handles images.
      */

      const imageInputs =
        await engine.processor(
          image
        );


      const textInputs =
        engine.tokenizer(
          prompt,
          {
            add_special_tokens:
              false,
          }
        );


      inputs = {
        ...textInputs,
        ...imageInputs,
      };
    }


    /* --------------------------------------------------------
       INFERENCE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "inference",
      progress: null,
      message:
        "DNVision is reading the delivery note...",
    });


    console.log(
      "DNVision GENERATION START"
    );


    const generatedIds =
      await engine.model.generate({
        ...inputs,

        max_new_tokens:
          80,

        do_sample:
          false,
      });


    console.log(
      "DNVision GENERATION COMPLETE"
    );


    /* --------------------------------------------------------
       DECODE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "decode",
      progress: null,
      message:
        "Reading DNVision result...",
    });


    const decoded =
      engine.tokenizer
        .batch_decode(
          generatedIds,
          {
            skip_special_tokens:
              true,
          }
        );


    console.log(
      "DNVision RAW OUTPUT:",
      decoded
    );


    const fullText =
      Array.isArray(decoded)
        ? decoded[0] || ""
        : String(
            decoded || ""
          );


    const answer =
      extractAssistantAnswer(
        fullText,
        cleanQuestion
      );


    console.log(
      "DNVision FINAL ANSWER:",
      answer
    );


    /* --------------------------------------------------------
       COMPLETE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "complete",
      progress: 100,
      message:
        "DNVision scan complete",
    });


    return {
      question:
        cleanQuestion,

      answer,

      raw:
        fullText,

      model:
        DNVISION_MODEL,

      device:
        DNVISION_DEVICE,
    };

  } catch (error) {

    console.error(
      "DNVision AI ERROR:",
      error
    );


    const message =
      getErrorMessage(
        error
      );


    throw new Error(
      `DNVision failed: ${message}`
    );
  }
}


/* ============================================================
   CLEAN MODEL RESPONSE
============================================================ */

function extractAssistantAnswer(
  text,
  question
) {
  let result =
    String(
      text || ""
    ).trim();


  if (!result) {
    return "";
  }


  /*
    Some generated outputs include
    the original prompt.

    Remove the question portion.
  */

  if (
    question &&
    result.includes(
      question
    )
  ) {
    const position =
      result.lastIndexOf(
        question
      );


    result =
      result
        .slice(
          position +
            question.length
        )
        .trim();
  }


  /*
    Remove common assistant labels.
  */

  result =
    result.replace(
      /^(assistant|assistant:)\s*/i,
      ""
    );


  result =
    result.replace(
      /^[:\-\s]+/,
      ""
    );


  return result.trim();
}


/* ============================================================
   DOWNLOAD PROGRESS
============================================================ */

function createProgressHandler(
  callback,
  stage
) {
  return (info) => {

    console.log(
      "DNVision MODEL FILE:",
      info
    );


    if (!callback) {
      return;
    }


    let progress =
      null;


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


    let message =
      `Loading DNVision ${stage}...`;


    if (
      progress !== null
    ) {
      message =
        `Loading DNVision ${progress}%`;
    }


    if (
      info?.file &&
      progress === null
    ) {
      message =
        `Loading ${getShortFileName(
          info.file
        )}...`;
    }


    callback({
      stage,

      progress,

      file:
        info?.file ||
        "",

      status:
        info?.status ||
        "",

      message,
    });
  };
}


/* ============================================================
   SHORT FILE NAME
============================================================ */

function getShortFileName(
  file
) {
  if (!file) {
    return "model";
  }


  const parts =
    String(file)
      .split("/");


  return (
    parts[
      parts.length - 1
    ] ||
    "model"
  );
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


  try {
    return JSON.stringify(
      error
    );
  } catch {
    return String(
      error ||
        "Unknown error"
    );
  }
}


/* ============================================================
   READY STATUS
============================================================ */

export function isDNVisionReady() {
  return Boolean(
    processor &&
    tokenizer &&
    model
  );
}


/* ============================================================
   MODEL INFORMATION
============================================================ */

export function getDNVisionModelInfo() {
  return {
    id:
      DNVISION_MODEL,

    device:
      DNVISION_DEVICE,

    dtype: {
      embed_tokens:
        "fp16",

      vision_encoder:
        "q4",

      decoder_model_merged:
        "q4",
    },

    loaded:
      isDNVisionReady(),
  };
}
