const mongoose = require('mongoose');
const normalizedLocationPlugin = require('./plugins/normalizedLocation');

const { Schema } = mongoose;

const locationSchema = new Schema({
  city: {
    type: String,
    required: true,
    trim: true,
  },
  // normalizeCity(city) / normalizeCity(locality): what suggestions match on.
  cityLower: {
    type: String,
    index: true,
  },
  locality: {
    type: String,
    default: null,
    trim: true,
  },
  localityLower: {
    type: String,
    default: null,
    index: true,
  },
  activeListingCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  popular: {
    type: Boolean,
    default: false,
  },
  popularRank: {
    type: Number,
    default: null,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  imageAlt: {
    type: String,
    default: null,
  },
});

locationSchema.index({ popular: 1 });
locationSchema.index({ popularRank: 1 });
locationSchema.plugin(normalizedLocationPlugin, { locality: true });

module.exports = mongoose.model('Location', locationSchema);
