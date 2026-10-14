process.env.MONGODB_DB_NAME = 'homenest_test_admin_import';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';

// No test may reach the network or the real Cloudinary account.
jest.mock('../src/utils/safeImageFetch', () => ({ fetchImage: jest.fn() }));

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { Property, PropertyImage, User } = require('../src/models');
const cloudinaryV2 = require('../src/config/cloudinary').v2;
const { fetchImage } = require('../src/utils/safeImageFetch');
const importService = require('../src/services/import.service');
const { whenImageQueueIdle } = require('../src/services/importImages.service');
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const URL = '/api/v1/admin/import/properties';
const KEY = 'test-import-key';
const PHOTO = (n, host = 'cdn.example.com') => `https://${host}/photo-${n}.jpg`;
const PHOTOS = [1, 2, 3, 4, 5].map((n) => PHOTO(n));

function item(n = 1, overrides = {}) {
  return {
    source: '99acres',
    sourceUrl: `https://www.99acres.com/listing-${n}`,
    title: `2 BHK Apartment for Rent number ${n}`,
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 1100,
    priceInRupees: 42000,
    city: 'Pune',
    contactNumber: '9876543210',
    imageUrls: PHOTOS,
    ...overrides,
  };
}

describe('POST /api/v1/admin/import/properties', () => {
  const app = createApp();
  let previousKey;
  let errorSpy;
  let uploadCount;

  const post = (properties) => request(app).post(URL).set('x-api-key', KEY).send({ properties });
  const listing = (n = 1) => Property.findOne({ sourceUrl: `https://www.99acres.com/listing-${n}` })
    .select('+contactNumber +imageImportStatus +importImageUrls').lean();

  beforeAll(async () => {
    previousKey = process.env.IMPORT_API_KEY;
    process.env.IMPORT_API_KEY = KEY;
    await connectToDatabase();
    await Property.init();
  });

  beforeEach(() => {
    uploadCount = 0;
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchImage.mockReset();
    fetchImage.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
    jest.spyOn(cloudinaryV2.uploader, 'upload_stream').mockImplementation((opts, cb) => {
      uploadCount += 1;
      const id = `${opts.folder}/${opts.public_id}`;
      return { end: () => cb(null, { secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${id}.jpg`, public_id: id }) };
    });
  });

  afterEach(async () => {
    await whenImageQueueIdle();
    jest.restoreAllMocks();
    await Promise.all([Property.deleteMany({}), PropertyImage.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    if (previousKey === undefined) delete process.env.IMPORT_API_KEY;
    else process.env.IMPORT_API_KEY = previousKey;
    await mongoose.connection.dropDatabase();
    await disconnectFromDatabase();
  });

  describe('whole-request errors', () => {
    it('401 when the x-api-key header is missing, wrong, or not configured', async () => {
      expect((await request(app).post(URL).send({ properties: [item()] })).status).toBe(401);
      expect((await request(app).post(URL).set('x-api-key', 'nope').send({ properties: [item()] })).status).toBe(401);
      delete process.env.IMPORT_API_KEY;
      const res = await request(app).post(URL).set('x-api-key', KEY).send({ properties: [item()] });
      process.env.IMPORT_API_KEY = KEY;
      expect(res.status).toBe(401);
    });

    it('400 for a missing, empty or non-array properties, and for over 100 items', async () => {
      for (const body of [{}, { properties: [] }, { properties: 'x' }, { properties: {} }]) {
        const res = await request(app).post(URL).set('x-api-key', KEY).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual(['properties must be a non-empty array']);
      }
      const tooMany = await post(Array(101).fill({}));
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.error.details).toEqual(['properties must contain at most 100 items']);
    });

    it('accepts exactly 100 items', async () => {
      const res = await post(Array(100).fill({}));
      expect(res.status).toBe(200);
      expect(res.body.failed).toBe(100);
    });

    it('400 for bad JSON', async () => {
      const res = await request(app).post(URL).set('x-api-key', KEY).set('Content-Type', 'application/json').send('{"properties": [');
      expect(res.status).toBe(400);
    });

    it('413 above 5 MB, and accepts a body above the global 100kb limit', async () => {
      const big = await post([{ description: 'x'.repeat(300 * 1024) }]);
      expect(big.status).toBe(200);
      const tooBig = await post([{ description: 'x'.repeat(6 * 1024 * 1024) }]);
      expect(tooBig.status).toBe(413);
    });

    it('keeps the 100kb limit on other routes', async () => {
      const res = await request(app).post('/api/v1/reports').send({ details: 'x'.repeat(300 * 1024) });
      expect(res.status).toBe(413);
    });
  });

  describe('results', () => {
    it('reports created, updated, skipped and failed with every field', async () => {
      await post([item(2), item(3)]);
      await Property.updateOne({ sourceUrl: 'https://www.99acres.com/listing-3' }, { $set: { status: 'published' } });

      const res = await post([item(1), item(2, { priceInRupees: 50000 }), item(3), item(4, { intent: 'lease', agentName: 'Ravi' })]);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ created: 1, updated: 1, skipped: 1, failed: 1 });
      expect(res.body.created + res.body.updated + res.body.skipped + res.body.failed).toBe(4);
      expect(res.body.results).toEqual([
        { index: 0, sourceUrl: 'https://www.99acres.com/listing-1', status: 'created', errors: [], warnings: [] },
        { index: 1, sourceUrl: 'https://www.99acres.com/listing-2', status: 'updated', errors: [], warnings: [] },
        {
          index: 2, sourceUrl: 'https://www.99acres.com/listing-3', status: 'skipped', errors: [], warnings: [],
          reason: 'Listing is no longer a draft (status: published), so it was not updated.',
        },
        {
          index: 3, sourceUrl: 'https://www.99acres.com/listing-4', status: 'failed',
          errors: ['intent must be one of: buy, rent'], warnings: ['agentName'],
        },
      ]);
      expect((await listing(2)).priceInRupees).toBe(50000);
    });

    it('returns all errors of a failed item at once, and null sourceUrl when unusable', async () => {
      const res = await post([{ title: 'abc', intent: 'x' }, item(1, { sourceUrl: 'ftp://nope' })]);
      const [first, second] = res.body.results;
      expect(first.status).toBe('failed');
      expect(first.sourceUrl).toBeNull();
      expect(first.errors.length).toBeGreaterThanOrEqual(8);
      expect(first.errors).toEqual(expect.arrayContaining([
        'title must be at least 5 characters', 'source is required', 'contactNumber is required', 'imageUrls is required',
      ]));
      expect(second.sourceUrl).toBeNull();
      expect(second.errors).toEqual(['sourceUrl must be a valid http or https URL']);
    });

    it('imports an item with unknown and server-controlled fields, listing them as warnings', async () => {
      const res = await post([item(1, { status: 'published', slug: 'my-slug', agentName: 'Ravi', verified: true, featured: true })]);
      expect(res.body.results[0]).toMatchObject({ status: 'created', errors: [], warnings: ['status', 'slug', 'agentName', 'verified', 'featured'] });
      const saved = await listing(1);
      expect(saved).toMatchObject({ status: 'draft', verified: false, featured: false, ownerId: null });
      expect(saved.slug).not.toBe('my-slug');
    });

    it('lets one item fail unexpectedly without affecting the others', async () => {
      const real = importService.upsertImportedProperty;
      const spy = jest.spyOn(importService, 'upsertImportedProperty');
      spy.mockImplementationOnce(() => Promise.reject(new Error('boom: secret db detail')));
      spy.mockImplementation(real);

      const res = await post([item(1), item(2)]);
      expect(res.status).toBe(200);
      expect(res.body.results[0]).toMatchObject({ status: 'failed', errors: ['Internal error while importing this item'] });
      expect(JSON.stringify(res.body)).not.toContain('boom');
      expect(res.body.results[1].status).toBe('created');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('required fields', () => {
    it.each([
      ['missing', undefined],
      ['null', null],
      ['an empty string', ''],
      ['a string', '1100'],
      ['NaN', NaN],
      ['zero', 0],
      ['negative', -5],
    ])('fails areaSqft when it is %s', async (_label, bad) => {
      const res = await post([item(1, { areaSqft: bad })]);
      expect(res.body.results[0].status).toBe('failed');
      expect(res.body.results[0].errors.join(' ')).toMatch(/areaSqft must be/);
      expect(await Property.countDocuments()).toBe(0);
    });

    it('fails a missing contactNumber and a missing imageUrls with clear messages', async () => {
      const res = await post([item(1, { contactNumber: undefined }), item(2, { imageUrls: undefined })]);
      expect(res.body.results[0].errors).toEqual(['contactNumber is required']);
      expect(res.body.results[1].errors).toEqual(['imageUrls is required']);
    });

    it('fails fewer than 5 unique image URLs (duplicates do not count) and more than 20', async () => {
      const dup = await post([item(1, { imageUrls: [...PHOTOS.slice(0, 4), PHOTOS[0], PHOTOS[1]] })]);
      expect(dup.body.results[0].errors).toEqual(['imageUrls must contain at least 5 unique URLs (got 4)']);
      const many = await post([item(2, { imageUrls: Array.from({ length: 21 }, (_, n) => PHOTO(n)) })]);
      expect(many.body.results[0].errors).toEqual(['imageUrls must contain at most 20 unique URLs (got 21)']);
      const twenty = await post([item(3, { imageUrls: Array.from({ length: 20 }, (_, n) => PHOTO(n)) })]);
      expect(twenty.body.results[0].status).toBe('created');
    });

    it('fails bad image URLs', async () => {
      const res = await post([item(1, { imageUrls: [...PHOTOS.slice(0, 4), 'ftp://x.com/a.jpg', 7] })]);
      expect(res.body.results[0].errors[0]).toMatch(/^imageUrls\[4\], imageUrls\[5\] must be a valid http or https URL/);
    });

    it.each([
      ['+91 98765-43210'], ['09876543210'], ['98765 43210'], ['+919876543210'], ['98765-43210'],
    ])('saves the phone %s as 10 digits', async (phone) => {
      const res = await post([item(1, { contactNumber: phone })]);
      expect(res.body.results[0].status).toBe('created');
      expect((await listing(1)).contactNumber).toBe('9876543210');
    });

    it('fails an invalid phone', async () => {
      const res = await post([item(1, { contactNumber: '12345' })]);
      expect(res.body.results[0].errors).toEqual(['contactNumber must be a valid 10-digit Indian mobile number']);
    });
  });

  describe('duplicate sourceUrl in one request', () => {
    it('fails the later item and imports the first', async () => {
      const res = await post([item(1), item(1, { title: 'A different title for the same URL' })]);
      expect(res.body.results[0].status).toBe('created');
      expect(res.body.results[1]).toMatchObject({ status: 'failed', errors: ['Duplicate sourceUrl in this request (same as index 0)'] });
      expect(await Property.countDocuments()).toBe(1);
    });

    it('treats cosmetic differences (utm param, trailing slash, host case) as the same URL', async () => {
      const res = await post([
        item(1),
        item(1, { sourceUrl: 'https://WWW.99acres.com/listing-1/?utm_source=x' }),
        item(1, { sourceUrl: 'https://www.99acres.com/listing-1/#top' }),
      ]);
      expect(res.body.results.map((r) => r.status)).toEqual(['created', 'failed', 'failed']);
      expect(res.body.results[1].errors).toEqual(['Duplicate sourceUrl in this request (same as index 0)']);
      expect(res.body.results[1].sourceUrl).toBe('https://www.99acres.com/listing-1');
      expect(await Property.countDocuments()).toBe(1);
    });
  });

  describe('re-import', () => {
    it('resets omitted optional fields on a draft and never changes status, verified or featured', async () => {
      await post([item(1, { locality: 'Baner', bhk: 2, furnished: 'furnished', amenities: ['Gym'] })]);
      await Property.updateOne({}, { $set: { verified: true, featured: true, featuredRank: 2 } });

      const res = await post([item(1)]);
      expect(res.body.results[0].status).toBe('updated');
      const saved = await Property.findOne().lean();
      expect(saved).toMatchObject({
        locality: null, bhk: null, furnished: null, amenities: [], status: 'draft', verified: true, featured: true, featuredRank: 2,
      });
    });

    it.each(['published', 'archived'])('skips a %s listing and changes nothing', async (status) => {
      await post([item(1)]);
      await whenImageQueueIdle();
      await Property.updateOne({}, { $set: { status } });
      const before = await Property.findOne().select('+contactNumber +importImageUrls +imageImportStatus').lean();

      const res = await post([item(1, { title: 'Totally different title', priceInRupees: 1 })]);
      expect(res.body.results[0]).toMatchObject({ status: 'skipped', reason: `Listing is no longer a draft (status: ${status}), so it was not updated.` });
      expect(await Property.findOne().select('+contactNumber +importImageUrls +imageImportStatus').lean()).toEqual(before);
    });
  });

  describe('photos', () => {
    const imagesOf = (n = 1) => listing(n).then((p) => PropertyImage.find({ propertyId: p._id }).sort({ displayOrder: 1 }).lean());

    it('answers first, then attaches five photos on our Cloudinary and marks the listing done', async () => {
      const res = await post([item(1)]);
      expect(res.body.results[0].status).toBe('created');
      expect((await listing(1)).imageImportStatus).toBe('pending');

      await whenImageQueueIdle();
      const images = await imagesOf();
      expect(images).toHaveLength(5);
      expect(images.map((i) => i.sourceUrl)).toEqual(PHOTOS);
      expect(images.map((i) => i.displayOrder)).toEqual([0, 1, 2, 3, 4]);
      for (const image of images) {
        expect(image.url).toMatch(/^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v1\/property-images\/imports\//);
        expect(image.publicId).toMatch(/^property-images\/imports\//);
      }
      const saved = await listing(1);
      expect(saved.imageImportStatus).toBe('done');
      expect(saved.importImageUrls).toBeUndefined();
      expect(saved).not.toHaveProperty('imageUrls');
    });

    it('marks the listing partial when one image fails, and still attaches the rest', async () => {
      fetchImage.mockImplementation(async (url) => {
        if (url === PHOTOS[2]) throw new Error('Not an image (content type "text/html")');
        return { buffer: Buffer.from('img'), contentType: 'image/jpeg' };
      });
      await post([item(1)]);
      await whenImageQueueIdle();

      expect((await imagesOf()).map((i) => i.sourceUrl)).toEqual([PHOTOS[0], PHOTOS[1], PHOTOS[3], PHOTOS[4]]);
      const saved = await listing(1);
      expect(saved.imageImportStatus).toBe('partial');
      expect(saved.importImageUrls).toEqual(PHOTOS);
    });

    it('marks the listing failed when no image can be fetched, without breaking other listings', async () => {
      fetchImage.mockImplementation(async (url) => {
        if (url.includes('bad.example.com')) throw new Error('blocked');
        return { buffer: Buffer.from('img'), contentType: 'image/jpeg' };
      });
      await post([item(1, { imageUrls: [1, 2, 3, 4, 5].map((n) => PHOTO(n, 'bad.example.com')) }), item(2)]);
      await whenImageQueueIdle();
      expect((await listing(1)).imageImportStatus).toBe('failed');
      expect((await listing(2)).imageImportStatus).toBe('done');
    });

    it('re-import adds only new photos and keeps existing and admin-uploaded ones in place', async () => {
      await post([item(1)]);
      await whenImageQueueIdle();
      const property = await listing(1);
      const adminImage = await PropertyImage.create({
        propertyId: property._id, url: 'https://res.cloudinary.com/demo/image/upload/v1/property-images/admin/a.jpg', displayOrder: 9,
      });
      fetchImage.mockClear();
      uploadCount = 0;

      const next = [...PHOTOS.slice(0, 4), PHOTO(6), PHOTO(7)];
      const res = await post([item(1, { imageUrls: next })]);
      expect(res.body.results[0].status).toBe('updated');
      expect((await listing(1)).imageImportStatus).toBe('pending');
      await whenImageQueueIdle();

      expect(fetchImage.mock.calls.map((c) => c[0])).toEqual([PHOTO(6), PHOTO(7)]); // nothing re-downloaded
      expect(uploadCount).toBe(2);
      const images = await imagesOf();
      expect(images).toHaveLength(8);
      expect(images.slice(0, 5).map((i) => i.sourceUrl)).toEqual(PHOTOS); // none deleted, none reordered
      expect(String(images[5]._id)).toBe(String(adminImage._id));
      expect(images.slice(6).map((i) => i.sourceUrl)).toEqual([PHOTO(6), PHOTO(7)]);
      expect(images[6].displayOrder).toBeGreaterThan(9);
      expect((await listing(1)).imageImportStatus).toBe('done');
    });

    it('does not touch the photos of a listing that is no longer a draft', async () => {
      await post([item(1)]);
      await whenImageQueueIdle();
      await Property.updateOne({}, { $set: { status: 'published' } });
      fetchImage.mockClear();
      await post([item(1, { imageUrls: [1, 2, 3, 4, 6].map((n) => PHOTO(n)) })]);
      await whenImageQueueIdle();
      expect(fetchImage).not.toHaveBeenCalled();
      expect(await PropertyImage.countDocuments()).toBe(5);
    });
  });

  describe('private fields stay private', () => {
    it('never returns contactNumber from public routes, nor the import bookkeeping from any route', async () => {
      await post([item(1)]);
      await whenImageQueueIdle();
      fetchImage.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
      // A second listing stays "pending" with its URL list still stored.
      fetchImage.mockRejectedValue(new Error('down'));
      await post([item(2)]);
      await whenImageQueueIdle();
      await Property.updateMany({}, { $set: { status: 'published', publishedAt: new Date() } });

      const email = `admin-${new mongoose.Types.ObjectId()}@example.com`;
      const registered = await registerVerified(app, { email, password: 'password123' });
      await User.findByIdAndUpdate(registered.body.user.id, { role: 'admin' });
      const auth = { Authorization: `Bearer ${tokenFromResponse(registered)}` };

      const slug = (await Property.findOne({ sourceUrl: 'https://www.99acres.com/listing-1' })).slug;
      const id = String((await Property.findOne({ sourceUrl: 'https://www.99acres.com/listing-1' }))._id);
      const responses = [
        await request(app).get('/api/v1/properties'),
        await request(app).get('/api/v1/properties/featured'),
        await request(app).get(`/api/v1/properties/${slug}`),
        await request(app).get('/api/v1/admin/properties').set(auth),
        await request(app).get(`/api/v1/admin/properties/${id}`).set(auth),
      ];
      responses.forEach((res, i) => {
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body);
        if (i < 3) { // public routes; the admin detail view shows the phone by design
          expect(text).not.toContain('contactNumber');
          expect(text).not.toContain('9876543210');
        }
        expect(text).not.toContain('imageImportStatus');
        expect(text).not.toContain('importImageUrls');
      });
      expect(JSON.stringify(responses[2].body)).toContain(slug); // the listing really was returned
    });
  });
});
