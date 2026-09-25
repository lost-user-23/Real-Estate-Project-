const crypto = require('crypto');
const { Property } = require('../models');

const EDITABLE_FIELDS = [
  'title',
  'description',
  'areaSqft',
  'priceInRupees',
  'bhk',
  'locality',
  'amenities',
  'contactNumber',
];

const ADMIN_ONLY_FIELDS = ['status', 'verified', 'featured', 'featuredRank'];

// Fields an admin may change beyond what an owner can (in addition to
// ADMIN_ONLY_FIELDS) — everything owner-editable, plus the classification
// fields that only an admin should be able to reclassify a listing under.
const ADMIN_EXTRA_EDITABLE_FIELDS = ['city', 'intent', 'propertyType'];

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(title) {
  const base = slugify(title) || 'property';
  let slug = base;

  while (await Property.exists({ slug })) {
    slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }

  return slug;
}

async function createProperty({ ownerId, input }) {
  const slug = await generateUniqueSlug(input.title);

  return Property.create({
    ownerId,
    slug,
    title: input.title,
    intent: input.intent,
    propertyType: input.propertyType,
    bhk: input.bhk ?? null,
    areaSqft: input.areaSqft,
    priceInRupees: input.priceInRupees,
    city: input.city,
    locality: input.locality ?? null,
    amenities: input.amenities ?? [],
    description: input.description ?? '',
    contactNumber: input.contactNumber,
    status: 'draft',
    verified: false,
    featured: false,
    featuredRank: null,
  });
}

function buildListFilter({ intent, city, locality, propertyType, minPrice, maxPrice }) {
  const filter = { status: 'published' };

  if (intent) filter.intent = intent;
  if (propertyType) filter.propertyType = propertyType;
  if (city) filter.city = new RegExp(`^${escapeRegExp(city)}$`, 'i');
  if (locality) filter.locality = new RegExp(`^${escapeRegExp(locality)}$`, 'i');

  if (minPrice != null || maxPrice != null) {
    filter.priceInRupees = {};
    if (minPrice != null) filter.priceInRupees.$gte = minPrice;
    if (maxPrice != null) filter.priceInRupees.$lte = maxPrice;
  }

  return filter;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findProperties({ filters, page, limit }) {
  const filter = buildListFilter(filters);
  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    Property.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit),
    Property.countDocuments(filter),
  ]);

  return {
    properties,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function findPublishedBySlug(slug) {
  return Property.findOne({ slug, status: 'published' });
}

async function findById(id) {
  return Property.findById(id);
}

function isOwnerOrAdmin(property, user) {
  if (user.role === 'admin') return true;
  return property.ownerId && String(property.ownerId) === String(user._id);
}

async function updatePropertyById(id, body, actor) {
  const property = await Property.findById(id);
  if (!property) return { error: 'not_found' };

  if (!isOwnerOrAdmin(property, actor)) {
    return { error: 'forbidden' };
  }

  const isAdmin = actor.role === 'admin';
  const allowedFields = isAdmin
    ? [...EDITABLE_FIELDS, ...ADMIN_EXTRA_EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS]
    : EDITABLE_FIELDS;

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      property[field] = body[field];
    }
  }

  if (property.isModified('status') && property.status === 'published' && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  await property.save();
  return { property };
}

async function deletePropertyById(id, actor) {
  const property = await Property.findById(id);
  if (!property) return { error: 'not_found' };

  if (!isOwnerOrAdmin(property, actor)) {
    return { error: 'forbidden' };
  }

  await property.deleteOne();
  return {};
}

module.exports = {
  EDITABLE_FIELDS,
  ADMIN_ONLY_FIELDS,
  createProperty,
  findProperties,
  findPublishedBySlug,
  findById,
  updatePropertyById,
  deletePropertyById,
};
