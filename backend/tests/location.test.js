process.env.MONGODB_DB_NAME = 'homenest_test_location';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Location = require('../src/models/Location');

const app = createApp();

async function registerUser(overrides = {}) {
  const email = overrides.email || `user-${new mongoose.Types.ObjectId()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'password123', ...overrides });
  return { token: res.body.token, user: res.body.user };
}

async function makeAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function registerAdmin() {
  const { token, user } = await registerUser();
  await makeAdmin(user.id);
  return { token, user };
}

const validPayload = {
  city: 'Mumbai',
  locality: 'Andheri',
  activeListingCount: 10,
  popular: true,
  popularRank: 1,
  imageUrl: 'https://example.com/mumbai.jpg',
  imageAlt: 'Mumbai skyline',
};

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Location.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/locations/popular', () => {
  it('is public and does not return 404', async () => {
    const res = await request(app).get('/api/v1/locations/popular');
    expect(res.status).not.toBe(404);
  });

  it('returns only popular locations, sorted by popularRank', async () => {
    await Location.create([
      { city: 'Delhi', popular: true, popularRank: 2 },
      { city: 'Mumbai', popular: true, popularRank: 1 },
      { city: 'Pune', popular: false, popularRank: 3 },
    ]);

    const res = await request(app).get('/api/v1/locations/popular');
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(2);
    expect(res.body.locations.map((l) => l.city)).toEqual(['Mumbai', 'Delhi']);
    expect(res.body.locations.every((l) => l.popular)).toBe(true);
  });
});

describe('GET /api/v1/locations/suggestions', () => {
  it('is public and does not return 404', async () => {
    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'test' });
    expect(res.status).not.toBe(404);
  });

  it('matches city case-insensitively', async () => {
    await Location.create({ city: 'Bengaluru', locality: 'Koramangala' });
    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'bengal' });
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
    expect(res.body.locations[0].city).toBe('Bengaluru');
  });

  it('matches locality case-insensitively', async () => {
    await Location.create({ city: 'Bengaluru', locality: 'Koramangala' });
    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'KORAMANGALA' });
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
  });

  it('limits results to 6', async () => {
    const docs = Array.from({ length: 8 }, (_, i) => ({ city: `Testville${i}` }));
    await Location.create(docs);

    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: 'Testville' });
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(6);
  });

  it('returns 400 for a missing q parameter', async () => {
    const res = await request(app).get('/api/v1/locations/suggestions');
    expect(res.status).toBe(400);
  });

  it('returns 400 for a blank q parameter', async () => {
    const res = await request(app).get('/api/v1/locations/suggestions').query({ q: '   ' });
    expect(res.status).toBe(400);
  });

  it('does not crash and treats regex-special input literally', async () => {
    await Location.create({ city: 'Bengaluru' });

    for (const special of ['(', '*', '[', '.*', '(unclosed']) {
      const res = await request(app).get('/api/v1/locations/suggestions').query({ q: special });
      expect(res.status).toBe(200);
      expect(res.body.locations).toEqual([]);
    }
  });
});

describe('PATCH /api/v1/admin/locations/:id', () => {
  it('is wired at the exact admin path', async () => {
    const location = await Location.create(validPayload);
    const res = await request(app).patch(`/api/v1/admin/locations/${location._id}`).send({});
    // Unauthenticated, but must not be a 404 route-not-found — confirms the route exists.
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated requests', async () => {
    const location = await Location.create(validPayload);
    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .send({ city: 'Pune' });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const location = await Location.create(validPayload);
    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Pune' });
    expect(res.status).toBe(403);
  });

  it('returns the updated location for an admin', async () => {
    const { token } = await registerAdmin();
    const location = await Location.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Pune' });

    expect(res.status).toBe(200);
    expect(res.body.location).toEqual({
      id: expect.any(String),
      city: 'Pune',
      locality: validPayload.locality,
      activeListingCount: validPayload.activeListingCount,
      popular: validPayload.popular,
      popularRank: validPayload.popularRank,
      imageUrl: validPayload.imageUrl,
      imageAlt: validPayload.imageAlt,
    });
  });

  it('supports partial updates and preserves omitted fields', async () => {
    const { token } = await registerAdmin();
    const location = await Location.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activeListingCount: 99 });

    expect(res.status).toBe(200);
    expect(res.body.location.activeListingCount).toBe(99);
    expect(res.body.location.city).toBe(validPayload.city);
    expect(res.body.location.locality).toBe(validPayload.locality);
    expect(res.body.location.popular).toBe(validPayload.popular);
    expect(res.body.location.popularRank).toBe(validPayload.popularRank);
  });

  it('rejects invalid field values', async () => {
    const { token } = await registerAdmin();
    const location = await Location.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activeListingCount: -1 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent location', async () => {
    const { token } = await registerAdmin();
    const res = await request(app)
      .patch(`/api/v1/admin/locations/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Pune' });
    expect(res.status).toBe(404);
  });

  it('ignores fields that are not in the allowed update list', async () => {
    const { token } = await registerAdmin();
    const location = await Location.create(validPayload);

    const res = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        city: 'Pune',
        contactEmail: 'hacker@example.com',
        contactPhone: '9999999999',
        arbitraryField: 'should not persist',
      });

    expect(res.status).toBe(200);
    expect(res.body.location.city).toBe('Pune');
    expect(res.body.location.contactEmail).toBeUndefined();
    expect(res.body.location.contactPhone).toBeUndefined();
    expect(res.body.location.arbitraryField).toBeUndefined();

    const stored = await Location.findById(location._id).lean();
    expect(stored.contactEmail).toBeUndefined();
    expect(stored.contactPhone).toBeUndefined();
    expect(stored.arbitraryField).toBeUndefined();
  });
});
