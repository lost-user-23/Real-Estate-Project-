process.env.MONGODB_DB_NAME = 'homenest_test_properties_contact';
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
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const OWNER_NUMBER = '+91 98765 43210';
const OTHER_NUMBER = '+91 91234 56789';

async function registerUser(label = 'user') {
  const email = `${label}-${new mongoose.Types.ObjectId()}@example.com`;
  const res = await registerVerified(app, { email, password: 'password123' });
  return { token: tokenFromResponse(res), id: res.body.user.id };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createListing({ ownerId = null, status = 'published', contactNumber = OWNER_NUMBER, ...rest } = {}) {
  const id = new mongoose.Types.ObjectId();
  const property = await Property.create({
    _id: id,
    ownerId,
    slug: `contact-${id}`,
    title: 'Contact Test Flat',
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 30000,
    city: 'Pune',
    contactNumber,
    status,
    publishedAt: status === 'published' ? new Date() : null,
    ...rest,
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

describe('GET /api/v1/properties/:id/contact', () => {
  it('rejects an anonymous request with 401', async () => {
    const listing = await createListing();
    const res = await request(app).get(`/api/v1/properties/${listing._id}/contact`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(OWNER_NUMBER);
  });

  it('returns only the contact number of a published listing to a logged-in user', async () => {
    const viewer = await registerUser('viewer');
    const listing = await createListing();

    const res = await request(app).get(`/api/v1/properties/${listing._id}/contact`).set(auth(viewer.token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contactNumber: OWNER_NUMBER });
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });

  it('returns null when a published listing has no contact number', async () => {
    const viewer = await registerUser('viewer');
    const listing = await createListing({ contactNumber: null });

    const res = await request(app).get(`/api/v1/properties/${listing._id}/contact`).set(auth(viewer.token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contactNumber: null });
  });

  it.each(['draft', 'archived'])('returns 404 for a %s listing', async (status) => {
    const viewer = await registerUser('viewer');
    const listing = await createListing({ status });

    const res = await request(app).get(`/api/v1/properties/${listing._id}/contact`).set(auth(viewer.token));

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(OWNER_NUMBER);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const viewer = await registerUser('viewer');
    const unknown = await request(app)
      .get(`/api/v1/properties/${new mongoose.Types.ObjectId()}/contact`)
      .set(auth(viewer.token));
    const malformed = await request(app).get('/api/v1/properties/not-an-id/contact').set(auth(viewer.token));

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe('contact rate limit (limiter active)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows 20 lookups per hour per user, then returns 429', async () => {
    // Register before activating limiters, so the register limiter is not in play.
    const viewer = await registerUser('limited');
    const other = await registerUser('unaffected');
    const listing = await createListing();
    const url = `/api/v1/properties/${listing._id}/contact`;

    process.env.NODE_ENV = 'development';
    const statuses = [];
    for (let i = 0; i < 20; i += 1) {
      const res = await request(app).get(url).set(auth(viewer.token));
      statuses.push(res.status);
    }
    const limited = await request(app).get(url).set(auth(viewer.token));
    const otherUser = await request(app).get(url).set(auth(other.token));

    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/too many/i);
    expect(JSON.stringify(limited.body)).not.toContain(OWNER_NUMBER);
    // The budget is per user, not shared.
    expect(otherUser.status).toBe(200);
  });
});

describe('contactNumber never appears in public or admin property responses', () => {
  it('is absent from every route except the contact endpoint and the owner\'s own list', async () => {
    const owner = await registerUser('owner');
    const admin = await registerUser('admin');
    await promoteToAdmin(admin.id);
    const published = await createListing({ ownerId: owner.id });
    await createListing({ ownerId: owner.id, status: 'draft', contactNumber: OTHER_NUMBER });

    const images = Array.from({ length: 5 }, (_, i) => ({ url: `https://res.cloudinary.com/demo/image/upload/v1/property-images/${i}.jpg` }));
    const responses = {
      list: await request(app).get('/api/v1/properties'),
      listLoggedIn: await request(app).get('/api/v1/properties').set(auth(owner.token)),
      featured: await request(app).get('/api/v1/properties?featured=false'),
      bySlug: await request(app).get(`/api/v1/properties/${published.slug}`),
      bySlugLoggedIn: await request(app).get(`/api/v1/properties/${published.slug}`).set(auth(owner.token)),
      create: await request(app)
        .post('/api/v1/properties')
        .set(auth(owner.token))
        .send({
          title: 'New flat',
          intent: 'buy',
          propertyType: 'apartment',
          areaSqft: 500,
          priceInRupees: 100,
          city: 'Pune',
          contactNumber: OTHER_NUMBER,
          images,
        }),
      ownerUpdate: await request(app)
        .patch(`/api/v1/properties/${published._id}`)
        .set(auth(owner.token))
        .send({ contactNumber: OWNER_NUMBER }),
      adminUpdate: await request(app)
        .patch(`/api/v1/properties/${published._id}`)
        .set(auth(admin.token))
        .send({ verified: true }),
      adminList: await request(app).get('/api/v1/admin/properties').set(auth(admin.token)),
      adminDashboard: await request(app).get('/api/v1/admin/dashboard').set(auth(admin.token)),
      othersMine: await request(app).get('/api/v1/properties/mine').set(auth(admin.token)),
    };

    for (const [name, res] of Object.entries(responses)) {
      expect({ name, ok: res.status < 400 }).toEqual({ name, ok: true });
      const body = JSON.stringify(res.body);
      expect({ name, leaks: body.includes('contactNumber') }).toEqual({ name, leaks: false });
      expect({ name, leaks: body.includes(OWNER_NUMBER) || body.includes(OTHER_NUMBER) }).toEqual({ name, leaks: false });
    }
  });

  it('GET /properties/mine gives the owner their own contact numbers and nobody else\'s', async () => {
    const owner = await registerUser('owner');
    const other = await registerUser('other');
    await createListing({ ownerId: owner.id, status: 'draft' });
    await createListing({ ownerId: other.id, contactNumber: OTHER_NUMBER });

    const mine = await request(app).get('/api/v1/properties/mine').set(auth(owner.token));

    expect(mine.status).toBe(200);
    expect(mine.body.properties).toHaveLength(1);
    expect(mine.body.properties[0].contactNumber).toBe(OWNER_NUMBER);
    expect(JSON.stringify(mine.body)).not.toContain(OTHER_NUMBER);
  });
});
