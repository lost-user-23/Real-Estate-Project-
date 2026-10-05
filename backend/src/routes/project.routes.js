const express = require('express');
const {
  listPublicProjects,
  listNewProjects,
  listBuilders,
  getPublicProjectById,
} = require('../controllers/project.controller');

const router = express.Router();

// Registered before "/:id" so the literal "new" and "builders" segments aren't cast to an ObjectId.
router.get('/new', listNewProjects);
router.get('/builders', listBuilders);
router.get('/', listPublicProjects);
router.get('/:id', getPublicProjectById);

module.exports = router;
