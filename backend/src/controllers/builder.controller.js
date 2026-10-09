const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { parseOptionalCity } = require('../utils/queryParams');
const builderService = require('../services/builder.service');
const { serializeBuilder } = require('../utils/serializers/builder.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

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
  } else {
    limit = Math.min(limit, MAX_LIMIT);
  }

  return { page, limit, errors };
}

function parseCity(query) {
  const errors = [];
  const city = parseOptionalCity(query, errors);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);
  return city;
}

function parseListQuery(query) {
  const { page, limit, errors } = parsePagination(query);
  const city = parseOptionalCity(query, errors);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);
  return { page, limit, city };
}

const listBuilders = asyncHandler(async (req, res) => {
  const pagination = parseListQuery(req.query || {});
  const { builders, total, totalPages } = await builderService.listBuilders(pagination);

  res.status(200).json({
    builders: builders.map(serializeBuilder),
    meta: { total, page: pagination.page, limit: pagination.limit, totalPages },
  });
});

const getBuilderBySlug = asyncHandler(async (req, res) => {
  const city = parseCity(req.query || {});
  const builder = await builderService.getBuilderBySlug(req.params.slug, { city });
  if (!builder) throw AppError.notFound('Builder not found');
  res.status(200).json({ builder: serializeBuilder(builder) });
});

module.exports = { listBuilders, getBuilderBySlug };
