const express =  require('express');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');
const router = express.Router();
const {protect} = require("../middleware/auth.middleware");
const {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  changeEmail,
  deleteAccount,
  verifyEmail,
  resendVerification,
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

router.post('/register', authLimiter, register);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', resendLimiter, resendVerification);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, accountLimiter, deleteAccount);
router.post('/change-password', protect, accountLimiter, changePassword);
router.patch('/change-email', protect, accountLimiter, changeEmail);
module.exports = router;