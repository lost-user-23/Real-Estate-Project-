const express =  require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {protect} = require("../middleware/auth.middleware");
const {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  changeEmail,
  deleteAccount,
} = require('../controllers/auth.controller');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Automated tests hit these routes far more than any real client would
  // within a window; Jest sets NODE_ENV=test by default.
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many attempts, please try again later' },
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
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.get('/me', protect, getCurrentUser);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, accountLimiter, deleteAccount);
router.post('/change-password', protect, accountLimiter, changePassword);
router.patch('/change-email', protect, accountLimiter, changeEmail);
module.exports = router;