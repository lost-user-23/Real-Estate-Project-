process.env.MONGODB_DB_NAME = 'homenest_test_reports';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const config = require('../src/config');
const User = require('../src/models/User');
const Report = require('../src/models/Report');

const app = createApp();

async function registerUser() {
  const email = `report-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Report Tester', email, password: 'password123' });
  return { token: response.body.token, user: response.body.user };
}

async function promoteToAdmin(userId) {
  await User.findByIdAndUpdate(userId, { role: 'admin' });
}

async function createAdmin() {
  const credentials = await registerUser();
  await promoteToAdmin(credentials.user.id);
  return credentials.token;
}

async function createReport(overrides = {}) {
  return Report.create({
    listingUrlOrId: 'listing-123',
    reason: 'Fraudulent listing',
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Report.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public reports', () => {
  it('creates a report without authentication and leaves reporterId null', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .send({ listingUrlOrId: 'listing-abc', reason: 'Spam listing' });

    expect(response.status).toBe(201);
    expect(response.body.report.status).toBe('open');
    expect(response.body.report.reporterId).toBeNull();
  });

  it('attaches reporterId when a valid token is provided', async () => {
    const { token, user } = await registerUser();
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ listingUrlOrId: 'listing-abc', reason: 'Spam listing' });

    expect(response.status).toBe(201);
    expect(response.body.report.reporterId).toBe(user.id);
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-real-token'],
    ['expired', () => jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, config.jwtSecret, { expiresIn: -10 })],
  ])('never fails the request when the token is %s', async (_label, tokenOrFactory) => {
    const token = typeof tokenOrFactory === 'function' ? tokenOrFactory() : tokenOrFactory;
    const req = request(app).post('/api/v1/reports');
    if (token) req.set('Authorization', `Bearer ${token}`);

    const response = await req.send({ listingUrlOrId: 'listing-abc', reason: 'Spam listing' });

    expect(response.status).toBe(201);
    expect(response.body.report.reporterId).toBeNull();
  });

  it('rejects a missing reason or listingUrlOrId', async () => {
    const response = await request(app).post('/api/v1/reports').send({ reason: '' });
    expect(response.status).toBe(400);
  });
});

describe('admin reports', () => {
  it('requires admin authentication', async () => {
    const response = await request(app).get('/api/v1/admin/reports');
    expect(response.status).toBe(401);
  });

  it('lists reports with pagination metadata', async () => {
    const token = await createAdmin();
    await createReport();
    await createReport({ listingUrlOrId: 'listing-456' });

    const response = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(2);
    expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('shows a report submitted through the public endpoint', async () => {
    const token = await createAdmin();
    const submitted = await request(app)
      .post('/api/v1/reports')
      .send({ listingUrlOrId: '/property/sunny-flat', reason: 'Suspected duplicate listing', details: 'Same photos' });
    expect(submitted.status).toBe(201);

    const response = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0]).toMatchObject({
      listingUrlOrId: '/property/sunny-flat',
      reason: 'Suspected duplicate listing',
      details: 'Same photos',
      status: 'open',
    });
  });

  it('updates only the status field', async () => {
    const token = await createAdmin();
    const report = await createReport();
    const headers = { Authorization: `Bearer ${token}` };

    const update = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set(headers)
      .send({ status: 'resolved' });

    expect(update.status).toBe(200);
    expect(update.body.report.status).toBe('resolved');
  });

  it('rejects a body containing fields other than status', async () => {
    const token = await createAdmin();
    const report = await createReport();

    const response = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', reason: 'tampered' });

    expect(response.status).toBe(400);
  });

  it('rejects an invalid status value', async () => {
    const token = await createAdmin();
    const report = await createReport();

    const response = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not-a-status' });

    expect(response.status).toBe(400);
  });
});
