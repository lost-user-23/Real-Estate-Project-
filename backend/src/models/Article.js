const mongoose = require('mongoose');
const { CONTENT_STATUSES } = require('./contentStatus');

const { Schema } = mongoose;

const articleSchema = new Schema(
  {
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

articleSchema.index({ status: 1 });
articleSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
