let opencvPromise = null;

export function loadOpenCV() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only load in the browser."));
  }

  if (window.cv?.Mat) {
    return Promise.resolve(window.cv);
  }

  if (opencvPromise) return opencvPromise;

  opencvPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-dam-opencv="true"]');

    const waitForRuntime = () => {
      const started = Date.now();

      const check = () => {
        if (window.cv?.Mat) {
          resolve(window.cv);
          return;
        }

        // Some OpenCV builds expose cv before WASM runtime finishes.
        if (window.cv && typeof window.cv === "object") {
          const previous = window.cv.onRuntimeInitialized;
          window.cv.onRuntimeInitialized = () => {
            try {
              if (typeof previous === "function") previous();
            } catch {
              // ignore
            }
            resolve(window.cv);
          };
        }

        if (Date.now() - started > 30000) {
          reject(
            new Error(
              "OpenCV took too long to initialize. Check your internet/CSP or host opencv.js locally."
            )
          );
          return;
        }

        setTimeout(check, 120);
      };

      check();
    };

    if (existing) {
      waitForRuntime();
      return;
    }

    const script = document.createElement("script");
    script.src = "/opencv.js";
    script.async = true;
    script.defer = true;
    script.dataset.damOpencv = "true";

    script.onload = waitForRuntime;
    script.onerror = () =>
      reject(
        new Error(
          "Could not load OpenCV.js. If your site blocks external scripts, download opencv.js into /public and change the script URL in opencv-loader.js."
        )
      );

    document.head.appendChild(script);
  });

  return opencvPromise;
}
