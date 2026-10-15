const express = require('express');
const {
  listAdminLoanEnquiries,
  updateAdminLoanEnquiryStatus,
} = require('../controllers/loanEnquiry.controller');

const router = express.Router();

router.get('/', listAdminLoanEnquiries);
router.patch('/:id', updateAdminLoanEnquiryStatus);

module.exports = router;
