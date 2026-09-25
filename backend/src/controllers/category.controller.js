const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeCategory } = require('../utils/serializers/category.serializer');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().select('name slug listingCount icon');
  res.json({ categories: categories.map(serializeCategory) });
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, icon } = req.body;
  const category = await Category.create({ name, slug, icon });
  res.status(201).json({ category: serializeCategory(category) });
});

const ALLOWED_FIELDS = ['name', 'slug', 'icon', 'listingCount'];

function validateField(field, value) {
  switch (field) {
    case 'name':
    case 'slug':
      if (typeof value !== 'string' || value.trim().length === 0) {
        return `${field} must be a non-empty string`;
      }
      break;
    case 'icon':
      if (typeof value !== 'string') {
        return 'icon must be a string';
      }
      break;
    case 'listingCount':
      if (typeof value !== 'number' || value < 0) {
        return 'listingCount must be a non-negative number';
      }
      break;
    default:
      break;
  }
  return null;
}

const updateCategory = asyncHandler(async (req, res) => {
  const updates = {};
  const validationErrors = [];

  for (const field of ALLOWED_FIELDS) {
    if (req.body[field] !== undefined) {
      const error = validateField(field, req.body[field]);
      if (error) {
        validationErrors.push(error);
      } else {
        updates[field] = field === 'slug' ? req.body[field].trim() : req.body[field];
      }
    }
  }

  if (validationErrors.length > 0) {
    throw AppError.badRequest('Validation failed', validationErrors);
  }

  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!category) throw AppError.notFound('Category not found');
  res.json({ category: serializeCategory(category) });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw AppError.notFound('Category not found');
  res.status(204).send();
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };