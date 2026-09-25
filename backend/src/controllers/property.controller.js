const Property = require('../models/Property');
const { PROPERTY_INTENTS, PROPERTY_TYPES, PROPERTY_STATUSES } = Property;
const propertyService = require('../services/property.service');
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
  const errors = validateCreateInput(req.body || {});
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const property = await propertyService.createProperty({
    ownerId: req.user._id,
    input: req.body,
  });

  res.status(201).json({ property: serializeProperty(property) });
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

  res.status(200).json({
    properties: serializeProperties(properties),
    meta: { total, page, limit, totalPages },
  });
});

const getPropertyBySlug = asyncHandler(async (req, res) => {
  const property = await propertyService.findPublishedBySlug(req.params.slug);
  if (!property) {
    throw AppError.notFound('Property not found');
  }
  res.status(200).json({ property: serializeProperty(property) });
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
  const { errors } = validateUpdateInput(req.body || {}, isAdmin);
  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const result = await propertyService.updatePropertyById(req.params.id, req.body || {}, req.user);

  if (result.error === 'not_found') throw AppError.notFound('Property not found');
  if (result.error === 'forbidden') throw AppError.forbidden('You do not have permission to update this property');

  res.status(200).json({ property: serializeProperty(result.property) });
});

const deleteProperty = asyncHandler(async (req, res) => {
  const result = await propertyService.deletePropertyById(req.params.id, req.user);

  if (result.error === 'not_found') throw AppError.notFound('Property not found');
  if (result.error === 'forbidden') throw AppError.forbidden('You do not have permission to delete this property');

  res.status(204).send();
});

module.exports = {
  createProperty,
  listProperties,
  getPropertyBySlug,
  updateProperty,
  deleteProperty,
};
