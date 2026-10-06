const express = require('express');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');
const { protect } = require('../middleware/auth.middleware');
const requireVerified = require('../middleware/requireVerified');
const {
  createProperty,
  listProperties,
  listMyProperties,
  listFeaturedProperties,
  getPropertyBySlug,
  getPropertyContact,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');

const router = express.Router();

// Contact numbers are private to logged-in users; this caps how many one
// account can collect. Keyed by user (after protect), not by IP.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  // Same convention as the auth limiters: tests flip NODE_ENV to exercise it.
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next, options) => next(new AppError('Too many contact requests. Please try again later.', options.statusCode)),
});

router.post('/', protect, requireVerified, createProperty);
router.get('/', listProperties);
// Must be registered before '/:slug', which would otherwise capture "mine" and "featured".
router.get('/mine', protect, listMyProperties);
router.get('/featured', listFeaturedProperties);
router.get('/:id/contact', protect, requireVerified, contactLimiter, getPropertyContact);
router.get('/:slug', getPropertyBySlug);
router.patch('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;
