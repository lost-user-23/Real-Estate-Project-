const mongoose = require('mongoose');
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

projectSchema.index({ status: 1 });
projectSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
