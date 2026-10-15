const express = require('express');
const { submitLoanEnquiry } = require('../controllers/loanEnquiry.controller');
const { loanEnquiryRateLimiter } = require('../middleware/loanEnquiryRateLimiter');

const router = express.Router();

router.post('/', loanEnquiryRateLimiter, submitLoanEnquiry);

module.exports = router;
