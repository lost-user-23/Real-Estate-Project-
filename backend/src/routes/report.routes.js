const express = require('express')
const optionalAuth = require('../middleware/optionalAuth')
const { protect } = require('../middleware/auth.middleware')
const { reportRateLimiter } = require('../middleware/reportRateLimiter')
const {createReport, listMyReports} = require('../controllers/report.controller')

const router = express.Router();

// Reports are open to anonymous visitors, so cap them per IP.
router.post('/', reportRateLimiter, optionalAuth, createReport);
router.get('/mine', protect, listMyReports);
module.exports = router;
