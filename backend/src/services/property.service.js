const crypto = require('crypto');
const mongoose = require('mongoose');
const { Property, PropertyImage, SavedProperty } = require('../models');
const AppError = require('../utils/AppError');
const { MAX_FEATURED } = require('../config/constants');
const { normalizeCity } = require('../utils/normalizeCity');
const { comparablePhone, MIN_PROPERTY_IMAGES } = require('../utils/propertyValidation');
const { resolvePublicId, deleteAssetsForImages } = require('./cloudinaryAssets.service');

const EDITABLE_FIELDS = [
  'title',
  'description',
  'areaSqft',
  'priceInRupees',
  'bhk',
  'locality',
  'amenities',
  'contactNumber',
  'bathrooms',
  'furnished',
  'balconies',
  'floor',
  'ownership',
  'facing',
  'yearOfConstruction',
  'isLuxury',
];

// Fields whose change by the owner of a verified listing drops the "Verified"
// badge, so an admin re-reviews it. Anything else (description, price, location)
// is deliberately not listed.
//  - title: what the admin vetted the listing as.
//  - contactNumber: the listing's phone (the Property field, not User.phone).
//  - images: the photos; these live in PropertyImage, so they are compared as a
//    set (by public id, else url) and a pure reorder does not count.
const TRUST_RELEVANT_FIELDS = ['title', 'contactNumber', 'images'];

const ADMIN_ONLY_FIELDS = ['status', 'verified', 'featured', 'featuredRank'];

// Fields an admin may change beyond what an owner can (in addition to
// ADMIN_ONLY_FIELDS) — everything owner-editable, plus the classification
// fields that only an admin should be able to reclassify a listing under.
const ADMIN_EXTRA_EDITABLE_FIELDS = ['city', 'intent', 'propertyType'];

// Same fields the single-item admin update path allows beyond owner-editable
// ones; bulk update is deliberately limited to this set.
const BULK_UPDATABLE_FIELDS = [...ADMIN_ONLY_FIELDS, ...ADMIN_EXTRA_EDITABLE_FIELDS];

// Publishing or verifying a listing is an approval: the admin must have
// something to review, so a description and the minimum photos are required.
// Shared by the single and bulk update paths.
function isApproval(fields) {
  return fields.status === 'published' || fields.verified === true;
}

function incompleteProblems({ description, imageCount }) {
  const problems = [];
  if (typeof description !== 'string' || description.trim().length === 0) problems.push('needs a description');
  if (imageCount < MIN_PROPERTY_IMAGES) problems.push(`needs at least ${MIN_PROPERTY_IMAGES} photos (has ${imageCount})`);
  return problems;
}

// items: [{ title, description, imageCount }]. Throws a 400 listing every incomplete one.
function assertApprovable(items) {
  const details = items.flatMap((item) => {
    const problems = incompleteProblems(item);
    return problems.length > 0 ? [`"${item.title}" ${problems.join(' and ')}`] : [];
  });
  if (details.length > 0) {
    throw AppError.badRequest('Listings must have a description and enough photos before they can be published or verified', details);
  }
}

// `current` is how many published featured listings exist, `needed` how many
// new slots the request wanted.
function featuredLimitError(current, needed = 1) {
  const free = Math.max(0, MAX_FEATURED - current);
  return AppError.conflict(
    `Featured limit reached (${MAX_FEATURED}). ${current} featured now, ${free} free slot${free === 1 ? '' : 's'}; this request needs ${needed}.`
  );
}

const publishedFeaturedCount = (extraFilter = {}) => Property.countDocuments({ featured: true, status: 'published', ...extraFilter });

// Two concurrent requests can both pass the check before either writes. After
// the write, recount; if the total is over the limit, put the featured-related
// fields back from the snapshot taken before the write and reject.
async function revertIfOverFeaturedLimit(snapshots, needed) {
  const total = await publishedFeaturedCount();
  if (total <= MAX_FEATURED) return;
  await Property.bulkWrite(snapshots.map((s) => ({
    updateOne: {
      filter: { _id: s._id },
      update: { $set: { featured: s.featured, featuredRank: s.featuredRank ?? null, status: s.status, publishedAt: s.publishedAt ?? null } },
    },
  })));
  throw featuredLimitError(await publishedFeaturedCount(), needed);
}

const FEATURED_SNAPSHOT_FIELDS = '_id featured featuredRank status publishedAt';

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Retries after a duplicate-key error on the slug, before giving up with a 409.
const SLUG_COLLISION_RETRIES = 3;

function slugWithSuffix(base) {
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function generateUniqueSlug(title) {
  const base = slugify(title) || 'property';
  let slug = base;

  while (await Property.exists({ slug })) {
    slug = slugWithSuffix(base);
  }

  return slug;
}

function isSlugCollision(err) {
  return err?.code === 11000 && Boolean(err.keyPattern?.slug || err.keyValue?.slug);
}

function normalizeImageInput(images) {
  return images.map((image, index) => {
    if (typeof image === 'string') {
      return { url: image, alt: '', displayOrder: index };
    }
    return {
      url: image.url,
      publicId: image.publicId ?? null,
      alt: image.alt ?? '',
      displayOrder: image.displayOrder ?? index,
    };
  });
}

// Replace the property's complete set of image records with the submitted set.
// Assets of images that were in the old set and are not in the new one are
// deleted from Cloudinary, but only after the replacement has succeeded.
async function replacePropertyImages(propertyId, images, ownerId) {
  const previous = await PropertyImage.find({ propertyId }).lean();
  await PropertyImage.deleteMany({ propertyId });

  const docs = images && images.length > 0
    ? normalizeImageInput(images).map((image) => ({ ...image, propertyId }))
    : [];
  const inserted = docs.length > 0 ? await PropertyImage.insertMany(docs) : [];

  const kept = new Set(inserted.map((row) => resolvePublicId(row)).filter(Boolean));
  const removed = previous.filter((image) => !kept.has(resolvePublicId(image)));
  await deleteAssetsForImages(removed, ownerId);

  return inserted;
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

// The exists() check in generateUniqueSlug can race with a concurrent create
// of the same title, so a duplicate-key error on the slug is retried with a
// fresh suffix. Existing slugs are never changed.
async function createProperty({ ownerId, input }) {
  const base = slugify(input.title) || 'property';
  let slug = await generateUniqueSlug(input.title);
  let property;

  for (let attempt = 0; ; attempt += 1) {
    try {
      property = await insertProperty({ ownerId, input, slug });
      break;
    } catch (err) {
      if (!isSlugCollision(err)) throw err;
      if (attempt >= SLUG_COLLISION_RETRIES) {
        throw AppError.conflict('Could not create a unique link for this listing. Please try again.');
      }
      slug = slugWithSuffix(base);
    }
  }

  const images = input.images && input.images.length > 0
    ? await replacePropertyImages(property._id, input.images, property.ownerId)
    : [];

  return { property, images };
}

function insertProperty({ ownerId, input, slug }) {
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
    bathrooms: input.bathrooms ?? null,
    furnished: input.furnished ?? null,
    balconies: input.balconies ?? null,
    floor: input.floor ?? null,
    ownership: input.ownership ?? null,
    facing: input.facing ?? null,
    yearOfConstruction: input.yearOfConstruction ?? null,
    isLuxury: Boolean(input.isLuxury),
    description: input.description ?? '',
    contactNumber: input.contactNumber,
    status: 'draft',
    verified: false,
    featured: false,
    featuredRank: null,
  });
}

function buildListFilter({ intent, city, locality, propertyType, minPrice, maxPrice, status, admin, featured, q, bhk }) {
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
  if (city) filter.cityLower = normalizeCity(city);
  if (locality) filter.locality = new RegExp(`^${escapeRegExp(locality)}$`, 'i');

  // No index for q: an unanchored regex cannot use one, and status + cityLower
  // (or status alone) already narrows the set before the regex is evaluated.
  if (q) {
    const keyword = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ title: keyword }, { locality: keyword }, { city: keyword }];
  }

  if (bhk) {
    const options = [];
    if (bhk.values.length > 0) options.push({ bhk: { $in: bhk.values } });
    if (bhk.min != null) options.push({ bhk: { $gte: bhk.min } });
    filter.$and = [{ $or: options }];
  }

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

// `featured` / `verified` put those listings first across the whole result
// set (not just the current page); every sort ends on a stable tiebreaker.
const LIST_SORTS = ['newest', 'featured', 'verified', 'price-asc', 'price-desc'];

function buildListSort({ sort, admin }) {
  const recency = admin ? { createdAt: -1 } : { publishedAt: -1 };
  switch (sort) {
    case 'featured':
      return { featured: -1, verified: -1, ...recency, _id: 1 };
    case 'verified':
      return { verified: -1, featured: -1, ...recency, _id: 1 };
    case 'price-asc':
      return { priceInRupees: 1, ...recency, _id: 1 };
    case 'price-desc':
      return { priceInRupees: -1, ...recency, _id: 1 };
    default:
      return recency;
  }
}

async function findProperties({ filters, page, limit }) {
  const filter = buildListFilter(filters);
  const sort = buildListSort(filters);
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

// Ranked picks first (rank 0 is a valid rank), then unranked newest first. The
// aggregation only decides the order of ids: documents are loaded through
// find() afterwards so select:false fields stay hidden and nothing raw leaks.
async function featuredIds({ city, limit }) {
  const rows = await Property.aggregate([
    { $match: buildListFilter({ featured: true, city }) },
    { $addFields: { isUnranked: { $in: [{ $type: '$featuredRank' }, ['null', 'missing']] } } },
    { $sort: { isUnranked: 1, featuredRank: 1, publishedAt: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
  return rows.map((row) => row._id);
}

// A city with no featured listings falls back to the national list so the
// homepage section is never blank; `scope` tells the caller which one it got.
async function findFeaturedProperties({ city, limit }) {
  let scope = city ? 'city' : 'national';
  let ids = city ? await featuredIds({ city, limit }) : [];
  if (!city || ids.length === 0) {
    scope = 'national';
    ids = await featuredIds({ limit });
  }

  const found = await Property.find({ _id: { $in: ids } });
  const byId = new Map(found.map((p) => [p._id.toString(), p]));
  const properties = ids.map((id) => byId.get(id.toString())).filter(Boolean);
  const imagesByPropertyId = await getImagesForProperties(ids);

  return { properties, imagesByPropertyId, scope };
}

// Owner's own listings in every status (drafts included), newest first. The
// contact number is selected because the caller is the owner.
async function findPropertiesByOwner({ ownerId, page, limit }) {
  const filter = { ownerId };
  const [properties, total] = await Promise.all([
    Property.find(filter)
      .select('+contactNumber')
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

// Contact number of a published listing, or null when there is no published
// listing with this id. `found` separates "no listing" from "no number".
async function findPublishedContactById(id, user = null) {
  const property = await Property.findById(id).select('+contactNumber').lean();
  if (!property) return { found: false };
  // Unpublished listings are visible only to their owner and to admins.
  if (property.status !== 'published' && !(user && isOwnerOrAdmin(property, user))) {
    return { found: false };
  }
  return { found: true, contactNumber: property.contactNumber || null };
}

async function findById(id) {
  return Property.findById(id);
}

// Contact number included (select:false by default); only for owner/admin routes.
async function findByIdWithContact(id) {
  return Property.findById(id).select('+contactNumber');
}

function isOwnerOrAdmin(property, user) {
  if (user.role === 'admin') return true;
  return property.ownerId && String(property.ownerId) === String(user._id);
}

function imageKey(image) {
  return resolvePublicId(image) || image.url;
}

function imageSetChanged(previous, submitted) {
  const before = new Set(previous.map(imageKey));
  const after = new Set(normalizeImageInput(submitted).map(imageKey));
  return before.size !== after.size || [...after].some((key) => !before.has(key));
}

// Compares incoming values with the stored ones, so resending a value as it
// already is does not count. Title is compared as the schema stores it (trimmed).
// contactNumber is compared in normalized form, since older records may have
// been saved with spaces or a +91 prefix.
async function trustFieldsChanged(property, body) {
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
  if (has('title') && (typeof body.title === 'string' ? body.title.trim() : body.title) !== property.title) return true;
  if (has('contactNumber') && comparablePhone(body.contactNumber) !== comparablePhone(property.contactNumber)) return true;
  if (has('images') && imageSetChanged(await getPropertyImages(property._id), body.images ?? [])) return true;
  return false;
}

async function updatePropertyById(id, body, actor) {
  // +contactNumber is for the change comparison only; the serializer strips it
  // from the response.
  const property = await Property.findById(id).select('+contactNumber');
  if (!property) return { error: 'not_found' };

  if (!isOwnerOrAdmin(property, actor)) {
    return { error: 'forbidden' };
  }

  const isAdmin = actor.role === 'admin';
  const allowedFields = isAdmin
    ? [...EDITABLE_FIELDS, ...ADMIN_EXTRA_EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS]
    : EDITABLE_FIELDS;

  // Decided before anything is written, so verified:false goes out in the same
  // save() as the edit (and before the images are replaced). Admin edits never
  // touch verified.
  if (!isAdmin && property.verified === true && await trustFieldsChanged(property, body)) {
    property.verified = false;
  }

  // Description and photos as they will be after this save, so one request can
  // fix them and approve together.
  if (isAdmin && isApproval(body)) {
    const sent = (field) => Object.prototype.hasOwnProperty.call(body, field);
    assertApprovable([{
      title: sent('title') ? body.title : property.title,
      description: sent('description') ? body.description : property.description,
      imageCount: sent('images') ? (body.images ?? []).length : await PropertyImage.countDocuments({ propertyId: property._id }),
    }]);
  }

  // The limit applies when a listing joins the featured set: it becomes featured,
  // or it is featured and becomes published (a featured draft is not counted
  // until then). Editing an already featured listing, or unfeaturing one, is
  // never blocked. Checked before anything is written.
  let featuredSnapshot = null;
  if (isAdmin) {
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const nextFeatured = has('featured') ? body.featured : property.featured;
    const nextStatus = has('status') ? body.status : property.status;
    const becomesFeatured = nextFeatured === true && property.featured !== true;
    const becomesPublished = nextFeatured === true && nextStatus === 'published' && property.status !== 'published';
    if (becomesFeatured || becomesPublished) {
      // Same set GET /featured serves: published and featured.
      const others = await publishedFeaturedCount({ _id: { $ne: property._id } });
      if (others >= MAX_FEATURED) throw featuredLimitError(others);
      featuredSnapshot = [property.toObject()];
    }
  }

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      property[field] = body[field];
    }
  }

  if (property.isModified('status') && property.status === 'published' && !property.publishedAt) {
    property.publishedAt = new Date();
  }

  await property.save();
  if (featuredSnapshot) await revertIfOverFeaturedLimit(featuredSnapshot, 1);

  const images = Object.prototype.hasOwnProperty.call(body, 'images')
    ? await replacePropertyImages(property._id, body.images, property.ownerId)
    : await getPropertyImages(property._id);

  return { property, images };
}

async function deletePropertyById(id, actor) {
  const property = await Property.findById(id);
  if (!property) return { error: 'not_found' };

  if (!isOwnerOrAdmin(property, actor)) {
    return { error: 'forbidden' };
  }

  const images = await PropertyImage.find({ propertyId: id }).lean();
  await property.deleteOne();
  await PropertyImage.deleteMany({ propertyId: id });
  await SavedProperty.deleteMany({ propertyId: id });
  await deleteAssetsForImages(images, property.ownerId);
  return {};
}

async function bulkUpdatePropertiesByIds(ids, updates) {
  const setFields = {};
  for (const field of BULK_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      setFields[field] = updates[field];
    }
  }

  if (isApproval(setFields)) {
    const [properties, counts] = await Promise.all([
      Property.find({ _id: { $in: ids } }).select('title description').lean(),
      PropertyImage.aggregate([
        { $match: { propertyId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: '$propertyId', count: { $sum: 1 } } },
      ]),
    ]);
    const countById = new Map(counts.map((row) => [String(row._id), row.count]));
    assertApprovable(properties.map((p) => ({ ...p, imageCount: countById.get(String(p._id)) ?? 0 })));
  }

  // The limit applies when listings join the featured set: the update features
  // them, or publishes them while they are (or become) featured. Afterwards the
  // total is the published featured listings outside the batch plus the batch
  // members that end up both featured and published.
  const featuring = setFields.featured === true;
  const publishing = setFields.status === 'published';
  let featuredSnapshot = null;
  if (featuring || (publishing && setFields.featured !== false)) {
    // Duplicate ids in the request must not inflate the total.
    const uniqueIds = [...new Set(ids.map(String))];
    const batchFilter = { _id: { $in: uniqueIds } };
    if (!featuring) batchFilter.featured = true;
    if (!publishing) batchFilter.status = 'published';
    const batchEndsPublished = !('status' in setFields) || publishing;
    const [outside, inBatch, currentInBatch] = await Promise.all([
      publishedFeaturedCount({ _id: { $nin: uniqueIds } }),
      batchEndsPublished ? Property.countDocuments(batchFilter) : 0,
      publishedFeaturedCount({ _id: { $in: uniqueIds } }),
    ]);
    if (outside + inBatch > MAX_FEATURED) {
      throw featuredLimitError(outside + currentInBatch, Math.max(0, inBatch - currentInBatch));
    }
    featuredSnapshot = await Property.find({ _id: { $in: uniqueIds } }).select(FEATURED_SNAPSHOT_FIELDS).lean();
  }

  // updateMany skips document hooks, so keep cityLower in step by hand.
  if (typeof setFields.city === 'string') setFields.cityLower = normalizeCity(setFields.city);

  // runValidators is a second line of defence behind validateBulkUpdates: it
  // applies the schema's required/enum checks to the $set paths.
  const result = await Property.updateMany({ _id: { $in: ids } }, { $set: setFields }, { runValidators: true });

  if (setFields.status === 'published') {
    await Property.updateMany({ _id: { $in: ids }, publishedAt: null }, { $set: { publishedAt: new Date() } });
  }
  if (featuredSnapshot) await revertIfOverFeaturedLimit(featuredSnapshot, featuredSnapshot.length);

  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

// Image rows go with the properties, then the Cloudinary assets as best effort.
async function bulkDeletePropertiesByIds(ids) {
  // Owners must be read before the rows go: each property's images are only
  // deletable under its own owner's folder.
  const properties = await Property.find({ _id: { $in: ids } }).select('ownerId').lean();
  const images = await PropertyImage.find({ propertyId: { $in: ids } }).lean();
  const result = await Property.deleteMany({ _id: { $in: ids } });
  await PropertyImage.deleteMany({ propertyId: { $in: ids } });
  await SavedProperty.deleteMany({ propertyId: { $in: ids } });

  const ownerByProperty = new Map(properties.map((p) => [String(p._id), p.ownerId ? String(p.ownerId) : null]));
  const imagesByOwner = new Map();
  for (const image of images) {
    const owner = ownerByProperty.get(String(image.propertyId)) ?? null;
    if (!imagesByOwner.has(owner)) imagesByOwner.set(owner, []);
    imagesByOwner.get(owner).push(image);
  }
  for (const [owner, ownerImages] of imagesByOwner) {
    await deleteAssetsForImages(ownerImages, owner);
  }
  return { deletedCount: result.deletedCount };
}

module.exports = {
  EDITABLE_FIELDS,
  TRUST_RELEVANT_FIELDS,
  ADMIN_ONLY_FIELDS,
  ADMIN_EXTRA_EDITABLE_FIELDS,
  BULK_UPDATABLE_FIELDS,
  createProperty,
  findProperties,
  findFeaturedProperties,
  findPropertiesByOwner,
  findPublishedBySlug,
  findPublishedContactById,
  LIST_SORTS,
  buildListFilter,
  findById,
  findByIdWithContact,
  updatePropertyById,
  deletePropertyById,
  bulkUpdatePropertiesByIds,
  bulkDeletePropertiesByIds,
  getPropertyImages,
  getImagesForProperties,
  replacePropertyImages,
};
