const mongoose = require('mongoose');
const normalizedLocationPlugin = require('./plugins/normalizedLocation');
const { CONTENT_STATUSES } = require('./contentStatus');

const { Schema } = mongoose;

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    developer: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    // normalizeCity(city); the field city matching runs on. Never user-supplied.
    cityLower: {
      type: String,
    },
    locality: {
      type: String,
      default: null,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imageAlt: {
      type: String,
      default: null,
    },
    startingPriceInRupees: {
      type: Number,
      required: true,
      min: 0,
    },
    possessionLabel: {
      type: String,
      default: '',
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

projectSchema.index({ status: 1, cityLower: 1, publishedAt: -1 });
projectSchema.index({ publishedAt: -1 });

// Builder detail lookups run with a case-insensitive collation (see
// builder.service.js), so this index must carry the same collation to be used.
// The explicit name avoids a name clash with the old, non-collated index.
projectSchema.index(
  { status: 1, developer: 1, publishedAt: -1, _id: -1 },
  {
    name: 'status_developer_ci_publishedAt_id',
    collation: { locale: 'en', strength: 2 },
  }
);

projectSchema.plugin(normalizedLocationPlugin);

module.exports = mongoose.model('Project', projectSchema);