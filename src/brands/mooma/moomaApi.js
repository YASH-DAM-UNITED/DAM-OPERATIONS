export async function moomaFetch(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`MOOMA API returned ${response.status}.`);
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || `MOOMA API error ${response.status}.`);
  }
  return data;
}

export function activeScroll(ref, block = "center", delay = 100) {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      ref?.current?.scrollIntoView({ behavior: "smooth", block });
    }, delay);
  });
}
