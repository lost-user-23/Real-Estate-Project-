const express = require('express');
const {
  listAdminArticles,
  getAdminArticleById,
  createArticle,
  updateArticle,
  publishArticle,
  deleteArticle,
} = require('../controllers/article.controller');

const router = express.Router();

router.get('/', listAdminArticles);
router.post('/', createArticle);
router.get('/:id', getAdminArticleById);
router.patch('/:id/publish', publishArticle);
router.patch('/:id', updateArticle);
router.delete('/:id', deleteArticle);

module.exports = router;