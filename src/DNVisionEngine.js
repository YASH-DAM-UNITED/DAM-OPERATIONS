import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForVision2Seq,
  RawImage,
} from "@huggingface/transformers";


/* ============================================================
   DNVISION MODEL CONFIG
============================================================ */

const DNVISION_MODEL =
  "Xenova/donut-base-finetuned-docvqa";


/* ============================================================
   MODEL CACHE

   These stay in memory after the first load so we do not
   reload the model every time the staff scans a document.
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
    loadModelFiles(onProgress);

  try {
    const result =
      await loadingPromise;

    return result;
  } catch (error) {
    loadingPromise = null;

    throw error;
  }
}


/* ============================================================
   INTERNAL MODEL LOADER
============================================================ */

async function loadModelFiles(
  onProgress
) {
  try {
    onProgress?.({
      stage: "starting",
      message:
        "Starting DNVision engine...",
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


    onProgress?.({
      stage: "tokenizer",
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


    onProgress?.({
      stage: "model",
      message:
        "Loading DNVision AI model...",
    });


    model =
      await AutoModelForVision2Seq.from_pretrained(
        DNVISION_MODEL,
        {
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
        "DNVision engine ready",
    });


    return {
      processor,
      tokenizer,
      model,
    };
  } catch (error) {
    processor = null;
    tokenizer = null;
    model = null;

    console.error(
      "DNVision model loading error:",
      error
    );

    throw new Error(
      "DNVision AI model could not be loaded."
    );
  }
}


/* ============================================================
   ASK DOCUMENT QUESTION

   preparedBlob comes from DNVisionImagePrep.js
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
      "DNVision question is empty."
    );
  }


  onProgress?.({
    stage: "loading",
    message:
      "Loading DNVision...",
  });


  const engine =
    await loadDNVisionEngine(
      onProgress
    );


  onProgress?.({
    stage: "image",
    message:
      "Reading delivery note image...",
  });


  /*
    Transformers.js can create a RawImage
    directly from the Blob produced by our
    DNVisionImagePrep.js file.
  */

  const image =
    await RawImage.fromBlob(
      preparedBlob
    );


  const imageInputs =
    await engine.processor(
      image
    );


  /* ==========================================================
     DONUT DOCUMENT QUESTION
  ========================================================== */

  const cleanQuestion =
    String(question)
      .replace(/[<>]/g, "")
      .trim();


  const taskPrompt =
    `<s_docvqa><s_question>${cleanQuestion}</s_question><s_answer>`;


  const decoderInput =
    engine.tokenizer(
      taskPrompt,
      {
        add_special_tokens:
          false,
      }
    );


  onProgress?.({
    stage: "inference",
    message:
      "DNVision is analyzing the document...",
  });


  const output =
    await engine.model.generate(
      imageInputs.pixel_values,
      {
        decoder_input_ids:
          decoderInput.input_ids,

        max_length:
          engine.model.config
            ?.decoder
            ?.max_position_embeddings ||
          512,
      }
    );


  const decoded =
    engine.tokenizer.batch_decode(
      output,
      {
        skip_special_tokens:
          false,
      }
    )[0];


  const answer =
    extractDNVisionAnswer(
      decoded
    );


  onProgress?.({
    stage: "complete",
    progress: 100,
    message:
      "DNVision analysis complete",
  });


  return {
    question:
      cleanQuestion,

    answer,

    raw:
      decoded,
  };
}


/* ============================================================
   EXTRACT ANSWER FROM DONUT OUTPUT
============================================================ */

function extractDNVisionAnswer(
  text
) {
  if (!text) {
    return "";
  }


  const answerMatch =
    text.match(
      /<s_answer>(.*?)<\/s_answer>/s
    );


  if (answerMatch?.[1]) {
    return cleanDNVisionText(
      answerMatch[1]
    );
  }


  let cleaned =
    String(text);


  cleaned =
    cleaned.replace(
      /<s_docvqa>/g,
      ""
    );


  cleaned =
    cleaned.replace(
      /<s_question>.*?<\/s_question>/gs,
      ""
    );


  cleaned =
    cleaned.replace(
      /<s_answer>/g,
      ""
    );


  cleaned =
    cleaned.replace(
      /<\/s_answer>/g,
      ""
    );


  cleaned =
    cleaned.replace(
      /<\/s>/g,
      ""
    );


  return cleanDNVisionText(
    cleaned
  );
}


/* ============================================================
   CLEAN MODEL TEXT
============================================================ */

function cleanDNVisionText(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* ============================================================
   DOWNLOAD PROGRESS HANDLER
============================================================ */

function createProgressHandler(
  callback,
  stage
) {
  return (info) => {
    if (!callback) {
      return;
    }


    let progress = null;


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
          : "Loading DNVision...",
    });
  };
}


/* ============================================================
   ENGINE STATUS
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

    loaded:
      isDNVisionReady(),
  };
}
