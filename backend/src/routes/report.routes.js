const express = require('express')
const optionalAuth = require('../middleware/optionalAuth')
const {createReport} = require('../controllers/report.controller')

const router = express.Router();
router.post('/',optionalAuth, createReport);
module.exports = router;