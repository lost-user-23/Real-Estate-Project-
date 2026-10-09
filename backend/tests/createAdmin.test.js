process.env.MONGODB_DB_NAME = 'homenest_test_create_admin';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
const { tokenFromResponse } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const { createOrPromoteAdmin } = require('../scripts/create-admin');

const app = createApp();

const admin = { name: 'Script Admin', email: 'script-admin@example.com', password: 'password123' };
const listing = {
  title: 'Admin Listing',
  intent: 'rent',
  propertyType: 'apartment',
  areaSqft: 950,
  priceInRupees: 25000,
  city: 'Bengaluru',
  locality: 'Koramangala',
  images: Array.from({ length: 5 }, (_, index) => ({
    url: `https://res.cloudinary.com/demo/image/upload/v1/property-images/${index}.jpg`,
  })),
};

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${tokenFromResponse(res)}` };
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('npm run admin:create', () => {
  it('creates a verified admin who can add a listing', async () => {
    expect(await createOrPromoteAdmin(admin)).toBe('Admin User created');
    const user = await User.findOne({ email: admin.email });
    expect(user.role).toBe('admin');
    expect(user.emailVerified).toBe(true);

    const res = await request(app).post('/api/v1/properties').set(await login(admin.email, admin.password)).send(listing);
    expect(res.status).toBe(201);
  });

  it('promotes an unverified account without verifying it, and says so', async () => {
    // An account that registered but never verified: no password yet.
    await request(app).post('/api/auth/register').send(admin);
    const end = Date.now() + 3000;
    while (!(await User.exists({ email: admin.email })) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const outcome = await createOrPromoteAdmin(admin);
    expect(outcome).toMatch(/^User promoted to admin/);
    expect(outcome).toMatch(/NOT verified/);
    const user = await User.findOne({ email: admin.email });
    expect(user.role).toBe('admin');
    expect(user.emailVerified).toBe(false);

    // It has no password until the verification link is used, so it cannot
    // even log in, let alone post.
    const attempt = await request(app).post('/api/auth/login').send({ email: admin.email, password: admin.password });
    expect(attempt.status).toBe(401);
  });

  it('is a no-op for an existing verified admin', async () => {
    await createOrPromoteAdmin(admin);
    expect(await createOrPromoteAdmin(admin)).toBe('Already an admin');
    expect(await User.countDocuments({ email: admin.email })).toBe(1);
  });
});
