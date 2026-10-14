const Property = require('../models/Property');

const { PROPERTY_INTENTS, PROPERTY_TYPES, FURNISHING_OPTIONS, FACING_OPTIONS } = Property;

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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}


// Optional text fields shared by create and edit. Absent (undefined) is skipped;
// a present null is an error, so only '' can clear a description.
function pushTextFieldErrors(errors, body) {
  for (const [field, check] of [['description', descriptionError], ['locality', localityError], ['contactNumber', phoneError]]) {
    if (body[field] !== undefined) {
      const error = check(body[field]);
      if (error) errors.push(error);
    }
  }
}

function validateCreateInput(body) {
  const errors = [];

  if (body.title === undefined) {
    errors.push('title is required');
  } else {
    const error = titleError(body.title);
    if (error) errors.push(error);
  }
  if (!PROPERTY_INTENTS.includes(body.intent)) {
    errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
  }
  if (!PROPERTY_TYPES.includes(body.propertyType)) {
    errors.push(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
  }
  if (!isFiniteNonNegativeNumber(body.areaSqft)) errors.push('areaSqft must be a non-negative number');
  if (!isFiniteNonNegativeNumber(body.priceInRupees)) errors.push('priceInRupees must be a non-negative number');
  if (!isNonEmptyString(body.city)) errors.push('city is required');

  if (body.bhk != null && !isFiniteNonNegativeNumber(body.bhk)) {
    errors.push('bhk must be a non-negative number');
  }
  pushTextFieldErrors(errors, body);
  if (body.amenities != null) {
    if (!Array.isArray(body.amenities) || !body.amenities.every((a) => typeof a === 'string')) {
      errors.push('amenities must be an array of strings');
    }
  }

  return errors;
}

// Optional listing details; null/undefined means "not provided".
function validateDetailFields(body) {
  const errors = [];
  for (const key of ['bathrooms', 'balconies']) {
    if (body[key] != null && !isFiniteNonNegativeNumber(body[key])) errors.push(`${key} must be a non-negative number`);
  }
  if (body.floor != null && !Number.isFinite(body.floor)) errors.push('floor must be a number');
  if (body.yearOfConstruction != null
    && !(Number.isInteger(body.yearOfConstruction) && body.yearOfConstruction >= 1800 && body.yearOfConstruction <= new Date().getFullYear() + 5)) {
    errors.push('yearOfConstruction must be a valid year');
  }
  if (body.furnished != null && !FURNISHING_OPTIONS.includes(body.furnished)) {
    errors.push(`furnished must be one of: ${FURNISHING_OPTIONS.join(', ')}`);
  }
  if (body.facing != null && !FACING_OPTIONS.includes(body.facing)) {
    errors.push(`facing must be one of: ${FACING_OPTIONS.join(', ')}`);
  }
  if (body.ownership != null && typeof body.ownership !== 'string') errors.push('ownership must be a string');
  if (body.isLuxury != null && typeof body.isLuxury !== 'boolean') errors.push('isLuxury must be a boolean');
  return errors;
}

module.exports = {
  MIN_PROPERTY_IMAGES,
  isNonEmptyString,
  isFiniteNonNegativeNumber,
  pushTextFieldErrors,
  validateCreateInput,
  validateDetailFields,
  normalizePhone,
  comparablePhone,
  titleError,
  descriptionError,
  localityError,
  phoneError,
  photoCountError,
  normalizeListingFields,
};
