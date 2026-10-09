const express =  require('express');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');
const config = require('../config');
const router = express.Router();
const {protect} = require("../middleware/auth.middleware");
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getCurrentUser,
  updateProfile,
  changePassword,
  changeEmail,
  deleteAccount,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require('../controllers/auth.controller');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Automated tests hit these routes far more than any real client would
  // within a window; Jest sets NODE_ENV=test by default.
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next, options) => next(new AppError('Too many attempts, please try again later', options.statusCode)),
});

// Password/email/delete take the current password, so they are brute-force
// targets for anyone holding a stolen token. Keyed by user (after protect)
// with its own budget, separate from the login limiter.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next, options) => next(new AppError('Too many attempts, please try again later', options.statusCode)),
});

// Resending sends mail to arbitrary addresses, so it gets a much smaller budget
// than login. Deliberately NOT skipped in tests so the limit can be exercised.
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => next(new AppError('Too many requests, please try again later', options.statusCode)),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // 5 per hour is easy to exhaust while developing; production keeps it.
  skip: () => config.env === 'test' || config.env === 'development',
  handler: (req, res, next, options) => next(new AppError('Too many requests, please try again later', options.statusCode)),
});

// OTP verification is a brute-force target: 6-digit codes have only 10^6
// combinations. User-level attempt counting handles lockouts; IP limiter is skipped in tests.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next, options) => next(new AppError('Too many attempts, please try again later', options.statusCode)),
});

router.post('/register', authLimiter, register);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', resendLimiter, resendVerification);
router.post('/login', authLimiter, login);
// No authLimiter on refresh: every page load and every 15-minute expiry calls
// it, and it needs a valid unspent refresh token anyway. The global limiter applies.
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', protect, logoutAll);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, accountLimiter, deleteAccount);
router.post('/change-password', protect, accountLimiter, changePassword);
router.patch('/change-email', protect, accountLimiter, changeEmail);

// Password reset (unauthenticated)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/verify-reset-otp', otpVerifyLimiter, verifyResetOtp);
router.post('/reset-password', authLimiter, resetPassword);
module.exports = router;