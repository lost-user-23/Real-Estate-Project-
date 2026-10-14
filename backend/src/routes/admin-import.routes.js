const express = require('express');
const requireImportKey = require('../middleware/importApiKey');
const { importProperties } = require('../controllers/import.controller');

const router = express.Router();

// The key is checked BEFORE the body is parsed, so an unauthenticated caller
// cannot make the server read a multi-MB body. app.js skips its global 100kb
// JSON parser for this path; this larger one replaces it.
router.post('/properties', requireImportKey, express.json({ limit: '5mb' }), importProperties);

module.exports = router;
