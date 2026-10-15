const mongoose = require('mongoose');
const { LOAN_ENQUIRY_STATUSES, LOAN_TYPES } = require('../models/LoanEnquiry');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validateLoanEnquiry } = require('../utils/loanEnquiryValidation');
const {
  serializeLoanEnquiry,
  serializeLoanEnquiries,
} = require('../utils/serializers/loanEnquiry.serializer');
const loanEnquiryService = require('../services/loanEnquiry.service');
const { notifyNewLoanEnquiry } = require('../services/loanEnquiryNotifier.service');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const STATUS_ERROR = `status must be one of: ${LOAN_ENQUIRY_STATUSES.join(', ')}`;
const TYPE_ERROR = `loanType must be one of: ${LOAN_TYPES.join(', ')}`;

const successBody = (referenceId) => ({
  success: true,
  message: 'Thanks, we have received your request. Our team will contact you soon.',
  referenceId: String(referenceId),
});

const submitLoanEnquiry = asyncHandler(async (req, res) => {
  // Honeypot: answer exactly like a success (with a throwaway reference) so
  // bots cannot tell they were caught. Nothing is saved.
  if (req.body?.website) {
    return res.status(201).json(successBody(new mongoose.Types.ObjectId()));
  }

  const data = validateLoanEnquiry(req.body);
  const { enquiry, created } = await loanEnquiryService.createLoanEnquiry(data, req.ip);
  if (created) notifyNewLoanEnquiry(enquiry);

  res.status(201).json(successBody(enquiry._id));
});

const listAdminLoanEnquiries = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const errors = [];
  let page = query.page !== undefined ? Number(query.page) : 1;
  let limit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;

  if (!Number.isInteger(page) || page < 1) errors.push('page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1) errors.push('limit must be a positive integer');
  else if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (query.status !== undefined && !LOAN_ENQUIRY_STATUSES.includes(query.status)) errors.push(STATUS_ERROR);
  if (query.loanType !== undefined && !LOAN_TYPES.includes(query.loanType)) errors.push(TYPE_ERROR);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const { enquiries, total, totalPages } = await loanEnquiryService.listLoanEnquiries({
    status: query.status,
    loanType: query.loanType,
    page,
    limit,
  });

  res.status(200).json({
    enquiries: serializeLoanEnquiries(enquiries),
    meta: { total, page, limit, totalPages },
  });
});

const updateAdminLoanEnquiryStatus = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== 'status') errors.push('only status can be updated');
  if (typeof body.status !== 'string' || !LOAN_ENQUIRY_STATUSES.includes(body.status)) errors.push(STATUS_ERROR);
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const updated = await loanEnquiryService.updateLoanEnquiryStatus(req.params.id, body.status);
  res.status(200).json({ loanEnquiry: serializeLoanEnquiry(updated) });
});

module.exports = { submitLoanEnquiry, listAdminLoanEnquiries, updateAdminLoanEnquiryStatus };
