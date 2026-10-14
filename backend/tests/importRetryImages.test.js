process.env.MONGODB_DB_NAME = 'homenest_test_import_retry';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';

jest.mock('../src/utils/safeImageFetch', () => ({ fetchImage: jest.fn() }));

const mongoose = require('mongoose');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { Property, PropertyImage } = require('../src/models');
const cloudinaryV2 = require('../src/config/cloudinary').v2;
const { fetchImage } = require('../src/utils/safeImageFetch');
const { main } = require('../scripts/import-retry-images');

const PHOTOS = [1, 2, 3, 4, 5].map((n) => `https://cdn.example.com/photo-${n}.jpg`);

function draft(n, overrides = {}) {
  return {
    slug: `retry-${n}-${new mongoose.Types.ObjectId()}`,
    title: `Retry listing ${n}`,
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 30000,
    city: 'Pune',
    source: '99acres',
    sourceUrl: `https://www.99acres.com/retry-${n}`,
    status: 'draft',
    imageImportStatus: 'pending',
    importImageUrls: PHOTOS,
    ...overrides,
  };
}

describe('npm run import:retry-images', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchImage.mockReset();
    fetchImage.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
    jest.spyOn(cloudinaryV2.uploader, 'upload_stream').mockImplementation((opts, cb) => ({
      end: () => cb(null, { secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${opts.folder}/${opts.public_id}.jpg`, public_id: `${opts.folder}/${opts.public_id}` }),
    }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('finishes pending and partial drafts, leaves others alone, and is idempotent', async () => {
    // The script disconnects when it is done, so connect for setup and reconnect for checks.
    await connectToDatabase();
    await Property.init();
    const pending = await Property.create(draft(1));
    const partial = await Property.create(draft(2, { imageImportStatus: 'partial' }));
    await PropertyImage.create({ propertyId: partial._id, url: 'https://res.cloudinary.com/demo/image/upload/v1/property-images/imports/x.jpg', sourceUrl: PHOTOS[0], displayOrder: 0 });
    const published = await Property.create(draft(3, { status: 'published' }));
    const done = await Property.create(draft(4, { imageImportStatus: 'done', importImageUrls: undefined }));
    const failed = await Property.create(draft(5, { imageImportStatus: 'failed' }));
    await disconnectFromDatabase();

    await main();
    expect(fetchImage).toHaveBeenCalledTimes(5 + 4); // partial already had photo 1

    await connectToDatabase();
    const status = async (p) => (await Property.findById(p._id).select('+imageImportStatus').lean()).imageImportStatus;
    expect(await status(pending)).toBe('done');
    expect(await status(partial)).toBe('done');
    expect(await status(published)).toBe('pending');
    expect(await status(done)).toBe('done');
    expect(await status(failed)).toBe('failed');
    expect(await PropertyImage.countDocuments({ propertyId: pending._id })).toBe(5);
    expect(await PropertyImage.countDocuments({ propertyId: partial._id })).toBe(5);
    expect(await PropertyImage.countDocuments({ propertyId: published._id })).toBe(0);
    await disconnectFromDatabase();

    fetchImage.mockClear();
    await main(); // second run: nothing left to do
    expect(fetchImage).not.toHaveBeenCalled();

    await connectToDatabase();
    expect(await PropertyImage.countDocuments()).toBe(10);
    await mongoose.connection.dropDatabase();
    await disconnectFromDatabase();
  });
});
