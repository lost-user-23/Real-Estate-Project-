const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

function createReportRateLimiter({ limit = 5, windowMs = 60 * 60 * 1000, skip } = {}) {
  return rateLimit({
    windowMs,
    limit, // 5 reports per IP per hour by default
    standardHeaders: true,
    legacyHeaders: false,
    // A rejected report (validation error, duplicate) is not spam; do not spend the budget.
    skipFailedRequests: true,
    ...(skip ? { skip } : {}),
    handler: (req, res, next) =>
      next(new AppError('Too many reports. Please try again later.', 429)),
  });
}

// Same convention as the other limiters: skipped under jest (NODE_ENV=test).
const reportRateLimiter = createReportRateLimiter({
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { reportRateLimiter, createReportRateLimiter };
