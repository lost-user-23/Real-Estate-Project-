// controllers/upload.controller.js
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { ALLOWED_IMAGE_FORMATS } = require('../config/uploadConfig');

// Receives the (already validated) image from multer's memory buffer and streams it to
// Cloudinary. The server picks folder and public_id, so a user can't write elsewhere.
const uploadImage = asyncHandler(async (req, res) => {
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      {
        folder: `${config.cloudinaryFolder}/${req.user._id}`,
        public_id: crypto.randomUUID(),
        resource_type: 'image',
        allowed_formats: ALLOWED_IMAGE_FORMATS,
      },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(req.file.buffer);
  });

  res.status(201).json({ url: result.secure_url, publicId: result.public_id });
});

module.exports = { uploadImage };
