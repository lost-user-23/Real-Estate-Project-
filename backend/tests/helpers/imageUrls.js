// Shared cases for the Cloudinary-only imageUrl rule. Suites using these must
// set CLOUDINARY_CLOUD_NAME to OWN_CLOUD before requiring the app.
const OWN_CLOUD = 'demo';

const ownUrl = `https://res.cloudinary.com/${OWN_CLOUD}/image/upload/v1/property-images/a.jpg`;

const invalidImageUrls = [
  ['another cloud name', 'https://res.cloudinary.com/other/image/upload/v1/a.jpg'],
  ['picsum.photos', 'https://picsum.photos/600/400'],
  ['an explicit port', `https://res.cloudinary.com:8443/${OWN_CLOUD}/image/upload/v1/a.jpg`],
  ['userinfo in the URL', `https://user:pw@res.cloudinary.com/${OWN_CLOUD}/image/upload/v1/a.jpg`],
  ['http instead of https', `http://res.cloudinary.com/${OWN_CLOUD}/image/upload/v1/a.jpg`],
  ['a javascript: URL', 'javascript:alert(1)'],
  ['a string over 2048 characters', `https://res.cloudinary.com/${OWN_CLOUD}/image/upload/${'a'.repeat(2100)}.jpg`],
  ['an empty string', ''],
  ['a number', 123],
];

module.exports = { OWN_CLOUD, ownUrl, invalidImageUrls };
