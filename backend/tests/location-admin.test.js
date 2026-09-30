process.env.MONGODB_DB_NAME = 'homenest_test_location_admin';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Location = require('../src/models/Location');

const app = createApp();

async function registerUser() {
  const email = `location-admin-${new mongoose.Types.ObjectId()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Location Admin Tester', email, password: 'password123' });
  return { token: res.body.token, user: res.body.user };
}

async function createAdminToken() {
  const { token, user } = await registerUser();
  await User.findByIdAndUpdate(user.id, { role: 'admin' });
  return token;
}

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

describe('GET /api/v1/admin/locations', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/admin/locations');
    expect(response.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .get('/api/v1/admin/locations')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('lists popular and non-popular locations, busiest first, with the public location shape', async () => {
    const token = await createAdminToken();
    await Location.create([
      { city: 'Quiet Town', activeListingCount: 2, popular: false },
      { city: 'Big City', activeListingCount: 40, popular: true, popularRank: 1 },
      { city: 'Mid City', activeListingCount: 12, popular: false },
    ]);

    const response = await request(app)
      .get('/api/v1/admin/locations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.locations.map((l) => l.city)).toEqual(['Big City', 'Mid City', 'Quiet Town']);
    expect(response.body.locations[0]).toMatchObject({
      id: expect.any(String),
      popular: true,
      popularRank: 1,
      activeListingCount: 40,
    });
    expect(response.body.meta).toMatchObject({ total: 3, page: 1, limit: 20, totalPages: 1 });
  });

  it('paginates, caps the limit and validates page params', async () => {
    const token = await createAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    await Location.create([
      { city: 'A', activeListingCount: 3 },
      { city: 'B', activeListingCount: 2 },
      { city: 'C', activeListingCount: 1 },
    ]);

    const page2 = await request(app).get('/api/v1/admin/locations?page=2&limit=2').set(headers);
    const capped = await request(app).get('/api/v1/admin/locations?limit=500').set(headers);
    const badPage = await request(app).get('/api/v1/admin/locations?page=0').set(headers);
    const badLimit = await request(app).get('/api/v1/admin/locations?limit=abc').set(headers);

    expect(page2.body.locations.map((l) => l.city)).toEqual(['C']);
    expect(page2.body.meta).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(capped.body.meta.limit).toBe(50);
    expect(badPage.status).toBe(400);
    expect(badLimit.status).toBe(400);
  });

  it('lets an admin toggle popular and clear the rank with null through PATCH', async () => {
    const token = await createAdminToken();
    const headers = { Authorization: `Bearer ${token}` };
    const location = await Location.create({ city: 'Rankville', activeListingCount: 9 });

    const on = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set(headers)
      .send({ popular: true, popularRank: 2 });
    const off = await request(app)
      .patch(`/api/v1/admin/locations/${location._id}`)
      .set(headers)
      .send({ popular: false, popularRank: null });

    expect(on.body.location).toMatchObject({ popular: true, popularRank: 2 });
    expect(off.body.location).toMatchObject({ popular: false, popularRank: null });

    const publicPopular = await request(app).get('/api/v1/locations/popular');
    expect(publicPopular.body.locations).toEqual([]);
  });
});
