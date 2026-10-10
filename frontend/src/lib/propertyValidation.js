// Mirrors backend/src/utils/propertyValidation.js, which is the source of truth.
// Keep the limits and rules here in sync with it; these only give inline errors
// before submit, the backend still validates every request.

export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LOCALITY_MAX_LENGTH = 100;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

// Strips spaces and dashes, then one leading +91 or 0. Returns the 10-digit
// number, or null if the input is not a valid Indian mobile number.
export function normalizePhone(value) {
  if (typeof value !== "string") return null;
  let digits = value.replace(/[\s-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : null;
}

// Each helper returns an error message or null. Length is measured after trim,
// so whitespace-only input fails the minimum.
function lengthError(label, value, { min = 0, max }) {
  const length = value.trim().length;
  if (length < min) return `${label} must be at least ${min} characters`;
  if (length > max) return `${label} must be at most ${max} characters`;
  return null;
}

export function titleError(value) {
  return lengthError("Title", value, { min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH });
}

// An empty string means "no description" and is allowed; whitespace-only is not.
export function descriptionError(value) {
  if (value === "") return null;
  return lengthError("Description", value, { min: DESCRIPTION_MIN_LENGTH, max: DESCRIPTION_MAX_LENGTH });
}

export function localityError(value) {
  return lengthError("Locality", value, { max: LOCALITY_MAX_LENGTH });
}

// Call only for a phone the user actually filled in; a blank phone is omitted
// from the payload instead (the backend rejects '' and null).
export function phoneError(value) {
  return normalizePhone(value) === null ? "Enter a valid 10-digit Indian mobile number (starting 6-9)" : null;
}

// Maps backend validation details ("title must be ...") to the form field they
// belong to, so the message can sit next to that input. Fields without a
// matching detail are left out; the caller keeps its generic error for those.
export function fieldErrorsFromApiError(error, fields = ["title", "description", "locality", "contactNumber"]) {
  const result = {};
  if (!Array.isArray(error?.data)) return result;
  for (const detail of error.data) {
    if (typeof detail !== "string") continue;
    const field = fields.find((name) => detail.startsWith(`${name} `));
    if (field && !result[field]) result[field] = detail;
  }
  return result;
}
