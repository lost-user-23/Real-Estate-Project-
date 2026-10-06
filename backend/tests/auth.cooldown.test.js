process.env.MONGODB_DB_NAME = 'homenest_test_auth_cooldown';
const { verificationHelpers } = require('./helpers/verification');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const mailer = require('../src/services/mailer.service');

// Own file so its resend calls do not share the resend rate limiter's budget
// with auth.verification.test.js (each test file gets a fresh app module).
const app = createApp();
const creds = { name: 'Cooldown User', email: 'cooldown@example.com', password: 'password123' };
const { sleep, waitFor, linksTo, endCooldown, registerUnverified, verify } = verificationHelpers(app, {
  mailer,
  User,
  password: creds.password,
});

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

describe('per-account verification mail cooldown', () => {
  it('sends at most one verification mail per minute, without changing any response', async () => {
    const { link } = await registerUnverified({ name: creds.name, email: creds.email });
    const again = await request(app).post('/api/auth/register').send({ name: creds.name, email: creds.email });
    const resend = await request(app).post('/api/auth/resend-verification').send({ email: creds.email });
    const fresh = await request(app).post('/api/auth/register').send({ email: 'someone-else@example.com' });
    expect(again.status).toBe(fresh.status);
    expect(again.body).toEqual(fresh.body);
    expect(resend.status).toBe(202);
    await waitFor(() => linksTo('someone-else@example.com').length === 1);
    await sleep(100);

    expect(linksTo(creds.email)).toHaveLength(1);
    // The suppressed requests did not rotate the token: the first link still works.
    expect((await verify(link)).status).toBe(200);
  });

  it('sends at most one "someone tried your address" notice per minute, with identical responses', async () => {
    const { link } = await registerUnverified({ name: creds.name, email: creds.email });
    expect((await verify(link)).status).toBe(200);
    // A verification mail went out just now; the notice has its own timestamp,
    // so that does not hold the first notice back.
    const first = await request(app).post('/api/auth/register').send({ email: creds.email });
    await waitFor(() => mailer.sendAccountExistsEmail.mock.calls.length === 1);

    const second = await request(app).post('/api/auth/register').send({ email: creds.email });
    const third = await request(app).post('/api/auth/register').send({ email: creds.email.toUpperCase() });
    const fresh = await request(app).post('/api/auth/register').send({ email: 'other-new@example.com' });
    for (const res of [first, second, third]) {
      expect(res.status).toBe(fresh.status);
      expect(res.body).toEqual(fresh.body);
    }
    await waitFor(() => linksTo('other-new@example.com').length === 1);
    await sleep(100);
    expect(mailer.sendAccountExistsEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendAccountExistsEmail).toHaveBeenCalledWith(creds.email);

    // After the minute, the next attempt is reported again.
    await User.updateOne({ email: creds.email }, { accountNoticeSentAt: new Date(Date.now() - 61 * 1000) });
    await request(app).post('/api/auth/register').send({ email: creds.email });
    await waitFor(() => mailer.sendAccountExistsEmail.mock.calls.length === 2);
  });

  it('sends again once the minute is over', async () => {
    const { link } = await registerUnverified({ name: creds.name, email: creds.email });
    await endCooldown(creds.email);
    await request(app).post('/api/auth/resend-verification').send({ email: creds.email });
    await waitFor(() => linksTo(creds.email).length === 2);
    // The new mail carries a new token; the old link is dead.
    expect((await verify(link)).status).toBe(400);
    expect((await verify(linksTo(creds.email)[1])).status).toBe(200);
  });
});
