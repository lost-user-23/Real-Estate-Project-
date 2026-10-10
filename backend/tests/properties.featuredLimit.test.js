process.env.MONGODB_DB_NAME = 'homenest_test_featured_limit';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { MAX_FEATURED } = require('../src/config/constants');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const app = createApp();

async function registerAdmin() {
  const email = `admin-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Featured Admin', email, password: 'password123' });
  await User.findByIdAndUpdate(response.body.user.id, { role: 'admin' });
  return tokenFromResponse(response);
}

async function createProperty(overrides = {}) {
  return Property.create({
    ownerId: null,
    slug: `property-${new mongoose.Types.ObjectId()}`,
    title: 'Test Property',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Bengaluru',
    locality: 'Koramangala',
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    featured: false,
    ...overrides,
  });
}

// Creates `count` published, already featured listings straight in the database.
async function seedFeatured(count) {
  const created = [];
  for (let i = 0; i < count; i += 1) created.push(await createProperty({ featured: true }));
  return created;
}

const featuredCount = () => Property.countDocuments({ featured: true });

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('featured limit: PATCH /api/v1/properties/:id', () => {
  const patch = (token, id, body) =>
    request(app).patch(`/api/v1/properties/${id}`).set('Authorization', `Bearer ${token}`).send(body);

  it('accepts MAX_FEATURED featured listings and rejects the next with 409', async () => {
    const token = await registerAdmin();
    const properties = await Promise.all(Array.from({ length: MAX_FEATURED + 1 }, () => createProperty()));

    for (const property of properties.slice(0, MAX_FEATURED)) {
      const response = await patch(token, property._id, { featured: true });
      expect(response.status).toBe(200);
    }

    const rejected = await patch(token, properties[MAX_FEATURED]._id, { featured: true });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.message).toBe(`Featured limit reached (${MAX_FEATURED})`);

    const stored = await Property.findById(properties[MAX_FEATURED]._id);
    expect(stored.featured).toBe(false);
    expect(await featuredCount()).toBe(MAX_FEATURED);
  });

  it('does not save other fields from a rejected request', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED);
    const target = await createProperty({ title: 'Original Title' });

    const rejected = await patch(token, target._id, { featured: true, title: 'Changed Title' });
    expect(rejected.status).toBe(409);
    expect((await Property.findById(target._id)).title).toBe('Original Title');
  });

  it('still lets an already featured listing be edited when the limit is full', async () => {
    const token = await registerAdmin();
    const [first] = await seedFeatured(MAX_FEATURED);

    const edited = await patch(token, first._id, { title: 'Edited While Full' });
    expect(edited.status).toBe(200);
    expect(edited.body.property.title).toBe('Edited While Full');
    expect(edited.body.property.featured).toBe(true);

    const resent = await patch(token, first._id, { featured: true, featuredRank: 3 });
    expect(resent.status).toBe(200);
    expect(await featuredCount()).toBe(MAX_FEATURED);
  });

  it('always allows featured: false and that frees a slot', async () => {
    const token = await registerAdmin();
    const [first] = await seedFeatured(MAX_FEATURED);
    const waiting = await createProperty();

    const unfeatured = await patch(token, first._id, { featured: false });
    expect(unfeatured.status).toBe(200);
    expect(unfeatured.body.property.featured).toBe(false);

    const featured = await patch(token, waiting._id, { featured: true });
    expect(featured.status).toBe(200);
    expect(await featuredCount()).toBe(MAX_FEATURED);
  });

  it('counts only published listings, like GET /featured', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 1);
    await createProperty({ featured: true, status: 'draft' });
    const target = await createProperty();

    const response = await patch(token, target._id, { featured: true });
    expect(response.status).toBe(200);
  });
});

describe('featured limit: PATCH /api/v1/admin/properties/bulk', () => {
  const bulk = (token, ids, updates) =>
    request(app).patch('/api/v1/admin/properties/bulk').set('Authorization', `Bearer ${token}`).send({ ids, updates });

  it('returns 409 and updates nothing when the total would exceed the limit', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 2);
    const batch = await Promise.all([createProperty(), createProperty(), createProperty()]);

    const response = await bulk(token, batch.map((p) => p._id.toString()), { featured: true });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe(`Featured limit reached (${MAX_FEATURED})`);
    expect(await featuredCount()).toBe(MAX_FEATURED - 2);
  });

  it('succeeds when the total lands exactly on the limit', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 2);
    const batch = await Promise.all([createProperty(), createProperty()]);

    const response = await bulk(token, batch.map((p) => p._id.toString()), { featured: true });
    expect(response.status).toBe(200);
    expect(response.body.modifiedCount).toBe(2);
    expect(await featuredCount()).toBe(MAX_FEATURED);
  });

  it('does not double count ids that are already featured or repeated', async () => {
    const token = await registerAdmin();
    const alreadyFeatured = await seedFeatured(MAX_FEATURED - 1);
    const fresh = await createProperty();
    const ids = [
      ...alreadyFeatured.map((p) => p._id.toString()),
      fresh._id.toString(),
      fresh._id.toString(),
      alreadyFeatured[0]._id.toString(),
    ];

    const response = await bulk(token, ids, { featured: true });
    expect(response.status).toBe(200);
    expect(await featuredCount()).toBe(MAX_FEATURED);
  });

  it('always allows featured: false', async () => {
    const token = await registerAdmin();
    const featured = await seedFeatured(MAX_FEATURED);

    const response = await bulk(token, featured.slice(0, 3).map((p) => p._id.toString()), { featured: false });
    expect(response.status).toBe(200);
    expect(await featuredCount()).toBe(MAX_FEATURED - 3);
  });
});

describe('featured limit: publishing a featured draft', () => {
  const patch = (token, id, body) =>
    request(app).patch(`/api/v1/properties/${id}`).set('Authorization', `Bearer ${token}`).send(body);
  const bulk = (token, ids, updates) =>
    request(app).patch('/api/v1/admin/properties/bulk').set('Authorization', `Bearer ${token}`).send({ ids, updates });

  it('returns 409 and keeps the draft when publishing a featured draft with the limit full', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED);
    const draft = await createProperty({ status: 'draft', featured: true, publishedAt: null, title: 'Draft Title' });

    const response = await patch(token, draft._id, { status: 'published', title: 'Changed Title' });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe(`Featured limit reached (${MAX_FEATURED})`);

    const stored = await Property.findById(draft._id);
    expect(stored.status).toBe('draft');
    expect(stored.title).toBe('Draft Title');
  });

  it('returns 409 when featuring and publishing a draft in the same request', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED);
    const draft = await createProperty({ status: 'draft', publishedAt: null });

    const response = await patch(token, draft._id, { status: 'published', featured: true });
    expect(response.status).toBe(409);

    const stored = await Property.findById(draft._id);
    expect(stored.status).toBe('draft');
    expect(stored.featured).toBe(false);
  });

  it('publishes a featured draft when under the limit', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 1);
    const draft = await createProperty({ status: 'draft', featured: true, publishedAt: null });

    const response = await patch(token, draft._id, { status: 'published' });
    expect(response.status).toBe(200);
    expect(response.body.property.status).toBe('published');
  });

  it('publishes a non-featured draft even when the limit is full', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED);
    const draft = await createProperty({ status: 'draft', publishedAt: null });

    const response = await patch(token, draft._id, { status: 'published' });
    expect(response.status).toBe(200);
  });

  it('bulk publish returns 409 and updates nothing when featured drafts would exceed the limit', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 1);
    const drafts = await Promise.all([
      createProperty({ status: 'draft', featured: true, publishedAt: null }),
      createProperty({ status: 'draft', featured: true, publishedAt: null }),
    ]);

    const response = await bulk(token, drafts.map((p) => p._id.toString()), { status: 'published' });
    expect(response.status).toBe(409);
    expect(await Property.countDocuments({ status: 'draft' })).toBe(2);
  });

  it('bulk publish succeeds under the limit and ignores duplicate ids and non-featured drafts', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 2);
    const featuredDrafts = await Promise.all([
      createProperty({ status: 'draft', featured: true, publishedAt: null }),
      createProperty({ status: 'draft', featured: true, publishedAt: null }),
    ]);
    const plain = await createProperty({ status: 'draft', publishedAt: null });
    const ids = [...featuredDrafts, plain].map((p) => p._id.toString());

    const response = await bulk(token, [...ids, ids[0]], { status: 'published' });
    expect(response.status).toBe(200);
    expect(await Property.countDocuments({ status: 'draft' })).toBe(0);
  });

  it('bulk feature and publish together counts the drafts in the batch', async () => {
    const token = await registerAdmin();
    await seedFeatured(MAX_FEATURED - 1);
    const drafts = await Promise.all([
      createProperty({ status: 'draft', publishedAt: null }),
      createProperty({ status: 'draft', publishedAt: null }),
    ]);

    const response = await bulk(token, drafts.map((p) => p._id.toString()), { featured: true, status: 'published' });
    expect(response.status).toBe(409);
    expect(await Property.countDocuments({ status: 'draft' })).toBe(2);
    expect(await featuredCount()).toBe(MAX_FEATURED - 1);
  });
});
