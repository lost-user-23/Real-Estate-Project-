const mongoose = require('mongoose');
const { CONTENT_STATUSES } = require('./contentStatus');

const { Schema } = mongoose;

const ARTICLE_TYPES = ['blog', 'news'];

const articleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ARTICLE_TYPES,
      default: 'blog',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    excerpt: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imageAlt: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: CONTENT_STATUSES,
      default: 'draft',
      required: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

articleSchema.index({ type: 1, status: 1, publishedAt: -1 });
articleSchema.index({ status: 1 });
articleSchema.index({ publishedAt: -1 });

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;
module.exports.ARTICLE_TYPES = ARTICLE_TYPES;
