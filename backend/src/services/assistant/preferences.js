const { PROPERTY_TYPES, FURNISHING_OPTIONS } = require('../../models/Property');
const { normalizeCity } = require('../../utils/normalizeCity');

// The only fields a conversation may carry. Anything else, from the client or
// from the language model, is dropped by sanitizePatch.
const PREF_FIELDS = [
  'intent',
  'propertyType',
  'minPrice',
  'maxPrice',
  'city',
  'locality',
  'excludeLocalities',
  'bhk',
  'bhkAtLeast',
  'minAreaSqft',
  'maxAreaSqft',
  'areaUnit',
  'furnished',
  'possession',
  'amenities',
];

const INTENTS = ['buy', 'rent'];
const POSSESSION = ['ready', 'under-construction'];
const AREA_UNITS = ['sqft', 'sqyd', 'sqm', 'acre'];
const SQFT_PER_UNIT = { sqft: 1, sqyd: 9, sqm: 10.7639, acre: 43560 };
const AREA_UNIT_LABELS = { sqft: 'sq ft', sqyd: 'sq yd', sqm: 'sq m', acre: 'acre' };

// Mirrors frontend/src/lib/propertyTypes.js (PROPERTY_TYPE_OPTIONS_BY_INTENT):
// plots are sale-only and PG/hostels are rent-only.
const TYPES_BY_INTENT = {
  buy: ['apartment', 'villa', 'independent-house', 'studio', 'penthouse', 'plot', 'commercial'],
  rent: ['apartment', 'villa', 'independent-house', 'studio', 'penthouse', 'pg-hostel', 'commercial'],
};

const PROPERTY_TYPE_LABELS = {
  apartment: 'Flat / Apartment',
  villa: 'Villa',
  'independent-house': 'Independent House',
  plot: 'Plot / Land',
  'pg-hostel': 'PG / Hostel',
  commercial: 'Commercial',
  studio: 'Studio',
  penthouse: 'Penthouse',
};

// Mirrors the amenity list in frontend/src/lib/amenities.js.
const KNOWN_AMENITIES = [
  'Parking',
  'Lift',
  'Power Backup',
  'Security',
  'Gym',
  'Clubhouse',
  'Garden',
  'Swimming Pool',
  'Kids Play Area',
  'Pet Friendly',
];

// Types where BHK is meaningful, and types where land/floor area is the key detail.
const BHK_TYPES = ['apartment', 'villa', 'independent-house', 'penthouse'];
const AREA_TYPES = ['plot', 'commercial'];

const MAX_PRICE = 100_000_000_000;
const MAX_AREA_SQFT = 100_000_000;
const MAX_BHK = 10;
const MAX_LIST = 10;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function positiveNumber(value, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value) : null;
}

function findCity(catalog, value) {
  const key = normalizeCity(value);
  if (!key) return null;
  return catalog.cities.find((c) => c.cityLower === key) || null;
}

function findLocalities(catalog, value, cityLower) {
  const key = normalizeCity(value);
  if (!key) return [];
  return catalog.localities.filter((l) => l.localityLower === key && (!cityLower || l.cityLower === cityLower));
}

// Validates a partial preference object against the supported fields and
// allowed values. Returns what is safe to apply (`patch`; null clears a field),
// what was dropped (`ignored`) and what needs a clarifying question
// (`ambiguous`). It never throws and never passes unknown keys through.
//
// `current` is the preference set the patch will be merged into; it is used to
// resolve a locality against the right city and to check ranges.
function sanitizePatch(raw, catalog, current = {}) {
  const patch = {};
  const ignored = [];
  const ambiguous = [];
  if (!isObject(raw)) return { patch, ignored, ambiguous };

  for (const key of Object.keys(raw)) {
    if (!PREF_FIELDS.includes(key)) ignored.push({ field: key, reason: 'unsupported field' });
  }
  const has = (key) => Object.hasOwn(raw, key) && PREF_FIELDS.includes(key);
  const clearing = (key) => has(key) && raw[key] === null;

  for (const key of PREF_FIELDS) {
    if (clearing(key)) patch[key] = null;
  }

  if (has('intent') && raw.intent !== null) {
    if (INTENTS.includes(raw.intent)) patch.intent = raw.intent;
    else ignored.push({ field: 'intent', reason: 'must be buy or rent' });
  }

  if (has('propertyType') && raw.propertyType !== null) {
    if (PROPERTY_TYPES.includes(raw.propertyType)) patch.propertyType = raw.propertyType;
    else ignored.push({ field: 'propertyType', reason: 'unsupported property type' });
  }

  for (const key of ['minPrice', 'maxPrice']) {
    if (has(key) && raw[key] !== null) {
      const value = positiveNumber(raw[key], MAX_PRICE);
      if (value === null) ignored.push({ field: key, reason: 'must be a non-negative amount in rupees' });
      else patch[key] = value;
    }
  }
  const lo = has('minPrice') ? patch.minPrice : current.minPrice;
  const hi = has('maxPrice') ? patch.maxPrice : current.maxPrice;
  if (lo != null && hi != null && lo > hi) {
    delete patch.minPrice;
    delete patch.maxPrice;
    ambiguous.push({ field: 'budget', reason: 'min-greater-than-max' });
  }

  for (const key of ['minAreaSqft', 'maxAreaSqft']) {
    if (has(key) && raw[key] !== null) {
      const value = positiveNumber(raw[key], MAX_AREA_SQFT);
      if (value === null) ignored.push({ field: key, reason: 'must be a non-negative area' });
      else patch[key] = value;
    }
  }
  const aLo = has('minAreaSqft') ? patch.minAreaSqft : current.minAreaSqft;
  const aHi = has('maxAreaSqft') ? patch.maxAreaSqft : current.maxAreaSqft;
  if (aLo != null && aHi != null && aLo > aHi) {
    delete patch.minAreaSqft;
    delete patch.maxAreaSqft;
    ambiguous.push({ field: 'area', reason: 'min-greater-than-max' });
  }
  if (has('areaUnit') && raw.areaUnit !== null) {
    if (AREA_UNITS.includes(raw.areaUnit)) patch.areaUnit = raw.areaUnit;
    else ignored.push({ field: 'areaUnit', reason: 'unsupported unit' });
  }

  if (has('bhk') && raw.bhk !== null) {
    if (Number.isInteger(raw.bhk) && raw.bhk >= 0 && raw.bhk <= MAX_BHK) patch.bhk = raw.bhk;
    else ignored.push({ field: 'bhk', reason: `must be a whole number from 0 to ${MAX_BHK}` });
  }
  if (has('bhkAtLeast') && raw.bhkAtLeast !== null) {
    if (typeof raw.bhkAtLeast === 'boolean') patch.bhkAtLeast = raw.bhkAtLeast;
    else ignored.push({ field: 'bhkAtLeast', reason: 'must be true or false' });
  }

  if (has('furnished') && raw.furnished !== null) {
    if (FURNISHING_OPTIONS.includes(raw.furnished)) patch.furnished = raw.furnished;
    else ignored.push({ field: 'furnished', reason: 'unsupported furnishing option' });
  }
  if (has('possession') && raw.possession !== null) {
    if (POSSESSION.includes(raw.possession)) patch.possession = raw.possession;
    else ignored.push({ field: 'possession', reason: 'unsupported possession status' });
  }

  if (has('amenities') && raw.amenities !== null) {
    if (Array.isArray(raw.amenities)) {
      const out = [];
      for (const item of raw.amenities.slice(0, MAX_LIST)) {
        const match = typeof item === 'string' ? KNOWN_AMENITIES.find((a) => a.toLowerCase() === item.trim().toLowerCase()) : null;
        if (match) {
          if (!out.includes(match)) out.push(match);
        } else {
          ignored.push({ field: 'amenities', reason: 'unsupported amenity' });
        }
      }
      patch.amenities = out;
    } else {
      ignored.push({ field: 'amenities', reason: 'must be a list' });
    }
  }

  // Location: values must exist in the published inventory.
  let cityLower = current.city ? normalizeCity(current.city) : null;
  let cityFromPatch = false;
  if (has('city') && raw.city !== null) {
    const city = typeof raw.city === 'string' ? findCity(catalog, raw.city) : null;
    if (city) {
      patch.city = city.city;
      cityLower = city.cityLower;
      cityFromPatch = true;
    } else {
      ambiguous.push({ field: 'city', reason: 'unknown-city', value: typeof raw.city === 'string' ? raw.city.slice(0, 60) : '' });
    }
  } else if (clearing('city')) {
    cityLower = null;
  }

  if (has('locality') && raw.locality !== null) {
    let matches = typeof raw.locality === 'string' ? findLocalities(catalog, raw.locality, cityLower) : [];
    // Not in the current city: the locality may belong to another city, which then replaces it.
    if (matches.length === 0 && cityLower && !cityFromPatch && typeof raw.locality === 'string') {
      matches = findLocalities(catalog, raw.locality, null);
      cityLower = null;
    }
    const cities = [...new Set(matches.map((m) => m.cityLower))];
    if (matches.length > 0 && cities.length === 1) {
      patch.locality = matches[0].locality;
      if (!cityLower) {
        // A locality that exists in exactly one city also settles the city.
        patch.city = catalog.cities.find((c) => c.cityLower === cities[0]).city;
      }
    } else if (cities.length > 1) {
      ambiguous.push({
        field: 'locality',
        reason: 'multiple-cities',
        value: matches[0].locality,
        cities: cities.map((c) => catalog.cities.find((x) => x.cityLower === c).city),
      });
    } else {
      ambiguous.push({ field: 'locality', reason: 'unknown-locality', value: typeof raw.locality === 'string' ? raw.locality.slice(0, 60) : '' });
    }
  }

  if (has('excludeLocalities') && raw.excludeLocalities !== null) {
    if (Array.isArray(raw.excludeLocalities)) {
      patch.excludeLocalities = raw.excludeLocalities
        .filter((v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80)
        .slice(0, MAX_LIST)
        .map((v) => v.trim());
    } else {
      ignored.push({ field: 'excludeLocalities', reason: 'must be a list' });
    }
  }

  return { patch, ignored, ambiguous };
}

// Applies a sanitized patch. Fields that only make sense in the old context are
// dropped: a new city invalidates the locality, and a different intent
// invalidates the budget (rent and sale prices are on different scales) and
// any property type that is not offered for the new intent.
function applyPatch(prefs, patch) {
  const next = { ...prefs };
  const dropped = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }

  if (patch.city !== undefined && patch.city !== prefs.city && patch.locality === undefined) {
    if (next.locality) dropped.push('locality');
    delete next.locality;
    delete next.excludeLocalities;
  }
  if (patch.intent && prefs.intent && patch.intent !== prefs.intent) {
    if (patch.minPrice === undefined && patch.maxPrice === undefined && (next.minPrice != null || next.maxPrice != null)) {
      delete next.minPrice;
      delete next.maxPrice;
      dropped.push('budget');
    }
    if (next.propertyType && !TYPES_BY_INTENT[patch.intent].includes(next.propertyType) && patch.propertyType === undefined) {
      delete next.propertyType;
      dropped.push('propertyType');
    }
  }
  if (patch.propertyType && patch.propertyType !== prefs.propertyType) {
    if (!BHK_TYPES.includes(patch.propertyType) && patch.bhk === undefined) {
      delete next.bhk;
      delete next.bhkAtLeast;
    }
    if (!AREA_TYPES.includes(patch.propertyType) && patch.minAreaSqft === undefined && patch.maxAreaSqft === undefined) {
      delete next.minAreaSqft;
      delete next.maxAreaSqft;
      delete next.areaUnit;
    }
  }
  if (next.bhk == null) delete next.bhkAtLeast;
  if (next.excludeLocalities && next.excludeLocalities.length === 0) delete next.excludeLocalities;
  return { prefs: next, dropped };
}

// Intent and type must be an offered pair (no rental plots, no PG for sale).
function typeIntentConflict(prefs) {
  if (prefs.intent && prefs.propertyType && !TYPES_BY_INTENT[prefs.intent].includes(prefs.propertyType)) {
    return prefs.propertyType === 'plot'
      ? 'Plots are listed for sale only, so I cannot search for plots to rent.'
      : `${PROPERTY_TYPE_LABELS[prefs.propertyType]} listings are available to rent only, not to buy.`;
  }
  return null;
}

const SKIPPABLE = ['propertyType', 'budget', 'city', 'locality', 'details'];
const EXPECTABLE = ['intent', 'propertyType', 'budget', 'city', 'locality', 'details', 'extras'];

// Rebuilds a trusted state from whatever the client sent back.
function sanitizeState(raw, catalog) {
  const state = { prefs: {}, skipped: [], expecting: null, searched: false, lastStats: null };
  if (!isObject(raw)) return state;

  state.prefs = sanitizePatch(raw.prefs, catalog).patch;
  for (const key of Object.keys(state.prefs)) {
    if (state.prefs[key] === null) delete state.prefs[key];
  }
  if (typeIntentConflict(state.prefs)) delete state.prefs.propertyType;

  if (Array.isArray(raw.skipped)) {
    state.skipped = [...new Set(raw.skipped.filter((f) => SKIPPABLE.includes(f)))];
  }
  if (EXPECTABLE.includes(raw.expecting)) state.expecting = raw.expecting;
  state.searched = raw.searched === true;

  if (isObject(raw.lastStats)) {
    state.lastStats = {
      minPrice: positiveNumber(raw.lastStats.minPrice, MAX_PRICE),
      maxPrice: positiveNumber(raw.lastStats.maxPrice, MAX_PRICE),
      medianAreaSqft: positiveNumber(raw.lastStats.medianAreaSqft, MAX_AREA_SQFT),
      localities: Array.isArray(raw.lastStats.localities)
        ? raw.lastStats.localities.filter((l) => typeof l === 'string' && l.length <= 80).slice(0, 20)
        : [],
    };
  }
  return state;
}

module.exports = {
  PREF_FIELDS,
  INTENTS,
  POSSESSION,
  AREA_UNITS,
  SQFT_PER_UNIT,
  AREA_UNIT_LABELS,
  TYPES_BY_INTENT,
  PROPERTY_TYPE_LABELS,
  KNOWN_AMENITIES,
  BHK_TYPES,
  AREA_TYPES,
  sanitizePatch,
  applyPatch,
  sanitizeState,
  typeIntentConflict,
};
