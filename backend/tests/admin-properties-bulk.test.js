process.env.MONGODB_DB_NAME = 'homenest_test_admin_properties_bulk';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const app = createApp();

async function registerUser(overrides = {}) {
  const email = overrides.email || `user-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Test User', email, password: 'password123', ...overrides });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function makeAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createProperty(overrides = {}) {
  const property = await Property.create({
    description: 'A complete listing description.',
    ownerId: overrides.ownerId || null,
    slug: overrides.slug || `property-${new mongoose.Types.ObjectId()}`,
    title: 'Test Property',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Bengaluru',
    locality: 'Koramangala',
    status: 'draft',
    verified: false,
    featured: false,
    featuredRank: null,
    ...overrides,
  });
  // Publishing and verifying need a description and at least 5 photos.
  await PropertyImage.insertMany(
    Array.from({ length: 5 }, (_, i) => ({ propertyId: property._id, url: `https://example.com/${i}.jpg`, displayOrder: i }))
  );
  return property;
}

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

describe('PATCH /api/v1/admin/properties/bulk', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .send({ ids: [new mongoose.Types.ObjectId().toString()], updates: { verified: true } });

    expect(response.status).toBe(401);
  });

  it('forbids a non-admin user', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [new mongoose.Types.ObjectId().toString()], updates: { verified: true } });

    expect(response.status).toBe(403);
  });

  it('applies the update to every matching property and reports counts', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const propertyA = await createProperty({ slug: 'bulk-a' });
    const propertyB = await createProperty({ slug: 'bulk-b' });
    const untouched = await createProperty({ slug: 'bulk-untouched' });

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ids: [propertyA._id.toString(), propertyB._id.toString()],
        updates: { verified: true, featured: true, status: 'published' },
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ matchedCount: 2, modifiedCount: 2 });

    const [updatedA, updatedB, updatedUntouched] = await Promise.all([
      Property.findById(propertyA._id),
      Property.findById(propertyB._id),
      Property.findById(untouched._id),
    ]);

    expect(updatedA.verified).toBe(true);
    expect(updatedA.featured).toBe(true);
    expect(updatedA.status).toBe('published');
    expect(updatedA.publishedAt).toBeInstanceOf(Date);
    expect(updatedB.verified).toBe(true);
    expect(updatedUntouched.verified).toBe(false);
  });

  it('does not overwrite an already-set publishedAt when bulk-publishing', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const originalDate = new Date('2020-01-01T00:00:00.000Z');
    const property = await createProperty({ status: 'published', publishedAt: originalDate });

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: { status: 'published' } });

    expect(response.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.publishedAt.toISOString()).toBe(originalDate.toISOString());
  });

  it('rejects an empty ids array', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [], updates: { verified: true } });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('rejects invalid ids', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: ['not-an-id'], updates: { verified: true } });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('rejects fields outside the allowed bulk update set', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty();

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: { title: 'Hijacked' } });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('rejects an empty updates object', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty();

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: {} });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('accepts featuredRank: null to unrank a listing', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty({ featured: true, featuredRank: 3 });

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: { featuredRank: null } });

    expect(response.status).toBe(200);
    const updated = await Property.findById(property._id);
    expect(updated.featuredRank).toBeNull();
  });

  it.each([
    ['status: null', { status: null }],
    ['city: null', { city: null }],
    ["city: ''", { city: '' }],
    ["city: '   '", { city: '   ' }],
    ['verified: null', { verified: null }],
    ['featured: null', { featured: null }],
    ['intent: null', { intent: null }],
    ['propertyType: null', { propertyType: null }],
  ])('rejects %s and leaves the database untouched', async (_label, updates) => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty({ status: 'published', city: 'Pune' });

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');

    const unchanged = await Property.findById(property._id);
    expect(unchanged.status).toBe('published');
    expect(unchanged.city).toBe('Pune');
    expect(unchanged.intent).toBe('buy');
    expect(unchanged.propertyType).toBe('apartment');
    expect(unchanged.verified).toBe(false);
    expect(unchanged.featured).toBe(false);
  });

  it('rejects a negative or non-numeric featuredRank', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty({ featured: true, featuredRank: 3 });

    for (const featuredRank of [-1, 'high']) {
      const response = await request(app)
        .patch('/api/v1/admin/properties/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [property._id.toString()], updates: { featuredRank } });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
    }
    expect((await Property.findById(property._id)).featuredRank).toBe(3);
  });

  it('applies a valid status + city update and keeps cityLower in step', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty({ status: 'draft', city: 'Pune' });

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: { status: 'archived', city: 'Mumbai' } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ matchedCount: 1, modifiedCount: 1 });
    const updated = await Property.findById(property._id);
    expect(updated.status).toBe('archived');
    expect(updated.city).toBe('Mumbai');
    expect(updated.cityLower).toBe('mumbai');
  });

  it('rejects invalid enum and type values', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);
    const property = await createProperty();

    const response = await request(app)
      .patch('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [property._id.toString()], updates: { status: 'unknown', verified: 'yes' } });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });
});

describe('DELETE /api/v1/admin/properties/bulk', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .send({ ids: [new mongoose.Types.ObjectId().toString()] });

    expect(response.status).toBe(401);
  });

  it('forbids a non-admin user', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [new mongoose.Types.ObjectId().toString()] });

    expect(response.status).toBe(403);
  });

  it('deletes every matching property and its images', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const propertyA = await createProperty({ slug: 'delete-a' });
    const propertyB = await createProperty({ slug: 'delete-b' });
    const untouched = await createProperty({ slug: 'delete-untouched' });
    await PropertyImage.create({ propertyId: propertyA._id, url: 'https://res.cloudinary.com/demo/a.jpg' });

    const response = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [propertyA._id.toString(), propertyB._id.toString()] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ deletedCount: 2 });

    expect(await Property.findById(propertyA._id)).toBeNull();
    expect(await Property.findById(propertyB._id)).toBeNull();
    expect(await Property.findById(untouched._id)).not.toBeNull();
    expect(await PropertyImage.find({ propertyId: propertyA._id })).toHaveLength(0);
  });

  it('rejects an empty ids array', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const response = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('rejects invalid ids', async () => {
    const { token, user } = await registerUser();
    await makeAdmin(user.id);

    const response = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: ['not-an-id'] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });
});
