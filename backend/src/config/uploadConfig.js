// Limits for image uploads, enforced by the multer middleware and the rate limiters.
module.exports = {
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],

  UPLOAD_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000,
    max: 10,
  },
  UPLOAD_DAILY_LIMIT: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 50,
  },
};
