const express = require('express');
const { listPublicArticles, getPublicArticleBySlug } = require('../controllers/article.controller');

const router = express.Router();

router.get('/', listPublicArticles);
router.get('/:slug', getPublicArticleBySlug);

module.exports = router;