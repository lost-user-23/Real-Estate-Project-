process.env.MONGODB_DB_NAME = 'homenest_test_auth_resend_rate_limit';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');

// Own file: the resend limiter keeps its count per test file (fresh app
// module), so no other resend test can eat into this budget.
const app = createApp();

beforeAll(async () => {
  await connectToDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('POST /api/auth/resend-verification rate limit', () => {
  it('allows 5 requests per hour per client, then answers 429', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@example.com' });
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.error.message).toBe('Too many requests, please try again later');
      }
    }
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });
});
