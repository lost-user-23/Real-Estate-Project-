const mongoose = require('mongoose');
const Property = require('../models/Property');
const { PROPERTY_INTENTS, PROPERTY_TYPES, PROPERTY_STATUSES } = Property;
const propertyService = require('../services/property.service');
const { BULK_UPDATABLE_FIELDS } = propertyService;
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { MAX_FEATURED } = require('../config/constants');
const { parseOptionalCity, parseOptionalText, parseKeyword } = require('../utils/queryParams');
const { isOwnCloudinaryImageUrl } = require('../services/cloudinaryAssets.service');
const {
  MIN_PROPERTY_IMAGES,
  titleError,
  photoCountError,
  normalizeListingFields,
  isNonEmptyString,
  isFiniteNonNegativeNumber,
  pushTextFieldErrors,
  validateCreateInput,
  validateDetailFields,
} = require('../utils/propertyValidation');
const { serializeProperty,serializeProperties } = require('../utils/serializers/property.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_BHK = 20;
const MAX_PROPERTY_IMAGES = 20;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_IMAGE_ALT_LENGTH = 300;
const MAX_IMAGE_PUBLIC_ID_LENGTH = 500;

function isValidImageUrl(value) {
  return typeof value === 'string' && value.length <= MAX_IMAGE_URL_LENGTH && isOwnCloudinaryImageUrl(value);
}

function validateImagesInput(images, minimumCount = 0) {
  const errors = [];
  if (images == null) {
    if (minimumCount > 0) errors.push(`images must contain at least ${minimumCount} images`);
    return errors;
  }

  if (!Array.isArray(images)) {
    errors.push('images must be an array');
    return errors;
  }
  const countError = photoCountError(images.length, minimumCount);
  if (countError) errors.push(countError);
  if (images.length > MAX_PROPERTY_IMAGES) {
    errors.push(`images must contain at most ${MAX_PROPERTY_IMAGES} images`);
  }

  images.forEach((image, index) => {
    if (typeof image === 'string') {
      if (!isValidImageUrl(image)) {
        errors.push(`images[${index}] must be a valid Cloudinary image URL`);
      }
      return;
    }
    if (typeof image !== 'object' || image === null || !isValidImageUrl(image.url)) {
      errors.push(`images[${index}].url must be a valid Cloudinary image URL`);
    }
    if (image != null && image.alt != null && typeof image.alt !== 'string') {
      errors.push(`images[${index}].alt must be a string`);
    } else if (image != null && typeof image.alt === 'string' && image.alt.length > MAX_IMAGE_ALT_LENGTH) {
      errors.push(`images[${index}].alt must be at most ${MAX_IMAGE_ALT_LENGTH} characters`);
    }
    if (image != null && image.publicId != null && !isNonEmptyString(image.publicId)) {
      errors.push(`images[${index}].publicId must be a non-empty string`);
    } else if (image != null && typeof image.publicId === 'string' && image.publicId.length > MAX_IMAGE_PUBLIC_ID_LENGTH) {
      errors.push(`images[${index}].publicId must be at most ${MAX_IMAGE_PUBLIC_ID_LENGTH} characters`);
    }
  });

  return errors;
}

const createProperty = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [...validateCreateInput(body), ...validateDetailFields(body), ...validateImagesInput(body.images, MIN_PROPERTY_IMAGES)];
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { property, images } = await propertyService.createProperty({
    ownerId: req.user._id,
    input: normalizeListingFields(body),
  });

  res.status(201).json({ property: serializeProperty(property, images, { includeOwnerFields: true }) });
});

// "2,3" -> { values: [2, 3], min: null }; "4+" -> { values: [], min: 4 }.
// Returns null for anything else, including more than one "N+" entry.
function parseBhk(raw) {
  if (typeof raw !== 'string') return null;
  const values = [];
  let min = null;
  for (const part of raw.split(',').map((p) => p.trim())) {
    const match = /^(\d{1,2})(\+?)$/.exec(part);
    if (!match) return null;
    const num = Number(match[1]);
    if (num > MAX_BHK) return null;
    if (match[2]) {
      if (min !== null) return null;
      min = num;
    } else if (!values.includes(num)) {
      values.push(num);
    }
  }
  return { values, min };
}

function parseListFilters(query) {
  const errors = [];
  const filters = {};

  if (query.intent != null) {
    if (!PROPERTY_INTENTS.includes(query.intent)) {
      errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
    } else {
      filters.intent = query.intent;
    }
  }

  if (query.propertyType != null) {
    if (!PROPERTY_TYPES.includes(query.propertyType)) {
      errors.push(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
    } else {
      filters.propertyType = query.propertyType;
    }
  }

  if (query.featured != null) {
    if (query.featured !== 'true' && query.featured !== 'false') {
      errors.push('featured must be true or false');
    } else {
      filters.featured = query.featured === 'true';
    }
  }

  if (query.sort != null) {
    if (!propertyService.LIST_SORTS.includes(query.sort)) {
      errors.push(`sort must be one of: ${propertyService.LIST_SORTS.join(', ')}`);
    } else {
      filters.sort = query.sort;
    }
  }

  const city = parseOptionalText(query, 'city', errors);
  if (city !== undefined) filters.city = city;
  const locality = parseOptionalText(query, 'locality', errors);
  if (locality !== undefined) filters.locality = locality;

  const q = parseKeyword(query, errors);
  if (q !== undefined) filters.q = q;

  if (query.bhk != null) {
    const parsed = parseBhk(query.bhk);
    if (parsed) {
      filters.bhk = parsed;
    } else {
      errors.push(`bhk must be a comma-separated list of whole numbers 0-${MAX_BHK}, or N+ (for example 2,3 or 4+)`);
    }
  }

  for (const key of ['minPrice', 'maxPrice']) {
    if (query[key] != null) {
      const num = Number(query[key]);
      if (!Number.isFinite(num) || num < 0) {
        errors.push(`${key} must be a non-negative number`);
      } else {
        filters[key] = num;
      }
    }
  }

  if (filters.minPrice != null && filters.maxPrice != null && filters.minPrice > filters.maxPrice) {
    errors.push('minPrice must not be greater than maxPrice');
  }

  return { filters, errors };
}

function parsePagination(query) {
  const errors = [];

  let page = query.page != null ? Number(query.page) : 1;
  let limit = query.limit != null ? Number(query.limit) : DEFAULT_LIMIT;

  if (!Number.isInteger(page) || page < 1) {
    errors.push('page must be a positive integer');
    page = 1;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    errors.push('limit must be a positive integer');
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  return { page, limit, errors };
}

const listProperties = asyncHandler(async (req, res) => {
  const { filters, errors: filterErrors } = parseListFilters(req.query || {});
  const { page, limit, errors: pageErrors } = parsePagination(req.query || {});
  const errors = [...filterErrors, ...pageErrors];

  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { properties, total, totalPages } = await propertyService.findProperties({ filters, page, limit });
  const imagesByPropertyId = await propertyService.getImagesForProperties(properties.map((p) => p._id));

  res.status(200).json({
    properties: serializeProperties(properties, imagesByPropertyId),
    meta: { total, page, limit, totalPages },
  });
});

const FEATURED_DEFAULT_LIMIT = MAX_FEATURED;

function parseFeaturedQuery(query) {
  const errors = [];
  let limit = FEATURED_DEFAULT_LIMIT;
  const city = parseOptionalCity(query, errors);

  if (query.limit != null) {
    const num = typeof query.limit === 'string' && query.limit.trim() !== '' ? Number(query.limit) : NaN;
    if (!Number.isInteger(num) || num < 1) {
      errors.push('limit must be a positive integer');
    } else {
      limit = Math.min(num, MAX_LIMIT);
    }
  }

  return { city, limit, errors };
}

const listFeaturedProperties = asyncHandler(async (req, res) => {
  const { city, limit, errors } = parseFeaturedQuery(req.query || {});
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { properties, imagesByPropertyId, scope } = await propertyService.findFeaturedProperties({ city, limit });

  res.status(200).json({ properties: serializeProperties(properties, imagesByPropertyId), scope });
});

const listMyProperties = asyncHandler(async (req, res) => {
  const { page, limit, errors } = parsePagination(req.query || {});
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { properties, total, totalPages } = await propertyService.findPropertiesByOwner({
    ownerId: req.user._id,
    page,
    limit,
  });
  const imagesByPropertyId = await propertyService.getImagesForProperties(properties.map((p) => p._id));

  res.status(200).json({
    properties: serializeProperties(properties, imagesByPropertyId, { includeContactNumber: true, includeOwnerFields: true }),
    meta: { total, page, limit, totalPages },
  });
});

const listAdminProperties = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const { page, limit, errors: pageErrors } = parsePagination(query);
  const errors = [...pageErrors];
  const q = parseKeyword(query, errors);

  let status;
  if (query.status != null) {
    if (!PROPERTY_STATUSES.includes(query.status)) {
      errors.push(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
    } else {
      status = query.status;
    }
  }

  let sort;
  if (query.sort != null) {
    if (!propertyService.LIST_SORTS.includes(query.sort)) {
      errors.push(`sort must be one of: ${propertyService.LIST_SORTS.join(', ')}`);
    } else {
      sort = query.sort;
    }
  }

  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { properties, total, totalPages } = await propertyService.findProperties({
    filters: { status, sort, q, admin: true },
    page,
    limit,
  });
  const imagesByPropertyId = await propertyService.getImagesForProperties(properties.map((p) => p._id));

  res.status(200).json({
    properties: serializeProperties(properties, imagesByPropertyId, { includeOwnerFields: true }),
    meta: { total, page, limit, totalPages },
  });
});

// Any status, with the contact number, so the admin edit form can be pre-filled.
const getAdminProperty = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw AppError.notFound('Property not found');
  }
  const property = await propertyService.findByIdWithContact(req.params.id);
  if (!property) {
    throw AppError.notFound('Property not found');
  }
  const images = await propertyService.getPropertyImages(property._id);
  res.status(200).json({
    property: serializeProperty(property, images, { includeContactNumber: true, includeOwnerFields: true }),
  });
});

const getPropertyBySlug = asyncHandler(async (req, res) => {
  const property = await propertyService.findPublishedBySlug(req.params.slug);
  if (!property) {
    throw AppError.notFound('Property not found');
  }
  const images = await propertyService.getPropertyImages(property._id);
  res.status(200).json({ property: serializeProperty(property, images) });
});

// Logged-in users only (protect + contactLimiter in the router). Drafts,
// archived listings and unknown ids are all a plain 404 so the response never
// reveals that an unpublished listing exists. The number is never logged.
const getPropertyContact = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw AppError.notFound('Property not found');
  }
  const result = await propertyService.findPublishedContactById(req.params.id, req.user);
  if (!result.found) {
    throw AppError.notFound('Property not found');
  }
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ contactNumber: result.contactNumber });
});

function validateUpdateInput(body, isAdmin) {
  const errors = [];

  if (body.title !== undefined) {
    const error = titleError(body.title);
    if (error) errors.push(error);
  }
  if (body.areaSqft != null && !isFiniteNonNegativeNumber(body.areaSqft)) {
    errors.push('areaSqft must be a non-negative number');
  }
  if (body.priceInRupees != null && !isFiniteNonNegativeNumber(body.priceInRupees)) {
    errors.push('priceInRupees must be a non-negative number');
  }
  if (body.bhk != null && !isFiniteNonNegativeNumber(body.bhk)) errors.push('bhk must be a non-negative number');
  pushTextFieldErrors(errors, body);
  if (body.amenities != null && (!Array.isArray(body.amenities) || !body.amenities.every((a) => typeof a === 'string'))) {
    errors.push('amenities must be an array of strings');
  }

  if (isAdmin) {
    if (body.status != null && !PROPERTY_STATUSES.includes(body.status)) {
      errors.push(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
    }
    if (body.verified != null && typeof body.verified !== 'boolean') {
      errors.push('verified must be a boolean');
    }
    if (body.featured != null && typeof body.featured !== 'boolean') {
      errors.push('featured must be a boolean');
    }
    if (body.featuredRank != null && !isFiniteNonNegativeNumber(body.featuredRank)) {
      errors.push('featuredRank must be a non-negative number');
    }
    if (body.city != null && !isNonEmptyString(body.city)) {
      errors.push('city must be a non-empty string');
    }
    if (body.intent != null && !PROPERTY_INTENTS.includes(body.intent)) {
      errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
    }
    if (body.propertyType != null && !PROPERTY_TYPES.includes(body.propertyType)) {
      errors.push(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
    }
  }

  return { errors };
}

const updateProperty = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const body = req.body || {};
  const { errors } = validateUpdateInput(body, isAdmin);
  // Edits send the final photo set, so the minimum applies whenever images is sent.
  errors.push(
    ...validateDetailFields(body),
    ...validateImagesInput(body.images, body.images === undefined ? 0 : MIN_PROPERTY_IMAGES),
  );
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const result = await propertyService.updatePropertyById(req.params.id, normalizeListingFields(body), req.user);

  if (result.error === 'not_found') throw AppError.notFound('Property not found');
  if (result.error === 'forbidden') throw AppError.forbidden('You do not have permission to update this property');

  res.status(200).json({ property: serializeProperty(result.property, result.images, { includeOwnerFields: true }) });
});

const deleteProperty = asyncHandler(async (req, res) => {
  const result = await propertyService.deletePropertyById(req.params.id, req.user);

  if (result.error === 'not_found') throw AppError.notFound('Property not found');
  if (result.error === 'forbidden') throw AppError.forbidden('You do not have permission to delete this property');

  res.status(204).send();
});

function validateBulkIds(ids) {
  const errors = [];

  if (!Array.isArray(ids) || ids.length === 0) {
    errors.push('ids must be a non-empty array');
    return errors;
  }

  const invalidIds = ids.filter((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id));
  if (invalidIds.length > 0) {
    errors.push(`ids contains invalid identifiers: ${invalidIds.join(', ')}`);
  }

  return errors;
}

function hasField(obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field);
}

function validateBulkUpdates(updates) {
  const errors = [];

  if (updates == null || typeof updates !== 'object' || Array.isArray(updates)) {
    errors.push('updates must be an object');
    return errors;
  }

  const unknownFields = Object.keys(updates).filter((field) => !BULK_UPDATABLE_FIELDS.includes(field));
  if (unknownFields.length > 0) {
    errors.push(`updates contains unsupported fields: ${unknownFields.join(', ')}`);
  }
  if (Object.keys(updates).length === 0) {
    errors.push('updates must include at least one field');
  }

  // Presence is decided by key, not value: bulkUpdatePropertiesByIds $sets every
  // own key, so a present null must be validated like any other value.
  if (hasField(updates, 'status') && !PROPERTY_STATUSES.includes(updates.status)) {
    errors.push(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
  }
  if (hasField(updates, 'verified') && typeof updates.verified !== 'boolean') {
    errors.push('verified must be a boolean');
  }
  if (hasField(updates, 'featured') && typeof updates.featured !== 'boolean') {
    errors.push('featured must be a boolean');
  }
  // null is valid here: it means "unranked".
  if (hasField(updates, 'featuredRank') && updates.featuredRank !== null && !isFiniteNonNegativeNumber(updates.featuredRank)) {
    errors.push('featuredRank must be null or a non-negative number');
  }
  if (hasField(updates, 'city') && (typeof updates.city !== 'string' || updates.city.trim().length === 0)) {
    errors.push('city must be a non-empty string');
  }
  if (hasField(updates, 'intent') && !PROPERTY_INTENTS.includes(updates.intent)) {
    errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
  }
  if (hasField(updates, 'propertyType') && !PROPERTY_TYPES.includes(updates.propertyType)) {
    errors.push(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
  }

  return errors;
}

const bulkUpdateProperties = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [...validateBulkIds(body.ids), ...validateBulkUpdates(body.updates)];
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { matchedCount, modifiedCount } = await propertyService.bulkUpdatePropertiesByIds(body.ids, body.updates);

  res.status(200).json({ matchedCount, modifiedCount, ids: body.ids });
});

const bulkDeleteProperties = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateBulkIds(body.ids);
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { deletedCount } = await propertyService.bulkDeletePropertiesByIds(body.ids);

  res.status(200).json({ deletedCount, ids: body.ids });
});

module.exports = {
  createProperty,
  listProperties,
  listMyProperties,
  listFeaturedProperties,
  listAdminProperties,
  getAdminProperty,
  getPropertyBySlug,
  getPropertyContact,
  updateProperty,
  deleteProperty,
  bulkUpdateProperties,
  bulkDeleteProperties,
};
