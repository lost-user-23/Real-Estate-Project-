const express = require('express');
const {protect} = require('../middleware/auth.middleware');
const {generateUploadSignature} = require('../controllers/upload.controller');

const router = express.Router();

router.post('/signature', protect, generateUploadSignature);

module.exports = router;