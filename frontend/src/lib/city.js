// Mirrors backend/src/utils/normalizeCity.js: trim, collapse inner whitespace, lowercase.
export function normalizeCity(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Case-insensitive, whitespace-tolerant city equality. Two missing or blank
// values are not "the same city".
export function isSameCity(a, b) {
  const left = normalizeCity(a);
  return left !== "" && left === normalizeCity(b);
}
