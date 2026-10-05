const express = require('express');
const {protect} = require('../middleware/auth.middleware');
const {uploadImage: uploadImageController} = require('../controllers/upload.controller');
const {uploadRateLimiter, uploadDailyLimiter} = require('../middleware/uploadRateLimiter');
const {uploadImage} = require('../middleware/uploadImage');

const router = express.Router();

router.post('/image', protect, uploadRateLimiter, uploadDailyLimiter, uploadImage, uploadImageController);

module.exports = router;
