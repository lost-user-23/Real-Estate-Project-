const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

function createContactRateLimiter({ limit = 5, windowMs = 60 * 60 * 1000, skip } = {}) {
  return rateLimit({
    windowMs,
    limit, // 5 submissions per IP per hour by default
    standardHeaders: true,
    legacyHeaders: false,
    // A rejected submission (validation error) is not spam; do not spend the budget.
    skipFailedRequests: true,
    ...(skip ? { skip } : {}),
    handler: (req, res, next) =>
      next(new AppError('Too many messages. Please try again later.', 429)),
  });
}

// Same convention as the other limiters: skipped under jest (NODE_ENV=test).
const contactRateLimiter = createContactRateLimiter({
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { contactRateLimiter, createContactRateLimiter };
