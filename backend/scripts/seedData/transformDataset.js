const { FURNISHING_OPTIONS, FACING_OPTIONS } = require('../../src/models/Property');
const { normalizeCity } = require('../../src/utils/normalizeCity');

const PROPERTY_TYPE_MAP = {
  apartment: 'apartment',
  'residential house': 'independent-house',
  'studio apartment': 'studio',
  'builder floor apartment': 'apartment',
  'service apartment': 'apartment',
  villa: 'villa',
  penthouse: 'penthouse',
};

const MAX_DESCRIPTION_LENGTH = 2000;

// "70,000" -> 70000, "1.4 Lac" -> 140000, "1.2 Cr" -> 12000000.
// "Call for Price" and anything else unreadable -> null.
function parsePrice(raw) {
  const match = /^([\d,]+(?:\.\d+)?)\s*(lac|lakh|cr|crore)?s?$/i.exec((raw || '').trim());
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'lac' || unit === 'lakh') return Math.round(value * 100000);
  if (unit === 'cr' || unit === 'crore') return Math.round(value * 10000000);
  return Math.round(value);
}

// The Area column looks like "750 12800"; the first number is the area.
function parseArea(raw) {
  const value = Number(String(raw || '').trim().split(/\s+/)[0].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseCount(raw) {
  const text = String(raw || '').trim();
  if (text === '') return null;
  if (text.startsWith('>')) return Number(text.slice(1)) || null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseFloor(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (text === '') return null;
  if (text === 'ground') return 0;
  if (text.includes('basement')) return -1;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseFacing(raw) {
  const value = String(raw || '').trim().toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
  return FACING_OPTIONS.includes(value) ? value : null;
}

function parseFurnished(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return FURNISHING_OPTIONS.includes(value) ? value : null;
}

function parseYear(raw) {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1800 && value <= new Date().getFullYear() + 5 ? value : null;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLocality(row) {
  const city = (row.Location || '').trim() || 'Mumbai';
  const fromDescription = new RegExp(`\\bin (.+?), ${escapeRegExp(city)}\\b`, 'i').exec(row.Description || '');
  if (fromDescription && fromDescription[1].trim()) return fromDescription[1].trim();
  const title = row.Title || '';
  const at = /\bat (.+)$/i.exec(title);
  if (at) return at[1].trim();
  const inMatch = /\b(?:Rent|Sale) in (.+)$/i.exec(title);
  return inMatch ? inMatch[1].trim() : null;
}

// Returns { doc } for a listable row, or { skipped: reason } otherwise.
// `rowNumber` is 1-based and keeps slugs stable across reruns. `slugKey`
// overrides it in the slug so rows from several files cannot collide.
function transformRow(row, rowNumber, slugKey = rowNumber) {
  const title = (row.Title || '').trim();
  if (!title) return { skipped: 'missing title' };

  const priceInRupees = parsePrice(row.Price);
  if (priceInRupees === null) return { skipped: 'no usable price' };
  const areaSqft = parseArea(row.Area);
  if (areaSqft === null) return { skipped: 'no usable area' };

  const propertyType = PROPERTY_TYPE_MAP[(row['Property Type'] || '').trim().toLowerCase()];
  if (!propertyType) return { skipped: `unknown property type "${row['Property Type']}"` };

  const city = (row.Location || '').trim() || 'Mumbai';
  const transaction = (row['Transaction Type'] || '').trim().toLowerCase();
  const locality = extractLocality(row);
  const amenities = (row.Amenities || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  const doc = {
    slug: `${slugify(title)}-${slugKey}`,
    title: title.slice(0, 200),
    intent: transaction === 'sale' || transaction === 'buy' ? 'buy' : 'rent',
    propertyType,
    bhk: parseCount(row.BHK),
    bathrooms: parseCount(row.Bathrooms),
    balconies: parseCount(row.Balconies),
    floor: parseFloor(row.Floor),
    areaSqft,
    priceInRupees,
    city,
    cityLower: normalizeCity(city),
    locality,
    furnished: parseFurnished(row.Furnished),
    ownership: (row.Ownership || '').trim() || null,
    facing: parseFacing(row.Facing),
    yearOfConstruction: parseYear(row['Year of Construction']),
    isLuxury: /^(t|true|yes|1)$/i.test((row['Is Luxury'] || '').trim()),
    amenities,
    description: (row.Description || '').trim().slice(0, MAX_DESCRIPTION_LENGTH),
    imageFile: (row['Property Image'] || '').trim() || null,
    // The dataset has no contact details; give each seeded listing a
    // deterministic placeholder so the contact reveal flow works in dev.
    contactNumber: `+91 98765 ${String(10000 + (rowNumber % 90000)).slice(-5)}`,
    ownerId: null,
    verified: false,
    featured: false,
    status: 'published',
  };
  return { doc };
}

const IMAGES_PER_PROPERTY = 5;

// The dataset only has image filenames, so every listing gets deterministic
// picsum.photos placeholders (already allowed in frontend/next.config.js).
// Not Cloudinary URLs: editing a seeded listing's photos later goes through
// the Cloudinary-only validation.
function buildImages(doc) {
  return Array.from({ length: IMAGES_PER_PROPERTY }, (_, index) => ({
    url: `https://picsum.photos/seed/${doc.slug}-${index + 1}/800/600`,
    alt: `${doc.title} - photo ${index + 1}`,
    displayOrder: index,
  }));
}

function deriveLocations(properties) {
  const byKey = new Map();
  const bump = (city, locality) => {
    const key = `${normalizeCity(city)}|${locality ? normalizeCity(locality) : ''}`;
    const entry = byKey.get(key) || { city, locality: locality || null, activeListingCount: 0 };
    entry.activeListingCount += 1;
    byKey.set(key, entry);
  };
  for (const p of properties) {
    bump(p.city, null);
    if (p.locality) bump(p.city, p.locality);
  }

  const locations = [...byKey.values()];
  const popular = locations
    .filter((l) => l.locality)
    .sort((a, b) => b.activeListingCount - a.activeListingCount)
    .slice(0, 12);
  const rankByEntry = new Map(popular.map((l, index) => [l, index + 1]));

  return locations.map((l) => ({
    city: l.city,
    cityLower: normalizeCity(l.city),
    locality: l.locality,
    localityLower: l.locality ? normalizeCity(l.locality) : null,
    activeListingCount: l.activeListingCount,
    popular: rankByEntry.has(l),
    popularRank: rankByEntry.get(l) ?? null,
    imageUrl: null,
    imageAlt: null,
  }));
}

const CATEGORY_LABELS = {
  apartment: 'Apartment',
  'independent-house': 'Independent House',
  villa: 'Villa',
  studio: 'Studio',
  penthouse: 'Penthouse',
};

function deriveCategories(properties) {
  const counts = new Map();
  for (const p of properties) counts.set(p.propertyType, (counts.get(p.propertyType) || 0) + 1);
  return [...counts.entries()].map(([slug, listingCount]) => ({
    slug,
    name: CATEGORY_LABELS[slug] || slug,
    listingCount,
    icon: '',
  }));
}

module.exports = {
  parsePrice,
  parseArea,
  parseFloor,
  parseFacing,
  transformRow,
  buildImages,
  IMAGES_PER_PROPERTY,
  deriveLocations,
  deriveCategories,
};
