const request = require('supertest');
const express = require('express');
const createApp = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');
const { createGlobalRateLimiter } = require('../src/middleware/globalRateLimiter');

describe('invalid JSON body', () => {
  it('returns 400 with a fixed message instead of the parser text', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid JSON body' } });
  });
});

describe('security headers', () => {
  it('sets helmet defaults', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('global rate limit (limiter active)', () => {
  // A throwaway app with a low limit and the skip rule turned off, so no
  // test-only code path exists in the real limiter.
  function createLimitedApp(limit) {
    const limitedApp = express();
    limitedApp.use(createGlobalRateLimiter({ limit, skip: () => false }));
    limitedApp.get('/ping', (req, res) => res.json({ ok: true }));
    limitedApp.use(errorHandler);
    return limitedApp;
  }

  it('returns 429 in the nested error shape with a Retry-After header', async () => {
    const limitedApp = createLimitedApp(2);
    const send = () => request(limitedApp).get('/ping');

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    const limited = await send();

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many requests. Please try again later.' } });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['ratelimit-limit'] ?? limited.headers.ratelimit).toBeDefined();
    expect(limited.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('does not count /health in the default limiter', async () => {
    const limiter = createGlobalRateLimiter({ limit: 1 });
    const limitedApp = express();
    process.env.NODE_ENV = 'development';
    try {
      limitedApp.use(limiter);
      limitedApp.get('/health', (req, res) => res.json({ ok: true }));
      limitedApp.use(errorHandler);
      await request(limitedApp).get('/health');
      expect((await request(limitedApp).get('/health')).status).toBe(200);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });
});
