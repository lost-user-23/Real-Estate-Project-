const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createProperty,
  listProperties,
  listMyProperties,
  getPropertyBySlug,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');

const router = express.Router();

router.post('/', protect, createProperty);
router.get('/', listProperties);
// Must be registered before '/:slug', which would otherwise capture "mine".
router.get('/mine', protect, listMyProperties);
router.get('/:slug', getPropertyBySlug);
router.patch('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;
