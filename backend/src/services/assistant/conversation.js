const { getCatalog } = require('./catalog');
const {
  sanitizePatch,
  applyPatch,
  sanitizeState,
  typeIntentConflict,
  TYPES_BY_INTENT,
  PROPERTY_TYPE_LABELS,
  BHK_TYPES,
  AREA_TYPES,
  AREA_UNIT_LABELS,
  KNOWN_AMENITIES,
} = require('./preferences');
const { extractRules } = require('./ruleExtractor');
const { extractWithModel, isConfigured } = require('./llmExtractor');
const { searchProperties, broadeningOptions } = require('./search');
const { formatPrice, formatArea, niceAmount } = require('./format');

// One turn of the guided property finder. State travels with the client but is
// rebuilt through sanitizeState on every request, so the server never trusts
// it. All wording is produced here from validated state and database results;
// the language model, when configured, only helps read what the user typed.

const SKIPPABLE = ['propertyType', 'budget', 'city', 'locality', 'details'];
const EXPECTABLE = ['intent', 'propertyType', 'budget', 'city', 'locality', 'details', 'extras'];
const REFINE_KINDS = ['cheaper', 'costlier', 'other-locality', 'larger', 'smaller', 'broaden'];
const BROADEN_KINDS = ['any-locality', 'raise-budget'];
const MAX_MESSAGE_LENGTH = 500;

const BUDGET_PRESETS = {
  buy: [
    { label: 'Under ₹50 L', maxPrice: 5_000_000 },
    { label: '₹50 L - ₹1 Cr', minPrice: 5_000_000, maxPrice: 10_000_000 },
    { label: '₹1 Cr - ₹2 Cr', minPrice: 10_000_000, maxPrice: 20_000_000 },
    { label: 'Above ₹2 Cr', minPrice: 20_000_000 },
  ],
  rent: [
    { label: 'Under ₹15,000', maxPrice: 15_000 },
    { label: '₹15,000 - ₹30,000', minPrice: 15_000, maxPrice: 30_000 },
    { label: '₹30,000 - ₹50,000', minPrice: 30_000, maxPrice: 50_000 },
    { label: 'Above ₹50,000', minPrice: 50_000 },
  ],
};

const AREA_PRESETS = [
  { label: 'Under 1,000 sq ft', maxAreaSqft: 1000 },
  { label: '1,000 - 2,000 sq ft', minAreaSqft: 1000, maxAreaSqft: 2000 },
  { label: '2,000 - 5,000 sq ft', minAreaSqft: 2000, maxAreaSqft: 5000 },
  { label: '5,000+ sq ft', minAreaSqft: 5000 },
];

// ---------------------------------------------------------------- helpers

const chip = (label, action, extra = {}) => ({ label, action, ...extra });
const patchChip = (label, prefs) => chip(label, { type: 'patch', prefs });
const skipChip = (field, label = 'Skip') => chip(label, { type: 'skip', field });

function budgetText(prefs) {
  const per = prefs.intent === 'rent' ? '/month' : '';
  const { minPrice: lo, maxPrice: hi } = prefs;
  if (lo != null && hi != null) return `${formatPrice(lo)} - ${formatPrice(hi)}${per}`;
  if (hi != null) return `Up to ${formatPrice(hi)}${per}`;
  if (lo != null) return `From ${formatPrice(lo)}${per}`;
  return null;
}

function areaText(prefs) {
  const { minAreaSqft: lo, maxAreaSqft: hi, areaUnit } = prefs;
  if (lo != null && hi != null) return `${formatArea(lo, areaUnit)} - ${formatArea(hi, areaUnit)}`;
  if (hi != null) return `Up to ${formatArea(hi, areaUnit)}`;
  if (lo != null) return `${formatArea(lo, areaUnit)}+`;
  return null;
}

function criteriaText(prefs) {
  const parts = [];
  if (prefs.propertyType) parts.push(PROPERTY_TYPE_LABELS[prefs.propertyType].toLowerCase());
  if (prefs.intent) parts.push(prefs.intent === 'rent' ? 'to rent' : 'to buy');
  if (prefs.locality || prefs.city) parts.push(`in ${[prefs.locality, prefs.city].filter(Boolean).join(', ')}`);
  const budget = budgetText(prefs);
  if (budget) parts.push(`(${budget[0].toLowerCase()}${budget.slice(1)})`);
  return parts.join(' ') || 'your preferences';
}

// What the user sees in the "your preferences" panel. `ask` is the question to
// re-open for editing; `clear` is the set of fields removed by the x button.
function buildSummary(prefs, skipped) {
  const rows = [];
  const add = (key, label, value, ask, clear) => rows.push({ key, label, value, ask, clear });

  if (prefs.intent) add('intent', 'Looking to', prefs.intent === 'rent' ? 'Rent' : 'Buy', 'intent', null);
  if (prefs.propertyType) add('propertyType', 'Property', PROPERTY_TYPE_LABELS[prefs.propertyType], 'propertyType', ['propertyType']);
  else if (skipped.includes('propertyType')) add('propertyType', 'Property', 'Any type', 'propertyType', null);

  const budget = budgetText(prefs);
  if (budget) add('budget', prefs.intent === 'rent' ? 'Rent' : 'Budget', budget, 'budget', ['minPrice', 'maxPrice']);
  else if (skipped.includes('budget')) add('budget', 'Budget', 'No limit', 'budget', null);

  if (prefs.city) add('city', 'City', prefs.city, 'city', ['city']);
  else if (skipped.includes('city')) add('city', 'City', 'Any city', 'city', null);

  if (prefs.locality) add('locality', 'Locality', prefs.locality, 'locality', ['locality']);
  else if (skipped.includes('locality') && prefs.city) add('locality', 'Locality', `Anywhere in ${prefs.city}`, 'locality', null);
  if (prefs.excludeLocalities?.length) add('excludeLocalities', 'Excluding', prefs.excludeLocalities.join(', '), 'locality', ['excludeLocalities']);

  if (prefs.bhk != null) add('bhk', 'Bedrooms', `${prefs.bhk}${prefs.bhkAtLeast ? '+' : ''} BHK`, 'details', ['bhk', 'bhkAtLeast']);
  const area = areaText(prefs);
  if (area) add('area', 'Size', area, 'details', ['minAreaSqft', 'maxAreaSqft', 'areaUnit']);
  if (prefs.furnished) add('furnished', 'Furnishing', prefs.furnished, 'extras', ['furnished']);
  if (prefs.possession) add('possession', 'Possession', prefs.possession === 'ready' ? 'Ready to move' : 'Under construction', 'extras', ['possession']);
  if (prefs.amenities?.length) add('amenities', 'Amenities', prefs.amenities.join(', '), 'extras', ['amenities']);
  return rows;
}

// ---------------------------------------------------------------- questions

function questionFor(field, prefs, catalog, { editing = false } = {}) {
  const lead = editing ? 'Sure. ' : '';
  switch (field) {
    case 'intent':
      return {
        text: `${lead}Are you looking to buy or rent?`,
        quickReplies: [patchChip('Buy', { intent: 'buy' }), patchChip('Rent', { intent: 'rent' })],
      };
    case 'propertyType': {
      const types = TYPES_BY_INTENT[prefs.intent || 'buy'];
      return {
        text: `${lead}What type of property are you looking for?`,
        quickReplies: [
          ...types.map((t) => patchChip(PROPERTY_TYPE_LABELS[t], { propertyType: t })),
          skipChip('propertyType', 'Show any type'),
        ],
      };
    }
    case 'budget': {
      const presets = BUDGET_PRESETS[prefs.intent || 'buy'];
      return {
        text: prefs.intent === 'rent'
          ? `${lead}What monthly rent range works for you? Pick one or type your own, like “under 25k”.`
          : `${lead}What is your budget? Pick a range or type your own, like “under 70 lakh”.`,
        quickReplies: [
          ...presets.map(({ label, ...range }) => patchChip(label, { minPrice: range.minPrice ?? null, maxPrice: range.maxPrice ?? null })),
          skipChip('budget', 'No fixed budget'),
        ],
      };
    }
    case 'city': {
      const top = catalog.cities.slice(0, 8);
      return {
        text: `${lead}Which city should I search in?`,
        quickReplies: [...top.map((c) => patchChip(c.city, { city: c.city })), skipChip('city', 'Any city')],
      };
    }
    case 'locality': {
      const inCity = catalog.localities.filter((l) => l.cityLower === (prefs.city || '').toLowerCase()).slice(0, 8);
      return {
        text: prefs.city
          ? `${lead}Do you have a preferred locality in ${prefs.city}? You can type one or pick below.`
          : `${lead}Which locality do you prefer? Tell me the city too if you can.`,
        quickReplies: [
          ...inCity.map((l) => patchChip(l.locality, { city: prefs.city, locality: l.locality })),
          skipChip('locality', prefs.city ? `Anywhere in ${prefs.city}` : 'No preference'),
        ],
      };
    }
    case 'details': {
      if (AREA_TYPES.includes(prefs.propertyType)) {
        return {
          text: `${lead}What plot or built-up size do you need? Type something like “200 sq yd” or pick a range.`,
          quickReplies: [
            ...AREA_PRESETS.map(({ label, ...range }) => patchChip(label, { minAreaSqft: range.minAreaSqft ?? null, maxAreaSqft: range.maxAreaSqft ?? null })),
            skipChip('details'),
          ],
        };
      }
      return {
        text: `${lead}How many bedrooms (BHK) do you want?`,
        quickReplies: [
          ...[1, 2, 3, 4].map((n) => patchChip(`${n} BHK`, { bhk: n, bhkAtLeast: false })),
          patchChip('5+ BHK', { bhk: 5, bhkAtLeast: true }),
          skipChip('details'),
        ],
      };
    }
    case 'extras': {
      const replies = [];
      if (prefs.propertyType !== 'plot') {
        replies.push(patchChip('Furnished', { furnished: 'furnished' }), patchChip('Semi-furnished', { furnished: 'semi-furnished' }));
        replies.push(patchChip('Ready to move', { possession: 'ready' }));
        if (prefs.intent === 'buy') replies.push(patchChip('Under construction', { possession: 'under-construction' }));
      }
      for (const a of ['Parking', 'Lift', 'Gym', 'Swimming Pool', 'Security']) {
        if (!(prefs.amenities || []).includes(a)) replies.push(patchChip(a, { amenities: [...(prefs.amenities || []), a] }));
      }
      return { text: `${lead}Anything else that matters? Tap to add, or type it.`, quickReplies: replies };
    }
    default:
      return { text: 'How can I help you find a property?', quickReplies: [] };
  }
}

// Which question comes next, or null when it is time to search.
function nextQuestion(prefs, st, { showNow, bulk }) {
  if (!prefs.intent) return 'intent';
  if (!prefs.propertyType && !st.skipped.includes('propertyType')) return 'propertyType';
  if (prefs.minPrice == null && prefs.maxPrice == null && !st.skipped.includes('budget') && !showNow) return 'budget';
  if (!prefs.city && !st.skipped.includes('city')) return 'city';
  const hasDetails = prefs.bhk != null || prefs.minAreaSqft != null || prefs.maxAreaSqft != null;
  if (st.searched || showNow || bulk || hasDetails) return null;
  if (prefs.city && !prefs.locality && !st.skipped.includes('locality')) return 'locality';
  const wantsDetails = BHK_TYPES.includes(prefs.propertyType) || AREA_TYPES.includes(prefs.propertyType);
  if (wantsDetails && !st.skipped.includes('details')) return 'details';
  return null;
}

// ---------------------------------------------------------------- actions

function parseAction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  switch (raw.type) {
    case 'patch':
      return { type: 'patch', prefs: raw.prefs };
    case 'skip':
      return SKIPPABLE.includes(raw.field) ? { type: 'skip', field: raw.field } : null;
    case 'ask':
      return EXPECTABLE.includes(raw.field) ? { type: 'ask', field: raw.field } : null;
    case 'refine':
      return REFINE_KINDS.includes(raw.kind) ? { type: 'refine', kind: raw.kind } : null;
    case 'broaden':
      return BROADEN_KINDS.includes(raw.kind) ? { type: 'broaden', kind: raw.kind } : null;
    case 'search':
      return { type: 'search' };
    case 'reset':
      return { type: 'reset' };
    default:
      return null;
  }
}

// Turns a refinement into a raw preference patch using the last results as the
// reference point, e.g. "cheaper" lowers the budget relative to what was shown.
function refinementPatch(kind, prefs, st) {
  const stats = st.lastStats || {};
  const notes = [];
  const patch = {};

  switch (kind) {
    case 'cheaper': {
      const base = prefs.maxPrice ?? stats.maxPrice;
      if (base == null) return { needs: 'budget' };
      patch.maxPrice = niceAmount(base * 0.8);
      if (prefs.minPrice != null && prefs.minPrice > patch.maxPrice) patch.minPrice = null;
      notes.push(`Lowering your budget ceiling to ${formatPrice(patch.maxPrice)}.`);
      break;
    }
    case 'costlier':
    case 'broaden': {
      const base = prefs.maxPrice ?? stats.maxPrice;
      if (base != null) {
        patch.maxPrice = niceAmount(base * 1.25);
        notes.push(`Raising your budget ceiling to ${formatPrice(patch.maxPrice)}.`);
      }
      if (kind === 'broaden' && prefs.locality) {
        patch.locality = null;
        notes.push(`Searching all of ${prefs.city} instead of ${prefs.locality}.`);
      }
      if (base == null && !(kind === 'broaden' && prefs.locality)) return { needs: 'budget' };
      break;
    }
    case 'any-locality': {
      if (!prefs.locality && !prefs.excludeLocalities?.length) return { needs: 'locality' };
      patch.locality = null;
      patch.excludeLocalities = null;
      notes.push(`Searching all of ${prefs.city} instead of ${prefs.locality || 'the localities I excluded'}.`);
      break;
    }
    case 'other-locality': {
      const exclude = [...(prefs.excludeLocalities || [])];
      if (prefs.locality) exclude.push(prefs.locality);
      else exclude.push(...(stats.localities || []));
      if (exclude.length === 0) return { needs: 'locality' };
      patch.excludeLocalities = [...new Set(exclude)].slice(0, 10);
      patch.locality = null;
      notes.push(`Looking outside ${exclude.slice(0, 3).join(', ')}.`);
      break;
    }
    case 'larger':
    case 'smaller': {
      const up = kind === 'larger';
      if (BHK_TYPES.includes(prefs.propertyType) && prefs.bhk != null) {
        patch.bhk = up ? Math.min(prefs.bhk + 1, 10) : Math.max(prefs.bhk - 1, 0);
        patch.bhkAtLeast = up;
        notes.push(`Looking at ${patch.bhk}${up ? '+' : ''} BHK.`);
        break;
      }
      const base = (up ? prefs.minAreaSqft : prefs.maxAreaSqft) ?? stats.medianAreaSqft;
      if (base == null) return { needs: 'details' };
      const target = Math.round(base * (up ? 1.15 : 0.85));
      if (up) {
        patch.minAreaSqft = target;
        patch.maxAreaSqft = null;
      } else {
        patch.maxAreaSqft = target;
        patch.minAreaSqft = null;
      }
      notes.push(`${up ? 'At least' : 'Up to'} ${formatArea(target, prefs.areaUnit)}.`);
      break;
    }
    default:
      break;
  }
  return { patch, notes };
}

// ---------------------------------------------------------------- the turn

function emptyState() {
  return { prefs: {}, skipped: [], expecting: null, searched: false, lastStats: null };
}

function ambiguityReply(item, prefs, catalog) {
  switch (item.field) {
    case 'city': {
      const cities = catalog.cities.slice(0, 8).map((c) => c.city);
      return {
        text: `I don't have any published listings in “${item.value}” yet. I can search ${cities.length ? cities.join(', ') : 'the cities on HomeNest'}. Which one would you like?`,
        expecting: 'city',
        quickReplies: [...cities.map((c) => patchChip(c, { city: c })), skipChip('city', 'Any city')],
      };
    }
    case 'locality': {
      if (item.reason === 'multiple-cities') {
        return {
          text: `“${item.value}” appears in more than one city (${item.cities.join(', ')}). Which city do you mean?`,
          expecting: 'city',
          quickReplies: item.cities.map((c) => patchChip(c, { city: c, locality: item.value })),
        };
      }
      const q = questionFor('locality', prefs, catalog);
      return {
        text: `I couldn't find a locality called “${item.value}”${prefs.city ? ` in ${prefs.city}` : ''}. ${q.text}`,
        expecting: 'locality',
        quickReplies: q.quickReplies,
      };
    }
    case 'budget': {
      if (item.reason === 'missing-unit') {
        const n = item.value;
        const rent = prefs.intent === 'rent';
        const options = rent
          ? [[`₹${n} thousand`, n * 1000], [`₹${n} lakh`, n * 100_000]]
          : [[`₹${n} lakh`, n * 100_000], [`₹${n} crore`, n * 10_000_000]];
        return {
          text: `Just to be sure about the budget: did you mean ${options.map(([l]) => l).join(' or ')}?`,
          expecting: 'budget',
          quickReplies: options.map(([label, value]) => patchChip(label.replace('₹', '₹'), { maxPrice: value, minPrice: null })),
        };
      }
      return { ...questionFor('budget', prefs, catalog), text: 'Your minimum budget is higher than your maximum. What range did you mean?', expecting: 'budget' };
    }
    case 'intent':
      return { ...questionFor('intent', prefs, catalog), text: 'I read both buying and renting in that. Which do you want?', expecting: 'intent' };
    case 'propertyType': {
      const values = (item.values || []).map((t) => patchChip(PROPERTY_TYPE_LABELS[t], { propertyType: t }));
      return { text: 'Which one should I search for first?', expecting: 'propertyType', quickReplies: values };
    }
    case 'area':
      return { ...questionFor('details', prefs, catalog), text: 'The minimum size is above the maximum. What size range did you mean?', expecting: 'details' };
    default:
      return null;
  }
}

function resultsIntro(prefs, found) {
  const { exactTotal, exact, approximate } = found;
  const what = criteriaText(prefs);
  if (exact.length > 0) {
    const more = exactTotal > exact.length ? `, showing the top ${exact.length}` : '';
    let text = `I found ${exactTotal} published listing${exactTotal === 1 ? '' : 's'} for ${what} that match${exactTotal === 1 ? 'es' : ''} everything you asked for${more}.`;
    if (approximate.length > 0) text += ` ${approximate.length} close match${approximate.length === 1 ? '' : 'es'} follow, each marked with what differs.`;
    return text;
  }
  if (approximate.length > 0) {
    return `No listing for ${what} matches every preference exactly. These ${approximate.length} are the closest published options, and each says what differs.`;
  }
  return `I couldn't find any published listings for ${what}.`;
}

function followUpChips(prefs, found) {
  const chips = [];
  if (found.exact.length + found.approximate.length > 0) {
    if (prefs.maxPrice != null || found.stats.maxPrice != null) chips.push(chip('Show cheaper options', { type: 'refine', kind: 'cheaper' }));
    if (prefs.city) chips.push(chip('Try another locality', { type: 'refine', kind: 'other-locality' }));
    if (prefs.propertyType === 'plot' || prefs.bhk == null) chips.push(chip('Show larger ones', { type: 'refine', kind: 'larger' }));
    if (prefs.propertyType && prefs.propertyType !== 'plot' && prefs.propertyType !== 'pg-hostel' && !prefs.possession && prefs.intent === 'buy') {
      chips.push(patchChip('Only ready-to-move', { possession: 'ready' }));
    }
    chips.push(chip('Add more preferences', { type: 'ask', field: 'extras' }));
  }
  chips.push(chip('Start over', { type: 'reset' }));
  return chips.slice(0, 6);
}

async function handleTurn({ message, action, state } = {}, { llm = extractWithModel } = {}) {
  const catalog = await getCatalog();
  const out = { messages: [], quickReplies: [], results: null, ignored: [], aiUsed: false };
  let st = sanitizeState(state, catalog);
  const text = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  const act = parseAction(action);
  if (action && !act) out.ignored.push({ field: 'action', reason: 'unsupported action' });

  const say = (t) => out.messages.push(t);
  let rawPatch = {};
  let ambiguous = [];
  let showNow = false;
  let skipField = null;
  let editField = null;
  let notes = [];
  let offTopic = false;

  if (act?.type === 'reset') {
    st = emptyState();
    say('Okay, starting fresh. I can help you find a property to buy or rent.');
  } else if (act?.type === 'ask') {
    editField = act.field;
  } else if (act?.type === 'skip') {
    skipField = act.field;
  } else if (act?.type === 'search') {
    showNow = true;
  } else if (act?.type === 'patch') {
    rawPatch = act.prefs && typeof act.prefs === 'object' ? { ...act.prefs } : {};
  } else if (act?.type === 'broaden' || act?.type === 'refine') {
    const kind = act.type === 'broaden' ? (act.kind === 'any-locality' ? 'any-locality' : 'costlier') : act.kind;
    const r = refinementPatch(kind, st.prefs, st);
    if (r.needs) {
      editField = r.needs;
    } else {
      rawPatch = r.patch;
      notes = r.notes;
    }
  } else if (text) {
    const rules = extractRules(text, { catalog, current: st.prefs, expecting: st.expecting });
    rawPatch = { ...rules.patch };
    ambiguous = [...rules.ambiguous];
    showNow = rules.showNow;

    let modelPatch = null;
    if (isConfigured() && rules.ops.length === 0 && !rules.skip) {
      modelPatch = await llm(text, { current: st.prefs, expecting: st.expecting, cities: catalog.cities.map((c) => c.city) });
    }
    if (modelPatch && typeof modelPatch === 'object') {
      out.aiUsed = true;
      // Rules win key by key; the model fills what the rules could not read.
      rawPatch = { ...modelPatch, ...rawPatch };
      if (modelPatch.minPrice !== undefined || modelPatch.maxPrice !== undefined) {
        ambiguous = ambiguous.filter((a) => a.field !== 'budget' || a.reason !== 'missing-unit');
      }
    }

    for (const field of rules.clears) rawPatch[field] = null;

    for (const op of rules.ops) {
      if (op === 'reset') {
        st = emptyState();
        rawPatch = {};
        ambiguous = [];
        say('Okay, starting fresh.');
        break;
      }
      const r = refinementPatch(op, st.prefs, st);
      if (r.needs) editField = r.needs;
      else {
        rawPatch = { ...r.patch, ...rawPatch };
        notes.push(...r.notes);
      }
    }

    if (rules.skip && st.expecting) {
      const field = typeof rules.skip === 'string' && rules.skip !== 'true' ? rules.skip : st.expecting;
      if (SKIPPABLE.includes(field)) skipField = field;
    }
    if (Object.keys(rawPatch).length === 0 && ambiguous.length === 0 && !skipField && !editField && !showNow && rules.ops.length === 0) {
      offTopic = true;
    }
  }

  // Validate. Whatever the client, rules or model proposed is filtered here.
  const clean = sanitizePatch(rawPatch, catalog, st.prefs);
  out.ignored.push(...clean.ignored);
  ambiguous.push(...clean.ambiguous);
  const changedFields = Object.keys(clean.patch);
  const touched = changedFields.length > 0;

  const applied = applyPatch(st.prefs, clean.patch);
  let prefs = applied.prefs;
  if (applied.dropped.includes('budget')) st.skipped = st.skipped.filter((f) => f !== 'budget');
  if (clean.patch.propertyType) st.skipped = st.skipped.filter((f) => f !== 'propertyType');
  if (clean.patch.city) st.skipped = st.skipped.filter((f) => f !== 'city');

  if (skipField) {
    if (!st.skipped.includes(skipField)) st.skipped.push(skipField);
    if (skipField === 'budget') {
      delete prefs.minPrice;
      delete prefs.maxPrice;
    }
    if (skipField === 'locality') delete prefs.locality;
    if (skipField === 'city') {
      delete prefs.city;
      delete prefs.locality;
    }
  }
  // A fresh answer to a question the user once skipped un-skips it.
  if (prefs.minPrice != null || prefs.maxPrice != null) st.skipped = st.skipped.filter((f) => f !== 'budget');
  if (prefs.locality) st.skipped = st.skipped.filter((f) => f !== 'locality');

  // Pairs that are not offered (a rental plot): say so rather than guess.
  const conflict = typeIntentConflict(prefs);
  let conflictReply = null;
  if (conflict) {
    const rentalPlot = prefs.propertyType === 'plot';
    conflictReply = {
      text: `${conflict} ${rentalPlot ? 'Would you like to buy a plot, or rent a different type of property?' : 'Would you like to rent it, or buy a different type of property?'}`,
      expecting: rentalPlot ? 'intent' : 'propertyType',
      quickReplies: rentalPlot
        ? [patchChip('Buy a plot', { intent: 'buy', propertyType: 'plot' }), patchChip('Rent something else', { intent: 'rent', propertyType: null })]
        : [patchChip('Rent it', { intent: 'rent' }), patchChip('Buy something else', { intent: 'buy', propertyType: null })],
    };
    delete prefs.propertyType;
  }

  if (applied.dropped.includes('budget')) {
    notes.push('Since you switched between buying and renting, I cleared the budget.');
  }
  if (applied.dropped.includes('propertyType') && !conflictReply) {
    notes.push('That property type is not offered for this option, so I cleared it.');
  }

  st.prefs = prefs;

  // Decide what to say next.
  let question = null; // { field, text, quickReplies }
  const bulk = changedFields.filter((f) => f !== 'areaUnit' && f !== 'bhkAtLeast').length >= 3 && !act;

  if (conflictReply) {
    question = { ...conflictReply };
  } else if (ambiguous.length > 0) {
    question = ambiguityReply(ambiguous[0], prefs, catalog);
  }
  if (!question && editField) {
    const q = questionFor(editField, prefs, catalog, { editing: true });
    question = { ...q, expecting: editField };
  }
  if (!question) {
    const field = nextQuestion(prefs, st, { showNow, bulk });
    if (field) {
      const q = questionFor(field, prefs, catalog);
      question = { ...q, expecting: field };
    }
  }

  if (notes.length > 0) say(notes.join(' '));
  else if (touched && !act && !offTopic) say(`Got it: ${criteriaText(prefs)}.`);

  if (offTopic) {
    const looksLikeQuestion = /\?|^(what|how|why|can|is|are|do|does|will|should)\b/i.test(text);
    const finance = /\b(loan|emi|interest|mortgage|lender|bank)\b/i.test(text);
    if (finance) {
      say('I can point you to HomeNest\'s EMI calculator and loan enquiry form, but I can\'t quote rates or confirm any lender\'s offer.');
      out.quickReplies.push(chip('EMI calculator', null, { href: '/tools/emi-calculator' }), chip('Loan options', null, { href: '/tools/loans' }));
    } else if (looksLikeQuestion) {
      say('I\'m here to match you with listings from HomeNest\'s database, so I can\'t answer legal or general property questions. Tell me what you are looking for and I\'ll search.');
    } else {
      say('I didn\'t catch a property preference in that. Tell me what you want to buy or rent, or pick an option.');
    }
  }

  if (question) {
    st.expecting = question.expecting || null;
    say(question.text);
    out.quickReplies.push(...question.quickReplies);
  } else if (prefs.intent) {
    // Nothing left to ask: search. Preferences irrelevant to the type are not applied.
    const forSearch = { ...prefs };
    if (forSearch.propertyType && !BHK_TYPES.includes(forSearch.propertyType)) {
      delete forSearch.bhk;
      delete forSearch.bhkAtLeast;
    }
    const found = await searchProperties(forSearch);
    st.searched = true;
    st.expecting = null;
    st.lastStats = found.stats;
    out.results = {
      exact: found.exact,
      approximate: found.approximate,
      exactTotal: found.exactTotal,
      approximateTotal: found.approximateTotal,
    };
    say(resultsIntro(forSearch, found));

    if (found.exact.length === 0) {
      const options = await broadeningOptions(forSearch);
      const chips = [];
      for (const option of options) {
        if (option.kind === 'any-locality') {
          chips.push(chip(`Search all of ${prefs.city} (${option.count} listings)`, { type: 'broaden', kind: 'any-locality' }));
        } else if (option.kind === 'raise-budget') {
          chips.push(chip(`Raise budget to ${formatPrice(option.maxPrice)} (${option.count} listings)`, { type: 'broaden', kind: 'raise-budget' }));
        }
      }
      if (found.approximate.length === 0) {
        say(options.length > 0
          ? 'I can widen the search for you. Here is what would actually bring up listings:'
          : 'Nothing is listed for that combination right now. You can change the city, property type or budget.');
      }
      out.quickReplies.push(...chips);
      out.quickReplies.push(chip('Change city', { type: 'ask', field: 'city' }), chip('Change property type', { type: 'ask', field: 'propertyType' }));
      out.quickReplies.push(chip('Start over', { type: 'reset' }));
    } else {
      say('Listing details come from HomeNest\'s live database. EMI figures are estimates only, not lender offers.');
      out.quickReplies.push(...followUpChips(prefs, found));
    }
  } else {
    // No intent yet and nothing to ask is impossible; fall back to the first question.
    const q = questionFor('intent', prefs, catalog);
    st.expecting = 'intent';
    say(q.text);
    out.quickReplies.push(...q.quickReplies);
  }

  out.state = {
    prefs: st.prefs,
    skipped: st.skipped,
    expecting: st.expecting,
    searched: st.searched,
    lastStats: st.lastStats,
  };
  out.summary = buildSummary(st.prefs, st.skipped);
  return out;
}

// Greeting for a brand-new conversation.
async function startConversation() {
  const catalog = await getCatalog();
  const q = questionFor('intent', {}, catalog);
  return {
    messages: ['Hi, I\'m the HomeNest property finder. Tell me what you are looking for, like “3 BHK flat in Jaipur under ₹70 lakh”, or answer a few quick questions.', q.text],
    quickReplies: q.quickReplies,
    results: null,
    ignored: [],
    aiUsed: false,
    state: { ...emptyState(), expecting: 'intent' },
    summary: [],
  };
}

module.exports = {
  handleTurn,
  startConversation,
  MAX_MESSAGE_LENGTH,
  KNOWN_AMENITIES,
  AREA_UNIT_LABELS,
};
