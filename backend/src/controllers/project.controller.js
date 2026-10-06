const { CONTENT_STATUSES } = require('../models/contentStatus');
const { isOwnCloudinaryImageUrl } = require('../services/cloudinaryAssets.service');
const projectService =require('../services/project.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parseOptionalCity } = require('../utils/queryParams');
const { serializeProject, serializeProjects } = require('../utils/serializers/project.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_NAME_LENGTH = 200;
const MAX_IMAGE_URL_LENGTH = 2048;
const NULLABLE_STRING_FIELDS = ['locality', 'imageUrl', 'imageAlt'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateFields(body, { isCreate = false } = {}) {
  const errors = [];

  if (isCreate || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      errors.push('name must be a non-empty string');
    } else if (body.name.trim().length > MAX_NAME_LENGTH) {
      errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
    }
  }

  for (const field of ['developer', 'city']) {
    if (isCreate || body[field] !== undefined) {
      if (!isNonEmptyString(body[field])) {
        errors.push(`${field} must be a non-empty string`);
      }
    }
  }

  if (body.possessionLabel !== undefined && typeof body.possessionLabel !== 'string') {
    errors.push('possessionLabel must be a string');
  }

  for (const field of NULLABLE_STRING_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
      errors.push(`${field} must be a string or null`);
    }
  }

  if (
    typeof body.imageUrl === 'string' &&
    !(body.imageUrl.length <= MAX_IMAGE_URL_LENGTH && isOwnCloudinaryImageUrl(body.imageUrl))
  ) {
    errors.push('imageUrl must be a valid Cloudinary image URL');
  }

  if (isCreate || body.startingPriceInRupees !== undefined) {
    const price = body.startingPriceInRupees;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      errors.push('startingPriceInRupees must be a non-negative number');
    }
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

const listPublicProjects = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  const { projects, total, totalPages } = await projectService.listProjects({
    ...pagination,
    publishedOnly: true,
  });

  res.status(200).json({
    projects: serializeProjects(projects),
    meta: { total, ...pagination, totalPages },
  });
});

// Backs the home page's "new projects" section per docs/backend-architecture.md:
// published only, newest first, capped at 4 — separate from the paginated list above.
const listNewProjects = asyncHandler(async (req, res) => {
  const projects = await projectService.listNewProjects();
  res.status(200).json({ projects: serializeProjects(projects) });
});

// Builders are derived from published projects (Project.developer is a plain
// string), grouped and counted in the database so counts are never partial.
const listBuilders = asyncHandler(async (req, res) => {
  const errors = [];
  const city = parseOptionalCity(req.query || {}, errors);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const builders = await projectService.listBuilders({ city });
  res.status(200).json({
    builders: builders.map((builder) => ({ ...builder, projects: serializeProjects(builder.projects) })),
  });
});

const getPublicProjectById = asyncHandler(async (req, res) => {
  const project = await projectService.findPublishedById(req.params.id);
  if (!project) throw AppError.notFound('Project not found');
  res.status(200).json({ project: serializeProject(project) });
});

const listAdminProjects = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  const { projects, total, totalPages } = await projectService.listProjects({
    ...pagination,
    publishedOnly: false,
  });

  res.status(200).json({
    projects: serializeProjects(projects),
    meta: { total, ...pagination, totalPages },
  });
});

const getAdminProjectById = asyncHandler(async (req, res) => {
  const project = await projectService.findById(req.params.id);
  if (!project) throw AppError.notFound('Project not found');
  res.status(200).json({ project: serializeProject(project) });
});

const createProject = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateFields(body, { isCreate: true });
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const project = await projectService.createProject(body);
  res.status(201).json({ project: serializeProject(project) });
});

const updateProject = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateFields(body);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const project = await projectService.updateProjectById(req.params.id, body);
  if (!project) throw AppError.notFound('Project not found');
  res.status(200).json({ project: serializeProject(project) });
});

const publishProject = asyncHandler(async (req, res) => {
  const project = await projectService.publishProjectById(req.params.id);
  if (!project) throw AppError.notFound('Project not found');
  res.status(200).json({ project: serializeProject(project) });
});

const deleteProject = asyncHandler(async (req, res) => {
  const project = await projectService.deleteProjectById(req.params.id);
  if (!project) throw AppError.notFound('Project not found');
  res.status(204).send();
});

module.exports = {
  listPublicProjects,
  listNewProjects,
  listBuilders,
  getPublicProjectById,
  listAdminProjects,
  getAdminProjectById,
  createProject,
  updateProject,
  publishProject,
  deleteProject,
};
