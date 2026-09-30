process.env.MONGODB_DB_NAME = 'homenest_test_properties_mine';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const app = createApp();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function registerUser(email) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return { token: res.body.token, id: res.body.user.id };
}

let counter = 0;
async function createListing(ownerId, status = 'draft') {
  counter += 1;
  const property = await Property.create({
    ownerId,
    slug: `mine-${counter}`,
    title: `Mine ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 5000000,
    city: 'Delhi',
    contactNumber: '9999999999',
    status,
  });
  await PropertyImage.create({ propertyId: property._id, url: 'https://example.com/a.jpg' });
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

describe('GET /api/v1/properties/mine', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/properties/mine');
    expect(res.status).toBe(401);
  });

  it('returns only the caller\'s properties in every status, with images and the owner\'s contact number', async () => {
    const me = await registerUser('me@example.com');
    const other = await registerUser('other@example.com');
    await createListing(me.id, 'draft');
    await createListing(me.id, 'published');
    await createListing(other.id, 'published');

    const res = await request(app).get('/api/v1/properties/mine').set(auth(me.token));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.properties.map((p) => p.status).sort()).toEqual(['draft', 'published']);
    res.body.properties.forEach((p) => {
      expect(String(p.ownerId)).toBe(me.id);
      expect(p.images).toHaveLength(1);
      expect(p.contactNumber).toBe('9999999999');
    });
  });

  it('is not shadowed by the /:slug route', async () => {
    const me = await registerUser('me@example.com');
    const res = await request(app).get('/api/v1/properties/mine').set(auth(me.token));
    expect(res.status).toBe(200);
    expect(res.body.properties).toEqual([]);
  });

  it('paginates and validates page/limit', async () => {
    const me = await registerUser('me@example.com');
    await createListing(me.id);
    await createListing(me.id);
    await createListing(me.id);

    const page = await request(app).get('/api/v1/properties/mine?limit=2&page=2').set(auth(me.token));
    expect(page.status).toBe(200);
    expect(page.body.properties).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });

    const bad = await request(app).get('/api/v1/properties/mine?page=0').set(auth(me.token));
    expect(bad.status).toBe(400);
  });
});
