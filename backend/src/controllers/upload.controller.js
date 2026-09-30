// controllers/upload.controller.js
const cloudinary = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');

const generateUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = req.body?.folder || `properties/${req.user._id}`;
  const resourceType = req.body?.resourceType || 'image';

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
    resourceType,
  });
});

module.exports = { generateUploadSignature };