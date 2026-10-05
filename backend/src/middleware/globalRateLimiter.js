const rateLimit = require('express-rate-limit');
const config = require('../config');
const AppError = require('../utils/AppError');

// Broad safety net for every route. The strict per-route limiters (auth,
// contact, reports, ...) stay in place and are hit first for their own paths.
function createGlobalRateLimiter({
  limit = config.rateLimitMax,
  windowMs = config.rateLimitWindowMs,
  skip,
} = {}) {
  return rateLimit({
    windowMs,
    limit, // 200 requests per IP per 15 minutes by default
    standardHeaders: true,
    legacyHeaders: false,
    // Load balancer health probes would otherwise burn the budget of their IP.
    skip: skip || ((req) => process.env.NODE_ENV === 'test' || req.path === '/health'),
    handler: (req, res, next, options) =>
      next(new AppError('Too many requests. Please try again later.', options.statusCode)),
  });
}

module.exports = { createGlobalRateLimiter, globalRateLimiter: createGlobalRateLimiter() };
