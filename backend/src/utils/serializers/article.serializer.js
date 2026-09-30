function serializeArticle(article) {
  return typeof article.toObject === 'function' ? article.toObject() : { ...article };
}

function serializeArticles(articles) {
  return articles.map(serializeArticle);
}

module.exports = { serializeArticle, serializeArticles };