const express = require('express');
const { submitContactMessage } = require('../controllers/contactMessage.controller');
const { contactRateLimiter } = require('../middleware/contactRateLimiter');

const router = express.Router();

router.post('/', contactRateLimiter, submitContactMessage);

module.exports = router;
