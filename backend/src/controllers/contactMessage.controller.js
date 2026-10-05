const { CONTACT_MESSAGE_STATUSES } = require('../models/ContactMessage');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const {
  serializeContactMessage,
  serializeContactMessages,
} = require('../utils/serializers/contactMessage.serializer');
const { validateContactMessage } = require('../utils/contactMessageValidation');
const contactMessageService = require('../services/contactMessage.service');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const STATUS_ERROR = `status must be one of: ${CONTACT_MESSAGE_STATUSES.join(', ')}`;

const SUCCESS_BODY = {
  success: true,
  message: 'Thanks, we will get back to you soon!',
};

const submitContactMessage = asyncHandler(async (req, res) => {
  // Honeypot: real users never fill this hidden field. Respond identically to
  // a real success so bots can't tell they were caught.
  if (req.body?.website) {
    return res.status(201).json(SUCCESS_BODY);
  }

  const data = validateContactMessage(req.body);
  await contactMessageService.createContactMessage(data, req.ip);

  res.status(201).json(SUCCESS_BODY);
});

const listAdminContactMessages = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const errors = [];
  let page = query.page !== undefined ? Number(query.page) : 1;
  let limit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;

  if (!Number.isInteger(page) || page < 1) {
    errors.push('page must be a positive integer');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    errors.push('limit must be a positive integer');
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }
  if (query.status !== undefined && !CONTACT_MESSAGE_STATUSES.includes(query.status)) {
    errors.push(STATUS_ERROR);
  }
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const { messages, total, totalPages } = await contactMessageService.listContactMessages({
    status: query.status,
    page,
    limit,
  });

  res.status(200).json({
    messages: serializeContactMessages(messages),
    meta: { total, page, limit, totalPages },
  });
});

const updateAdminContactMessageStatus = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = [];
  const keys = Object.keys(body);

  if (keys.length !== 1 || keys[0] !== 'status') {
    errors.push('only status can be updated');
  }
  if (typeof body.status !== 'string' || !CONTACT_MESSAGE_STATUSES.includes(body.status)) {
    errors.push(STATUS_ERROR);
  }
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const updated = await contactMessageService.updateContactMessageStatus(req.params.id, body.status);
  res.status(200).json({ contactMessage: serializeContactMessage(updated) });
});

module.exports = {
  submitContactMessage,
  listAdminContactMessages,
  updateAdminContactMessageStatus,
};
