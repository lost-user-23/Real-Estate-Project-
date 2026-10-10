process.env.MONGODB_DB_NAME = 'homenest_test_auth_action_code';
const request = require('supertest');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const mailer = require('../src/services/mailer.service');
const { tokenFromResponse, registerVerified, grantActionCode, ACTION_CODE } = require('./helpers/auth');

const app = createApp();
const creds = { name: 'Code User', email: 'code@example.com', password: 'password123' };
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function login() {
  return tokenFromResponse(await registerVerified(app, creds));
}

beforeAll(connectToDatabase);
afterAll(async () => {
  await User.deleteMany({});
  await disconnectFromDatabase();
});
beforeEach(async () => {
  await User.deleteMany({});
  jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendAccountExistsEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendActionCodeEmail').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

const pw = { currentPassword: creds.password, newPassword: 'a-brand-new-password' };
const changePassword = (token, code) =>
  request(app).post('/api/auth/change-password').set(auth(token)).send({ ...pw, code });
const changeEmail = (token, code) =>
  request(app)
    .patch('/api/auth/change-email')
    .set(auth(token))
    .send({ currentPassword: creds.password, newEmail: 'next@example.com', code });

describe('POST /api/auth/request-action-code', () => {
  it('requires authentication and a known purpose', async () => {
    expect((await request(app).post('/api/auth/request-action-code').send({})).status).toBe(401);
    const token = await login();
    const bad = await request(app).post('/api/auth/request-action-code').set(auth(token)).send({ purpose: 'x' });
    expect(bad.status).toBe(400);
  });

  it('emails a 6-digit code to the current address and enforces a cooldown', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/auth/request-action-code')
      .set(auth(token))
      .send({ purpose: 'change-password' });
    expect(res.status).toBe(202);
    const [to, code] = mailer.sendActionCodeEmail.mock.calls[0];
    expect(to).toBe(creds.email);
    expect(code).toMatch(/^\d{6}$/);

    const again = await request(app)
      .post('/api/auth/request-action-code')
      .set(auth(token))
      .send({ purpose: 'change-password' });
    expect(again.status).toBe(429);
    expect(mailer.sendActionCodeEmail).toHaveBeenCalledTimes(1);
  });

  it('works end to end with the emailed code, and the code is single-use', async () => {
    const token = await login();
    await request(app).post('/api/auth/request-action-code').set(auth(token)).send({ purpose: 'change-password' });
    const code = mailer.sendActionCodeEmail.mock.calls[0][1];
    const ok = await changePassword(token, code);
    expect(ok.status).toBe(200);
    const replay = await changePassword(tokenFromResponse(ok), code);
    expect(replay.status).toBe(400);
  });
});

describe('code required for sensitive changes', () => {
  it.each([
    ['change-password', changePassword],
    ['change-email', changeEmail],
  ])('%s rejects a missing, wrong, or other-purpose code', async (purpose, act) => {
    const token = await login();
    expect((await act(token, undefined)).status).toBe(400);
    await grantActionCode(creds.email, purpose);
    expect((await act(token, '000000')).status).toBe(400);
    const other = purpose === 'change-password' ? 'change-email' : 'change-password';
    await grantActionCode(creds.email, other);
    const res = await act(token, ACTION_CODE);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired code');
  });

  it('locks the code after too many wrong attempts, even for the right code', async () => {
    const token = await login();
    await grantActionCode(creds.email, 'change-password');
    for (let i = 0; i < 5; i += 1) {
      expect((await changePassword(token, '000000')).status).toBe(400);
    }
    expect((await changePassword(token, ACTION_CODE)).status).toBe(400);
  });

  it('rejects an expired code', async () => {
    const token = await login();
    await grantActionCode(creds.email, 'change-password');
    await User.updateOne({ email: creds.email }, { actionOtpExpiry: new Date(Date.now() - 1000) });
    expect((await changePassword(token, ACTION_CODE)).status).toBe(400);
  });

  it('a wrong current password does not spend the code', async () => {
    const token = await login();
    await grantActionCode(creds.email, 'change-password');
    const bad = await request(app)
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ ...pw, currentPassword: 'wrong-password', code: ACTION_CODE });
    expect(bad.status).toBe(400);
    expect((await changePassword(token, ACTION_CODE)).status).toBe(200);
  });
});
