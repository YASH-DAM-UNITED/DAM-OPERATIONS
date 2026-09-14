export function stripCodeFence(text = "") {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export function extractJson(text = "") {
  const clean = stripCodeFence(text);
  try {
    return JSON.parse(clean);
  } catch (_) {}

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(clean.slice(start, end + 1));
  }
  throw new Error("The local model finished, but did not return valid JSON.");
}

export function normalizeQty(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

export function normalizeResult(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  return {
    deliveryNote: String(source.deliveryNote || "").trim(),
    shippingDate: String(source.shippingDate || "").trim(),
    source: String(source.source || "").trim(),
    destination: String(source.destination || "").trim(),
    items: rawItems.map((item, index) => ({
      id: `${Date.now()}-${index}`,
      sku: String(item?.sku || "").replace(/[\[\]]/g, "").trim().toUpperCase(),
      product: String(item?.product || "").trim(),
      orderedQty: normalizeQty(item?.orderedQty),
      orderedUom: String(item?.orderedUom || "").trim().toUpperCase(),
      orderedSize: String(item?.orderedSize || "").trim().toUpperCase(),
      deliveredQty: normalizeQty(item?.deliveredQty),
      deliveredUom: String(item?.deliveredUom || "").trim().toUpperCase(),
      deliveredSize: String(item?.deliveredSize || "").trim().toUpperCase(),
      needsReview: Boolean(item?.needsReview),
    })),
  };
}

export function rowNeedsReview(row) {
  return Boolean(
    row.needsReview ||
      !row.sku ||
      !row.product ||
      row.orderedQty === null ||
      !row.orderedUom ||
      row.deliveredQty === null ||
      !row.deliveredUom
  );
}

export function validateNote(note) {
  const warnings = [];
  if (!note.deliveryNote) warnings.push("Delivery Note No is missing");
  if (!note.shippingDate) warnings.push("Shipping Date is missing");
  if (!note.source) warnings.push("Source Location is missing");
  if (!note.destination) warnings.push("Destination Location is missing");
  if (!note.items.length) warnings.push("No product rows were extracted");
  const reviewCount = note.items.filter(rowNeedsReview).length;
  if (reviewCount) warnings.push(`${reviewCount} row(s) need review`);
  return warnings;
}
