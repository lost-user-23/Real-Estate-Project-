const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

// Dedicated quota, separate from the contact form's.
// NOTE: the store is in-memory, so on Vercel/serverless the budget is per
// instance. That is a speed bump, not strict abuse prevention; a shared store
// (or CAPTCHA) would be needed for that and is out of scope here.
function createLoanEnquiryRateLimiter({ limit = 5, windowMs = 60 * 60 * 1000, skip } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    ...(skip ? { skip } : {}),
    handler: (req, res, next) =>
      next(new AppError('Too many requests. Please try again later.', 429)),
  });
}

const loanEnquiryRateLimiter = createLoanEnquiryRateLimiter({
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { loanEnquiryRateLimiter, createLoanEnquiryRateLimiter };
