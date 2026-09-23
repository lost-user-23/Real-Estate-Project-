const express =  require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {protect} = require("../middleware/auth.middleware");
const {register, login, getCurrentUser} = require('../controllers/auth.controller');

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

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.get('/me', protect, getCurrentUser);
module.exports = router;