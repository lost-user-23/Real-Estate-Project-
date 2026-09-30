process.env.MONGODB_DB_NAME = 'homenest_test_auth_account';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const config = require('../src/config');

const app = createApp();

const creds = { name: 'Test User', email: 'user@example.com', password: 'password123' };
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerUser(overrides = {}) {
  const body = { ...creds, ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  return { token: res.body.token, id: res.body.user.id, ...body };
}

async function makeAdmin(id) {
  await User.updateOne({ _id: id }, { role: 'admin' });
}

let slugCounter = 0;
async function createListing(ownerId, withImage = true) {
  slugCounter += 1;
  const property = await Property.create({
    ownerId,
    slug: `listing-${slugCounter}`,
    title: `Listing ${slugCounter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 5000000,
    city: 'Delhi',
  });
  if (withImage) {
    await PropertyImage.create({ propertyId: property._id, url: 'https://example.com/a.jpg' });
  }
  return property;
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([User.deleteMany({}), Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('all account endpoints require authentication', () => {
  it.each([
    ['patch', '/api/auth/me'],
    ['delete', '/api/auth/me'],
    ['post', '/api/auth/change-password'],
    ['patch', '/api/auth/change-email'],
  ])('%s %s returns 401 without a token', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Not authenticated' });
  });
});

describe('PATCH /api/auth/me', () => {
  it('updates name and phone', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .patch('/api/auth/me')
      .set(auth(token))
      .send({ name: '  New Name ', phone: '+91 98765 43210' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(res.body.user.phone).toBe('+91 98765 43210');

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.body.user.name).toBe('New Name');
    expect(me.body.user.phone).toBe('+91 98765 43210');
  });

  it('clears the phone number with an empty string', async () => {
    const { token } = await registerUser();
    await request(app).patch('/api/auth/me').set(auth(token)).send({ phone: '9876543210' });
    const res = await request(app).patch('/api/auth/me').set(auth(token)).send({ phone: '' });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('');
  });

  it('ignores role, email, passwordHash and other smuggled fields', async () => {
    const { token, id } = await registerUser();
    const before = await User.findById(id).select('+passwordHash');

    const res = await request(app)
      .patch('/api/auth/me')
      .set(auth(token))
      .send({
        name: 'Legit',
        role: 'admin',
        email: 'attacker@example.com',
        passwordHash: 'x',
        passwordChangedAt: new Date(Date.now() + 1e9).toISOString(),
        _id: new mongoose.Types.ObjectId().toString(),
        externalAuthId: 'evil',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.email).toBe(creds.email);

    const after = await User.findById(id).select('+passwordHash');
    expect(after.name).toBe('Legit');
    expect(after.role).toBe('user');
    expect(after.email).toBe(creds.email);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.passwordChangedAt).toBeUndefined();
    expect(after.externalAuthId).toBeUndefined();
  });

  it('rejects a request containing only non-whitelisted fields', async () => {
    const { token, id } = await registerUser();
    const res = await request(app).patch('/api/auth/me').set(auth(token)).send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect((await User.findById(id)).role).toBe('user');
  });

  it.each([
    [{ name: 123 }],
    [{ name: 'x'.repeat(101) }],
    [{ name: { $gt: '' } }],
    [{ phone: 'not a phone' }],
    [{ phone: 12345678 }],
    [{ phone: '123' }],
  ])('rejects invalid input %j', async (body) => {
    const { token } = await registerUser();
    const res = await request(app).patch('/api/auth/me').set(auth(token)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
  });
});

describe('POST /api/auth/change-password', () => {
  const newPassword = 'a-brand-new-password';

  it('changes the password, returns a fresh token, and the new password logs in', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: creds.password, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.passwordHash).toBeUndefined();

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('keeps the current session alive with the returned token', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: creds.password, newPassword });
    const me = await request(app).get('/api/auth/me').set(auth(res.body.token));
    expect(me.status).toBe(200);
  });

  it('rejects tokens issued before the change (old token dead, new token alive)', async () => {
    const { token: oldToken } = await registerUser();
    // Token iat has one-second resolution; make sure the change lands in a later second.
    await sleep(1100);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(oldToken))
      .send({ currentPassword: creds.password, newPassword });
    expect(res.status).toBe(200);

    const oldRes = await request(app).get('/api/auth/me').set(auth(oldToken));
    expect(oldRes.status).toBe(401);
    const newRes = await request(app).get('/api/auth/me').set(auth(res.body.token));
    expect(newRes.status).toBe(200);

    // optionalAuth (used by POST /reports) must treat the stale token as anonymous too.
    const report = { listingUrlOrId: 'listing-abc', reason: 'Spam listing' };
    const staleReport = await request(app).post('/api/v1/reports').set(auth(oldToken)).send(report);
    expect(staleReport.status).toBe(201);
    expect(staleReport.body.report.reporterId).toBeNull();
    const freshReport = await request(app).post('/api/v1/reports').set(auth(res.body.token)).send(report);
    expect(freshReport.body.report.reporterId).toBe(res.body.user.id);
  });

  it('returns 400 (not 401) for a wrong current password and changes nothing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'wrong-password', newPassword });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Current password is incorrect');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
  });

  it.each([
    [{ newPassword: 'longenough1' }, 'missing current password'],
    [{ currentPassword: creds.password }, 'missing new password'],
    [{ currentPassword: creds.password, newPassword: 'short' }, 'too-short new password'],
    [{ currentPassword: creds.password, newPassword: 12345678 }, 'non-string new password'],
    [{ currentPassword: { $ne: '' }, newPassword: 'longenough1' }, 'operator-object current password'],
  ])('rejects bad input: %j (%s)', async (body) => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/auth/change-password').set(auth(token)).send(body);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/auth/change-email', () => {
  it('changes the email (normalized) and the new address can log in', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: '  New@Example.COM ' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('new@example.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'new@example.com', password: creds.password });
    expect(login.status).toBe(200);
  });

  it('keeps the existing token valid after an email change', async () => {
    const { token } = await registerUser();
    await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: 'new@example.com' });
    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('new@example.com');
  });

  it('returns 400 (not 401) for a wrong current password', async () => {
    const { token, id } = await registerUser();
    const res = await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: 'wrong-password', newEmail: 'new@example.com' });
    expect(res.status).toBe(400);
    expect((await User.findById(id)).email).toBe(creds.email);
  });

  it.each([
    [{ currentPassword: creds.password }, 'missing email'],
    [{ currentPassword: creds.password, newEmail: 'not-an-email' }, 'malformed email'],
    [{ currentPassword: creds.password, newEmail: 42 }, 'non-string email'],
    [{ newEmail: 'new@example.com' }, 'missing password'],
    [{ currentPassword: creds.password, newEmail: creds.email.toUpperCase() }, 'same email'],
  ])('rejects bad input: %j (%s)', async (body) => {
    const { token } = await registerUser();
    const res = await request(app).patch('/api/auth/change-email').set(auth(token)).send(body);
    expect(res.status).toBe(400);
  });

  it('rejects an email already used by another account (case-insensitive)', async () => {
    await registerUser({ email: 'taken@example.com' });
    const { token } = await registerUser();
    const res = await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: 'TAKEN@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });

  it('handles the duplicate-key race (11000 on save) like registration', async () => {
    const { token, id } = await registerUser();
    jest.spyOn(User.prototype, 'save').mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const res = await request(app)
      .patch('/api/auth/change-email')
      .set(auth(token))
      .send({ currentPassword: creds.password, newEmail: 'race@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
    jest.restoreAllMocks();
    expect((await User.findById(id)).email).toBe(creds.email);
  });
});

describe('DELETE /api/auth/me', () => {
  it('deletes the account together with its listings and their images', async () => {
    const { token, id } = await registerUser();
    const other = await registerUser({ email: 'other@example.com' });
    await createListing(id);
    await createListing(id);
    const otherListing = await createListing(other.id);

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });
    expect(res.status).toBe(200);

    expect(await User.findById(id)).toBeNull();
    expect(await Property.countDocuments({ ownerId: id })).toBe(0);
    // Only the other user's listing and its image remain.
    expect(await Property.countDocuments({})).toBe(1);
    expect(await PropertyImage.countDocuments({})).toBe(1);
    expect(await PropertyImage.countDocuments({ propertyId: otherListing._id })).toBe(1);

    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(401);
  });

  it('returns 400 (not 401) for a wrong password and deletes nothing', async () => {
    const { token, id } = await registerUser();
    await createListing(id);
    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: 'wrong-password' });
    expect(res.status).toBe(400);
    expect(await User.findById(id)).not.toBeNull();
    expect(await Property.countDocuments({ ownerId: id })).toBe(1);
  });

  it('requires a password in the body', async () => {
    const { token, id } = await registerUser();
    const res = await request(app).delete('/api/auth/me').set(auth(token));
    expect(res.status).toBe(400);
    expect(await User.findById(id)).not.toBeNull();
  });

  it('refuses to delete the last remaining admin', async () => {
    const { token, id } = await registerUser();
    await makeAdmin(id);
    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last remaining admin/i);
    expect(await User.findById(id)).not.toBeNull();
  });

  it('allows an admin to delete their account when another admin exists', async () => {
    const first = await registerUser();
    const second = await registerUser({ email: 'admin2@example.com' });
    await makeAdmin(first.id);
    await makeAdmin(second.id);
    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(first.token))
      .send({ password: creds.password });
    expect(res.status).toBe(200);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });

  it('deletes properties and the user even if image cleanup fails (no live listing loses images)', async () => {
    const { token, id } = await registerUser();
    await createListing(id);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(PropertyImage, 'deleteMany').mockRejectedValueOnce(new Error('cleanup failed'));

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });

    expect(res.status).toBe(200);
    expect(await User.findById(id)).toBeNull();
    expect(await Property.countDocuments({})).toBe(0);
    // Only unreachable image rows are left behind, and the failure is logged.
    expect(await PropertyImage.countDocuments({})).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('image cleanup failed'), 'cleanup failed');
  });

  it('never deletes images before the properties are gone', async () => {
    const { token, id } = await registerUser();
    await createListing(id);
    jest.spyOn(Property, 'deleteMany').mockRejectedValueOnce(new Error('db failure'));
    const imageDelete = jest.spyOn(PropertyImage, 'deleteMany');

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });

    expect(res.status).toBe(500);
    expect(imageDelete).not.toHaveBeenCalled();
    expect(await PropertyImage.countDocuments({})).toBe(1);
  });

  it('leaves the user in place (retryable) and no ownerless listings if a step fails', async () => {
    const { token, id } = await registerUser();
    await createListing(id);
    jest.spyOn(Property, 'deleteMany').mockRejectedValueOnce(new Error('db failure'));

    const failed = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });
    expect(failed.status).toBe(500);
    // The owner still exists, so the listing is not orphaned.
    expect(await User.findById(id)).not.toBeNull();
    expect(await Property.countDocuments({ ownerId: id })).toBe(1);

    const retry = await request(app)
      .delete('/api/auth/me')
      .set(auth(token))
      .send({ password: creds.password });
    expect(retry.status).toBe(200);
    expect(await Property.countDocuments({})).toBe(0);
    expect(await PropertyImage.countDocuments({})).toBe(0);
  });
});

describe('unexpected errors in account endpoints', () => {
  const originalEnv = config.env;
  afterEach(() => {
    config.env = originalEnv;
  });

  const boom = () => new Error('boom');
  it.each([
    ['patch', '/api/auth/me', { name: 'x' }, () => jest.spyOn(User, 'findByIdAndUpdate').mockRejectedValue(boom())],
    [
      'post',
      '/api/auth/change-password',
      { currentPassword: creds.password, newPassword: 'another-password' },
      () => jest.spyOn(User.prototype, 'save').mockRejectedValue(boom()),
    ],
    [
      'patch',
      '/api/auth/change-email',
      { currentPassword: creds.password, newEmail: 'new@example.com' },
      () => jest.spyOn(User.prototype, 'save').mockRejectedValue(boom()),
    ],
    ['delete', '/api/auth/me', { password: creds.password }, () => jest.spyOn(User, 'deleteOne').mockRejectedValue(boom())],
  ])('%s %s -> generic 500 through the error handler, logged without secrets', async (method, path, body, fail) => {
    const { token } = await registerUser();
    // The error handler only logs outside the test env; 'staging' also avoids the dev stack.
    config.env = 'staging';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fail();

    const res = await request(app)[method](path).set(auth(token)).send(body);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
    expect(errorSpy).toHaveBeenCalled();
    const logged = JSON.stringify(errorSpy.mock.calls.map((c) => String(c[0]?.stack ?? c[0])));
    expect(logged).toContain('boom');
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(creds.password);
  });
});
