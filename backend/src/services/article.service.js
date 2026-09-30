const Article = require('../models/Article');
const AppError = require('../utils/AppError');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EDITABLE_FIELDS = ['title', 'slug', 'excerpt', 'content', 'imageUrl', 'imageAlt', 'status'];

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(title) {
  const base = slugify(title) || 'article';
  let slug = base;
  let suffix = 2;

  while (await Article.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function createArticle(input) {
  const slug = input.slug || await generateUniqueSlug(input.title);
  if (input.slug && await Article.exists({ slug })) {
    throw AppError.conflict('slug already in use');
  }

  const status = input.status || 'draft';
  return Article.create({
    title: input.title,
    slug,
    excerpt: input.excerpt ?? '',
    content: input.content ?? '',
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    status,
    publishedAt: status === 'published' ? new Date() : null,
  });
}

async function listArticles({ page, limit, publishedOnly }) {
  const filter = publishedOnly ? { status: 'published' } : {};
  const skip = (page - 1) * limit;
  const sort = publishedOnly ? { publishedAt: -1 } : { createdAt: -1 };
  const [articles, total] = await Promise.all([
    Article.find(filter).sort(sort).skip(skip).limit(limit),
    Article.countDocuments(filter),
  ]);

  return { articles, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function findPublishedBySlug(slug) {
  return Article.findOne({ slug, status: 'published' });
}

async function findById(id) {
  return Article.findById(id);
}

async function updateArticleById(id, body) {
  const article = await Article.findById(id);
  if (!article) return null;

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      article[field] = body[field];
    }
  }

  if (article.isModified('slug') && await Article.exists({ slug: article.slug, _id: { $ne: article._id } })) {
    throw AppError.conflict('slug already in use');
  }

  if (article.isModified('status') && article.status === 'published' && !article.publishedAt) {
    article.publishedAt = new Date();
  }

  return article.save();
}

async function publishArticleById(id) {
  const article = await Article.findById(id);
  if (!article) return null;

  article.status = 'published';
  if (!article.publishedAt) article.publishedAt = new Date();
  return article.save();
}

async function deleteArticleById(id) {
  return Article.findByIdAndDelete(id);
}

module.exports = {
  SLUG_PATTERN,
  EDITABLE_FIELDS,
  createArticle,
  listArticles,
  findPublishedBySlug,
  findById,
  updateArticleById,
  publishArticleById,
  deleteArticleById,
};