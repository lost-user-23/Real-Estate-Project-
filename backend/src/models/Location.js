const mongoose = require('mongoose');

const { Schema } = mongoose;

const locationSchema = new Schema({
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

locationSchema.index({ city: 1 });
locationSchema.index({ popular: 1 });
locationSchema.index({ popularRank: 1 });
// Minimal default for the city/locality autocomplete described in the
locationSchema.index({ city: 'text', locality: 'text' });

module.exports = mongoose.model('Location', locationSchema);
