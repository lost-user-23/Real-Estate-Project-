process.env.CLOUDINARY_CLOUD_NAME = 'demo';

const { MAX_IMAGE_URL_LENGTH, isValidImageUrl } = require('../src/services/cloudinaryAssets.service');
const { ownUrl, invalidImageUrls } = require('./helpers/imageUrls');

describe('isValidImageUrl', () => {
  it('accepts an own-cloud https Cloudinary URL', () => {
    expect(isValidImageUrl(ownUrl)).toBe(true);
  });

  it('accepts a URL at exactly the length cap', () => {
    const prefix = 'https://res.cloudinary.com/demo/image/upload/';
    const url = `${prefix}${'a'.repeat(MAX_IMAGE_URL_LENGTH - prefix.length)}`;
    expect(url).toHaveLength(MAX_IMAGE_URL_LENGTH);
    expect(isValidImageUrl(url)).toBe(true);
  });

  it.each(invalidImageUrls)('rejects %s', (label, value) => {
    expect(isValidImageUrl(value)).toBe(false);
  });

  it.each([null, undefined, {}, [], true])('rejects non-string value %p', (value) => {
    expect(isValidImageUrl(value)).toBe(false);
  });
});
