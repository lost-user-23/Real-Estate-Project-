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
      maxlength: 2048,
    },
    // Cloudinary public_id, kept so the asset can be deleted with the listing.
    // Optional: older rows have none and fall back to the id in the URL.
    publicId: {
      type: String,
      default: null,
      maxlength: 500,
    },
    alt: {
      type: String,
      default: '',
      maxlength: 300,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

propertyImageSchema.pre('validate', function validateStorageReference() {
  if (!this.storageKey && !this.url) {
    throw new Error('PropertyImage requires either storageKey or url.');
  }
});

propertyImageSchema.index({ propertyId: 1, displayOrder: 1 });

module.exports = mongoose.model('PropertyImage', propertyImageSchema);
