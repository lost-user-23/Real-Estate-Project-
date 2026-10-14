process.env.MONGODB_DB_NAME = 'homenest_test_auth_sessions';
const { registerVerified, refreshCookieFromResponse, grantActionCode } = require('./helpers/auth');

const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const config = require('../src/config');
const { hashToken } = require('../src/utils/verificationToken');
const { RESET_TOKEN_AUDIENCE } = require('../src/utils/resetOtp');

const app = createApp();
const creds = { name: 'Session User', email: 'sessions@example.com', password: 'password123' };
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const login = () => request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
const me = (token) => request(app).get('/api/auth/me').set(auth(token));
const logout = (cookie) => request(app).post('/api/auth/logout').set('Cookie', cookie);

// Two logins of one account: two devices.
async function twoDevices() {
  await registerVerified(app, creds);
  const a = await login();
  const b = await login();
  return {
    a: { token: a.body.accessToken, cookie: refreshCookieFromResponse(a) },
    b: { token: b.body.accessToken, cookie: refreshCookieFromResponse(b) },
  };
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('session id', () => {
  it('is in the access token and stays the same across refresh rotations', async () => {
    await registerVerified(app, creds);
    const first = await login();
    const sid = jwt.decode(first.body.accessToken).sid;
    expect(sid).toEqual(expect.any(String));

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookieFromResponse(first));
    expect(refreshed.status).toBe(200);
    expect(jwt.decode(refreshed.body.accessToken).sid).toBe(sid);
    expect(await RefreshToken.countDocuments({ sessionId: sid })).toBe(2);
  });

  it('rejects a validly signed access token that has no session id', async () => {
    await registerVerified(app, creds);
    const user = await User.findOne({ email: creds.email });
    const token = jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: '15m' });
    expect((await me(token)).status).toBe(401);
  });
});

describe('logout', () => {
  it('rejects the old access token afterwards', async () => {
    const { a } = await twoDevices();
    expect((await me(a.token)).status).toBe(200);

    expect((await logout(a.cookie)).status).toBe(200);
    const res = await me(a.token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Not authenticated' } });
  });

  it('leaves the other device logged in', async () => {
    const { a, b } = await twoDevices();
    await logout(a.cookie);

    expect((await me(b.token)).status).toBe(200);
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', b.cookie);
    expect(refreshed.status).toBe(200);
  });

  it('kills a token that was already rotated, not just the latest one', async () => {
    const { a } = await twoDevices();
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', a.cookie);
    const newCookie = refreshCookieFromResponse(rotated);

    await logout(newCookie);
    expect((await me(rotated.body.accessToken)).status).toBe(401);
    expect((await me(a.token)).status).toBe(401);
  });

  it('makes the refresh cookie unusable', async () => {
    const { a } = await twoDevices();
    await logout(a.cookie);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', a.cookie);
    expect(res.status).toBe(401);
  });

  it('works with an expired access token, since it only needs the cookie', async () => {
    const { a } = await twoDevices();
    const sid = jwt.decode(a.token).sid;
    const user = await User.findOne({ email: creds.email });
    const expired = jwt.sign({ id: user._id, role: user.role, sid }, config.jwtSecret, { expiresIn: -10 });

    const res = await logout(a.cookie).set(auth(expired));
    expect(res.status).toBe(200);
    expect(await RefreshToken.countDocuments({ sessionId: sid })).toBe(0);
    expect((await me(a.token)).status).toBe(401);
  });

  it('ends the session from a valid Bearer token when the cookie is missing', async () => {
    const { a, b } = await twoDevices();

    const res = await request(app).post('/api/auth/logout').set(auth(a.token));
    expect(res.status).toBe(200);
    expect((await me(a.token)).status).toBe(401);
    expect((await me(b.token)).status).toBe(200);

    const junk = await request(app).post('/api/auth/logout').set(auth('not-a-token'));
    expect(junk.status).toBe(200);
  });

  it('is idempotent and clears the cookie with the attributes it was set with', async () => {
    const { a } = await twoDevices();
    const first = await logout(a.cookie);
    const second = await logout(a.cookie);
    const none = await request(app).post('/api/auth/logout');

    for (const res of [first, second, none]) {
      expect(res.status).toBe(200);
      const cleared = res.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
      expect(cleared).toMatch(/Path=\/api\/auth/);
      expect(cleared).toMatch(/HttpOnly/);
      expect(cleared).toMatch(/SameSite=Strict/i);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });
});

describe('optionalAuth', () => {
  it('treats a logged-out token as anonymous', async () => {
    const { a } = await twoDevices();
    const report = { listingUrlOrId: 'listing-abc', reason: 'Something else' };

    const before = await request(app).post('/api/v1/reports').set(auth(a.token)).send(report);
    expect(before.body.report.reporterId).not.toBeNull();

    await logout(a.cookie);
    const after = await request(app).post('/api/v1/reports').set(auth(a.token)).send({ ...report, listingUrlOrId: 'other' });
    expect(after.status).toBe(201);
    expect(after.body.report.reporterId).toBeNull();
  });
});

describe('other revocation paths', () => {
  it('logout-all ends every device immediately', async () => {
    const { a, b } = await twoDevices();
    expect((await request(app).post('/api/auth/logout-all').set(auth(a.token))).status).toBe(200);
    expect((await me(a.token)).status).toBe(401);
    expect((await me(b.token)).status).toBe(401);
  });

  it('password reset revokes every session', async () => {
    const { a, b } = await twoDevices();
    const user = await User.findOne({ email: creds.email });
    const jti = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { resetTokenHash: hashToken(jti), resetTokenExpiry: new Date(Date.now() + 60000) }
    );
    const resetToken = jwt.sign({ id: String(user._id), purpose: 'password-reset', jti }, config.jwtSecret, {
      audience: RESET_TOKEN_AUDIENCE,
      expiresIn: '10m',
    });

    const res = await request(app).post('/api/auth/reset-password').send({ resetToken, newPassword: 'newSecure123' });
    expect(res.status).toBe(200);
    expect((await me(a.token)).status).toBe(401);
    expect((await me(b.token)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', b.cookie)).status).toBe(401);
  });

  it('password change keeps only the current device logged in', async () => {
    const { a, b } = await twoDevices();
    const code = await grantActionCode(creds.email, 'change-password');
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(a.token))
      .send({ currentPassword: creds.password, newPassword: 'newSecure123', code });
    expect(res.status).toBe(200);

    expect((await me(res.body.accessToken)).status).toBe(200);
    expect((await me(a.token)).status).toBe(401);
    expect((await me(b.token)).status).toBe(401);
  });
});
