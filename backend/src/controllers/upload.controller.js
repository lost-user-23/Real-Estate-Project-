// controllers/upload.controller.js
const cloudinary = require('../config/cloudinary');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');

// The folder is part of the signed payload, so the server picks it: each user
// uploads under their own subfolder of CLOUDINARY_FOLDER. Any folder or
// resourceType in the request body is ignored.
const generateUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${config.cloudinaryFolder}/${req.user._id}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  res.status(200).json({
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    resourceType: 'image',
  });
});

module.exports = { generateUploadSignature };
