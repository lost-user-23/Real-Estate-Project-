process.env.MONGODB_DB_NAME = 'homenest_test_properties_featured';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const app = createApp();

let counter = 0;
async function createFeatured(overrides = {}) {
  counter += 1;
  return Property.create({
    slug: `featured-${counter}`,
    title: `Featured ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Pune',
    contactNumber: '9999999999',
    status: 'published',
    featured: true,
    featuredRank: null,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

// Mongoose applies the schema default (null), so go to the driver to get a
// document that genuinely has no featuredRank field.
async function createFeaturedWithoutRankField(overrides = {}) {
  const doc = await createFeatured(overrides);
  await Property.collection.updateOne({ _id: doc._id }, { $unset: { featuredRank: '' } });
  return doc;
}

const titles = (res) => res.body.properties.map((p) => p.title);

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/properties/featured', () => {
  it('is not shadowed by /:slug', async () => {
    await createFeatured({ title: 'Real pick' });
    await createFeatured({ slug: 'featured', title: 'Slug named featured' });

    const res = await request(app).get('/api/v1/properties/featured');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.properties)).toBe(true);
    expect(res.body.scope).toBe('national');
    expect(res.body.meta).toBeUndefined();
    expect(res.body.property).toBeUndefined();
  });

  it('lists ranked picks before unranked ones', async () => {
    await createFeatured({ title: 'Unranked', publishedAt: new Date('2026-06-01') });
    await createFeatured({ title: 'Rank 2', featuredRank: 2 });
    await createFeatured({ title: 'Rank 1', featuredRank: 1 });

    const res = await request(app).get('/api/v1/properties/featured');

    expect(titles(res)).toEqual(['Rank 1', 'Rank 2', 'Unranked']);
  });

  it('counts rank 0 as ranked and sorts it first', async () => {
    await createFeatured({ title: 'Rank 1', featuredRank: 1 });
    await createFeatured({ title: 'Rank 0', featuredRank: 0 });
    await createFeatured({ title: 'Unranked' });

    const res = await request(app).get('/api/v1/properties/featured');

    expect(titles(res)).toEqual(['Rank 0', 'Rank 1', 'Unranked']);
  });

  it('puts null and missing ranks after every ranked pick', async () => {
    await createFeatured({ title: 'Null rank', publishedAt: new Date('2026-03-01') });
    await createFeaturedWithoutRankField({ title: 'Missing rank', publishedAt: new Date('2026-04-01') });
    await createFeatured({ title: 'Rank 9', featuredRank: 9, publishedAt: new Date('2020-01-01') });

    const res = await request(app).get('/api/v1/properties/featured');

    expect(titles(res)).toEqual(['Rank 9', 'Missing rank', 'Null rank']);
  });

  it('breaks ties by publishedAt desc, then _id', async () => {
    const sameDate = new Date('2026-02-01');
    await createFeatured({ title: 'Tie A', featuredRank: 3, publishedAt: new Date('2026-01-01') });
    await createFeatured({ title: 'Tie B', featuredRank: 3, publishedAt: new Date('2026-05-01') });
    const c = await createFeatured({ title: 'Tie C', featuredRank: 3, publishedAt: sameDate });
    const d = await createFeatured({ title: 'Tie D', featuredRank: 3, publishedAt: sameDate });

    const res = await request(app).get('/api/v1/properties/featured');

    const sameDateOrder = String(c._id) < String(d._id) ? ['Tie C', 'Tie D'] : ['Tie D', 'Tie C'];
    expect(titles(res)).toEqual(['Tie B', ...sameDateOrder, 'Tie A']);
  });

  it('matches the city ignoring case and reports city scope', async () => {
    await createFeatured({ title: 'Pune pick', city: 'Pune' });
    await createFeatured({ title: 'Delhi pick', city: 'Delhi' });

    const res = await request(app).get('/api/v1/properties/featured?city=pUnE');

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('city');
    expect(titles(res)).toEqual(['Pune pick']);
  });

  it('finds a city pick even when it is outside the national top picks', async () => {
    for (let i = 0; i < 10; i += 1) {
      await createFeatured({ title: `Delhi ${i}`, city: 'Delhi', featuredRank: i });
    }
    await createFeatured({ title: 'Goa unranked', city: 'Goa' });

    const res = await request(app).get('/api/v1/properties/featured?city=Goa');

    expect(res.body.scope).toBe('city');
    expect(titles(res)).toEqual(['Goa unranked']);
  });

  it('falls back to national when the city has no featured listings', async () => {
    await createFeatured({ title: 'Delhi pick', city: 'Delhi' });
    await createFeatured({ title: 'Unfeatured Goa', city: 'Goa', featured: false });

    const res = await request(app).get('/api/v1/properties/featured?city=Goa');

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('national');
    expect(titles(res)).toEqual(['Delhi pick']);
  });

  it('excludes drafts and archived listings, including in the fallback', async () => {
    await createFeatured({ title: 'Published' });
    await createFeatured({ title: 'Draft', status: 'draft' });
    await createFeatured({ title: 'Archived', status: 'archived' });

    const national = await request(app).get('/api/v1/properties/featured');
    const cityOnly = await request(app).get('/api/v1/properties/featured?city=Pune');

    expect(titles(national)).toEqual(['Published']);
    expect(titles(cityOnly)).toEqual(['Published']);
  });

  it('never exposes contactNumber or internal fields', async () => {
    const doc = await createFeatured();
    await PropertyImage.create({ propertyId: doc._id, url: 'https://example.com/a.jpg', alt: 'a' });

    const res = await request(app).get('/api/v1/properties/featured');

    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0]).not.toHaveProperty('contactNumber');
    expect(res.body.properties[0]).not.toHaveProperty('isUnranked');
    expect(res.body.properties[0].images).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain('9999999999');
  });

  it('defaults to 8 and honors limit, capped at 50', async () => {
    for (let i = 0; i < 10; i += 1) await createFeatured({ title: `Pick ${i}`, featuredRank: i });

    const byDefault = await request(app).get('/api/v1/properties/featured');
    const three = await request(app).get('/api/v1/properties/featured?limit=3');
    const huge = await request(app).get('/api/v1/properties/featured?limit=500');

    expect(byDefault.body.properties).toHaveLength(8);
    expect(titles(three)).toEqual(['Pick 0', 'Pick 1', 'Pick 2']);
    expect(huge.status).toBe(200);
    expect(huge.body.properties).toHaveLength(10);
  });

  it.each([
    ['repeated city', '?city=a&city=b'],
    ['blank city', '?city=%20%20'],
    ['empty city', '?city='],
    ['zero limit', '?limit=0'],
    ['fractional limit', '?limit=2.5'],
    ['text limit', '?limit=abc'],
    ['repeated limit', '?limit=1&limit=2'],
  ])('rejects %s with 400 in the unified error shape', async (_name, qs) => {
    const res = await request(app).get(`/api/v1/properties/featured${qs}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
