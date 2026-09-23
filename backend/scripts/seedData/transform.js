const { PROPERTY_INTENTS, PROPERTY_TYPES, PROPERTY_STATUSES } = require('../../src/models/Property');
const { CONTENT_STATUSES } = require('../../src/models/contentStatus');

class SeedValidationError extends Error {
  constructor(collection, identifier, message) {
    super(`[${collection} ${identifier || '(no id)'}] ${message}`);
    this.name = 'SeedValidationError';
  }
}

function requireString(value, collection, identifier, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SeedValidationError(collection, identifier, `${field} must be a non-empty string`);
  }
  return value;
}

function requireFiniteNumber(value, collection, identifier, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SeedValidationError(collection, identifier, `${field} must be a finite number`);
  }
  return value;
}

function optionalRank(value, collection, identifier, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SeedValidationError(collection, identifier, `${field} must be numeric or null`);
  }
  return value;
}

function parseDate(value, collection, identifier, field) {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new SeedValidationError(collection, identifier, `${field} is not a valid date: ${value}`);
  }
  return date;
}

function requireEnum(value, allowed, collection, identifier, field) {
  if (!allowed.includes(value)) {
    throw new SeedValidationError(
      collection,
      identifier,
      `${field} "${value}" is not one of: ${allowed.join(', ')}`
    );
  }
  return value;
}

function imagePayload(mock, collection, identifier) {
  if (!mock.image) return null;
  requireString(mock.image.src, collection, identifier, 'image.src');
  return { url: mock.image.src, alt: mock.image.alt || '' };
}

function transformProperty(mock) {
  const identifier = mock && mock.id;
  requireString(mock.slug, 'properties', identifier, 'slug');
  requireString(mock.title, 'properties', identifier, 'title');
  requireEnum(mock.intent, PROPERTY_INTENTS, 'properties', identifier, 'intent');
  requireEnum(mock.propertyType, PROPERTY_TYPES, 'properties', identifier, 'propertyType');
  requireEnum(mock.status, PROPERTY_STATUSES, 'properties', identifier, 'status');
  requireString(mock.city, 'properties', identifier, 'city');
  requireFiniteNumber(mock.areaSqft, 'properties', identifier, 'areaSqft');
  requireFiniteNumber(mock.priceInRupees, 'properties', identifier, 'priceInRupees');
  const featuredRank = optionalRank(mock.featuredRank, 'properties', identifier, 'featuredRank');
  const publishedAt = parseDate(mock.publishedAt, 'properties', identifier, 'publishedAt');
  const imageSrc = imagePayload(mock, 'properties', identifier);

  const doc = {
    slug: mock.slug,
    title: mock.title,
    intent: mock.intent,
    propertyType: mock.propertyType,
    bhk: mock.bhk ?? null,
    areaSqft: mock.areaSqft,
    priceInRupees: mock.priceInRupees,
    city: mock.city,
    locality: mock.locality ?? null,
    amenities: Array.isArray(mock.amenities) ? mock.amenities : [],
    // Not present in mock data; never invented (docs/backend-architecture.md
    // "Do not invent owner contact numbers").
    ownerId: null,
    verified: Boolean(mock.verified),
    featured: Boolean(mock.featured),
    featuredRank,
    status: mock.status,
    publishedAt,
  };

  const image = imageSrc ? { ...imageSrc, displayOrder: 0 } : null;

  return { doc, image };
}

function transformLocation(mock) {
  const identifier = mock && mock.id;
  requireString(mock.city, 'locations', identifier, 'city');
  const activeListingCount = requireFiniteNumber(
    mock.activeListingCount,
    'locations',
    identifier,
    'activeListingCount'
  );
  const popularRank = optionalRank(mock.popularRank, 'locations', identifier, 'popularRank');
  const image = imagePayload(mock, 'locations', identifier);

  const doc = {
    city: mock.city,
    locality: mock.locality ?? null,
    activeListingCount,
    popular: Boolean(mock.popular),
    popularRank,
    imageUrl: image ? image.url : null,
    imageAlt: image ? image.alt : null,
  };

  return { doc };
}

function transformCategory(mock) {
  const identifier = mock && mock.id;
  requireString(mock.slug, 'categories', identifier, 'slug');
  requireString(mock.name, 'categories', identifier, 'name');
  const listingCount = requireFiniteNumber(mock.listingCount, 'categories', identifier, 'listingCount');

  const doc = {
    name: mock.name,
    slug: mock.slug,
    listingCount,
    icon: mock.icon || '',
  };

  return { doc };
}

function transformProject(mock) {
  const identifier = mock && mock.id;
  requireString(mock.name, 'projects', identifier, 'name');
  requireString(mock.developer, 'projects', identifier, 'developer');
  requireString(mock.city, 'projects', identifier, 'city');
  requireEnum(mock.status, CONTENT_STATUSES, 'projects', identifier, 'status');
  const startingPriceInRupees = requireFiniteNumber(
    mock.startingPriceInRupees,
    'projects',
    identifier,
    'startingPriceInRupees'
  );
  const publishedAt = parseDate(mock.publishedAt, 'projects', identifier, 'publishedAt');
  const image = imagePayload(mock, 'projects', identifier);

  const doc = {
    name: mock.name,
    developer: mock.developer,
    city: mock.city,
    locality: mock.locality ?? null,
    imageUrl: image ? image.url : null,
    imageAlt: image ? image.alt : null,
    startingPriceInRupees,
    possessionLabel: mock.possessionLabel || '',
    status: mock.status,
    publishedAt,
  };

  return { doc };
}

function transformArticle(mock) {
  const identifier = mock && mock.id;
  requireString(mock.slug, 'articles', identifier, 'slug');
  requireString(mock.title, 'articles', identifier, 'title');
  requireEnum(mock.status, CONTENT_STATUSES, 'articles', identifier, 'status');
  const publishedAt = parseDate(mock.publishedAt, 'articles', identifier, 'publishedAt');
  const image = imagePayload(mock, 'articles', identifier);

  const doc = {
    title: mock.title,
    slug: mock.slug,
    excerpt: mock.excerpt || '',
    content: mock.content || '',
    imageUrl: image ? image.url : null,
    imageAlt: image ? image.alt : null,
    status: mock.status,
    publishedAt,
  };

  return { doc };
}

module.exports = {
  SeedValidationError,
  transformProperty,
  transformLocation,
  transformCategory,
  transformProject,
  transformArticle,
};
