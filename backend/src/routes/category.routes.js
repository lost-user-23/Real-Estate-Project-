const express = require('express');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/category.controller');

const router = express.Router();

router.get('/', listCategories);
router.post('/', protect, restrictTo('admin'), createCategory);
router.patch('/:id', protect, restrictTo('admin'), updateCategory);
router.delete('/:id', protect, restrictTo('admin'), deleteCategory);

module.exports = router;