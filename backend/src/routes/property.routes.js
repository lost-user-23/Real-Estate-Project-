const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const {
  createProperty,
  listProperties,
  listMyProperties,
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
  message: { message: 'Too many contact requests. Please try again later.' },
});

router.post('/', protect, createProperty);
router.get('/', listProperties);
// Must be registered before '/:slug', which would otherwise capture "mine".
router.get('/mine', protect, listMyProperties);
router.get('/:id/contact', protect, contactLimiter, getPropertyContact);
router.get('/:slug', getPropertyBySlug);
router.patch('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;
