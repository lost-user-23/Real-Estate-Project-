// Source of truth for listing field rules, shared by create and edit.
// frontend/src/lib/propertyValidation.js mirrors these for inline form errors.

const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MIN_LENGTH = 20;
const DESCRIPTION_MAX_LENGTH = 2000;
const LOCALITY_MAX_LENGTH = 100;
const MIN_PROPERTY_IMAGES = 5;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

// Strips spaces and dashes, then one leading +91 or 0. Returns the 10-digit
// number, or null if the input is not a valid Indian mobile number.
function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : null;
}

// Stored numbers may predate normalization (spaces, +91), so compare them in
// normalized form; unrecognisable values fall back to the trimmed raw string.
function comparablePhone(value) {
  if (value == null) return null;
  return normalizePhone(value) ?? String(value).trim();
}

// Returns an error message, or null. Length is measured after trim, so
// whitespace-only input fails the minimum.
function textLengthError(field, value, { min = 0, max }) {
  if (typeof value !== 'string') return `${field} must be a string`;
  const length = value.trim().length;
  if (length < min) return `${field} must be at least ${min} characters`;
  if (length > max) return `${field} must be at most ${max} characters`;
  return null;
}

function titleError(value) {
  return textLengthError('title', value, { min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH });
}

// An empty string means "no description" (cleared) and is allowed; anything
// else, including whitespace-only, must meet the minimum.
function descriptionError(value) {
  if (value === '') return null;
  return textLengthError('description', value, { min: DESCRIPTION_MIN_LENGTH, max: DESCRIPTION_MAX_LENGTH });
}

function localityError(value) {
  return textLengthError('locality', value, { max: LOCALITY_MAX_LENGTH });
}

function phoneError(value) {
  if (typeof value !== 'string') return 'contactNumber must be a string';
  if (normalizePhone(value) === null) return 'contactNumber must be a valid 10-digit Indian mobile number';
  return null;
}

function photoCountError(count, min = MIN_PROPERTY_IMAGES) {
  return count < min ? `images must contain at least ${min} images` : null;
}

// Copy of the body with text trimmed and the phone in its stored 10-digit form.
// Call only after validation has passed.
function normalizeListingFields(body) {
  const out = { ...body };
  for (const field of ['title', 'description', 'locality']) {
    if (typeof out[field] === 'string') out[field] = out[field].trim();
  }
  if (typeof out.contactNumber === 'string') out.contactNumber = normalizePhone(out.contactNumber) ?? out.contactNumber;
  return out;
}

module.exports = {
  MIN_PROPERTY_IMAGES,
  normalizePhone,
  comparablePhone,
  titleError,
  descriptionError,
  localityError,
  phoneError,
  photoCountError,
  normalizeListingFields,
};
