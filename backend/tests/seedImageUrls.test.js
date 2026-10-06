process.env.CLOUDINARY_CLOUD_NAME = 'demo';

const { loadMockData } = require('../scripts/seedData/loadMockData');
const {
  transformProperty,
  transformLocation,
  transformProject,
  transformArticle,
} = require('../scripts/seedData/transform');
const { toOwnImageUrl, rewriteImageUrls, collectImageUrls } = require('../scripts/seedData/imageUrls');
const { isOwnCloudinaryImageUrl } = require('../src/services/cloudinaryAssets.service');

describe('seed image URLs', () => {
  it('maps picsum seeds to own-cloud URLs and leaves other URLs alone', () => {
    const url = toOwnImageUrl('https://picsum.photos/seed/proj-2/800/600', 'demo');
    expect(url.startsWith('https://res.cloudinary.com/demo/image/upload/project-images/legacy/legacy-')).toBe(true);
    expect(toOwnImageUrl('https://picsum.photos/seed/loc/800/600', 'demo')).toContain('/project-images/legacy/');
    expect(toOwnImageUrl('https://example.com/a.jpg', 'demo')).toBe('https://example.com/a.jpg');
  });

  it('gives each project its own asset', () => {
    const urls = Array.from({ length: 5 }, (_, i) => toOwnImageUrl(`https://picsum.photos/seed/proj-${i + 1}/800/600`, 'demo'));
    expect(new Set(urls).size).toBe(5);
  });

  it('points every property image at one shared placeholder outside property-images/', () => {
    const urls = Array.from({ length: 12 }, (_, i) => toOwnImageUrl(`https://picsum.photos/seed/p${i + 1}/800/600`, 'demo'));
    expect(new Set(urls).size).toBe(1);
    expect(urls[0]).not.toContain('/property-images/');
    expect(urls[0]).toBe(toOwnImageUrl('https://picsum.photos/seed/loc/800/600', 'demo'));
  });

  it('turns the whole frontend mock dataset into URLs that pass isOwnCloudinaryImageUrl', () => {
    const mock = loadMockData();
    const transformed = rewriteImageUrls(
      {
        properties: mock.MOCK_PROPERTIES.map(transformProperty),
        locations: mock.MOCK_LOCATIONS.map(transformLocation),
        projects: mock.MOCK_PROJECTS.map(transformProject),
        articles: mock.MOCK_ARTICLES.map(transformArticle),
      },
      'demo'
    );

    const urls = collectImageUrls(transformed);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes('picsum'))).toEqual([]);
    const propertyUrls = transformed.properties.map(({ image }) => image.url);
    expect(propertyUrls.filter((url) => url.includes('/property-images/'))).toEqual([]);
    expect(urls.filter((url) => !isOwnCloudinaryImageUrl(url))).toEqual([]);
  });
});
