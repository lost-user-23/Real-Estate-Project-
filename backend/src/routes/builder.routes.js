const express = require('express');
const { listBuilders, getBuilderBySlug } = require('../controllers/builder.controller');

const router = express.Router();

router.get('/', listBuilders);
router.get('/:slug', getBuilderBySlug);

module.exports = router;
