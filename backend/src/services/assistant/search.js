const { Property } = require('../../models');
const { normalizeCity } = require('../../utils/normalizeCity');
const { getImagesForProperties } = require('../property.service');
const { serializeProperty } = require('../../utils/serializers/property.serializer');
const { PROPERTY_TYPE_LABELS } = require('./preferences');
const { formatPrice, formatArea, niceAmount } = require('./format');

// Property matching for the assistant. The filter is built here, field by
// field, from validated preferences; nothing a model produced is ever placed
// in a query. Only published listings are read, and every result goes through
// the same public serializer as the rest of the API.

const EXACT_LIMIT = 6;
const APPROX_LIMIT = 4;
const CANDIDATE_CAP = 150;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactCi = (value) => new RegExp(`^${escapeRegExp(value.trim())}$`, 'i');

// The part of the search that is never relaxed on its own: status, intent,
// type, budget and city. Locality and the softer preferences are handled when
// results are sorted into exact and approximate matches.
function buildHardFilter(prefs, { withLocality, relaxBudgetBy = 0 } = {}) {
  const filter = { status: 'published' };
  if (prefs.intent) filter.intent = prefs.intent;
  if (prefs.propertyType) filter.propertyType = prefs.propertyType;
  if (prefs.city) filter.cityLower = normalizeCity(prefs.city);

  const price = {};
  if (prefs.minPrice != null) price.$gte = relaxBudgetBy ? Math.floor(prefs.minPrice / (1 + relaxBudgetBy)) : prefs.minPrice;
  if (prefs.maxPrice != null) price.$lte = Math.ceil(prefs.maxPrice * (1 + relaxBudgetBy));
  if (Object.keys(price).length > 0) filter.priceInRupees = price;

  const locality = [];
  if (withLocality === true && prefs.locality) locality.push({ locality: exactCi(prefs.locality) });
  if (prefs.excludeLocalities?.length) {
    locality.push({ locality: { $nin: prefs.excludeLocalities.map(exactCi) } });
  }
  if (locality.length > 0) filter.$and = locality;
  return filter;
}

function currentYear() {
  return new Date().getFullYear();
}

function possessionOf(property) {
  if (property.yearOfConstruction == null) return null;
  return property.yearOfConstruction <= currentYear() ? 'ready' : 'under-construction';
}

const hasAmenity = (property, amenity) =>
  (property.amenities || []).some((a) => typeof a === 'string' && a.toLowerCase().includes(amenity.toLowerCase()));

// Scores one listing against the preferences that are not part of the hard
// filter. `met` are reasons it fits; `gaps` are preferences it does not meet.
function evaluate(property, prefs) {
  const met = [];
  const gaps = [];
  let score = 0;

  if (prefs.locality) {
    if (property.locality && normalizeCity(property.locality) === normalizeCity(prefs.locality)) {
      met.push(`In ${property.locality}, as you asked`);
      score += 4;
    } else {
      gaps.push(`In ${property.locality || 'another area'} rather than ${prefs.locality}`);
    }
  }

  if (prefs.bhk != null) {
    const ok = property.bhk != null && (prefs.bhkAtLeast ? property.bhk >= prefs.bhk : property.bhk === prefs.bhk);
    if (ok) {
      met.push(`${property.bhk} BHK${prefs.bhkAtLeast ? ` (you wanted ${prefs.bhk}+)` : ''}`);
      score += 3;
    } else {
      gaps.push(property.bhk != null ? `${property.bhk} BHK instead of ${prefs.bhk}${prefs.bhkAtLeast ? '+' : ''} BHK` : 'BHK not listed');
    }
  }

  if (prefs.minAreaSqft != null || prefs.maxAreaSqft != null) {
    const area = property.areaSqft;
    const okMin = prefs.minAreaSqft == null || area >= prefs.minAreaSqft;
    const okMax = prefs.maxAreaSqft == null || area <= prefs.maxAreaSqft;
    if (okMin && okMax) {
      met.push(`Area ${formatArea(area, prefs.areaUnit)} fits your size range`);
      score += 3;
    } else {
      gaps.push(`Area ${formatArea(area, prefs.areaUnit)} is ${okMin ? 'larger' : 'smaller'} than you asked`);
    }
  }

  if (prefs.furnished) {
    if (property.furnished === prefs.furnished) {
      met.push(`${property.furnished[0].toUpperCase()}${property.furnished.slice(1)}`);
      score += 2;
    } else {
      gaps.push(property.furnished ? `${property.furnished} instead of ${prefs.furnished}` : 'Furnishing not listed');
    }
  }

  if (prefs.possession) {
    const status = possessionOf(property);
    if (status === prefs.possession) {
      met.push(status === 'ready' ? `Ready to move (built ${property.yearOfConstruction})` : `Under construction (due ${property.yearOfConstruction})`);
      score += 2;
    } else {
      gaps.push(status ? `Possession: ${status === 'ready' ? 'ready to move' : 'under construction'}` : 'Possession status not listed');
    }
  }

  for (const amenity of prefs.amenities || []) {
    if (hasAmenity(property, amenity)) {
      met.push(`Has ${amenity}`);
      score += 1.5;
    } else {
      gaps.push(`No ${amenity} listed`);
    }
  }

  if (property.verified) score += 0.4;
  if (property.featured) score += 0.2;
  return { met, gaps, score };
}

function baseReasons(property, prefs) {
  const reasons = [];
  const type = PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType;
  if (prefs.maxPrice != null || prefs.minPrice != null) {
    const unit = property.intent === 'rent' ? '/month' : '';
    reasons.push(`${formatPrice(property.priceInRupees)}${unit} is within your budget`);
  }
  reasons.unshift(`${type} for ${property.intent === 'rent' ? 'rent' : 'sale'} in ${[property.locality, property.city].filter(Boolean).join(', ')}`);
  if (property.verified) reasons.push('Verified by HomeNest');
  return reasons;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function present(property, images, match) {
  const out = serializeProperty(property, images);
  if (typeof out.description === 'string' && out.description.length > 220) {
    out.description = `${out.description.slice(0, 217)}...`;
  }
  out.match = match;
  return out;
}

async function fetchCandidates(filter, sort) {
  return Property.find(filter).sort(sort).limit(CANDIDATE_CAP);
}

const CANDIDATE_SORT = { featured: -1, verified: -1, publishedAt: -1, _id: 1 };

// Runs a search. Returns exact matches (every stated preference met) and
// approximate matches (the hard constraints and city hold, but the locality or
// a softer preference differs; each says how). Counts are the true numbers of
// published listings that satisfy the hard filter.
async function searchProperties(prefs) {
  const hasLocality = Boolean(prefs.locality);

  // Candidates in the preferred locality (or everywhere, if none was named).
  const primaryFilter = buildHardFilter(prefs, { withLocality: hasLocality });
  const primary = await fetchCandidates(primaryFilter, CANDIDATE_SORT);
  let pool = primary;

  // Other localities of the same city, only fetched when they could be shown.
  if (hasLocality) {
    const looseFilter = buildHardFilter(prefs, { withLocality: false });
    looseFilter._id = { $nin: primary.map((p) => p._id) };
    pool = [...primary, ...(await fetchCandidates(looseFilter, CANDIDATE_SORT))];
  }

  const exact = [];
  const approximate = [];
  for (const property of pool) {
    const result = evaluate(property, prefs);
    const entry = { property, ...result };
    if (result.gaps.length === 0) exact.push(entry);
    else approximate.push(entry);
  }
  const byScore = (a, b) => b.score - a.score;
  exact.sort(byScore);
  approximate.sort(byScore);

  const shownExact = exact.slice(0, EXACT_LIMIT);
  const shownApprox = exact.length >= EXACT_LIMIT ? [] : approximate.slice(0, APPROX_LIMIT);
  const shown = [...shownExact, ...shownApprox];
  const imagesById = await getImagesForProperties(shown.map((e) => e.property._id));

  const toResult = (tier) => (entry) =>
    present(entry.property, imagesById.get(String(entry.property._id)) || [], {
      tier,
      reasons: [...baseReasons(entry.property, prefs).slice(0, 1), ...entry.met, ...baseReasons(entry.property, prefs).slice(1)].slice(0, 5),
      gaps: tier === 'approximate' ? entry.gaps : [],
    });

  const stats = {
    minPrice: shown.length ? Math.min(...shown.map((e) => e.property.priceInRupees)) : null,
    maxPrice: shown.length ? Math.max(...shown.map((e) => e.property.priceInRupees)) : null,
    medianAreaSqft: median(shown.map((e) => e.property.areaSqft)),
    localities: [...new Set(shown.map((e) => e.property.locality).filter(Boolean))].slice(0, 20),
  };

  return {
    exact: shownExact.map(toResult('exact')),
    approximate: shownApprox.map(toResult('approximate')),
    exactTotal: exact.length,
    approximateTotal: approximate.length,
    candidateCapReached: primary.length >= CANDIDATE_CAP,
    stats,
  };
}

// The non-hard preferences as query clauses, so a broadening offer can count the
// listings that would match *everything* the visitor asked for.
function softClauses(prefs) {
  const clauses = [];
  if (prefs.bhk != null) clauses.push({ bhk: prefs.bhkAtLeast ? { $gte: prefs.bhk } : prefs.bhk });
  if (prefs.minAreaSqft != null) clauses.push({ areaSqft: { $gte: prefs.minAreaSqft } });
  if (prefs.maxAreaSqft != null) clauses.push({ areaSqft: { $lte: prefs.maxAreaSqft } });
  if (prefs.furnished) clauses.push({ furnished: prefs.furnished });
  if (prefs.possession) clauses.push({ yearOfConstruction: prefs.possession === 'ready' ? { $lte: currentYear() } : { $gt: currentYear() } });
  for (const amenity of prefs.amenities || []) {
    clauses.push({ amenities: { $elemMatch: { $regex: escapeRegExp(amenity), $options: 'i' } } });
  }
  return clauses;
}

// Number of published listings matching every stated preference.
async function countExact(prefs) {
  const filter = buildHardFilter(prefs, { withLocality: Boolean(prefs.locality) });
  const soft = softClauses(prefs);
  if (soft.length > 0) filter.$and = [...(filter.$and || []), ...soft];
  return Property.countDocuments(filter);
}

// Offers are only made when they would bring up more matching listings than the
// current search has, and the number shown is that real count. Each offer is
// exactly what its button does: one change, nothing else relaxed.
async function broadeningOptions(prefs) {
  const options = [];
  const base = await countExact(prefs);
  if (prefs.locality || prefs.excludeLocalities?.length) {
    const count = await countExact({ ...prefs, locality: undefined, excludeLocalities: undefined });
    if (count > base) options.push({ kind: 'any-locality', count });
  }
  if (prefs.maxPrice != null) {
    const raised = niceAmount(prefs.maxPrice * 1.25);
    const count = await countExact({ ...prefs, maxPrice: raised });
    if (count > base) options.push({ kind: 'raise-budget', maxPrice: raised, count });
  }
  return options;
}

module.exports = {
  searchProperties,
  broadeningOptions,
  buildHardFilter,
  evaluate,
  possessionOf,
  EXACT_LIMIT,
  APPROX_LIMIT,
  CANDIDATE_CAP,
};
