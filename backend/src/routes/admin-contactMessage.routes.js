const express = require('express');
const {
  listAdminContactMessages,
  updateAdminContactMessageStatus,
} = require('../controllers/contactMessage.controller');

const router = express.Router();

router.get('/', listAdminContactMessages);
router.patch('/:id', updateAdminContactMessageStatus);

module.exports = router;
