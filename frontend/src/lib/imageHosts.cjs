// Hosts next/image may load from. CommonJS so next.config.js can require it,
// and the runtime check in safeImageSrc.mjs imports the same list, so the two
// cannot drift. All hosts are https only.
const IMAGE_HOSTNAMES = ["picsum.photos", "res.cloudinary.com", "images.unsplash.com"];

module.exports = { IMAGE_HOSTNAMES };
