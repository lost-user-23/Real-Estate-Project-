const mongoose = require('mongoose');

const { Schema } = mongoose;

const propertyImageSchema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    // Populated when using object storage (e.g. S3-compatible key).
    storageKey: {
      type: String,
      default: null,
    },
    // Populated when the image is referenced by a direct URL.
    url: {
      type: String,
      default: null,
    },
    alt: {
      type: String,
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

propertyImageSchema.pre('validate', function validateStorageReference(next) {
  if (!this.storageKey && !this.url) {
    next(new Error('PropertyImage requires either storageKey or url.'));
    return;
  }
  next();
});

propertyImageSchema.index({ propertyId: 1, displayOrder: 1 });

module.exports = mongoose.model('PropertyImage', propertyImageSchema);
