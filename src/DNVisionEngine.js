import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForVision2Seq,
  RawImage,
  env,
} from "@huggingface/transformers";





/* ============================================================
   DNVISION NETWORK DIAGNOSTICS
============================================================ */

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;

const originalFetch = globalThis.fetch.bind(globalThis);

env.fetch = async (url, options) => {
  console.log(
    "DNVision FETCH:",
    String(url)
  );

  try {
    const response = await originalFetch(
      url,
      options
    );

    console.log(
      "DNVision FETCH RESULT:",
      response.status,
      response.statusText,
      String(url)
    );

    return response;
  } catch (error) {
    console.error(
      "DNVision FETCH FAILED:",
      String(url),
      error
    );

    throw new Error(
      `Network fetch failed for: ${String(url)}`
    );
  }
};


/* ============================================================
   DNVISION CONFIG
============================================================ */

const DNVISION_MODEL =
  "HuggingFaceTB/SmolVLM-256M-Instruct";

const DNVISION_DEVICE =
  "webgpu";


/* ============================================================
   ENGINE CACHE
============================================================ */

let processor = null;
let tokenizer = null;
let model = null;

let loadingPromise = null;


/* ============================================================
   LOAD ENGINE
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
      message:
        "DNVision AI ready",
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
    return await loadingPromise;
  } catch (error) {
    processor = null;
    tokenizer = null;
    model = null;

    loadingPromise = null;

    throw error;
  }
}


/* ============================================================
   LOAD MODEL FILES
============================================================ */

async function loadDNVisionModel(
  onProgress
) {
  try {
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
        "Loading DNVision processor...",
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
       MODEL
    -------------------------------------------------------- */

    onProgress?.({
      stage: "model",
      progress: null,
      message:
        "Loading DNVision vision model...",
    });


    model =
      await AutoModelForVision2Seq.from_pretrained(
        DNVISION_MODEL,
        {
          device:
            DNVISION_DEVICE,

          /*
            Use quantized weights where
            available to reduce memory
            and download requirements.
          */

          dtype:
            "q4",

          progress_callback:
            createProgressHandler(
              onProgress,
              "model"
            ),
        }
      );


    onProgress?.({
      stage: "ready",
      progress: 100,
      message:
        "DNVision WebGPU model ready",
    });


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
       LOAD IMAGE
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
       BUILD PROMPT
    -------------------------------------------------------- */

    const cleanQuestion =
      String(question)
        .replace(
          /[<>]/g,
          ""
        )
        .trim();


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


    let prompt;


    /*
      SmolVLM uses a chat template.

      Use the tokenizer template when
      available.
    */

    if (
      typeof engine.tokenizer
        .apply_chat_template ===
      "function"
    ) {
      prompt =
        engine.tokenizer
          .apply_chat_template(
            messages,
            {
              tokenize: false,

              add_generation_prompt:
                true,
            }
          );
    } else {
      /*
        Safety fallback.
      */

      prompt =
        `<|im_start|>User:<image>${cleanQuestion}<end_of_utterance>\nAssistant:`;
    }


    console.log(
      "DNVision prompt:",
      prompt
    );


    /* --------------------------------------------------------
       PROCESS IMAGE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "processing",
      progress: null,
      message:
        "Preparing image for DNVision...",
    });


    const imageInputs =
      await engine.processor(
        image
      );


    /* --------------------------------------------------------
       TOKENIZE PROMPT
    -------------------------------------------------------- */

    const textInputs =
      engine.tokenizer(
        prompt,
        {
          add_special_tokens:
            false,
        }
      );


    /* --------------------------------------------------------
       GENERATE
    -------------------------------------------------------- */

    onProgress?.({
      stage: "inference",
      progress: null,
      message:
        "DNVision is reading the delivery note...",
    });


    const generatedIds =
      await engine.model.generate({
        ...textInputs,
        ...imageInputs,

        max_new_tokens:
          100,

        do_sample:
          false,
      });


    /* --------------------------------------------------------
       DECODE
    -------------------------------------------------------- */

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
      "DNVision decoded:",
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
      "DNVision answer:",
      answer
    );


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
   EXTRACT ASSISTANT RESPONSE
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
    Remove the original question if the
    decoded output contains the prompt.
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
    Remove common assistant prefixes.
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
      "DNVision download:",
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
        Math.round(
          info.progress
        );
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

      message:
        progress !== null
          ? `Loading DNVision ${progress}%`
          : `Loading DNVision ${stage}...`,
    });
  };
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
   STATUS
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

    dtype:
      "q4",

    loaded:
      isDNVisionReady(),
  };
}
