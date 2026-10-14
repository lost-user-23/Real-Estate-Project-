const { REPORT_STATUSES, REPORT_REASONS } = require('../models/Report');
const reportService = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { serializeReport, serializeAdminReport, serializeMyReport } = require('../utils/serializers/report.serializer');

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_LISTING_LENGTH = 500;
const MAX_REASON_LENGTH = 200;
const MAX_DETAILS_LENGTH = 2000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCreateFields(body) {
  const errors = [];

  if (!isNonEmptyString(body.listingUrlOrId)) {
    errors.push('listingUrlOrId must be a non-empty string');
  } else if (body.listingUrlOrId.trim().length > MAX_LISTING_LENGTH) {
    errors.push(`listingUrlOrId must be at most ${MAX_LISTING_LENGTH} characters`);
  }
  if (!isNonEmptyString(body.reason)) {
    errors.push('reason must be a non-empty string');
  } else if (body.reason.trim().length > MAX_REASON_LENGTH) {
    errors.push(`reason must be at most ${MAX_REASON_LENGTH} characters`);
  } else if (!REPORT_REASONS.includes(body.reason.trim())) {
    errors.push('reason must be one of the listed reasons');
  }
  if (body.details !== undefined && typeof body.details !== 'string') {
    errors.push('details must be a string');
  } else if (body.details !== undefined && body.details.length > MAX_DETAILS_LENGTH) {
    errors.push(`details must be at most ${MAX_DETAILS_LENGTH} characters`);
  }
  if (body.propertyId !== undefined && body.propertyId !== null) {
    if (typeof body.propertyId !== 'string' || !OBJECT_ID.test(body.propertyId)) {
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

  // tracked: the report is tied to a valid logged-in reporter, so it shows under "My reports".
  res.status(201).json({ report: serializeReport(report), tracked: Boolean(report.reporterId) });
});

const listMyReports = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  const { reports, properties, total, totalPages } = await reportService.listReportsByReporter(req.user._id, pagination);

  res.status(200).json({
    reports: reports.map((report) => serializeMyReport(report, properties)),
    meta: { total, ...pagination, totalPages },
  });
});

const listAdminReports = asyncHandler(async (req, res) => {
  const pagination = validateAndBuildPagination(req.query || {});
  validateStatusFilter(req.query?.status);

  const { reports, properties, total, totalPages } = await reportService.listReports({
    ...pagination,
    status: req.query?.status,
  });

  res.status(200).json({
    reports: reports.map((report) => serializeAdminReport(report, properties)),
    meta: { total, ...pagination, totalPages },
  });
});

const getAdminReportById = asyncHandler(async (req, res) => {
  const found = await reportService.findById(req.params.id);
  if (!found) throw AppError.notFound('Report not found');
  res.status(200).json({ report: serializeAdminReport(found.report, found.properties) });
});

const updateAdminReportStatus = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateStatusUpdate(body);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const updated = await reportService.updateStatusById(req.params.id, body.status);
  if (!updated) throw AppError.notFound('Report not found');
  res.status(200).json({ report: serializeAdminReport(updated.report, updated.properties) });
});

module.exports = {
  createReport,
  listMyReports,
  listAdminReports,
  getAdminReportById,
  updateAdminReportStatus,
};