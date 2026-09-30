const mongoose = require('mongoose');
const { REPORT_STATUSES } = require('../models/Report');
const reportService = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { serializeReport, serializeReports } = require('../utils/serializers/report.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCreateFields(body) {
  const errors = [];

  if (!isNonEmptyString(body.listingUrlOrId)) {
    errors.push('listingUrlOrId must be a non-empty string');
  }
  if (!isNonEmptyString(body.reason)) {
    errors.push('reason must be a non-empty string');
  }
  if (body.details !== undefined && typeof body.details !== 'string') {
    errors.push('details must be a string');
  }
  if (body.propertyId !== undefined && body.propertyId !== null) {
    if (!mongoose.Types.ObjectId.isValid(body.propertyId)) {
      errors.push('propertyId must be a valid ObjectId');
    }
  }

  return errors;
}

function validateStatusUpdate(body) {
  const errors = [];
  const keys = Object.keys(body || {});

  if (keys.length !== 1 || keys[0] !== 'status') {
    errors.push('only status can be updated');
  }
  if (!isNonEmptyString(body.status) || !REPORT_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${REPORT_STATUSES.join(', ')}`);
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

function validateStatusFilter(status) {
  if (status !== undefined && !REPORT_STATUSES.includes(status)) {
    throw AppError.badRequest('Validation failed', [`status must be one of: ${REPORT_STATUSES.join(', ')}`]);
  }
}

const createReport = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateCreateFields(body);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const report = await reportService.createReport({
    listingUrlOrId: body.listingUrlOrId,
    reason: body.reason,
    details: body.details,
    propertyId: body.propertyId,
    reporterId: req.user?._id ?? null,
  });

  res.status(201).json({ report: serializeReport(report) });
});

const listAdminReports = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  validateStatusFilter(req.query?.status);

  const { reports, total, totalPages } = await reportService.listReports({
    ...pagination,
    status: req.query?.status,
  });

  res.status(200).json({
    reports: serializeReports(reports),
    meta: { total, ...pagination, totalPages },
  });
});

const getAdminReportById = asyncHandler(async (req, res) => {
  const report = await reportService.findById(req.params.id);
  if (!report) throw AppError.notFound('Report not found');
  res.status(200).json({ report: serializeReport(report) });
});

const updateAdminReportStatus = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateStatusUpdate(body);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const report = await reportService.updateStatusById(req.params.id, body.status);
  if (!report) throw AppError.notFound('Report not found');
  res.status(200).json({ report: serializeReport(report) });
});

module.exports = {
  createReport,
  listAdminReports,
  getAdminReportById,
  updateAdminReportStatus,
};