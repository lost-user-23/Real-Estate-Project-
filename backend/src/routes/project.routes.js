const express = require('express');
const {
  listPublicProjects,
  listNewProjects,
  getPublicProjectById,
} = require('../controllers/project.controller');

const router = express.Router();

// Registered before "/:id" so the literal "new" segment isn't cast to an ObjectId.
router.get('/new', listNewProjects);
router.get('/', listPublicProjects);
router.get('/:id', getPublicProjectById);

module.exports = router;
