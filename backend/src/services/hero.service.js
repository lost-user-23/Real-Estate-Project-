const HeroBanner = require('../models/HeroBanner');
const { deleteAssetsByPublicIds, resolvePublicId } = require('./cloudinaryAssets.service');

const { HERO_DECORATIONS } = HeroBanner;

async function getOrCreate() {
  // Not saved until the first update, so public reads never write.
  return (await HeroBanner.findOne({ key: 'hero' })) || new HeroBanner({ key: 'hero' });
}

function plainEvent(event) {
  return {
    id: String(event._id),
    name: event.name,
    decoration: event.decoration,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    enabled: event.enabled,
    greeting: event.greeting || '',
    badge: event.badge || '',
    titleLead: event.titleLead || '',
    titleAccent: event.titleAccent || '',
    subtitle: event.subtitle || '',
  };
}

// What the admin editor works with.
function serializeAdmin(doc) {
  return {
    slides: doc.slides.map((s) => ({ url: s.url, publicId: s.publicId, alt: s.alt || '' })),
    badge: doc.badge || '',
    titleLead: doc.titleLead || '',
    titleAccent: doc.titleAccent || '',
    subtitle: doc.subtitle || '',
    manualDecoration: doc.manualDecoration || null,
    events: doc.events.map(plainEvent),
    updatedAt: doc.updatedAt,
  };
}

// The first enabled event whose window contains `now` (earliest start wins on overlap).
function activeEvent(doc, now) {
  return (
    [...doc.events]
      .filter((e) => e.enabled && e.startsAt <= now && now <= e.endsAt)
      .sort((a, b) => a.startsAt - b.startsAt)[0] || null
  );
}

// What visitors get: the base content with any active event layered on top. Empty strings mean
// "not customised", so the frontend falls back to its built-in copy.
function resolvePublic(doc, now = new Date()) {
  const event = doc.manualDecoration ? null : activeEvent(doc, now);
  const pick = (field) => (event && event[field]) || doc[field] || '';
  return {
    slides: doc.slides.map((s) => ({ url: s.url, alt: s.alt || '' })),
    badge: pick('badge'),
    titleLead: pick('titleLead'),
    titleAccent: pick('titleAccent'),
    subtitle: pick('subtitle'),
    decoration: doc.manualDecoration || (event ? event.decoration : null),
    greeting: event ? event.greeting || '' : '',
  };
}

async function getPublicHero(now) {
  return resolvePublic(await getOrCreate(), now);
}

async function getAdminHero() {
  return serializeAdmin(await getOrCreate());
}

// Applies already-validated fields. Cloudinary assets for slides that were dropped are
// deleted after the save, best effort.
async function updateHero(fields) {
  const doc = await getOrCreate();
  const previous = doc.slides.map((s) => ({ url: s.url, publicId: s.publicId }));

  for (const key of ['slides', 'badge', 'titleLead', 'titleAccent', 'subtitle', 'manualDecoration', 'events']) {
    if (fields[key] !== undefined) doc[key] = fields[key];
  }
  await doc.save();

  const kept = new Set(doc.slides.map((s) => s.url));
  const dropped = previous
    .filter((s) => !kept.has(s.url))
    .map((s) => resolvePublicId(s))
    .filter(Boolean);
  if (dropped.length) await deleteAssetsByPublicIds(dropped);

  return serializeAdmin(doc);
}

module.exports = { HERO_DECORATIONS, getPublicHero, getAdminHero, updateHero, resolvePublic };
