const mongoose = require('mongoose');
const Property = require('../models/Property');
const { PROPERTY_INTENTS, PROPERTY_TYPES, PROPERTY_STATUSES } = Property;
const propertyService = require('../services/property.service');
const { BULK_UPDATABLE_FIELDS } = propertyService;
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { serializeProperty, serializeProperties } = require('../utils/serializers/property.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_TITLE_LENGTH = 200;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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
  if (images.length < minimumCount) {
    errors.push(`images must contain at least ${minimumCount} images`);
  }

  images.forEach((image, index) => {
    if (typeof image === 'string') {
      if (!isNonEmptyString(image)) errors.push(`images[${index}] must be a non-empty URL string`);
      return;
    }
    if (typeof image !== 'object' || image === null || !isNonEmptyString(image.url)) {
      errors.push(`images[${index}].url must be a non-empty string`);
    }
    if (image != null && image.alt != null && typeof image.alt !== 'string') {
      errors.push(`images[${index}].alt must be a string`);
    }
  });

  return errors;
}

function validateCreateInput(body) {
  const errors = [];

  if (!isNonEmptyString(body.title)) {
    errors.push('title is required');
  } else if (body.title.trim().length > MAX_TITLE_LENGTH) {
    errors.push(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  if (!PROPERTY_INTENTS.includes(body.intent)) {
    errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
  }
  if (!PROPERTY_TYPES.includes(body.propertyType)) {
    errors.push(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
  }
  if (!isFiniteNonNegativeNumber(body.areaSqft)) errors.push('areaSqft must be a non-negative number');
  if (!isFiniteNonNegativeNumber(body.priceInRupees)) errors.push('priceInRupees must be a non-negative number');
  if (!isNonEmptyString(body.city)) errors.push('city is required');

  if (body.bhk != null && !isFiniteNonNegativeNumber(body.bhk)) {
    errors.push('bhk must be a non-negative number');
  }
  if (body.locality != null && typeof body.locality !== 'string') {
    errors.push('locality must be a string');
  }
  if (body.description != null && typeof body.description !== 'string') {
    errors.push('description must be a string');
  }
  if (body.contactNumber != null && typeof body.contactNumber !== 'string') {
    errors.push('contactNumber must be a string');
  }
  if (body.amenities != null) {
    if (!Array.isArray(body.amenities) || !body.amenities.every((a) => typeof a === 'string')) {
      errors.push('amenities must be an array of strings');
    }
  }

  return errors;
}

const createProperty = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [...validateCreateInput(body), ...validateImagesInput(body.images, 5)];
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { property, images } = await propertyService.createProperty({
    ownerId: req.user._id,
    input: body,
  });

  res.status(201).json({ property: serializeProperty(property, images) });
});

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

  if (query.city != null) filters.city = query.city;
  if (query.locality != null) filters.locality = query.locality;

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
    properties: serializeProperties(properties, imagesByPropertyId, { includeContactNumber: true }),
    meta: { total, page, limit, totalPages },
  });
});

const listAdminProperties = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const { page, limit, errors: pageErrors } = parsePagination(query);
  const errors = [...pageErrors];

  let status;
  if (query.status != null) {
    if (!PROPERTY_STATUSES.includes(query.status)) {
      errors.push(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
    } else {
      status = query.status;
    }
  }

  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { properties, total, totalPages } = await propertyService.findProperties({
    filters: { status, admin: true },
    page,
    limit,
  });
  const imagesByPropertyId = await propertyService.getImagesForProperties(properties.map((p) => p._id));

  res.status(200).json({
    properties: serializeProperties(properties, imagesByPropertyId),
    meta: { total, page, limit, totalPages },
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
  const result = await propertyService.findPublishedContactById(req.params.id);
  if (!result.found) {
    throw AppError.notFound('Property not found');
  }
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ contactNumber: result.contactNumber });
});

function validateUpdateInput(body, isAdmin) {
  const errors = [];

  if (body.title != null) {
    if (!isNonEmptyString(body.title)) {
      errors.push('title must be a non-empty string');
    } else if (body.title.trim().length > MAX_TITLE_LENGTH) {
      errors.push(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }
  }
  if (body.areaSqft != null && !isFiniteNonNegativeNumber(body.areaSqft)) {
    errors.push('areaSqft must be a non-negative number');
  }
  if (body.priceInRupees != null && !isFiniteNonNegativeNumber(body.priceInRupees)) {
    errors.push('priceInRupees must be a non-negative number');
  }
  if (body.bhk != null && !isFiniteNonNegativeNumber(body.bhk)) errors.push('bhk must be a non-negative number');
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
  errors.push(...validateImagesInput(body.images));
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const result = await propertyService.updatePropertyById(req.params.id, body, req.user);

  if (result.error === 'not_found') throw AppError.notFound('Property not found');
  if (result.error === 'forbidden') throw AppError.forbidden('You do not have permission to update this property');

  res.status(200).json({ property: serializeProperty(result.property, result.images) });
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

  if (updates.status != null && !PROPERTY_STATUSES.includes(updates.status)) {
    errors.push(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
  }
  if (updates.verified != null && typeof updates.verified !== 'boolean') {
    errors.push('verified must be a boolean');
  }
  if (updates.featured != null && typeof updates.featured !== 'boolean') {
    errors.push('featured must be a boolean');
  }
  if (updates.featuredRank != null && !isFiniteNonNegativeNumber(updates.featuredRank)) {
    errors.push('featuredRank must be a non-negative number');
  }
  if (updates.city != null && !isNonEmptyString(updates.city)) {
    errors.push('city must be a non-empty string');
  }
  if (updates.intent != null && !PROPERTY_INTENTS.includes(updates.intent)) {
    errors.push(`intent must be one of: ${PROPERTY_INTENTS.join(', ')}`);
  }
  if (updates.propertyType != null && !PROPERTY_TYPES.includes(updates.propertyType)) {
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
  listAdminProperties,
  getPropertyBySlug,
  getPropertyContact,
  updateProperty,
  deleteProperty,
  bulkUpdateProperties,
  bulkDeleteProperties,
};
