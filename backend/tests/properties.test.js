process.env.MONGODB_DB_NAME = 'homenest_test_properties';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

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
const validImages = Array.from({ length: 5 }, (_, index) => ({
  url: `https://res.cloudinary.com/demo/image/upload/v1/property-images/${index}.jpg`,
}));

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
  await Promise.all([User.deleteMany({}), Property.deleteMany({}), PropertyImage.deleteMany({})]);
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

  it('rejects submissions with fewer than five images', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload, images: validImages.slice(0, 4) });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContain('images must contain at least 5 images');
  });

  it('creates an owned draft and links all submitted images even when published status is requested', async () => {
    const { token, user } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload, status: 'published', images: validImages });

    expect(response.status).toBe(201);
    expect(response.body.property.ownerId).toBe(user.id);
    expect(response.body.property.status).toBe('draft');
    expect(response.body.property.slug).toEqual(expect.any(String));
    expect(response.body.property.images).toHaveLength(5);

    const stored = await PropertyImage.find({ propertyId: response.body.property._id });
    expect(stored).toHaveLength(5);
    expect(stored.every((image) => String(image.propertyId) === response.body.property._id)).toBe(true);
    expect(stored.map((image) => image.url).sort()).toEqual(validImages.map((image) => image.url).sort());
  });

  it('gives listings with the same title distinct slugs and leaves existing slugs unchanged', async () => {
    const { token } = await registerUser();
    const submit = () =>
      request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validPayload, images: validImages });

    const first = await submit();
    const second = await submit();
    const third = await submit();

    expect([first.status, second.status, third.status]).toEqual([201, 201, 201]);
    expect(first.body.property.slug).toBe('sunny-2bhk-apartment');
    const slugs = [first, second, third].map((res) => res.body.property.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(second.body.property.slug).toMatch(/^sunny-2bhk-apartment-[0-9a-f]{6}$/);

    const stored = await Property.findById(first.body.property._id);
    expect(stored.slug).toBe('sunny-2bhk-apartment');
  });

  describe('slug duplicate-key race', () => {
    function slugCollision(slug) {
      return Object.assign(new Error(`E11000 duplicate key error: slug "${slug}"`), {
        code: 11000,
        keyPattern: { slug: 1 },
        keyValue: { slug },
      });
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('retries with a new suffix when the insert collides on the slug', async () => {
      const { token } = await registerUser();
      const realCreate = Property.create.bind(Property);
      const attemptedSlugs = [];
      jest.spyOn(Property, 'create').mockImplementation(async (doc) => {
        attemptedSlugs.push(doc.slug);
        // Simulates another request inserting the same slug between the
        // exists() check and this insert.
        if (attemptedSlugs.length === 1) throw slugCollision(doc.slug);
        return realCreate(doc);
      });

      const response = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validPayload, images: validImages });

      expect(response.status).toBe(201);
      expect(attemptedSlugs).toHaveLength(2);
      expect(attemptedSlugs[0]).toBe('sunny-2bhk-apartment');
      expect(attemptedSlugs[1]).toMatch(/^sunny-2bhk-apartment-[0-9a-f]{6}$/);
      expect(response.body.property.slug).toBe(attemptedSlugs[1]);
      expect(await PropertyImage.countDocuments({ propertyId: response.body.property._id })).toBe(5);
    });

    it('returns 409 after 3 retries all collide, and stores nothing', async () => {
      const { token } = await registerUser();
      const spy = jest.spyOn(Property, 'create').mockImplementation(async (doc) => {
        throw slugCollision(doc.slug);
      });

      const response = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validPayload, images: validImages });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/unique link/);
      expect(spy).toHaveBeenCalledTimes(4);
      expect(await PropertyImage.countDocuments({})).toBe(0);
    });

    it('does not retry a duplicate-key error on another field', async () => {
      const { token } = await registerUser();
      const other = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { other: 1 }, keyValue: { other: 'x' } });
      const spy = jest.spyOn(Property, 'create').mockRejectedValue(other);

      const response = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validPayload, images: validImages });

      expect(response.status).toBe(409);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects malformed image entries', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload, images: [{ alt: 'missing url' }, ...validImages.slice(1)] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details).toContain('images[0].url must be a non-empty string');
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
      .send({ ...validPayload, ...override, images: validImages });

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

  it('never returns draft or archived properties even when ?status=draft is requested', async () => {
    const { user } = await registerUser();
    await createProperty({ ownerId: user.id, slug: 'still-draft', status: 'draft' });
    await createProperty({ ownerId: user.id, slug: 'still-archived', status: 'archived' });
    await createProperty({ ownerId: user.id, slug: 'still-published', status: 'published' });

    const response = await request(app).get('/api/v1/properties').query({ status: 'draft' });

    expect(response.status).toBe(200);
    expect(response.body.properties.map((property) => property.slug)).toEqual(['still-published']);
  });
});

describe('GET /api/v1/properties/:slug', () => {
  it('returns a published property by slug', async () => {
    const property = await createProperty({ slug: 'visible-property' });
    const response = await request(app).get(`/api/v1/properties/${property.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.property.slug).toBe(property.slug);
  });

  it('includes uploaded images ordered by displayOrder', async () => {
    const property = await createProperty({ slug: 'with-images' });
    await PropertyImage.create([
      { propertyId: property._id, url: 'https://res.cloudinary.com/demo/second.jpg', displayOrder: 1 },
      { propertyId: property._id, url: 'https://res.cloudinary.com/demo/first.jpg', displayOrder: 0 },
    ]);

    const response = await request(app).get(`/api/v1/properties/${property.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.property.images.map((image) => image.url)).toEqual([
      'https://res.cloudinary.com/demo/first.jpg',
      'https://res.cloudinary.com/demo/second.jpg',
    ]);
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

  it('lets an owner replace their property images', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    await PropertyImage.create({ propertyId: property._id, url: 'https://res.cloudinary.com/demo/old.jpg', displayOrder: 0 });

    const newUrl = 'https://res.cloudinary.com/demo/image/upload/v1/property-images/new.jpg';
    const response = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ images: [{ url: newUrl, alt: 'Front view' }] });

    expect(response.status).toBe(200);
    expect(response.body.property.images).toEqual([
      expect.objectContaining({ url: newUrl, alt: 'Front view', displayOrder: 0 }),
    ]);

    const stored = await PropertyImage.find({ propertyId: property._id });
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toBe(newUrl);
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
  it('deletes associated image records along with the property', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    await PropertyImage.create({ propertyId: property._id, url: 'https://res.cloudinary.com/demo/a.jpg' });

    const response = await request(app)
      .delete(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await PropertyImage.find({ propertyId: property._id })).toHaveLength(0);
  });

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

describe('GET /api/v1/admin/properties', () => {
  it('rejects a non-admin user with 403', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const response = await request(app).get('/api/v1/admin/properties');
    expect(response.status).toBe(401);
  });

  it('lets an admin see draft and archived listings alongside published ones', async () => {
    const { token, user } = await registerUser();
    await promoteToAdmin(user.id);
    await createProperty({ slug: 'draft-one', status: 'draft', publishedAt: null });
    await createProperty({ slug: 'archived-one', status: 'archived' });
    await createProperty({ slug: 'published-one', status: 'published' });

    const response = await request(app)
      .get('/api/v1/admin/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.properties.map((property) => property.slug).sort()).toEqual(
      ['archived-one', 'draft-one', 'published-one'].sort()
    );
    expect(response.body.meta).toMatchObject({ total: 3 });
  });

  it('narrows results with ?status= for an admin', async () => {
    const { token, user } = await registerUser();
    await promoteToAdmin(user.id);
    await createProperty({ slug: 'draft-two', status: 'draft', publishedAt: null });
    await createProperty({ slug: 'published-two', status: 'published' });

    const response = await request(app)
      .get('/api/v1/admin/properties')
      .query({ status: 'draft' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.properties.map((property) => property.slug)).toEqual(['draft-two']);
  });

  it('rejects an invalid ?status= with 400', async () => {
    const { token, user } = await registerUser();
    await promoteToAdmin(user.id);

    const response = await request(app)
      .get('/api/v1/admin/properties')
      .query({ status: 'not-a-status' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it('paginates newest first with accurate meta', async () => {
    const { token, user } = await registerUser();
    await promoteToAdmin(user.id);
    await createProperty({ slug: 'admin-page-a' });
    await createProperty({ slug: 'admin-page-b' });
    await createProperty({ slug: 'admin-page-c' });

    const response = await request(app)
      .get('/api/v1/admin/properties')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.properties).toHaveLength(2);
    expect(response.body.properties.map((p) => p.slug)).toEqual(['admin-page-c', 'admin-page-b']);
    expect(response.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
  });
});
