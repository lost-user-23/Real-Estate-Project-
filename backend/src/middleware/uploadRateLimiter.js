const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const AppError = require('../utils/AppError');
const { UPLOAD_RATE_LIMIT, UPLOAD_DAILY_LIMIT } = require('../config/uploadConfig');

// Per authenticated user, falling back to IP. Mount after the auth middleware.
const keyGenerator = (req) => (req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip));

function createLimiter({ windowMs, max }, message) {
  return rateLimit({
    windowMs,
    limit: max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    // Same convention as the other limiters: skipped under jest (NODE_ENV=test).
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res, next) => next(new AppError(message, 429)),
  });
}

const uploadRateLimiter = createLimiter(
  UPLOAD_RATE_LIMIT,
  'Too many uploads. Please wait a few minutes before uploading more images.'
);
const uploadDailyLimiter = createLimiter(
  UPLOAD_DAILY_LIMIT,
  'Daily upload limit reached. Please try again tomorrow.'
);

module.exports = { uploadRateLimiter, uploadDailyLimiter, createLimiter };
