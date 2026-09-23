// The auth rate limiter is skipped when NODE_ENV=test (see auth.routes.js),
// which is what every other test relies on. This file briefly flips NODE_ENV
// to prove the limiter itself is wired correctly when it's actually active.
const request = require('supertest');

describe('auth rate limiting (limiter active)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    const createApp = require('../src/app');
    app = createApp();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns 429 after exceeding the login attempt limit', async () => {
    // Omit credentials so requests fail fast on validation (400) instead of
    // touching MongoDB - this test only cares whether the limiter, which
    // runs ahead of the controller, eventually kicks in.
    let lastStatus;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app).post('/api/auth/login').send({});
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
