const express = require('express')
const rateLimit = require('express-rate-limit')
const AppError = require('../utils/AppError');
const optionalAuth = require('../middleware/optionalAuth')
const {createReport} = require('../controllers/report.controller')

const router = express.Router();

// Reports are open to anonymous visitors, so cap them per IP.
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Same convention as the other limiters: tests flip NODE_ENV to exercise it.
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next, options) => next(new AppError('Too many reports. Please try again later.', options.statusCode)),
});

router.post('/', reportLimiter, optionalAuth, createReport);
module.exports = router;
