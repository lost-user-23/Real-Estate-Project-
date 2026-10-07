const mongoose = require('mongoose');
const normalizedLocationPlugin = require('./plugins/normalizedLocation');

const { Schema } = mongoose;

const PROPERTY_INTENTS = ['buy', 'rent'];

const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'independent-house',
  'plot',
  'pg-hostel',
  'commercial',
  'studio',
  'penthouse',
];

const FURNISHING_OPTIONS = ['furnished', 'semi-furnished', 'unfurnished'];
const FACING_OPTIONS = [
  'north',
  'south',
  'east',
  'west',
  'north-east',
  'north-west',
  'south-east',
  'south-west',
];

// Matches the statuses the frontend currently uses (docs/backend-architecture.md
// "Current Frontend Contract"). `pending_review` is mentioned for the future
// user-submission flow and is not part of today's implementation boundary.
const PROPERTY_STATUSES = ['draft', 'published', 'archived'];

const propertySchema = new Schema(
  {
    // Null for admin-created seed records; set once user submissions exist.
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    intent: {
      type: String,
      enum: PROPERTY_INTENTS,
      required: true,
    },
    propertyType: {
      type: String,
      enum: PROPERTY_TYPES,
      required: true,
    },
    bhk: {
      type: Number,
      default: null,
      min: 0,
    },
    areaSqft: {
      type: Number,
      required: true,
      min: 0,
    },
    priceInRupees: {
      type: Number,
      required: true,
      min: 0,
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
    bathrooms: { type: Number, default: null, min: 0 },
    furnished: { type: String, enum: [...FURNISHING_OPTIONS, null], default: null },
    balconies: { type: Number, default: null, min: 0 },
    floor: { type: Number, default: null },
    ownership: { type: String, default: null, trim: true },
    facing: { type: String, enum: [...FACING_OPTIONS, null], default: null },
    yearOfConstruction: { type: Number, default: null, min: 1800 },
    isLuxury: { type: Boolean, default: false },
    // Filename of the listing photo from the imported dataset; not a URL.
    imageFile: { type: String, default: null },
    amenities: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    // Private field; must be excluded from anonymous/public projections.
    contactNumber: {
      type: String,
      select: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    featuredRank: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: PROPERTY_STATUSES,
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

propertySchema.index({ featured: 1 });
propertySchema.index({ featuredRank: 1 });
propertySchema.index({ publishedAt: -1 });
// Public list and featured queries always filter on status first, then city.
propertySchema.index({ status: 1, cityLower: 1, publishedAt: -1 });
propertySchema.index({ status: 1, featured: 1, cityLower: 1 });
propertySchema.index({ locality: 1 });
propertySchema.index({ intent: 1 });
propertySchema.index({ propertyType: 1 });

propertySchema.plugin(normalizedLocationPlugin);

module.exports = mongoose.model('Property', propertySchema);
module.exports.PROPERTY_INTENTS = PROPERTY_INTENTS;
module.exports.PROPERTY_TYPES = PROPERTY_TYPES;
module.exports.PROPERTY_STATUSES = PROPERTY_STATUSES;
module.exports.FURNISHING_OPTIONS = FURNISHING_OPTIONS;
module.exports.FACING_OPTIONS = FACING_OPTIONS;
