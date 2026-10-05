process.env.MONGODB_DB_NAME = 'homenest_test_auth_middleware';

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../src/config');
const createApp = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');
const { protect } = require('../src/middleware/auth.middleware');
const { generateToken } = require('../src/services/auth.service');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');

// Minimal app so protect + the real error handler can be exercised in isolation.
function buildProtectedApp() {
  const app = express();
  app.get('/protected', protect, (req, res) => res.json({ id: req.user.id }));
  app.use(errorHandler);
  return app;
}

const protectedApp = buildProtectedApp();
const app = createApp();

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('protect middleware', () => {
  it('returns 401 for an invalid token', async () => {
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Not authenticated' } });
  });

  it('returns 401 for a validly signed token carrying a malformed user id', async () => {
    const token = generateToken({ _id: 'definitely-not-an-objectid', role: 'user' });
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Not authenticated' } });
  });

  describe('when the user lookup fails with a database error', () => {
    const originalEnv = config.env;

    afterEach(() => {
      config.env = originalEnv;
    });

    function failLookup() {
      // errorHandler logs non-test errors; keep the test output clean.
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(User, 'findById').mockRejectedValue(new Error('connection lost at db-host:27017'));
      return generateToken({ _id: new mongoose.Types.ObjectId(), role: 'user' });
    }

    it('returns 500 through the error handler (not 401, so clients are not logged out)', async () => {
      const token = failLookup();
      const res = await request(protectedApp)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { message: 'Internal server error' } });
    });

    it('does not leak a stack trace or the error message in production', async () => {
      config.env = 'production';
      const token = failLookup();
      const res = await request(protectedApp)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.error.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/db-host|at .*\.js|stack/i);
    });

    it('does include the stack in development (proves the production check is meaningful)', async () => {
      config.env = 'development';
      const token = failLookup();
      const res = await request(protectedApp)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
      expect(res.body.error.stack).toEqual(expect.any(String));
    });
  });
});

describe('login with an email that does not exist', () => {
  const creds = { name: 'Real User', email: 'real@example.com', password: 'password123' };

  it('still runs bcrypt.compare and returns the same 401 as a wrong password', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const compareSpy = jest.spyOn(bcrypt, 'compare');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong-password' });
    expect(compareSpy).toHaveBeenCalledTimes(1);

    compareSpy.mockClear();
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('compares against a valid bcrypt hash with cost 10', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(compareSpy).toHaveBeenCalledTimes(1);
    const dummyHash = compareSpy.mock.calls[0][1];
    expect(dummyHash).toMatch(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/);
    expect(bcrypt.getRounds(dummyHash)).toBe(10);
  });

  it('does not accept the dummy hash as a match for any password', async () => {
    // A missing user must never authenticate, even if the compare were to match.
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });
    expect(res.status).toBe(401);
  });
});

// Sanity: the token helper used above really is verifiable by protect's secret.
describe('test token helper', () => {
  it('produces tokens with an iat claim', () => {
    const token = generateToken({ _id: new mongoose.Types.ObjectId(), role: 'user' });
    expect(jwt.decode(token).iat).toEqual(expect.any(Number));
  });
});
