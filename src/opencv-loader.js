let opencvPromise = null;

export function loadOpenCV() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("OpenCV can only run inside the browser.")
    );
  }

  if (opencvPromise) return opencvPromise;

  opencvPromise = new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "OpenCV failed to initialize within 30 seconds."
        )
      );
    }, 30000);

    const finish = async () => {
      try {
        let cv = window.cv;

        // IMPORTANT:
        // Newer OpenCV.js builds may expose cv as a Promise.
        if (cv && typeof cv.then === "function") {
          cv = await cv;
          window.cv = cv;
        }

        if (cv?.Mat && cv?.imread) {
          clearTimeout(timeout);
          console.log("✅ OpenCV READY");
          resolve(cv);
          return true;
        }

        return false;
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
        return false;
      }
    };

    // OpenCV already loaded from an earlier visit
    if (await finish()) return;

    let script = document.querySelector(
      'script[data-dam-opencv="true"]'
    );

    if (!script) {
      script = document.createElement("script");

      // Your own Cloudflare-hosted copy
      script.src = "/opencv.js";

      script.async = true;
      script.defer = true;
      script.dataset.damOpencv = "true";

      document.head.appendChild(script);
    }

    script.onerror = () => {
      clearTimeout(timeout);
      reject(
        new Error(
          "opencv.js could not be downloaded from /opencv.js"
        )
      );
    };

    script.onload = async () => {
      console.log("✅ opencv.js file downloaded");

      if (await finish()) return;

      // Some builds need a little time after script.onload
      const started = Date.now();

      const checkRuntime = async () => {
        if (await finish()) return;

        if (Date.now() - started > 25000) {
          clearTimeout(timeout);

          reject(
            new Error(
              "opencv.js downloaded, but the OpenCV runtime did not initialize."
            )
          );

          return;
        }

        setTimeout(checkRuntime, 150);
      };

      checkRuntime();
    };
  });

  return opencvPromise;
}
