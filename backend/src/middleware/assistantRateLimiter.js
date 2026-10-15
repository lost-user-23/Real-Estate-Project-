const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

// Each chat turn can trigger a paid AI call and several database queries, so
// it gets its own quota, separate from the global one.
// NOTE: the store is in-memory, so on serverless hosting the budget is per
// instance. It is a speed bump, not strict abuse prevention.
function createAssistantRateLimiter({ limit = 40, windowMs = 10 * 60 * 1000, skip } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(skip ? { skip } : {}),
    handler: (req, res, next) => next(new AppError('You are sending messages too quickly. Please wait a moment and try again.', 429)),
  });
}

const assistantRateLimiter = createAssistantRateLimiter({
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { assistantRateLimiter, createAssistantRateLimiter };
