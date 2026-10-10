const { CONTENT_STATUSES } = require('../models/contentStatus');
const articleService = require('../services/article.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { isValidImageUrl } = require('../services/cloudinaryAssets.service');
const { serializeArticle, serializeArticles } = require('../utils/serializers/article.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_TITLE_LENGTH = 200;
const TEXT_FIELDS = ['excerpt', 'content'];
const IMAGE_FIELDS = ['imageAlt'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateFields(body, { isCreate = false } = {}) {
  const errors = [];

  if (isCreate || body.title !== undefined) {
    if (!isNonEmptyString(body.title)) {
      errors.push('title must be a non-empty string');
    } else if (body.title.trim().length > MAX_TITLE_LENGTH) {
      errors.push(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
    if (!isNonEmptyString(body.slug) || !articleService.SLUG_PATTERN.test(body.slug)) {
      errors.push('slug must contain lowercase letters, numbers, and single hyphens only');
    }
  }

  for (const field of TEXT_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  for (const field of IMAGE_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string or null`);
    }
  }

  // undefined means not provided and null clears the image.
  if (body.imageUrl !== undefined && body.imageUrl !== null && !isValidImageUrl(body.imageUrl)) {
    errors.push('imageUrl must be a valid Cloudinary image URL');
  }

  if (body.status !== undefined && !CONTENT_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${CONTENT_STATUSES.join(', ')}`);
  }

  return errors;
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

function validateAndBuildPagination(query) {
  const { page, limit, errors } = parsePagination(query);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);
  return { page, limit };
}

const listPublicArticles = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  const { articles, total, totalPages } = await articleService.listArticles({
    ...pagination,
    publishedOnly: true,
  });

  res.status(200).json({
    articles: serializeArticles(articles),
    meta: { total, ...pagination, totalPages },
  });
});

const getPublicArticleBySlug = asyncHandler(async (req, res) => {
  const article = await articleService.findPublishedBySlug(req.params.slug);
  if (!article) throw AppError.notFound('Article not found');
  res.status(200).json({ article: serializeArticle(article) });
});

const listAdminArticles = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  const { articles, total, totalPages } = await articleService.listArticles({
    ...pagination,
    publishedOnly: false,
  });

  res.status(200).json({
    articles: serializeArticles(articles),
    meta: { total, ...pagination, totalPages },
  });
});

const getAdminArticleById = asyncHandler(async (req, res) => {
  const article = await articleService.findById(req.params.id);
  if (!article) throw AppError.notFound('Article not found');
  res.status(200).json({ article: serializeArticle(article) });
});

const createArticle = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateFields(body, { isCreate: true });
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const article = await articleService.createArticle(body);
  res.status(201).json({ article: serializeArticle(article) });
});

const updateArticle = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateFields(body);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const article = await articleService.updateArticleById(req.params.id, body);
  if (!article) throw AppError.notFound('Article not found');
  res.status(200).json({ article: serializeArticle(article) });
});

const publishArticle = asyncHandler(async (req, res) => {
  const article = await articleService.publishArticleById(req.params.id);
  if (!article) throw AppError.notFound('Article not found');
  res.status(200).json({ article: serializeArticle(article) });
});

const deleteArticle = asyncHandler(async (req, res) => {
  const article = await articleService.deleteArticleById(req.params.id);
  if (!article) throw AppError.notFound('Article not found');
  res.status(204).send();
});

module.exports = {
  listPublicArticles,
  getPublicArticleBySlug,
  listAdminArticles,
  getAdminArticleById,
  createArticle,
  updateArticle,
  publishArticle,
  deleteArticle,
};