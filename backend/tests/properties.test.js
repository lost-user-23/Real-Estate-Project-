process.env.MONGODB_DB_NAME = 'homenest_test_properties';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

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
  const response = await registerVerified(app, { name: 'Property Tester', email, password: 'password123', ...overrides });
  return { token: tokenFromResponse(response), user: response.body.user };
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

  describe('text and phone validation', () => {
    const post = (token, body) =>
      request(app).post('/api/v1/properties').set('Authorization', `Bearer ${token}`).send({ ...validPayload, images: validImages, ...body });

    it('rejects a whitespace-only title, a short title, a short description and a long locality', async () => {
      const { token } = await registerUser();
      expect((await post(token, { title: '      ' })).status).toBe(400);
      expect((await post(token, { title: 'abcd' })).status).toBe(400);
      expect((await post(token, { description: '   ' })).status).toBe(400);
      expect((await post(token, { description: 'too short' })).status).toBe(400);
      expect((await post(token, { locality: 'a'.repeat(101) })).status).toBe(400);
      expect(await Property.countDocuments()).toBe(0);
    });

    it('rejects a null title, description, locality and contactNumber', async () => {
      const { token } = await registerUser();
      for (const field of ['title', 'description', 'locality', 'contactNumber']) {
        const response = await post(token, { [field]: null });
        expect(response.status).toBe(400);
        expect(response.body.error.details).toContain(`${field} must be a string`);
      }
      expect(await Property.countDocuments()).toBe(0);
    });

    it('rejects a title over 200 characters and accepts exactly 200', async () => {
      const { token } = await registerUser();
      const response = await post(token, { title: 'a'.repeat(201) });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('title must be at most 200 characters');
      expect((await post(token, { title: 'a'.repeat(200) })).status).toBe(201);
    });

    it('allows omitting contactNumber and description, and saves a trimmed locality', async () => {
      const { token } = await registerUser();
      const ok = await post(token, { locality: '  Koramangala  ' });
      expect(ok.status).toBe(201);
      expect((await Property.findOne()).locality).toBe('Koramangala');
    });

    it('rejects an invalid phone and stores a normalized one', async () => {
      const { token } = await registerUser();
      expect((await post(token, { contactNumber: '12345' })).status).toBe(400);

      const ok = await post(token, { contactNumber: '+91 98765-43210' });
      expect(ok.status).toBe(201);
      const stored = await Property.findOne().select('+contactNumber');
      expect(stored.contactNumber).toBe('9876543210');
    });
  });

  describe('image and description validation', () => {
    const post = (token, body) =>
      request(app).post('/api/v1/properties').set('Authorization', `Bearer ${token}`).send({ ...validPayload, ...body });
    const own = (path) => `https://res.cloudinary.com/demo/image/upload/v1/${path}`;
    const withFirst = (url) => [{ url }, ...validImages.slice(1)];

    it.each([
      ['another cloud', 'https://res.cloudinary.com/other/image/upload/v1/a.jpg'],
      ['an arbitrary website', 'https://example.com/a.jpg'],
      ['a lookalike host', 'https://res.cloudinary.com.evil.com/demo/image/upload/v1/a.jpg'],
      ['plain http', 'http://res.cloudinary.com/demo/image/upload/v1/a.jpg'],
      ['embedded credentials', 'https://user:pw@res.cloudinary.com/demo/image/upload/v1/a.jpg'],
      ['a non-default port', 'https://res.cloudinary.com:8443/demo/image/upload/v1/a.jpg'],
    ])('rejects an image URL with %s', async (_label, url) => {
      const { token } = await registerUser();
      const response = await post(token, { images: withFirst(url) });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('images[0].url must be a valid Cloudinary image URL');
      expect(await Property.countDocuments()).toBe(0);
    });

    it('rejects every Cloudinary URL when no cloud name is configured', async () => {
      const { token } = await registerUser();
      const config = require('../src/config');
      const original = config.cloudinaryCloudName;
      config.cloudinaryCloudName = '';
      try {
        const response = await post(token, { images: validImages });
        expect(response.status).toBe(400);
      } finally {
        config.cloudinaryCloudName = original;
      }
    });

    it('rejects 21 images and accepts 20', async () => {
      const { token } = await registerUser();
      const images = Array.from({ length: 21 }, (_, i) => ({ url: own(`property-images/${i}.jpg`) }));

      const tooMany = await post(token, { images });
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.error.details).toContain('images must contain at most 20 images');

      const ok = await post(token, { images: images.slice(0, 20) });
      expect(ok.status).toBe(201);
    });

    it('rejects an over-long image alt', async () => {
      const { token } = await registerUser();
      const response = await post(token, { images: [{ ...validImages[0], alt: 'a'.repeat(301) }, ...validImages.slice(1)] });
      expect(response.status).toBe(400);
    });

    it('rejects a description over 2000 characters and accepts exactly 2000', async () => {
      const { token } = await registerUser();

      const tooLong = await post(token, { description: 'a'.repeat(2001), images: validImages });
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.error.details).toContain('description must be at most 2000 characters');
      expect(await Property.countDocuments()).toBe(0);

      const ok = await post(token, { description: 'a'.repeat(2000), images: validImages });
      expect(ok.status).toBe(201);
    });
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
    expect(response.body.error.details).toContain('images[0].url must be a valid Cloudinary image URL');
  });

  it('rejects non-Cloudinary image URLs', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validPayload,
        images: [
          'https://images.example.com/house.jpg',
          ...validImages.slice(1),
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details).toContain('images[0] must be a valid Cloudinary image URL');
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

  it('does not expose ownerId or status on public list, featured and slug responses', async () => {
    const { user } = await registerUser();
    await createProperty({ ownerId: user.id, slug: 'public-one', featured: true, featuredRank: 1 });

    const list = await request(app).get('/api/v1/properties');
    const featured = await request(app).get('/api/v1/properties/featured');
    const bySlug = await request(app).get('/api/v1/properties/public-one');

    for (const property of [list.body.properties[0], featured.body.properties[0], bySlug.body.property]) {
      expect(property.slug).toBe('public-one');
      expect(property).not.toHaveProperty('ownerId');
      expect(property).not.toHaveProperty('status');
      expect(property).not.toHaveProperty('__v');
    }
  });

  describe('keyword and bhk filters', () => {
    const slugs = (response) => response.body.properties.map((property) => property.slug).sort();
    const get = (query) => request(app).get('/api/v1/properties').query(query);

    async function seed() {
      const { user } = await registerUser();
      const base = { ownerId: user.id };
      await createProperty({ ...base, slug: 'one-koramangala', title: 'Cozy studio', bhk: 1, locality: 'Koramangala' });
      await createProperty({ ...base, slug: 'two-indiranagar', title: 'Sunny flat', bhk: 2, locality: 'Indiranagar' });
      await createProperty({ ...base, slug: 'three-pune', title: 'Garden Villa', bhk: 3, city: 'Pune', locality: 'Baner' });
      await createProperty({ ...base, slug: 'five-bengaluru', title: 'Grand mansion', bhk: 5, locality: 'Whitefield' });
      await createProperty({ ...base, slug: 'no-bhk', title: 'Retail shop', bhk: null, propertyType: 'commercial' });
    }

    it('matches the keyword against title, locality and city case-insensitively', async () => {
      await seed();
      expect(slugs(await get({ q: 'VILLA' }))).toEqual(['three-pune']);
      expect(slugs(await get({ q: 'indira' }))).toEqual(['two-indiranagar']);
      expect(slugs(await get({ q: 'pune' }))).toEqual(['three-pune']);
      expect((await get({ q: '  villa  ' })).body.properties).toHaveLength(1);
    });

    it('does not match the keyword against other fields', async () => {
      const { user } = await registerUser();
      await createProperty({ ownerId: user.id, slug: 'desc-only', description: 'near the metro' });
      expect((await get({ q: 'metro' })).body.properties).toEqual([]);
    });

    it('filters by a single bhk, several bhk values and 4+', async () => {
      await seed();
      expect(slugs(await get({ bhk: '2' }))).toEqual(['two-indiranagar']);
      expect(slugs(await get({ bhk: '2,3' }))).toEqual(['three-pune', 'two-indiranagar']);
      expect(slugs(await get({ bhk: '4+' }))).toEqual(['five-bengaluru']);
      expect(slugs(await get({ bhk: '1,4+' }))).toEqual(['five-bengaluru', 'one-koramangala']);
    });

    it('combines the keyword and bhk with city and keeps total in meta', async () => {
      await seed();
      expect(slugs(await get({ city: 'Bengaluru', bhk: '1,2,3' }))).toEqual(['one-koramangala', 'two-indiranagar']);
      const response = await get({ city: 'bengaluru', q: 'a', bhk: '2,5' });
      expect(slugs(response)).toEqual(['five-bengaluru', 'two-indiranagar']);
      expect(response.body.meta.total).toBe(2);
    });

    it('treats regex characters in the keyword literally', async () => {
      const { user } = await registerUser();
      await createProperty({ ownerId: user.id, slug: 'plain', title: 'Plain house' });
      await createProperty({ ownerId: user.id, slug: 'special', title: 'Flat (A+) [corner] $5.00' });

      // Unescaped, these would match everything or throw an invalid-regex error.
      for (const q of ['.*', '\\', '^Plain', 'Plain|Flat', 'P.ain']) {
        const response = await get({ q });
        expect(response.status).toBe(200);
        expect(response.body.properties).toEqual([]);
      }
      expect(slugs(await get({ q: '(' }))).toEqual(['special']);
      expect(slugs(await get({ q: '[' }))).toEqual(['special']);
      expect(slugs(await get({ q: '(A+) [corner] $5.00' }))).toEqual(['special']);
    });

    it('rejects invalid q and bhk with the standard 400 shape', async () => {
      for (const query of [
        { q: '   ' },
        { q: 'x'.repeat(101) },
        { q: ['a', 'b'] },
        { bhk: 'abc' },
        { bhk: '2,' },
        { bhk: '-1' },
        { bhk: '2.5' },
        { bhk: '21' },
        { bhk: '3+,4+' },
        { bhk: ['2', '3'] },
      ]) {
        const response = await get(query);
        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Validation failed');
        expect(response.body.error.details.length).toBeGreaterThan(0);
      }
      expect((await get({ q: 'x'.repeat(100) })).status).toBe(200);
    });

    it('rejects a repeated locality or city with 400 instead of failing or silently matching nothing', async () => {
      for (const query of ['locality=a&locality=b', 'city=a&city=b']) {
        const response = await request(app).get(`/api/v1/properties?${query}`);
        expect(response.status).toBe(400);
        expect(response.body.error.message).toBe('Validation failed');
        expect(response.body.error.details.length).toBeGreaterThan(0);
      }
    });

    it('never returns drafts or archived listings for a matching keyword or bhk', async () => {
      const { user } = await registerUser();
      await createProperty({ ownerId: user.id, slug: 'pub', title: 'Match me', bhk: 2 });
      await createProperty({ ownerId: user.id, slug: 'drf', title: 'Match me', bhk: 2, status: 'draft' });
      await createProperty({ ownerId: user.id, slug: 'arc', title: 'Match me', bhk: 2, status: 'archived' });

      expect(slugs(await get({ q: 'match', bhk: '2', status: 'draft' }))).toEqual(['pub']);
    });
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
  it('preserves status in admin publish and feature update responses', async () => {
    const { user: owner } = await registerUser();
    const { token, user: admin } = await registerUser();
    await promoteToAdmin(admin.id);
    const property = await createProperty({ ownerId: owner.id, status: 'draft', publishedAt: null });
    const path = `/api/v1/properties/${property._id}`;

    const published = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(published.status).toBe(200);
    expect(published.body.property.status).toBe('published');

    const featured = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send({ featured: true });
    expect(featured.status).toBe(200);
    expect(featured.body.property.status).toBe('published');
    expect(featured.body.property.featured).toBe(true);
  });

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

  it('rejects an over-long description, a foreign-cloud image and 21 images on update', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft', description: 'original' });
    const patch = (body) =>
      request(app).patch(`/api/v1/properties/${property._id}`).set('Authorization', `Bearer ${token}`).send(body);

    const longDescription = await patch({ description: 'a'.repeat(2001) });
    expect(longDescription.status).toBe(400);

    const foreign = await patch({ images: [{ url: 'https://res.cloudinary.com/other/image/upload/v1/a.jpg' }] });
    expect(foreign.status).toBe(400);

    const tooMany = await patch({
      images: Array.from({ length: 21 }, (_, i) => ({ url: `https://res.cloudinary.com/demo/image/upload/v1/p/${i}.jpg` })),
    });
    expect(tooMany.status).toBe(400);

    expect((await Property.findById(property._id)).description).toBe('original');

    const ok = await patch({ description: 'a'.repeat(2000) });
    expect(ok.status).toBe(200);
  });

  it('lets an owner replace their property images', async () => {
    const { token, user } = await registerUser();
    const property = await createProperty({ ownerId: user.id, status: 'draft' });
    await PropertyImage.create({ propertyId: property._id, url: 'https://res.cloudinary.com/demo/old.jpg', displayOrder: 0 });

    const newUrl = 'https://res.cloudinary.com/demo/image/upload/v1/property-images/new.jpg';
    const response = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ images: [{ url: newUrl, alt: 'Front view' }, ...validImages.slice(1)] });

    expect(response.status).toBe(200);
    expect(response.body.property.images).toEqual([
      expect.objectContaining({ url: newUrl, alt: 'Front view', displayOrder: 0 }),
      ...validImages.slice(1).map((image, i) => expect.objectContaining({ url: image.url, displayOrder: i + 1 })),
    ]);

    const stored = await PropertyImage.find({ propertyId: property._id }).sort({ displayOrder: 1 });
    expect(stored).toHaveLength(5);
    expect(stored.map((image) => image.url)).toEqual([newUrl, ...validImages.slice(1).map((image) => image.url)]);
  });

  describe('unverifying on trust-relevant owner edits', () => {
    const imgUrl = (n) => `https://res.cloudinary.com/demo/image/upload/v1/property-images/${n}.jpg`;
    const imgs = [0, 1, 2, 3, 4, 5].map((n) => ({ url: imgUrl(n), publicId: `property-images/${n}` }));

    async function setup(overrides = {}) {
      const { token, user } = await registerUser();
      const property = await createProperty({
        ownerId: user.id,
        verified: true,
        title: 'Original Title',
        contactNumber: '9876543210',
        ...overrides,
      });
      await PropertyImage.insertMany(imgs.map((image, i) => ({ ...image, propertyId: property._id, displayOrder: i })));
      const patch = (body, as = token) =>
        request(app).patch(`/api/v1/properties/${property._id}`).set('Authorization', `Bearer ${as}`).send(body);
      const stored = async () => Property.findById(property._id);
      return { patch, stored, property };
    }

    it('owner changes title: verified becomes false, status unchanged', async () => {
      const { patch, stored } = await setup();
      const response = await patch({ title: 'New Title' });
      expect(response.status).toBe(200);
      expect(response.body.property.verified).toBe(false);
      const doc = await stored();
      expect(doc.verified).toBe(false);
      expect(doc.status).toBe('published');
    });

    it('owner resends the identical title: verified stays true', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ title: '  Original Title ' })).status).toBe(200);
      expect((await stored()).verified).toBe(true);
    });

    it('owner edits description only: verified stays true', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ description: 'A brand new description of the flat', priceInRupees: 5 })).status).toBe(200);
      expect((await stored()).verified).toBe(true);
    });

    it('admin changes title: verified stays true', async () => {
      const { patch, stored } = await setup();
      const { token: adminToken, user: admin } = await registerUser();
      await promoteToAdmin(admin.id);
      expect((await patch({ title: 'Admin Title' }, adminToken)).status).toBe(200);
      const doc = await stored();
      expect(doc.title).toBe('Admin Title');
      expect(doc.verified).toBe(true);
    });

    it('owner changes contactNumber: verified becomes false, number not leaked', async () => {
      const { patch, stored } = await setup();
      const response = await patch({ contactNumber: '9123456780' });
      expect(response.status).toBe(200);
      expect(response.body.property).not.toHaveProperty('contactNumber');
      expect((await stored()).verified).toBe(false);
    });

    it('owner resends identical contactNumber: verified stays true', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ contactNumber: '9876543210' })).status).toBe(200);
      expect((await stored()).verified).toBe(true);
    });

    it('owner adds a photo via images: verified becomes false', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ images: [...imgs, { url: imgUrl(6) }] })).status).toBe(200);
      expect((await stored()).verified).toBe(false);
    });

    it('owner removes a photo via images: verified becomes false', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ images: imgs.slice(0, 5) })).status).toBe(200);
      expect((await stored()).verified).toBe(false);
    });

    it('owner reorders photos only: verified stays true', async () => {
      const { patch, stored, property } = await setup();
      expect((await patch({ images: [...imgs].reverse() })).status).toBe(200);
      expect((await stored()).verified).toBe(true);
      expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(imgs.length);
    });

    it('owner resends identical images: verified stays true', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ images: imgs })).status).toBe(200);
      expect((await stored()).verified).toBe(true);
    });

    it('a listing that was already unverified stays unverified', async () => {
      const { patch, stored } = await setup({ verified: false });
      const response = await patch({ title: 'Another Title', images: imgs.slice(0, 5) });
      expect(response.status).toBe(200);
      expect((await stored()).verified).toBe(false);
    });
  });

  describe('field validation on update', () => {
    const own = (n) => ({ url: `https://res.cloudinary.com/demo/image/upload/v1/property-images/e${n}.jpg` });
    const fiveImages = [0, 1, 2, 3, 4].map(own);

    async function setup(overrides = {}) {
      const { token, user } = await registerUser();
      const property = await createProperty({
        ownerId: user.id,
        status: 'draft',
        description: 'An original description that is long enough',
        contactNumber: '9876543210',
        ...overrides,
      });
      await PropertyImage.insertMany(fiveImages.map((image, i) => ({ ...image, propertyId: property._id, displayOrder: i })));
      const patch = (body) =>
        request(app).patch(`/api/v1/properties/${property._id}`).set('Authorization', `Bearer ${token}`).send(body);
      const stored = () => Property.findById(property._id).select('+contactNumber');
      return { patch, stored, property };
    }

    it('rejects images with fewer than 5 entries and leaves the stored photos alone', async () => {
      const { patch, property } = await setup();
      const response = await patch({ images: fiveImages.slice(0, 3) });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('images must contain at least 5 images');
      expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(5);
    });

    it('rejects an explicit empty images array', async () => {
      const { patch } = await setup();
      const response = await patch({ images: [] });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('images must contain at least 5 images');
    });

    it('accepts an edit that does not send images', async () => {
      const { patch, property } = await setup();
      expect((await patch({ priceInRupees: 123 })).status).toBe(200);
      expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(5);
    });

    it('accepts 5 or more images', async () => {
      const { patch } = await setup();
      expect((await patch({ images: fiveImages })).status).toBe(200);
      expect((await patch({ images: [...fiveImages, own(5), own(6)] })).status).toBe(200);
    });

    it.each([
      ['+91 98765-43210', '9876543210'],
      ['098765 43210', '9876543210'],
      ['  9123456780 ', '9123456780'],
      ['+919876543211', '9876543211'],
    ])('stores contactNumber %j as %s', async (input, expected) => {
      const { patch, stored } = await setup();
      expect((await patch({ contactNumber: input })).status).toBe(200);
      expect((await stored()).contactNumber).toBe(expected);
    });

    it.each(['12345', '5876543210', '98765432101', 'abcdefghij', '+1 9876543210', '   '])(
      'rejects contactNumber %j',
      async (input) => {
        const { patch, stored } = await setup();
        const response = await patch({ contactNumber: input });
        expect(response.status).toBe(400);
        expect(response.body.error.details).toContain('contactNumber must be a valid 10-digit Indian mobile number');
        expect((await stored()).contactNumber).toBe('9876543210');
      },
    );

    it('rejects a whitespace-only or too-short title and trims a valid one', async () => {
      const { patch, stored } = await setup();
      for (const title of ['     ', 'abcd', '  abcd  ']) {
        const response = await patch({ title });
        expect(response.status).toBe(400);
        expect(response.body.error.details).toContain('title must be at least 5 characters');
      }
      expect((await patch({ title: 'a'.repeat(201) })).status).toBe(400);
      expect((await patch({ title: '   Fresh Title   ' })).status).toBe(200);
      expect((await stored()).title).toBe('Fresh Title');
    });

    it('rejects a whitespace-only or short description, allows clearing it and trims a valid one', async () => {
      const { patch, stored } = await setup();
      for (const description of ['            ', 'too short']) {
        const response = await patch({ description });
        expect(response.status).toBe(400);
        expect(response.body.error.details).toContain('description must be at least 20 characters');
      }
      expect((await patch({ description: '' })).status).toBe(200);
      expect((await stored()).description).toBe('');
      expect((await patch({ description: '   A description that is long enough   ' })).status).toBe(200);
      expect((await stored()).description).toBe('A description that is long enough');
    });

    it('rejects a null title, description, locality and contactNumber on update', async () => {
      const { patch, stored } = await setup();
      for (const field of ['title', 'description', 'locality', 'contactNumber']) {
        const response = await patch({ [field]: null });
        expect(response.status).toBe(400);
        expect(response.body.error.details).toContain(`${field} must be a string`);
      }
      const doc = await stored();
      expect(doc.title).toBe('Test Property');
      expect(doc.contactNumber).toBe('9876543210');
    });

    it('rejects a title over 200 characters and accepts exactly 200 on update', async () => {
      const { patch } = await setup();
      const response = await patch({ title: 'a'.repeat(201) });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('title must be at most 200 characters');
      expect((await patch({ title: 'a'.repeat(200) })).status).toBe(200);
    });

    it('still accepts an empty-string description on update (cleared)', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ description: '' })).status).toBe(200);
      expect((await stored()).description).toBe('');
    });

    it('saves the trimmed locality on update', async () => {
      const { patch, stored } = await setup();
      expect((await patch({ locality: '   Indiranagar   ' })).status).toBe(200);
      expect((await stored()).locality).toBe('Indiranagar');
    });

    it('does not apply the description rule when description is not in the PATCH', async () => {
      const { patch } = await setup({ description: 'short' });
      expect((await patch({ priceInRupees: 99 })).status).toBe(200);
    });

    it('rejects a locality over 100 characters and accepts exactly 100', async () => {
      const { patch } = await setup();
      const response = await patch({ locality: 'a'.repeat(101) });
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContain('locality must be at most 100 characters');
      expect((await patch({ locality: 'a'.repeat(100) })).status).toBe(200);
    });

    it('does not unverify when only the phone formatting differs from the stored number', async () => {
      const { patch, stored } = await setup({ verified: true, contactNumber: '+91 98765 43210' });
      expect((await patch({ contactNumber: '9876543210' })).status).toBe(200);
      const doc = await stored();
      expect(doc.verified).toBe(true);
      expect(doc.contactNumber).toBe('9876543210');
    });
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
