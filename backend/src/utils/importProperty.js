// Step B of the scraper import: check and clean ONE scraped item.
// Pure function: no database, no request object, so it is easy to test.
//
//   const { value, errors, warnings } = validateImportItem(item);
//
// - errors:   every problem found (not just the first). Empty means valid.
// - warnings: names of fields we ignored (typos, or fields only the server sets).
// - value:    the cleaned item ready to be saved, or null when there are errors.
const { URL } = require('url');
const { normalizeCity } = require('./normalizeCity');
const {
  isNonEmptyString,
  normalizeListingFields,
  validateCreateInput,
  validateDetailFields,
} = require('./propertyValidation');

const MAX_SOURCE_LENGTH = 100;
const MAX_SOURCE_URL_LENGTH = 2048;
const MIN_IMAGE_URLS = 5;
const MAX_IMAGE_URLS = 20;

// Fields the scraper may send. Anything else is ignored and reported as a warning.
const REQUIRED_FIELDS = [
  'source', 'sourceUrl', 'title', 'intent', 'propertyType', 'areaSqft', 'priceInRupees', 'city',
  'contactNumber', 'imageUrls',
];
const OPTIONAL_FIELDS = [
  'locality', 'description', 'bhk', 'bathrooms', 'balconies', 'floor', 'furnished', 'facing',
  'yearOfConstruction', 'ownership', 'isLuxury', 'amenities',
];
const ACCEPTED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

// Query parameters that only track marketing clicks; they do not identify a
// listing, so two URLs differing only by these are the same listing.
const TRACKING_PARAMS = new Set(['gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'mc_cid', 'mc_eid', '_ga', 'igshid']);

function isTrackingParam(name) {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

// Turns a listing URL into the form used as the unique key, or returns null if
// it is not a usable http(s) URL. Rules (also written in docs/scraper-contract.md):
//   host and scheme lowercase, no #fragment, no login:password@, no tracking
//   params, remaining params sorted, no trailing slash. Path case is kept
//   because paths are case-sensitive.
function normalizeSourceUrl(value) {
  if (typeof value !== 'string') return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  const query = url.searchParams.toString();
  const path = url.pathname.replace(/\/+$/, '');

  return `${url.protocol}//${url.host}${path}${query ? `?${query}` : ''}`;
}

// The scraper may send null for "unknown". The website validators treat a null
// description as an error, so null optional fields are removed first.
function dropNulls(item) {
  const out = {};
  for (const [key, value] of Object.entries(item)) {
    if (value !== null) out[key] = value;
  }
  return out;
}

// The cleaned sourceUrl of a raw item, or null when it is missing or unusable.
function cleanedSourceUrl(item) {
  const raw = item?.sourceUrl;
  if (typeof raw !== 'string' || raw.trim().length > MAX_SOURCE_URL_LENGTH) return null;
  return normalizeSourceUrl(raw);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > MAX_SOURCE_URL_LENGTH) return false;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// Trimmed image URLs without repeats (same address after URL parsing). Call only
// once every entry has passed isHttpUrl.
function uniqueImageUrls(list) {
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const url = entry.trim();
    const key = new URL(url).href;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(url);
    }
  }
  return out;
}

function imageUrlErrors(value) {
  if (value === undefined) return ['imageUrls is required'];
  if (!Array.isArray(value)) return ['imageUrls must be an array of image URLs'];

  const bad = [];
  value.forEach((entry, i) => {
    if (!isHttpUrl(entry)) bad.push(i);
  });
  if (bad.length > 0) {
    const shown = bad.slice(0, 5).map((i) => `imageUrls[${i}]`).join(', ');
    return [`${shown}${bad.length > 5 ? ' and others' : ''} must be a valid http or https URL of at most ${MAX_SOURCE_URL_LENGTH} characters`];
  }

  const unique = uniqueImageUrls(value).length;
  if (unique < MIN_IMAGE_URLS) return [`imageUrls must contain at least ${MIN_IMAGE_URLS} unique URLs (got ${unique})`];
  if (unique > MAX_IMAGE_URLS) return [`imageUrls must contain at most ${MAX_IMAGE_URLS} unique URLs (got ${unique})`];
  return [];
}

function trimmedStrings(list) {
  return list.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

// Import-only rules, on top of the website's own validators.
function importOnlyErrors(item) {
  const errors = [];

  if (!isNonEmptyString(item.source)) {
    errors.push('source is required');
  } else if (item.source.trim().length > MAX_SOURCE_LENGTH) {
    errors.push(`source must be at most ${MAX_SOURCE_LENGTH} characters`);
  }

  if (!isNonEmptyString(item.sourceUrl)) {
    errors.push('sourceUrl is required');
  } else if (item.sourceUrl.trim().length > MAX_SOURCE_URL_LENGTH) {
    errors.push(`sourceUrl must be at most ${MAX_SOURCE_URL_LENGTH} characters`);
  } else if (normalizeSourceUrl(item.sourceUrl) === null) {
    errors.push('sourceUrl must be a valid http or https URL');
  }

  // validateCreateInput only checks contactNumber when present; here it is required.
  if (item.contactNumber === undefined) errors.push('contactNumber is required');
  errors.push(...imageUrlErrors(item.imageUrls));

  // Zero is allowed on the website form but is junk data for a scraped listing.
  // Only checked when the value is already a valid number, to avoid two messages.
  if (item.areaSqft === 0) errors.push('areaSqft must be greater than 0');
  if (item.priceInRupees === 0) errors.push('priceInRupees must be greater than 0');

  return errors;
}

// Builds the saved shape. Optional fields that were not sent get the same
// defaults the website uses when it creates a listing (null, [], false), so a
// re-import of a draft resets them instead of leaving old values behind.
// Required fields are never defaulted: validation has already passed here.
function buildValue(item) {
  const clean = normalizeListingFields(item);
  return {
    source: clean.source.trim(),
    sourceUrl: normalizeSourceUrl(clean.sourceUrl),
    title: clean.title,
    intent: clean.intent,
    propertyType: clean.propertyType,
    areaSqft: clean.areaSqft,
    priceInRupees: clean.priceInRupees,
    city: clean.city.trim(),
    cityLower: normalizeCity(clean.city),
    locality: clean.locality || null,
    description: clean.description ?? '',
    bhk: clean.bhk ?? null,
    bathrooms: clean.bathrooms ?? null,
    balconies: clean.balconies ?? null,
    floor: clean.floor ?? null,
    furnished: clean.furnished ?? null,
    facing: clean.facing ?? null,
    yearOfConstruction: clean.yearOfConstruction ?? null,
    ownership: clean.ownership ? clean.ownership.trim() || null : null,
    isLuxury: Boolean(clean.isLuxury),
    amenities: clean.amenities ? trimmedStrings(clean.amenities) : [],
    contactNumber: clean.contactNumber,
    // Photo import bookkeeping: the background job downloads these and moves the
    // status on. A re-import of a draft always starts over with "pending".
    importImageUrls: uniqueImageUrls(clean.imageUrls),
    imageImportStatus: 'pending',
  };
}

function validateImportItem(item) {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return { value: null, errors: ['item must be an object'], warnings: [] };
  }

  const warnings = Object.keys(item).filter((key) => !ACCEPTED_FIELDS.has(key));
  const known = dropNulls(Object.fromEntries(Object.entries(item).filter(([key]) => ACCEPTED_FIELDS.has(key))));

  const errors = [
    ...validateCreateInput(known),
    ...validateDetailFields(known),
    ...importOnlyErrors(known),
  ];
  if (errors.length > 0) return { value: null, errors, warnings };

  return { value: buildValue(known), errors: [], warnings };
}

module.exports = { validateImportItem, normalizeSourceUrl, cleanedSourceUrl, ACCEPTED_FIELDS };
