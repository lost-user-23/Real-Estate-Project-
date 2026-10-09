process.env.MONGODB_DB_NAME = 'homenest_test_facilities';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Location = require('../src/models/Location');
const Facility = require('../src/models/Facility');

const app = createApp();

async function registerUser() {
  const email = `facility-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Facility Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createLocation(overrides = {}) {
  return Location.create({ city: 'Bengaluru', locality: 'Koramangala', ...overrides });
}

const validFacility = {
  name: 'Koramangala School',
  type: 'school',
  address: '12 Main Road',
  distanceKm: 1.2,
};

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([Facility.deleteMany({}), Location.deleteMany({}), User.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/locations/:locationId/facilities', () => {
  it('returns facilities sorted by distance for an existing location', async () => {
    const location = await createLocation();
    await Facility.create([
      { ...validFacility, locationId: location._id, name: 'Far Hospital', type: 'hospital', distanceKm: 4 },
      { ...validFacility, locationId: location._id, distanceKm: 1.2 },
    ]);

    const response = await request(app).get(`/api/v1/locations/${location._id}/facilities`);

    expect(response.status).toBe(200);
    expect(response.body.facilities).toHaveLength(2);
    expect(response.body.facilities[0].distanceKm).toBe(1.2);
    expect(response.body.facilities[0].id).toBeDefined();
    expect(response.body.facilities[0].locationId).toBe(location._id.toString());
  });

  it('returns 404 for a nonexistent location', async () => {
    const response = await request(app)
      .get(`/api/v1/locations/${new mongoose.Types.ObjectId()}/facilities`);

    expect(response.status).toBe(404);
  });

  it('returns 400 for an invalid location id', async () => {
    const response = await request(app).get('/api/v1/locations/not-an-id/facilities');

    expect(response.status).toBe(400);
  });
});

describe('Admin facility API', () => {
  it('requires an admin to create a facility and validates locationId', async () => {
    const user = await registerUser();
    const location = await createLocation();

    const unauthenticated = await request(app)
      .post('/api/v1/admin/facilities')
      .send({ ...validFacility, locationId: location._id });
    expect(unauthenticated.status).toBe(401);

    const nonAdmin = await request(app)
      .post('/api/v1/admin/facilities')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ ...validFacility, locationId: location._id });
    expect(nonAdmin.status).toBe(403);

    await promoteToAdmin(user.user.id);
    const created = await request(app)
      .post('/api/v1/admin/facilities')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ ...validFacility, locationId: location._id });

    expect(created.status).toBe(201);
    expect(created.body.facility.type).toBe('school');
    expect(created.body.facility.locationId).toBe(location._id.toString());

    const invalidReference = await request(app)
      .post('/api/v1/admin/facilities')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ ...validFacility, locationId: new mongoose.Types.ObjectId() });
    expect(invalidReference.status).toBe(404);
  });

  it('supports partial admin updates and validates facility type', async () => {
    const user = await registerUser();
    await promoteToAdmin(user.user.id);
    const location = await createLocation();
    const facility = await Facility.create({ locationId: location._id, ...validFacility });

    const updated = await request(app)
      .patch(`/api/v1/admin/facilities/${facility._id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Updated School' });

    expect(updated.status).toBe(200);
    expect(updated.body.facility.name).toBe('Updated School');
    expect(updated.body.facility.type).toBe('school');
    expect(updated.body.facility.distanceKm).toBe(1.2);

    const invalid = await request(app)
      .patch(`/api/v1/admin/facilities/${facility._id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ type: 'airport' });
    expect(invalid.status).toBe(400);
  });

  it('allows an admin to delete a facility', async () => {
    const user = await registerUser();
    await promoteToAdmin(user.user.id);
    const location = await createLocation();
    const facility = await Facility.create({ locationId: location._id, ...validFacility });

    const response = await request(app)
      .delete(`/api/v1/admin/facilities/${facility._id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(204);
    expect(await Facility.findById(facility._id)).toBeNull();
  });
});
