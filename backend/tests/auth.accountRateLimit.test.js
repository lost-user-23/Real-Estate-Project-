const { tokenFromResponse, registerVerified } = require('./helpers/auth');
// Limiters are skipped when NODE_ENV=test (see auth.routes.js); flip it briefly
// to prove the account limiter is wired to password, email and delete.
process.env.MONGODB_DB_NAME = 'homenest_test_auth_account_rl';

const request = require('supertest');
const mongoose = require('mongoose');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');

describe('account endpoint rate limiting (limiter active)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let app;
  let token;

  beforeAll(async () => {
    // Register with the limiter skipped, then turn it on for the assertions.
    const createApp = require('../src/app');
    app = createApp();
    await connectToDatabase();
    const res = await registerVerified(app, { email: 'rl@example.com', password: 'password123' });
    token = tokenFromResponse(res);
    process.env.NODE_ENV = 'development';
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await User.deleteMany({});
    await mongoose.connection.dropDatabase();
    await disconnectFromDatabase();
  });

  // Wrong current password: fails fast with 400 and never changes anything.
  it.each([
    ['post', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'longenough1' }],
    ['patch', '/api/auth/change-email', { currentPassword: 'nope', newEmail: 'x@example.com' }],
    ['delete', '/api/auth/me', { password: 'nope' }],
  ])('%s %s returns 429 after 10 attempts', async (method, path, body) => {
    // The three routes share one budget per user, so each case gets its own user.
    const email = `rl-${method}@example.com`;
    process.env.NODE_ENV = 'test';
    const reg = await registerVerified(app, { email, password: 'password123' });
    process.env.NODE_ENV = 'development';

    let lastStatus;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${tokenFromResponse(reg)}`)
        .send(body);
      lastStatus = res.status;
      if (i < 10) expect(res.status).toBe(400);
    }
    expect(lastStatus).toBe(429);
  });

  it('does not rate limit PATCH /me (no password involved)', async () => {
    let lastStatus;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Name ${i}` });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(200);
  });
});
