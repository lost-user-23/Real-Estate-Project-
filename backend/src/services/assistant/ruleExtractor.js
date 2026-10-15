const { normalizeCity } = require('../../utils/normalizeCity');
const { SQFT_PER_UNIT, KNOWN_AMENITIES } = require('./preferences');

// Deterministic preference extraction from plain text. It works with no AI
// provider, and it is also what keeps the numbers exact when a provider is
// configured. Everything it returns is a *raw* patch: conversation.js still
// runs it through sanitizePatch before anything is applied.

const CITY_ALIASES = {
  bangalore: 'bengaluru',
  bengalore: 'bengaluru',
  bombay: 'mumbai',
  delhi: 'delhi ncr',
  'new delhi': 'delhi ncr',
  ncr: 'delhi ncr',
  gurgaon: 'delhi ncr',
  gurugram: 'delhi ncr',
  noida: 'delhi ncr',
  madras: 'chennai',
  calcutta: 'kolkata',
  cochin: 'kochi',
  poona: 'pune',
};

const TYPE_PATTERNS = [
  ['plot', /\b(plots?|lands?|sites?)\b/],
  ['apartment', /\b(flats?|apartments?|apt|builder floors?)\b/],
  ['independent-house', /\b(independent houses?|houses?|kothi|bungalows?)\b/],
  ['villa', /\bvillas?\b/],
  ['studio', /\bstudios?\b/],
  ['penthouse', /\bpenthouses?\b/],
  ['pg-hostel', /\b(pg|paying guests?|hostels?)\b/],
  ['commercial', /\b(commercial|shops?|offices?|showrooms?|warehouses?)\b/],
];

const AREA_UNIT_SRC =
  '(sq\\.?\\s?ft|sqft|sft|square\\s*f(?:ee|oo)t|sq\\.?\\s?yd|sqyd|sq\\.?\\s?yards?|square\\s*yards?|gaj|sq\\.?\\s?m|sqm|square\\s*met(?:er|re)s?|acres?)';
const NUM = '(\\d+(?:\\.\\d+)?)';

function areaUnitOf(text) {
  const t = text.toLowerCase().replace(/[\s.]/g, '');
  if (t.includes('acre')) return 'acre';
  if (t.includes('yd') || t.includes('yard') || t === 'gaj') return 'sqyd';
  if (t === 'sqm' || t.includes('met')) return 'sqm';
  return 'sqft';
}

const AMOUNT_UNITS = [
  [/^(crores?|cr)$/, 10_000_000],
  [/^(lakhs?|lacs?|lac|lk|l)$/, 100_000],
  [/^(k|thousand)$/, 1000],
  [/^(million|m)$/, 1_000_000],
];

function amountValue(numStr, unit) {
  const base = Number(numStr);
  if (!unit) return base;
  const match = AMOUNT_UNITS.find(([re]) => re.test(unit));
  return Math.round(base * (match ? match[1] : 1));
}

function matchesWord(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text);
}

function detectIntent(text) {
  const buy = /\b(buy|buying|purchase|purchasing|own|for sale|investment|invest)\b/.test(text);
  const rent = /\b(rent|renting|rental|lease|leasing|to let|tenant)\b/.test(text);
  if (buy && rent) return { ambiguous: true };
  if (buy) return { value: 'buy' };
  if (rent) return { value: 'rent' };
  return {};
}

function detectTypes(text) {
  // "independent house" must not also count as "house" twice, and "plot" wins
  // over words like "site" appearing elsewhere only when it is the sole match.
  let found = TYPE_PATTERNS.filter(([, re]) => re.test(text)).map(([type]) => type);
  // Qualifiers that name a more specific type win over the generic word they contain.
  const drop = (generic, specific) => { if (found.includes(generic) && found.includes(specific)) found = found.filter((t) => t !== generic); };
  drop('apartment', 'studio');
  drop('apartment', 'penthouse');
  drop('independent-house', 'villa');
  return found;
}

function extractBhk(text) {
  const m = /(\d{1,2})\s*(\+)?\s*-?\s*(?:bhk|bedrooms?|bed\b|br\b)/.exec(text);
  if (!m) return { text };
  const value = Number(m[1]);
  return { value, atLeast: Boolean(m[2]), text: text.replace(m[0], ' ') };
}

function extractArea(text) {
  const range = new RegExp(`${NUM}\\s*(?:to|-|–|and)\\s*${NUM}\\s*${AREA_UNIT_SRC}`, 'i').exec(text);
  if (range) {
    const unit = areaUnitOf(range[3]);
    const factor = SQFT_PER_UNIT[unit];
    const a = Number(range[1]) * factor;
    const b = Number(range[2]) * factor;
    return { min: Math.round(Math.min(a, b)), max: Math.round(Math.max(a, b)), unit, text: text.replace(range[0], ' ') };
  }
  const single = new RegExp(`(?:(at least|minimum|min|above|over|more than|under|below|upto|up to|max|maximum|less than|around|about)\\s*)?${NUM}\\s*${AREA_UNIT_SRC}`, 'i').exec(text);
  if (!single) return { text };
  const unit = areaUnitOf(single[3]);
  const value = Number(single[2]) * SQFT_PER_UNIT[unit];
  const q = (single[1] || '').toLowerCase();
  const out = { unit, text: text.replace(single[0], ' ') };
  if (/^(at least|minimum|min|above|over|more than)$/.test(q)) out.min = Math.round(value);
  else if (/^(under|below|upto|up to|max|maximum|less than)$/.test(q)) out.max = Math.round(value);
  else {
    // A bare size ("500 sq yd plot") means "about this big", so allow a margin.
    out.min = Math.round(value * 0.85);
    out.max = Math.round(value * 1.15);
  }
  return out;
}

const MAX_Q = /(under|below|upto|up to|within|max(?:imum)?|less than|not more than|at most|budget(?: of| is| upto| up to)?|can spend|afford|limit)\s*$/;
const MIN_Q = /(above|over|more than|at least|minimum|min|starting(?: from)?|from)\s*$/;
const RANGE_Q = /betweens*$/;
const AROUND_Q = /(around|about|approx(?:imately)?|roughly)\s*$/;

// Returns { min, max, ambiguous }.
function extractBudget(text, { expecting, intent }) {
  const cleaned = text.replace(/(?<=\d),(?=\d)/g, '');
  const tokenRe = new RegExp(`(₹|rs\\.?|inr)?\\s*${NUM}\\s*(crores?|cr|lakhs?|lacs?|lac|lk|l|k|thousand|million|m)?(?![a-z0-9])`, 'gi');
  const tokens = [];
  let m;
  while ((m = tokenRe.exec(cleaned)) !== null) {
    tokens.push({ index: m.index, end: m.index + m[0].length, currency: Boolean(m[1]), num: m[2], unit: m[3] ? m[3].toLowerCase() : null });
  }
  const cueWords = /\b(budget|price|cost|rent|per month|a month|monthly|\/mo|pm|afford|spend|worth)\b/.test(cleaned);

  const usable = tokens.filter((t, i) => {
    const n = Number(t.num);
    if (!t.unit && !t.currency && n >= 1900 && n <= 2100) return false;
    const next = tokens[i + 1];
    const startsRange = next && next.unit && /^(to|and|-|–)$/.test(cleaned.slice(t.end, next.index).trim());
    return startsRange || RANGE_Q.test(cleaned.slice(0, t.index)) || Boolean(t.unit) || t.currency || cueWords || expecting === 'budget' || MAX_Q.test(cleaned.slice(0, t.index)) || MIN_Q.test(cleaned.slice(0, t.index));
  });
  if (usable.length === 0) return {};

  const first = usable[0];
  const second = usable[1];
  const joiner = second ? cleaned.slice(first.end, second.index).trim() : '';
  const isRange = second && /^(to|and|-|–|till|until)$/.test(joiner);

  const resolve = (t, fallbackUnit) => {
    const unit = t.unit || fallbackUnit || null;
    const value = amountValue(t.num, unit);
    if (!unit && !t.currency && value < 10_000) return null;
    return value;
  };

  if (isRange) {
    const lo = resolve(first, second.unit);
    const hi = resolve(second, null);
    if (lo == null || hi == null) return { ambiguous: { reason: 'missing-unit', value: Number(first.num) } };
    return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
  }

  const value = resolve(first, null);
  if (value == null) return { ambiguous: { reason: 'missing-unit', value: Number(first.num), intent } };
  const before = cleaned.slice(0, first.index);
  if (MIN_Q.test(before)) return { min: value };
  if (AROUND_Q.test(before)) return { min: Math.round(value * 0.85), max: Math.round(value * 1.15) };
  return { max: value };
}

function detectCity(text, catalog) {
  const candidates = [];
  for (const c of catalog.cities) candidates.push({ key: c.cityLower, city: c.city });
  for (const [alias, target] of Object.entries(CITY_ALIASES)) {
    const city = catalog.cities.find((c) => c.cityLower === target);
    if (city) candidates.push({ key: alias, city: city.city });
  }
  candidates.sort((a, b) => b.key.length - a.key.length);
  for (const cand of candidates) {
    if (matchesWord(text, cand.key)) return cand.city;
  }
  return null;
}

function detectLocality(text, catalog, cityLower) {
  const pool = cityLower ? catalog.localities.filter((l) => l.cityLower === cityLower) : catalog.localities;
  const sorted = [...pool].sort((a, b) => b.localityLower.length - a.localityLower.length);
  for (const l of sorted) {
    if (matchesWord(text, l.localityLower)) return l.locality;
  }
  return null;
}

// Phrases that change an existing search rather than describe a new one.
const OPS = [
  ['reset', /\b(start over|start again|reset|new search|clear (?:all|everything)|from scratch)\b/],
  ['cheaper', /\b(cheaper|cheap|less expensive|lower (?:the )?(?:budget|price)|reduce (?:the )?(?:budget|price)|low(?:er)? cost|affordable)\b/],
  ['costlier', /\b(costlier|more expensive|higher (?:the )?(?:budget|price)|increase (?:the )?budget|raise (?:the )?budget|premium|luxury|upgrade)\b/],
  ['other-locality', /\b(another|different|other|else|new) (?:locality|localities|area|areas|neighbou?rhood)\b|\belsewhere\b/],
  ['larger', /\b(larger|bigger|more spacious|spacious|more area|bigger size|larger size)\b/],
  ['smaller', /\b(smaller|compact)\b/],
  ['broaden', /\b(broaden|widen|expand (?:the )?search|more options|relax)\b/],
];

const CLEAR_TARGETS = {
  budget: ['minPrice', 'maxPrice'],
  price: ['minPrice', 'maxPrice'],
  locality: ['locality', 'excludeLocalities'],
  area: ['locality', 'excludeLocalities'],
  bhk: ['bhk', 'bhkAtLeast'],
  furnishing: ['furnished'],
  possession: ['possession'],
  amenities: ['amenities'],
  size: ['minAreaSqft', 'maxAreaSqft', 'areaUnit'],
};

const SKIP_RE = /^\s*(skip|no preference|none|no|any|anything|any ?thing|doesn'?t matter|does not matter|not sure|don'?t care|dont care|whatever|flexible|anywhere|no limit|no budget limit|open to (?:all|anything)|any (?:city|area|locality|budget|size|bhk))\b/;
const SKIP_FIELDS = [
  ['budget', /\b(budget|price)\b/],
  ['city', /\b(city|town)\b/],
  ['locality', /\b(locality|area|neighbou?rhood)\b/],
  ['details', /\b(bhk|size|details|bedrooms?)\b/],
  ['propertyType', /\b(type|property type)\b/],
];
const SHOW_NOW_RE = /\b(show (?:me )?(?:the )?(?:results|options|properties|listings|matches)|show me now|search now|just show|go ahead|that'?s (?:all|it)|recommend(?: something)?|suggest(?: something)?|find (?:me )?(?:something|properties))\b/;

function extractRules(message, { catalog, current = {}, expecting = null } = {}) {
  const original = typeof message === 'string' ? message.slice(0, 600) : '';
  let text = original.toLowerCase().replace(/\s+/g, ' ').trim();
  const patch = {};
  const ambiguous = [];
  const ops = [];
  const clears = [];

  if (!text) return { patch, ambiguous, ops, clears, skip: null, showNow: false };

  for (const [op, re] of OPS) {
    if (re.test(text)) ops.push(op);
  }

  let skip = null;
  if (SKIP_RE.test(text) && text.length < 60) {
    const named = SKIP_FIELDS.find(([, re]) => re.test(text));
    skip = named ? named[0] : expecting || true;
  }

  const clearMatch = /\b(?:remove|clear|drop|ignore|forget|no)\s+(?:the\s+)?(budget|price|locality|area|bhk|furnishing|possession|amenities|size)\b(?:\s+(?:filter|limit|requirement|preference))?/.exec(text);
  if (clearMatch && /\b(remove|clear|drop|ignore|forget)\b/.test(clearMatch[0])) {
    clears.push(...CLEAR_TARGETS[clearMatch[1]]);
    text = text.replace(clearMatch[0], ' ');
  }

  const intent = detectIntent(text);
  if (intent.value) patch.intent = intent.value;
  if (intent.ambiguous) ambiguous.push({ field: 'intent', reason: 'both-buy-and-rent' });

  const types = detectTypes(text);
  if (types.length === 1) patch.propertyType = types[0];
  else if (types.length > 1) ambiguous.push({ field: 'propertyType', reason: 'multiple-types', values: types });

  const bhk = extractBhk(text);
  text = bhk.text;
  if (bhk.value !== undefined) {
    patch.bhk = bhk.value;
    if (bhk.atLeast) patch.bhkAtLeast = true;
    else patch.bhkAtLeast = false;
  }

  const area = extractArea(text);
  text = area.text;
  if (area.min !== undefined) patch.minAreaSqft = area.min;
  if (area.max !== undefined) patch.maxAreaSqft = area.max;
  if (area.unit) patch.areaUnit = area.unit;

  // Words that are only filler for the budget parser.
  const budgetIntent = patch.intent || current.intent;
  const budget = extractBudget(text, { expecting, intent: budgetIntent });
  if (budget.min !== undefined) patch.minPrice = budget.min;
  if (budget.max !== undefined) patch.maxPrice = budget.max;
  if (budget.ambiguous) ambiguous.push({ field: 'budget', ...budget.ambiguous });
  // "Budget between X and Y" replaces both ends; a single bound keeps the other as is,
  // except a fresh upper bound replaces an old one on its own.

  const furnished = /\bsemi[- ]?furnished\b/.test(text)
    ? 'semi-furnished'
    : /\b(un[- ]?furnished|bare ?shell)\b/.test(text)
      ? 'unfurnished'
      : /\b(fully[- ]?furnished|furnished)\b/.test(text)
        ? 'furnished'
        : null;
  if (furnished) patch.furnished = furnished;

  if (/\b(ready[- ]to[- ]move|ready possession|immediate possession|move[- ]in ready|ready flats?|ready to occupy)\b/.test(text)) {
    patch.possession = 'ready';
  } else if (/\b(under[- ]construction|new launch|upcoming|pre[- ]launch|not ready)\b/.test(text)) {
    patch.possession = 'under-construction';
  }

  const amenityHits = [];
  const amenityWords = [
    ['Parking', /\b(parking|garage|car park)\b/],
    ['Lift', /\b(lift|elevator)\b/],
    ['Power Backup', /\bpower backup\b/],
    ['Security', /\b(security|gated)\b/],
    ['Gym', /\b(gym|fitness)\b/],
    ['Clubhouse', /\bclub ?house\b/],
    ['Garden', /\b(garden|park view)\b/],
    ['Swimming Pool', /\b(swimming pool|pool)\b/],
    ['Kids Play Area', /\b(kids play|play area|children'?s play)\b/],
    ['Pet Friendly', /\bpet[- ]friendly\b/],
  ];
  for (const [name, re] of amenityWords) {
    if (re.test(text) && KNOWN_AMENITIES.includes(name)) amenityHits.push(name);
  }
  if (amenityHits.length > 0) {
    patch.amenities = [...new Set([...(current.amenities || []), ...amenityHits])];
  }

  // Location. Prefer a city named in the message; otherwise keep the current one for locality lookup.
  const cityInText = detectCity(text, catalog);
  let locality;
  if (cityInText) {
    patch.city = cityInText;
    locality = detectLocality(text, catalog, normalizeCity(cityInText));
  } else {
    locality = detectLocality(text, catalog, current.city ? normalizeCity(current.city) : null)
      || detectLocality(text, catalog, null);
  }
  // Do not let a locality that is also a city alias word shadow the city.
  if (locality) patch.locality = locality;

  // A place the inventory does not contain: only flagged when the user clearly named one.
  if (!cityInText && !locality) {
    const named = /\b(?:in|at|near|around)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/.exec(original);
    const bare = (expecting === 'city' || expecting === 'locality') && !skip && ops.length === 0
      && Object.keys(patch).length === 0 && original.trim().length > 1 && original.trim().length <= 40
      && /^[A-Za-z][A-Za-z .'-]*$/.test(original.trim());
    const searching = Boolean(patch.intent || patch.propertyType || patch.bhk != null || current.intent || current.propertyType || expecting);
    if (named && searching) patch.city = named[1].trim();
    else if (bare) patch[expecting === 'locality' ? 'locality' : 'city'] = original.trim();
  }

  // Plots cannot be rented here, so a plot request with no stated intent can only mean buying.
  if (patch.propertyType === 'plot' && !patch.intent && !current.intent) patch.intent = 'buy';
  if (patch.propertyType === 'pg-hostel' && !patch.intent && !current.intent) patch.intent = 'rent';

  const showNow = SHOW_NOW_RE.test(text);
  return { patch, ambiguous, ops, clears, skip, showNow };
}

module.exports = { extractRules, CITY_ALIASES };
