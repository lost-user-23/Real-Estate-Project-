process.env.MONGODB_DB_NAME = 'homenest_test_auth_verification';
const { tokenFromResponse, registerVerified, tokenFromLink } = require('./helpers/auth');
const { verificationHelpers } = require('./helpers/verification');

const request = require('supertest');
const bcrypt = require('bcrypt');
const { URL } = require('url');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const mailer = require('../src/services/mailer.service');
const { hashToken } = require('../src/utils/verificationToken');
const { hashPassword } = require('../src/services/auth.service');
const { backfillEmailVerified } = require('../scripts/backfill-email-verified');

const app = createApp();

const creds = { name: 'Verify User', email: 'verify@example.com', password: 'password123' };
const auth = (token) => ({ Cookie: `token=${token}` });
const helpers = verificationHelpers(app, { mailer, User, password: creds.password });
const { sleep, waitFor, lastLinkTo, endCooldown, verify } = helpers;
const registerUnverified = (overrides = {}) =>
  helpers.registerUnverified({ name: creds.name, email: creds.email, ...overrides });

// An unverified account that already has a password: the shape of accounts
// created before this design (or promoted by admin:create). New sign-ups can
// no longer produce it, but the soft gate still has to hold for it.
async function legacyUnverified(email) {
  await User.create({ email, name: 'Legacy', passwordHash: await hashPassword(creds.password), emailVerified: false });
  const login = await request(app).post('/api/auth/login').send({ email, password: creds.password });
  expect(login.status).toBe(200);
  expect(login.body.user.emailVerified).toBe(false);
  return tokenFromResponse(login);
}

beforeAll(async () => {
  await connectToDatabase();
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendAccountExistsEmail').mockResolvedValue();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('POST /api/auth/verify-email (registration)', () => {
  it('verifies the account, and the link then stops working', async () => {
    const { link } = await registerUnverified();
    expect(new URL(link).searchParams.get('flow')).toBe('register');

    const res = await verify(link);
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.email).toBe(creds.email.toLowerCase());

    const user = await User.findOne({ email: creds.email.toLowerCase() }).select(
      '+passwordHash +verifyTokenHash +verifyTokenExpiry +verifyTokenPurpose'
    );
    expect(user.emailVerified).toBe(true);
    expect(await bcrypt.compare(creds.password, user.passwordHash)).toBe(true);
    expect(user.verifyTokenHash).toBeUndefined();
    expect(user.verifyTokenExpiry).toBeUndefined();
    expect(user.verifyTokenPurpose).toBeUndefined();
  });

  it('rejects a reused token with the generic error', async () => {
    const { link } = await registerUnverified();
    expect((await verify(link)).status).toBe(200);

    const again = await verify(link, 'a-different-password');
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ error: { message: 'This verification link is invalid or has expired' } });
  });

  it('rejects an expired token with the same generic error as an unknown one', async () => {
    const { link } = await registerUnverified();
    const token = tokenFromLink(link);
    await User.updateOne({ email: creds.email.toLowerCase() }, { verifyTokenExpiry: new Date(Date.now() - 1000) });

    const expired = await request(app).post('/api/auth/verify-email').send({ token, password: creds.password });
    const unknown = await request(app).post('/api/auth/verify-email').send({ token: 'f'.repeat(64), password: creds.password });
    expect(expired.status).toBe(400);
    expect(expired.body).toEqual(unknown.body);
    expect((await User.findOne({ email: creds.email.toLowerCase() })).emailVerified).toBe(false);
  });

  it.each([[{}], [{ token: 42 }], [{ token: '' }], [{ token: 'x'.repeat(500) }]])(
    'rejects a missing or malformed token: %j',
    async (body) => {
      const res = await request(app).post('/api/auth/verify-email').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('This verification link is invalid or has expired');
    }
  );

  it('only matches the stored hash, never the hash itself used as a token', async () => {
    const { link } = await registerUnverified();
    const hash = hashToken(tokenFromLink(link));
    const res = await request(app).post('/api/auth/verify-email').send({ token: hash, password: creds.password });
    expect(res.status).toBe(400);
  });

  it('logs the user in: the response sets a working session cookie', async () => {
    const { link } = await registerUnverified();
    const res = await verify(link);
    expect(res.status).toBe(200);
    expect(res.body.flow).toBe('register');
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cookie).toMatch(/HttpOnly/i);

    const me = await request(app).get('/api/auth/me').set(auth(tokenFromResponse(res)));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email.toLowerCase());
    expect(me.body.user.emailVerified).toBe(true);
  });

  it.each([
    [{}, 'missing'],
    [{ password: 'short' }, 'too short'],
    [{ password: 42 }, 'not text'],
  ])('rejects a %j (%s) password with 400 and leaves the link usable', async (extra) => {
    const { link } = await registerUnverified();
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFromLink(link), ...extra });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Password must be at least 8 characters');
    expect(res.headers['set-cookie']).toBeUndefined();
    const user = await User.findOne({ email: creds.email.toLowerCase() }).select('+passwordHash');
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).toBeUndefined();

    // Same link, valid password: it still works.
    expect((await verify(link)).status).toBe(200);
  });
});

describe('login before verification', () => {
  it('gives the same 401 as an unknown email, and still runs one bcrypt compare', async () => {
    await registerUnverified();
    const compareSpy = jest.spyOn(bcrypt, 'compare');

    const unverified = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockClear();
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: creds.password });
    expect(compareSpy).toHaveBeenCalledTimes(1);

    expect(unverified.status).toBe(401);
    expect(unverified.body).toEqual(unknown.body);
    expect(unverified.body).toEqual({ error: { message: 'Invalid credentials' } });
    expect(unverified.headers['set-cookie']).toBeUndefined();
  });
});

describe('pre-account hijacking', () => {
  it("an attacker who registers the victim's address first never controls the password", async () => {
    // The attacker registers victim@x and even sends a password (ignored).
    const { link } = await registerUnverified({ email: 'victim@example.com', password: 'attacker-password' });
    const attackerEarly = await request(app)
      .post('/api/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker-password' });
    expect(attackerEarly.status).toBe(401);

    // The link went to the victim's inbox; the victim sets their own password.
    const res = await verify(link, 'victim-own-password');
    expect(res.status).toBe(200);

    const attacker = await request(app)
      .post('/api/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker-password' });
    expect(attacker.status).toBe(401);
    const victim = await request(app)
      .post('/api/auth/login')
      .send({ email: 'victim@example.com', password: 'victim-own-password' });
    expect(victim.status).toBe(200);
  });
});

describe('token fields are never exposed', () => {
  it('are hidden from default queries and from every auth response', async () => {
    const { link } = await registerUnverified();
    const plain = await User.findOne({ email: creds.email.toLowerCase() });
    expect(plain.verifyTokenHash).toBeUndefined();
    expect(plain.verifyTokenExpiry).toBeUndefined();
    expect(plain.pendingEmail).toBeUndefined();

    const verified = await verify(link);
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const me = await request(app).get('/api/auth/me').set(auth(tokenFromResponse(login)));
    for (const body of [verified.body, login.body, me.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toMatch(/verifyToken|pendingEmail|passwordHash/);
    }
  });
});

describe('email change confirmation', () => {
  it('stores the request in pendingEmail only and refuses to let it claim a used address', async () => {
    const owner = await registerVerified(app, { ...creds, email: 'owner@example.com' });
    await registerVerified(app, { ...creds, email: 'other@example.com' });
    const token = tokenFromResponse(owner);
    mailer.sendVerificationEmail.mockClear();

    const res = await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: 'other@example.com' });
    expect(res.status).toBe(202);
    const user = await User.findOne({ email: 'owner@example.com' }).select('+pendingEmail');
    expect(user.pendingEmail).toBeUndefined();
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mailer.sendAccountExistsEmail).toHaveBeenCalledWith('other@example.com');
  });

  it('a later link replaces the earlier one (only the newest confirms)', async () => {
    const owner = await registerVerified(app, { ...creds, email: 'owner@example.com' });
    const token = tokenFromResponse(owner);
    const change = (newEmail) =>
      request(app).patch('/api/auth/change-email').set(auth(token)).send({ currentPassword: creds.password, newEmail });

    await change('first@example.com');
    const firstLink = lastLinkTo('first@example.com');
    expect(new URL(firstLink).searchParams.get('flow')).toBe('email-change');
    await change('second@example.com');
    const secondLink = lastLinkTo('second@example.com');

    expect((await request(app).post('/api/auth/verify-email').send({ token: tokenFromLink(firstLink) })).status).toBe(400);
    const ok = await request(app).post('/api/auth/verify-email').send({ token: tokenFromLink(secondLink) });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe('second@example.com');
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('sends a fresh link for an unverified account and invalidates the old one', async () => {
    const { link } = await registerUnverified();
    await endCooldown(creds.email.toLowerCase());
    mailer.sendVerificationEmail.mockClear();

    const res = await request(app).post('/api/auth/resend-verification').send({ email: creds.email });
    expect(res.status).toBe(202);
    await waitFor(() => mailer.sendVerificationEmail.mock.calls.length === 1);
    const newLink = mailer.sendVerificationEmail.mock.calls[0][1];
    expect(newLink).not.toBe(link);

    expect((await verify(link)).status).toBe(400);
    expect((await verify(newLink)).status).toBe(200);
  });

  it('answers identically for unknown and already-verified addresses and sends nothing', async () => {
    await registerVerified(app, { ...creds, email: 'done@example.com' });
    mailer.sendVerificationEmail.mockClear();

    const known = await request(app).post('/api/auth/resend-verification').send({ email: 'done@example.com' });
    const unknown = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@example.com' });
    const garbage = await request(app).post('/api/auth/resend-verification').send({ email: 42 });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(garbage.body).toEqual(known.body);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('pre-verification sessions and links', () => {
  it('setting the password on verify ends sessions that predate it (password-holding unverified account)', async () => {
    const earlyToken = await legacyUnverified(creds.email);
    expect((await request(app).get('/api/auth/me').set(auth(earlyToken))).status).toBe(200);
    const { link } = await registerUnverified();
    // Token iat has one-second resolution; make sure verification lands later.
    await sleep(1100);

    const res = await verify(link, 'a-brand-new-password');
    expect(res.status).toBe(200);
    expect(tokenFromResponse(res)).toEqual(expect.any(String));

    expect((await request(app).get('/api/auth/me').set(auth(earlyToken))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(tokenFromResponse(res)))).status).toBe(200);
  });

  it('does not revoke sessions when an email change is confirmed', async () => {
    const owner = await registerVerified(app, { ...creds, email: 'keep@example.com' });
    const token = tokenFromResponse(owner);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: 'kept@example.com' });
    // Email-change links need no password.
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFromLink(lastLinkTo('kept@example.com')) });
    expect(res.status).toBe(200);
    expect(res.body.flow).toBe('email-change');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
  });

  it('re-registering an unverified address rotates the token: only the newest link works', async () => {
    const { link: firstLink } = await registerUnverified();
    await endCooldown(creds.email.toLowerCase());
    const { link: secondLink } = await registerUnverified();
    expect(secondLink).not.toBe(firstLink);

    const stale = await verify(firstLink);
    expect(stale.status).toBe(400);
    expect(stale.body).toEqual({ error: { message: 'This verification link is invalid or has expired' } });
    const fresh = await verify(secondLink);
    expect(fresh.status).toBe(200);
  });
});

describe('pendingEmail is never exposed', () => {
  it('stays out of every auth response while a change is pending and after it is confirmed', async () => {
    const owner = await registerVerified(app, { ...creds, email: 'secret-owner@example.com' });
    let token = tokenFromResponse(owner);
    const pending = 'secret-pending@example.com';
    const bodies = [];
    const record = (res) => {
      bodies.push(res.body);
      return res;
    };

    record(
      await request(app)
        .patch('/api/auth/change-email')
        .set(auth(token))
        .send({ currentPassword: creds.password, newEmail: pending })
    );
    expect((await User.findOne({ email: 'secret-owner@example.com' }).select('+pendingEmail')).pendingEmail).toBe(pending);

    record(await request(app).get('/api/auth/me').set(auth(token)));
    record(await request(app).patch('/api/auth/me').set(auth(token)).send({ name: 'Renamed' }));
    record(await request(app).post('/api/auth/login').send({ email: 'secret-owner@example.com', password: creds.password }));
    const changed = record(
      await request(app)
        .post('/api/auth/change-password')
        .set(auth(token))
        .send({ currentPassword: creds.password, newPassword: 'another-password' })
    );
    token = tokenFromResponse(changed);
    record(await request(app).post('/api/auth/resend-verification').send({ email: pending }));
    await waitFor(() => Boolean(lastLinkTo(pending)));
    record(await request(app).post('/api/auth/verify-email').send({ token: tokenFromLink(lastLinkTo(pending)) }));
    record(await request(app).get('/api/auth/me').set(auth(token)));

    expect(bodies).toHaveLength(8);
    for (const body of bodies) {
      expect(JSON.stringify(body)).not.toMatch(/pendingEmail|verifyToken|passwordHash/);
    }
    // While pending, nothing in a response names the requested address either.
    for (const body of bodies.slice(0, 6)) {
      expect(JSON.stringify(body)).not.toContain(pending);
    }
  });
});

describe('soft gate for unverified accounts', () => {
  // New sign-ups cannot log in before verifying any more; the gate is defence
  // in depth for unverified accounts that do have a password.
  const loggedInUnverified = () => legacyUnverified('gate@example.com');

  it('lets them log in and read, but blocks posting, uploading, saving and contact reveal', async () => {
    const token = await loggedInUnverified();
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
    expect((await request(app).get('/api/v1/properties/mine').set(auth(token))).status).toBe(200);

    const id = new mongoose.Types.ObjectId();
    const blocked = [
      request(app).post('/api/v1/properties').set(auth(token)).send({}),
      request(app).post('/api/v1/uploads/image').set(auth(token)),
      request(app).post(`/api/v1/saved-properties/${id}`).set(auth(token)),
      request(app).get(`/api/v1/properties/${id}/contact`).set(auth(token)),
    ];
    for (const res of await Promise.all(blocked)) {
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/verify your email/i);
    }
  });

  it('lifts the gate once verified (the verify response signs the user in)', async () => {
    const { link } = await registerUnverified({ email: 'gate@example.com' });
    const verified = await verify(link);
    expect(verified.status).toBe(200);

    const res = await request(app).post('/api/v1/properties').set(auth(tokenFromResponse(verified))).send({});
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

describe('backfill:email-verified', () => {
  it('verifies legacy users, leaves genuinely unverified ones alone, and is idempotent', async () => {
    await User.collection.insertOne({ email: 'legacy@example.com', passwordHash: 'x', role: 'user' });
    await registerUnverified({ email: 'fresh@example.com' });

    const first = await backfillEmailVerified(User);
    expect(first.updated).toBe(1);
    const second = await backfillEmailVerified(User);
    expect(second.updated).toBe(0);

    expect((await User.findOne({ email: 'legacy@example.com' })).emailVerified).toBe(true);
    expect((await User.findOne({ email: 'fresh@example.com' })).emailVerified).toBe(false);
  });
});
