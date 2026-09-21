import {
  pipeline,
} from "@huggingface/transformers";


/* ============================================================
   DNVISION CONFIG
============================================================ */

const DNVISION_MODEL =
  "Xenova/donut-base-finetuned-docvqa";


/* ============================================================
   ENGINE CACHE

   Once loaded, keep the model in memory so we do not
   create a new pipeline for every scan.
============================================================ */

let dnVisionPipeline = null;

let loadingPromise = null;


/* ============================================================
   LOAD DNVISION ENGINE
============================================================ */

export async function loadDNVisionEngine(
  onProgress
) {

  if (dnVisionPipeline) {

    onProgress?.({
      stage: "ready",
      progress: 100,
      message:
        "DNVision engine ready",
    });

    return dnVisionPipeline;
  }


  if (loadingPromise) {
    return loadingPromise;
  }


  onProgress?.({
    stage: "starting",
    progress: 0,
    message:
      "Starting DNVision engine...",
  });


  loadingPromise =
    pipeline(
      "document-question-answering",

      DNVISION_MODEL,

      {
        progress_callback:
          (info) => {

            console.log(
              "DNVision model loading:",
              info
            );


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


            onProgress?.({
              stage:
                "model",

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
                  : "Loading DNVision AI model...",
            });
          },
      }
    );


  try {

    dnVisionPipeline =
      await loadingPromise;


    onProgress?.({
      stage: "ready",
      progress: 100,
      message:
        "DNVision engine ready",
    });


    return dnVisionPipeline;

  } catch (error) {

    console.error(
      "DNVision MODEL LOAD ERROR:",
      error
    );


    dnVisionPipeline =
      null;

    loadingPromise =
      null;


    /*
      IMPORTANT:
      Keep the actual error message.

      This means if anything fails again,
      the scanner will show us the REAL
      reason instead of only saying
      "model could not be loaded".
    */

    const realMessage =
      error?.message ||
      String(error) ||
      "Unknown model loading error";


    throw new Error(
      `DNVision model load failed: ${realMessage}`
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
      "DNVision question is empty."
    );
  }


  try {

    onProgress?.({
      stage: "loading",
      progress: null,
      message:
        "Loading DNVision...",
    });


    const pipe =
      await loadDNVisionEngine(
        onProgress
      );


    onProgress?.({
      stage: "image",
      progress: null,
      message:
        "Preparing document for AI...",
    });


    /*
      Create a temporary browser URL
      from the processed delivery-note
      image.

      The Transformers.js document QA
      pipeline can read this image URL.
    */

    const imageURL =
      URL.createObjectURL(
        preparedBlob
      );


    try {

      onProgress?.({
        stage: "inference",
        progress: null,
        message:
          "DNVision is reading the delivery note...",
      });


      const cleanQuestion =
        String(question)
          .replace(
            /[<>]/g,
            ""
          )
          .trim();


      console.log(
        "DNVision question:",
        cleanQuestion
      );


      const output =
        await pipe(
          imageURL,
          cleanQuestion
        );


      console.log(
        "DNVision raw output:",
        output
      );


      const answer =
        extractAnswer(
          output
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
          output,
      };

    } finally {

      URL.revokeObjectURL(
        imageURL
      );
    }

  } catch (error) {

    console.error(
      "DNVision AI ERROR:",
      error
    );


    const realMessage =
      error?.message ||
      String(error) ||
      "Unknown DNVision error";


    throw new Error(
      `DNVision failed: ${realMessage}`
    );
  }
}


/* ============================================================
   EXTRACT ANSWER
============================================================ */

function extractAnswer(
  output
) {

  if (!output) {
    return "";
  }


  /*
    Normal Transformers.js output:

    [
      {
        answer: "CKWH/INT/46389"
      }
    ]
  */

  if (
    Array.isArray(output) &&
    output.length > 0
  ) {

    const first =
      output[0];


    if (
      typeof first?.answer ===
      "string"
    ) {

      return first.answer.trim();
    }
  }


  /*
    Fallback in case a future version
    returns an object instead.
  */

  if (
    typeof output?.answer ===
    "string"
  ) {

    return output.answer.trim();
  }


  return "";
}


/* ============================================================
   ENGINE STATUS
============================================================ */

export function isDNVisionReady() {

  return Boolean(
    dnVisionPipeline
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

    task:
      "document-question-answering",
  };
}
