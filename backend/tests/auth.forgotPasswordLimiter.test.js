process.env.MONGODB_DB_NAME = 'homenest_test_forgot_limiter';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const config = require('../src/config');

const app = createApp();
const send = () => request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

beforeAll(async () => {
  await connectToDatabase();
});

afterAll(async () => {
  config.env = 'test';
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('forgot-password limiter by environment', () => {
  it('is not applied in development, so local testing is not locked out', async () => {
    config.env = 'development';
    for (let i = 0; i < 7; i += 1) {
      expect((await send()).status).toBe(202);
    }
  });

  it('allows 5 requests per hour in production and then returns 429', async () => {
    config.env = 'production';
    for (let i = 0; i < 5; i += 1) {
      expect((await send()).status).toBe(202);
    }
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many requests, please try again later' } });
  });
});
