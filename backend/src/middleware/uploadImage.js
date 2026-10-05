const path = require('path');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_FORMATS } = require('../config/uploadConfig');

const ALLOWED_MIME = new Set(ALLOWED_IMAGE_FORMATS.map((f) => `image/${f === 'jpg' ? 'jpeg' : f}`));
const ALLOWED_EXT = new Set(ALLOWED_IMAGE_FORMATS.map((f) => `.${f}`));
const TYPE_MESSAGE = `Only ${ALLOWED_IMAGE_FORMATS.join(', ')} images are allowed.`;

const upload = multer({
  storage: multer.memoryStorage(), // nothing touches disk, so there are no temp files to clean up
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(AppError.badRequest(TYPE_MESSAGE));
    }
    cb(null, true);
  },
});

// Single "image" field. Multer errors become 400s with a friendly message, and
// the controller only runs (and Cloudinary is only called) when validation passed.
function uploadImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) {
      return req.file ? next() : next(AppError.badRequest('No image file provided (field name: "image").'));
    }
    if (err instanceof multer.MulterError) {
      const mb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      const messages = {
        LIMIT_FILE_SIZE: `Image is too large. Maximum size is ${mb} MB.`,
        LIMIT_FILE_COUNT: 'Upload one image at a time.',
        LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Use the "image" field.',
      };
      return next(AppError.badRequest(messages[err.code] || 'Invalid upload.'));
    }
    next(err);
  });
}

module.exports = { uploadImage };
