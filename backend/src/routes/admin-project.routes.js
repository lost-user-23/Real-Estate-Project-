const express = require('express');
const {
  listAdminProjects,
  getAdminProjectById,
  createProject,
  updateProject,
  publishProject,
  deleteProject,
} = require('../controllers/project.controller');

const router = express.Router();

router.get('/', listAdminProjects);
router.post('/', createProject);
router.get('/:id', getAdminProjectById);
router.patch('/:id/publish', publishProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

module.exports = router;
