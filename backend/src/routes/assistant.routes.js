const express = require('express');
const { chat } = require('../controllers/assistant.controller');
const { assistantRateLimiter } = require('../middleware/assistantRateLimiter');

const router = express.Router();

router.post('/chat', assistantRateLimiter, chat);

module.exports = router;
