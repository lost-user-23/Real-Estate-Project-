// routes/admin-report.routes.js
const express = require('express');
const {
  listAdminReports,
  getAdminReportById,
  updateAdminReportStatus,
} = require('../controllers/report.controller');

const router = express.Router();

router.get('/', listAdminReports);
router.get('/:id', getAdminReportById);
router.patch('/:id', updateAdminReportStatus);

module.exports = router;