process.env.MONGODB_DB_NAME = 'homenest_test_properties';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');

const app = createApp();

const validPayload = {
  title: 'Sunny 2BHK Apartment',
  intent: 'rent',
  propertyType: 'apartment',
  areaSqft: 950,
  priceInRupees: 25000,
  city: 'Bengaluru',
  locality: 'Koramangala',
};

async function registerUser(overrides = {}) {
  const email = overrides.email || `property-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Property Tester', email, password: 'password123', ...overrides });
  return { token: response.body.token, user: response.body.user };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createProperty(overrides = {}) {
  return Property.create({
    ownerId: overrides.ownerId || null,
    slug: overrides.slug || `property-${new mongoose.Types.ObjectId()}`,
    title: 'Test Property',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Bengaluru',
    locality: 'Koramangala',
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Property.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('POST /api/v1/properties', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/v1/properties').send(validPayload);
    expect(response.status).toBe(401);
  });

  it('creates a draft property owned by the authenticated user', async () => {
    const { token, user } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body.property.ownerId).toBe(user.id);
    expect(response.body.property.status).toBe('draft');
    expect(response.body.property.slug).toEqual(expect.any(String));
  });

  it.each([
    ['title', { title: '' }],
    ['intent', { intent: 'lease' }],
    ['propertyType', { propertyType: 'castle' }],
    ['areaSqft', { areaSqft: -1 }],
    ['priceInRupees', { priceInRupees: -1 }],
    ['city', { city: '' }],
  ])('rejects invalid %s', async (field, override) => {
    const { token } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload, ...override });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });
});

describe('GET /api/v1/properties', () => {
  it('uses page 1 and limit 20 by default', async () => {
    const response = await request(app).get('/api/v1/properties');

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });

  it.each([
    ['intent', { intent: 'rent' }],
    ['city case-insensitively', { city: 'bEnGaLuRu' }],
    ['locality case-insensitively', { locality: 'kOrAmAnGaLa' }],
    ['propertyType', { propertyType: 'villa' }],
    ['minPrice', { minPrice: 2000000 }, { priceInRupees: 2500000 }, { priceInRupees: 1000000 }],
    ['maxPrice', { maxPrice: 3000000 }, { priceInRupees: 2500000 }, { priceInRupees: 5000000 }],
  ])('filters by %s', async (_label, query, matchingOverrides = {}, otherOverrides = {}) => {
    const { user } = await registerUser();
    await createProperty({ ownerId: user.id, slug: 'matching', intent: 'rent', propertyType: 'villa', ...matchingOverrides });
    await createProperty({ ownerId: user.id, slug: 'other', intent: 'buy', propertyType: 'apartment', city: 'Pune', locality: 'Koregaon Park', ...otherOverrides });

    const response = await request(app).get('/api/v1/properties').query(query);

    expect(response.status).toBe(200);
    expect(response.body.properties.map((property) => property.slug)).toEqual(['matching']);
  });

  it('combines filters', async () => {
    const { user } = await registerUser();
    await createProperty({ ownerId: user.id, slug: 'match', intent: 'rent', propertyType: 'villa', priceInRupees: 2500000 });
    await createProperty({ ownerId: user.id, slug: 'wrong-price', intent: 'rent', propertyType: 'villa', priceInRupees: 5000000 });
    await createProperty({ ownerId: user.id, slug: 'wrong-type', intent: 'rent', propertyType: 'apartment', priceInRupees: 2500000 });

    const response = await request(app).get('/api/v1/properties').query({
      city: 'BENGALURU',
      propertyType: 'villa',
      minPrice: 2000000,
      maxPrice: 3000000,
    });

    expect(response.status).toBe(200);
    expect(response.body.properties.map((property) => property.slug)).toEqual(['match']);
  });

  it('rejects invalid filters and price ranges', async () => {
    for (const query of [
      { intent: 'lease' },
      { propertyType: 'castle' },
      { minPrice: 'not-a-number' },
      { maxPrice: 'not-a-number' },
      { minPrice: -1 },
      { maxPrice: -1 },
      { minPrice: 20, maxPrice: 10 },
    ]) {
      const response = await request(app).get('/api/v1/properties').query(query);
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
    }
  });

  it.each([
    { page: 'abc' },
    { page: 0 },
    { limit: 'abc' },
    { limit: 0 },
  ])('rejects invalid pagination %j', async (query) => {
    const response = await request(app).get('/api/v1/properties').query(query);
    expect(response.status).toBe(400);
  });

  it('caps limit at 50', async () => {
    const { user } = await registerUser();
    await Property.create(Array.from({ length: 51 }, (_, index) => ({
      ownerId: user.id,
      slug: `limit-${index}`,
      title: `Property ${index}`,
      intent: 'buy',
      propertyType: 'apartment',
      areaSqft: 1000,
      priceInRupees: 1000000,
      city: 'Bengaluru',
      status: 'published',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    })));

    const response = await request(app).get('/api/v1/properties').query({ limit: 100 });

    expect(response.status).toBe(200);
    expect(response.body.properties).toHaveLength(50);
    expect(response.body.meta.limit).toBe(50);
  });

  it('returns only published properties and correct empty metadata', async () => {
    const { user } = await registerUser();
    await createProperty({ ownerId: user.id, slug: 'draft', status: 'draft' });
    await createProperty({ ownerId: user.id, slug: 'archived', status: 'archived' });

    const response = await request(app).get('/api/v1/properties').query({ city: 'No Such City' });

    expect(response.status).toBe(200);
    expect(response.body.properties).toEqual([]);
    expect(response.body.meta).toMatchObject({ total: 0, totalPages: 1 });
  });
});

describe('GET /api/v1/properties/:slug', () => {
  it('returns a published property by slug', async () => {
    const property = await createProperty({ slug: 'visible-property' });
    const response = await request(app).get(`/api/v1/properties/${property.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.property.slug).toBe(property.slug);
  });

  it.each(['missing-property', 'draft-property', 'archived-property'])('does not return %s', async (slug) => {
    if (slug !== 'missing-property') {
      await createProperty({ slug, status: slug.replace('-property', '') });
    }

    const response = await request(app).get(`/api/v1/properties/${slug}`);
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/v1/properties/:id', () => {
  it('allows an owner to update their own editable fields', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    const response = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Property', priceInRupees: 2000000 });

    expect(response.status).toBe(200);
    expect(response.body.property.title).toBe('Updated Property');
    expect(response.body.property.priceInRupees).toBe(2000000);
  });

  it('ignores admin-only fields from non-admin owners', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    const response = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published', verified: true, featured: true });

    expect(response.status).toBe(200);
    expect(response.body.property.status).toBe('draft');
    expect(response.body.property.verified).toBe(false);
  });

  it('forbids a non-owner', async () => {
    const { user } = await registerUser();
    const { token } = await registerUser();
    const property = await createProperty({ ownerId: user.id });
    const response = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hijacked' });

    expect(response.status).toBe(403);
  });

  it('returns 404 for a missing property', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .patch(`/api/v1/properties/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing' });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/v1/properties/:id', () => {
  it('allows an owner to delete a draft', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    const response = await request(app)
      .delete(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await Property.findById(property._id)).toBeNull();
  });

  it('allows an owner to delete their own published property', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'published' });
    const response = await request(app)
      .delete(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await Property.findById(property._id)).toBeNull();
  });

  it('allows an admin to delete a published property', async () => {
    const { user } = await registerUser();
    const { token, user: admin } = await registerUser();
    await promoteToAdmin(admin.id);
    const property = await createProperty({ ownerId: user.id });
    const response = await request(app)
      .delete(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it('forbids a non-owner from deleting a property', async () => {
    const { user } = await registerUser();
    const { token } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    const response = await request(app)
      .delete(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('returns 404 for a missing property', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .delete(`/api/v1/properties/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
