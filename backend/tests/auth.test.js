process.env.MONGODB_DB_NAME = 'homenest_test_auth';
const { tokenFromResponse, refreshCookieFromResponse, registerVerified, tokenFromLink } = require('./helpers/auth');

const request = require('supertest');
const { URL } = require('url');
const { hashToken } = require('../src/utils/verificationToken');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const config = require('../src/config');
const mailer = require('../src/services/mailer.service');

const app = createApp();

const creds = { name: 'Test User', email: 'Test@Example.com', password: 'password123' };

// Registration finishes in the background after the 202 goes out.
const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > end) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const userExists = () => User.exists({ email: 'test@example.com' });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendAccountExistsEmail').mockResolvedValue();
});

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('POST /api/auth/register', () => {
  it('creates an unverified user with no password, emails a register link, and starts no session', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: creds.name, email: creds.email });
    expect(res.status).toBe(202);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toBeUndefined();
    await waitFor(() => mailer.sendVerificationEmail.mock.calls.length === 1);
    expect(mailer.sendVerificationEmail.mock.calls[0][0]).toBe('test@example.com');
    const link = new URL(mailer.sendVerificationEmail.mock.calls[0][1]);
    expect(link.searchParams.get('flow')).toBe('register');

    const user = await User.findOne({ email: 'test@example.com' }).select(
      '+passwordHash +verifyTokenHash +verifyTokenExpiry +verifyTokenPurpose +verifyTokenSentAt'
    );
    expect(user.emailVerified).toBe(false);
    expect(user.role).toBe('user');
    expect(user.name).toBe('Test User');
    expect(user.passwordHash).toBeUndefined();
    expect(user.verifyTokenPurpose).toBe('register');
    expect(user.verifyTokenSentAt).toBeInstanceOf(Date);
    expect(user.verifyTokenExpiry.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    // Only the hash is stored; the raw token exists only in the emailed link.
    const rawToken = tokenFromLink(link.toString());
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(user.verifyTokenHash).not.toBe(rawToken);
    expect(user.verifyTokenHash).toBe(hashToken(rawToken));
  });

  it('ignores a password sent by the client: nothing is stored and it cannot log in', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(202);
    await waitFor(userExists);
    expect((await User.findOne({ email: 'test@example.com' }).select('+passwordHash')).passwordHash).toBeUndefined();
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(401);
    expect(login.body.error.message).toBe('Invalid credentials');
  });

  it('answers an already-registered email exactly like a new one', async () => {
    const first = await request(app).post('/api/auth/register').send(creds);
    await waitFor(userExists);
    await User.updateOne({ email: 'test@example.com' }, { emailVerified: true });
    const second = await request(app).post('/api/auth/register').send(creds);
    const upper = await request(app)
      .post('/api/auth/register')
      .send({ ...creds, email: creds.email.toUpperCase() });

    for (const res of [second, upper]) {
      expect(res.status).toBe(first.status);
      expect(res.body).toEqual(first.body);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    // The existing owner gets a notice, not a second link, and nothing changed.
    // Two attempts within a minute produce one notice (per-account cooldown).
    await waitFor(() => mailer.sendAccountExistsEmail.mock.calls.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mailer.sendAccountExistsEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(await User.countDocuments({ email: 'test@example.com' })).toBe(1);
  });

  it('answers before looking the address up, so timing cannot reveal which branch ran', async () => {
    // A lookup that never finishes must not delay (or change) the response.
    jest.spyOn(User, 'findOne').mockReturnValue(new Promise(() => {}));
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: expect.any(String) });
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('re-registering an unverified address keeps the original name and rotates the link', async () => {
    await request(app).post('/api/auth/register').send({ name: 'First Name', email: creds.email });
    await waitFor(() => mailer.sendVerificationEmail.mock.calls.length === 1);
    // Step past the one-minute resend cooldown.
    await User.updateOne({ email: 'test@example.com' }, { verifyTokenSentAt: new Date(Date.now() - 61 * 1000) });

    await request(app).post('/api/auth/register').send({ name: 'Second Name', email: creds.email, password: 'attacker-password' });
    await waitFor(() => mailer.sendVerificationEmail.mock.calls.length === 2);
    const [first, second] = mailer.sendVerificationEmail.mock.calls.map((call) => tokenFromLink(call[1]));
    expect(second).not.toBe(first);
    const user = await User.findOne({ email: 'test@example.com' }).select('+passwordHash +verifyTokenHash');
    expect(user.name).toBe('First Name');
    expect(user.passwordHash).toBeUndefined();
    expect(user.verifyTokenHash).toBe(hashToken(second));
  });

  it('rolls the account back when the email cannot be sent, leaving the address free', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mailer.sendVerificationEmail.mockRejectedValueOnce(new Error('smtp down: secret detail'));
    const res = await request(app).post('/api/auth/register').send(creds);
    // The answer went out before the mail was attempted, so it is the generic one.
    expect(res.status).toBe(202);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    await waitFor(() => errorSpy.mock.calls.length > 0);
    expect(await User.countDocuments({ email: 'test@example.com' })).toBe(0);
    // The address is still free to register again.
    const retry = await request(app).post('/api/auth/register').send(creds);
    expect(retry.status).toBe(202);
    await waitFor(userExists);
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it('does not require a password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(202);
  });

  it('rejects missing email', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('ignores a client-supplied role (no privilege escalation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...creds, role: 'admin' });
    expect(res.status).toBe(202);
    await waitFor(userExists);
    expect((await User.findOne({ email: 'test@example.com' })).role).toBe('user');
  });

  it('accepts a short password because it ignores the password entirely', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(202);
  });

  it('rejects a malformed email address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects an over-long or non-text name', async () => {
    const long = await request(app).post('/api/auth/register').send({ email: 'n@example.com', name: 'x'.repeat(101) });
    const notText = await request(app).post('/api/auth/register').send({ email: 'n@example.com', name: 42 });
    expect(long.status).toBe(400);
    expect(notText.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerVerified(app, creds);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(tokenFromResponse(res)).toEqual(expect.any(String));
    expect(jwt.decode(res.body.accessToken).exp - jwt.decode(res.body.accessToken).iat).toBe(15 * 60);
    expect(res.headers['set-cookie'].some((c) => c.startsWith('token='))).toBe(false);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('Max-Age=604800');
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  it('marks the cookie Secure in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let res;
    try {
      res = await request(app)
        .post('/api/auth/login')
        .send({ email: creds.email, password: creds.password });
    } finally {
      process.env.NODE_ENV = original;
    }
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/;\s*Secure/i);
  });

  it('is case-insensitive on email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email.toUpperCase(), password: creds.password });
    expect(res.status).toBe(200);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email without a distinguishable message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('rejects missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: creds.email });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects when no token is supplied', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('ignores the access token when it is sent as a cookie', async () => {
    const reg = await registerVerified(app, creds);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${tokenFromResponse(reg)}`);
    expect(res.status).toBe(401);
  });

  it('rejects an Authorization header without the Bearer scheme', async () => {
    const reg = await registerVerified(app, creds);
    const res = await request(app).get('/api/auth/me').set('Authorization', tokenFromResponse(reg));
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const reg = await registerVerified(app, creds);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFromResponse(reg)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a valid token whose user was since deleted', async () => {
    const reg = await registerVerified(app, creds);
    await User.deleteMany({});
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFromResponse(reg)}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logged out' });
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
    expect(res.headers['set-cookie'][0]).toContain('Path=/api/auth');
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(res.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    expect(res.headers['set-cookie'][0]).not.toMatch(/Max-Age/i);
  });

  it('ends the session: the cookie jar can no longer refresh after logout', async () => {
    const agent = request.agent(app);
    await registerVerified(app, creds);
    await agent.post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect((await agent.post('/api/auth/refresh')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('Origin check on state-changing requests', () => {
  const body = { email: 'nobody@example.com', password: 'whatever' };

  it('rejects a POST from a foreign Origin with 403', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send(body);
    expect(res.status).toBe(403);
  });

  it('allows the configured origin, with or without a trailing slash', async () => {
    const plain = await request(app).post('/api/auth/login').set('Origin', config.corsOrigins[0]).send(body);
    const slash = await request(app).post('/api/auth/login').set('Origin', `${config.corsOrigins[0]}/`).send(body);
    expect(plain.status).toBe(401);
    expect(slash.status).toBe(401);
  });

  it('allows requests with no Origin header', async () => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(401);
  });

  it('does not check safe methods', async () => {
    const res = await request(app).get('/api/auth/me').set('Origin', 'https://evil.example');
    expect(res.status).toBe(401);
  });
});

describe('unexpected errors in register and login', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('register logs a background database failure and still answers generically', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('db exploded: secret detail'));
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(202);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    await waitFor(() => errorSpy.mock.calls.length > 0);
    expect(String(errorSpy.mock.calls[0])).toContain('db exploded');
    expect(await User.countDocuments({})).toBe(0);
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['an Error', () => new Error('background boom')],
    ['a non-Error value', () => undefined],
  ])('a background failure (%s) after the response is logged, never an unhandled rejection', async (_, makeFailure) => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      jest.spyOn(User, 'findOne').mockRejectedValueOnce(makeFailure());
      const res = await request(app).post('/api/auth/register').send(creds);
      expect(res.status).toBe(202);
      await waitFor(() => errorSpy.mock.calls.length > 0);
      // Give an unhandled rejection, if any, time to surface.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(unhandled).not.toHaveBeenCalled();
      expect(String(errorSpy.mock.calls[0][0])).toContain('[auth] registration');

      // The process (and the app) are still serving requests.
      const next = await request(app).post('/api/auth/register').send({ email: 'after@example.com' });
      expect(next.status).toBe(202);
      await waitFor(() => User.exists({ email: 'after@example.com' }));
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('login passes a database failure to the error handler as a generic 500', async () => {
    jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
      throw new Error('db exploded: secret detail');
    });
    const res = await request(app).post('/api/auth/login').send(creds);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('register answers a duplicate-key race with the same generic response', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const createSpy = jest.spyOn(User, 'create').mockRejectedValueOnce(duplicate);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(202);
    expect(res.body.message).toEqual(expect.any(String));
    await waitFor(() => createSpy.mock.calls.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The losing insert is not an error and sends nothing (the winner mails).
    expect(errorSpy).not.toHaveBeenCalled();
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('refresh tokens', () => {
  const refresh = (cookie) => request(app).post('/api/auth/refresh').set('Cookie', cookie);

  it('stores only a hash of the refresh token', async () => {
    const reg = await registerVerified(app, creds);
    const raw = refreshCookieFromResponse(reg).slice('refreshToken='.length);
    expect(raw).toHaveLength(128);
    expect(await RefreshToken.exists({ tokenHash: raw })).toBeNull();
    expect(await RefreshToken.exists({ tokenHash: hashToken(raw) })).not.toBeNull();
  });

  it('rejects a refresh without a cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rotates the token and returns a working access token', async () => {
    const reg = await registerVerified(app, creds);
    const first = refreshCookieFromResponse(reg);
    const res = await refresh(first);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
    const second = refreshCookieFromResponse(res);
    expect(second).not.toBe(first);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect((await refresh(second)).status).toBe(200);
  });

  it('revokes every session when a spent token is replayed', async () => {
    const reg = await registerVerified(app, creds);
    const other = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const stolen = refreshCookieFromResponse(reg);
    const rotated = await refresh(stolen);
    expect(rotated.status).toBe(200);

    // Outside the grace window for races between tabs.
    await RefreshToken.updateMany({ usedAt: { $ne: null } }, { $set: { usedAt: new Date(Date.now() - 60 * 1000) } });

    expect((await refresh(stolen)).status).toBe(401);
    expect(await RefreshToken.countDocuments({})).toBe(0);
    expect((await refresh(refreshCookieFromResponse(rotated))).status).toBe(401);
    expect((await refresh(refreshCookieFromResponse(other))).status).toBe(401);
  });

  it('does not revoke sessions for a replay inside the grace window', async () => {
    const reg = await registerVerified(app, creds);
    const first = refreshCookieFromResponse(reg);
    const rotated = await refresh(first);
    expect((await refresh(first)).status).toBe(401);
    expect((await refresh(refreshCookieFromResponse(rotated))).status).toBe(200);
  });

  it('rejects an expired refresh token', async () => {
    const reg = await registerVerified(app, creds);
    await RefreshToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await refresh(refreshCookieFromResponse(reg))).status).toBe(401);
  });

  it('logout deletes the record, so the old cookie no longer refreshes', async () => {
    const reg = await registerVerified(app, creds);
    const cookie = refreshCookieFromResponse(reg);
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(await RefreshToken.countDocuments({})).toBe(0);
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('logout-all revokes the sessions on every device', async () => {
    const reg = await registerVerified(app, creds);
    const other = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${tokenFromResponse(reg)}`);
    expect(res.status).toBe(200);
    expect((await refresh(refreshCookieFromResponse(reg))).status).toBe(401);
    expect((await refresh(refreshCookieFromResponse(other))).status).toBe(401);
  });

  it('logout-all requires an access token', async () => {
    expect((await request(app).post('/api/auth/logout-all')).status).toBe(401);
  });
});
