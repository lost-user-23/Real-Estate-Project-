const crypto = require('crypto');
const { Property, PropertyImage } = require('../models');

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

// Same fields the single-item admin update path allows beyond owner-editable
// ones; bulk update is deliberately limited to this set.
const BULK_UPDATABLE_FIELDS = [...ADMIN_ONLY_FIELDS, ...ADMIN_EXTRA_EDITABLE_FIELDS];

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

function normalizeImageInput(images) {
  return images.map((image, index) => {
    if (typeof image === 'string') {
      return { url: image, alt: '', displayOrder: index };
    }
    return {
      url: image.url,
      alt: image.alt ?? '',
      displayOrder: image.displayOrder ?? index,
    };
  });
}

// Replace the property's complete set of image records with the submitted set.
async function replacePropertyImages(propertyId, images) {
  await PropertyImage.deleteMany({ propertyId });
  if (!images || images.length === 0) return [];

  const docs = normalizeImageInput(images).map((image) => ({ ...image, propertyId }));
  return PropertyImage.insertMany(docs);
}

async function getPropertyImages(propertyId) {
  return PropertyImage.find({ propertyId }).sort({ displayOrder: 1, createdAt: 1 });
}

// Load a page of image records in one query and group them by property ID.
async function getImagesForProperties(propertyIds) {
  const images = await PropertyImage.find({ propertyId: { $in: propertyIds } }).sort({
    displayOrder: 1,
    createdAt: 1,
  });

  const imagesByPropertyId = new Map();
  for (const image of images) {
    const key = String(image.propertyId);
    if (!imagesByPropertyId.has(key)) imagesByPropertyId.set(key, []);
    imagesByPropertyId.get(key).push(image);
  }
  return imagesByPropertyId;
}

async function createProperty({ ownerId, input }) {
  const slug = await generateUniqueSlug(input.title);

  const property = await Property.create({
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

  const images = input.images && input.images.length > 0
    ? await replacePropertyImages(property._id, input.images)
    : [];

  return { property, images };
}

function buildListFilter({ intent, city, locality, propertyType, minPrice, maxPrice, status, admin, featured }) {
  const filter = {};
  if (admin) {
    // admin can see everything, optionally narrowed by ?status=
    if (status) filter.status = status;
  } else {
    filter.status = 'published';
  }
  if (featured != null) filter.featured = featured;
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
  const sort = filters.admin ? { createdAt: -1 } : { publishedAt: -1 };
  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    Property.find(filter).sort(sort).skip(skip).limit(limit),
    Property.countDocuments(filter),
  ]);

  return {
    properties,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Owner's own listings in every status (drafts included), newest first.
async function findPropertiesByOwner({ ownerId, page, limit }) {
  const filter = { ownerId };
  const [properties, total] = await Promise.all([
    Property.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
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

  const images = Object.prototype.hasOwnProperty.call(body, 'images')
    ? await replacePropertyImages(property._id, body.images)
    : await getPropertyImages(property._id);

  return { property, images };
}

async function deletePropertyById(id, actor) {
  const property = await Property.findById(id);
  if (!property) return { error: 'not_found' };

  if (!isOwnerOrAdmin(property, actor)) {
    return { error: 'forbidden' };
  }

  await property.deleteOne();
  await PropertyImage.deleteMany({ propertyId: id });
  return {};
}

async function bulkUpdatePropertiesByIds(ids, updates) {
  const setFields = {};
  for (const field of BULK_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      setFields[field] = updates[field];
    }
  }

  const result = await Property.updateMany({ _id: { $in: ids } }, { $set: setFields });

  if (setFields.status === 'published') {
    await Property.updateMany({ _id: { $in: ids }, publishedAt: null }, { $set: { publishedAt: new Date() } });
  }

  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

// Delete image metadata along with properties; Cloudinary assets are not deleted here.
async function bulkDeletePropertiesByIds(ids) {
  const result = await Property.deleteMany({ _id: { $in: ids } });
  await PropertyImage.deleteMany({ propertyId: { $in: ids } });
  return { deletedCount: result.deletedCount };
}

module.exports = {
  EDITABLE_FIELDS,
  ADMIN_ONLY_FIELDS,
  ADMIN_EXTRA_EDITABLE_FIELDS,
  BULK_UPDATABLE_FIELDS,
  createProperty,
  findProperties,
  findPropertiesByOwner,
  findPublishedBySlug,
  findById,
  updatePropertyById,
  deletePropertyById,
  bulkUpdatePropertiesByIds,
  bulkDeletePropertiesByIds,
  getPropertyImages,
  getImagesForProperties,
  replacePropertyImages,
};
