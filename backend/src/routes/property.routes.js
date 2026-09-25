const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  createProperty,
  listProperties,
  getPropertyBySlug,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');

const router = express.Router();

router.post('/', protect, createProperty);
router.get('/', listProperties);
router.get('/:slug', getPropertyBySlug);
router.patch('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;
