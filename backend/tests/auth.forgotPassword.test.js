process.env.MONGODB_DB_NAME = 'homenest_test_forgot_password';
const { registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const config = require('../src/config');
const mailer = require('../src/services/mailer.service');
const { hashToken } = require('../src/utils/verificationToken');
const { hashResetOtp } = require('../src/utils/resetOtp');

const app = createApp();

const creds = { name: 'Reset User', email: 'reset@example.com', password: 'password123' };

const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > end) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

// Extracts the 6-digit code from the mocked sendPasswordResetEmail calls.
function otpFromMailer(callIndex = -1) {
  const calls = mailer.sendPasswordResetEmail.mock.calls;
  const idx = callIndex < 0 ? calls.length + callIndex : callIndex;
  return calls[idx]?.[1];
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendAccountExistsEmail').mockResolvedValue();
  jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue();
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

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
describe('POST /api/auth/forgot-password', () => {
  it('returns a generic 202 for a verified account and sends an OTP email', async () => {
    await registerVerified(app, creds);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email });
    expect(res.status).toBe(202);
    expect(res.body.message).toEqual(expect.any(String));
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    expect(mailer.sendPasswordResetEmail.mock.calls[0][0]).toBe('reset@example.com');
    const otp = otpFromMailer();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('returns the same 202 for an unknown email (does not reveal account existence)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(res.body.message).toEqual(expect.any(String));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not send an OTP to an unverified account', async () => {
    await request(app).post('/api/auth/register').send({ email: creds.email, name: creds.name });
    await waitFor(() => User.exists({ email: 'reset@example.com' }));
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email });
    expect(res.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores only the OTP hash, never the plaintext', async () => {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    const otp = otpFromMailer();
    const user = await User.findOne({ email: 'reset@example.com' })
      .select('+resetOtpHash +resetOtpExpiry');
    expect(user.resetOtpHash).not.toBe(otp);
    expect(user.resetOtpHash).toBe(hashResetOtp(otp, config.jwtSecret));
    expect(user.resetOtpExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('invalidates previous OTPs when a new one is issued', async () => {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    const firstOtp = otpFromMailer();

    // Step past the one-minute cooldown.
    await User.updateOne(
      { email: 'reset@example.com' },
      { resetOtpSentAt: new Date(Date.now() - 61 * 1000) }
    );

    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 2);
    const secondOtp = otpFromMailer();

    // The first OTP no longer matches the stored hash.
    const user = await User.findOne({ email: 'reset@example.com' })
      .select('+resetOtpHash');
    expect(user.resetOtpHash).toBe(hashResetOtp(secondOtp, config.jwtSecret));
    expect(user.resetOtpHash).not.toBe(hashResetOtp(firstOtp, config.jwtSecret));
  });

  it('respects the per-account cooldown (60 seconds)', async () => {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);

    // A second request within the cooldown does not produce another email.
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects missing email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('rejects malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-email' });
    expect(res.status).toBe(400);
  });

  it('is case-insensitive on email', async () => {
    await registerVerified(app, creds);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email.toUpperCase() });
    expect(res.status).toBe(202);
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
  });

  it('logs background failures, never surfaces them in the response', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(User, 'findOne').mockReturnValueOnce({
      select: jest.fn().mockRejectedValueOnce(new Error('db down: secret')),
    });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email });
    expect(res.status).toBe(202);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    await waitFor(() => errorSpy.mock.calls.length > 0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-reset-otp
// ---------------------------------------------------------------------------
describe('POST /api/auth/verify-reset-otp', () => {
  async function requestOtpForUser() {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    return otpFromMailer();
  }

  it('returns a resetToken when the OTP is correct', async () => {
    const otp = await requestOtpForUser();
    const res = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(res.status).toBe(200);
    expect(res.body.resetToken).toEqual(expect.any(String));

    // The reset token is a valid JWT with the right purpose.
    const decoded = jwt.verify(res.body.resetToken, config.jwtSecret);
    expect(decoded.purpose).toBe('password-reset');
    expect(decoded.jti).toEqual(expect.any(String));
    const user = await User.findOne({ email: creds.email })
      .select('+resetTokenHash +resetTokenExpiry');
    expect(user.resetTokenHash).toBe(hashToken(decoded.jti));
    expect(user.resetTokenHash).not.toBe(decoded.jti);
    expect(user.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('consumes the OTP so it cannot be reused', async () => {
    const otp = await requestOtpForUser();
    const first = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(second.status).toBe(400);
  });

  it('rejects a wrong code and increments the attempt counter', async () => {
    await requestOtpForUser();
    const res = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: '000000' });
    expect(res.status).toBe(400);

    const user = await User.findOne({ email: 'reset@example.com' })
      .select('+resetOtpAttempts');
    expect(user.resetOtpAttempts).toBe(1);
  });

  it('locks out after MAX_OTP_ATTEMPTS and invalidates the OTP', async () => {
    const otp = await requestOtpForUser();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Exhaust attempts with wrong codes.
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: creds.email, code: '000000' });
    }

    // Even the correct code now fails.
    const res = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired code');
    expect(warnSpy).toHaveBeenCalledWith(
      '[auth] password reset OTP rejected: attempt limit exceeded'
    );

    // The OTP fields are cleared.
    const user = await User.findOne({ email: 'reset@example.com' })
      .select('+resetOtpHash');
    expect(user.resetOtpHash).toBeUndefined();
  });

  it('uses the same status and response body for incorrect and locked-out codes', async () => {
    const otp = await requestOtpForUser();
    const incorrectCode = otp === '000000' ? '000001' : '000000';
    const invalid = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: incorrectCode });

    await User.updateOne(
      { email: 'reset@example.com' },
      { resetOtpAttempts: 5 }
    );
    const lockedOut = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: incorrectCode });

    expect(lockedOut.status).toBe(invalid.status);
    expect(lockedOut.body).toEqual(invalid.body);
  });

  it('rejects an expired OTP', async () => {
    const otp = await requestOtpForUser();
    // Expire the OTP.
    await User.updateOne(
      { email: 'reset@example.com' },
      { resetOtpExpiry: new Date(Date.now() - 1000) }
    );
    const res = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(res.status).toBe(400);
  });

  it('returns the same error for unknown email and missing OTP (no email enumeration)', async () => {
    const unknown = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: 'ghost@example.com', code: '123456' });
    const noOtp = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: '123456' });
    expect(unknown.status).toBe(400);
    expect(noOtp.status).toBe(400);
    expect(unknown.body.error.message).toBe(noOtp.body.error.message);
  });

  it('rejects non-6-digit codes', async () => {
    await requestOtpForUser();
    for (const bad of ['12345', '1234567', 'abcdef', '12.456']) {
      const res = await request(app)
        .post('/api/auth/verify-reset-otp')
        .send({ email: creds.email, code: bad });
      expect(res.status).toBe(400);
    }
  });

  it('rejects when email or code is missing', async () => {
    expect(
      (await request(app).post('/api/auth/verify-reset-otp').send({ code: '123456' })).status
    ).toBe(400);
    expect(
      (await request(app).post('/api/auth/verify-reset-otp').send({ email: creds.email })).status
    ).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------
describe('POST /api/auth/reset-password', () => {
  async function obtainResetToken() {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    const otp = otpFromMailer();
    const verify = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    return verify.body.resetToken;
  }

  it('resets the password and invalidates existing sessions', async () => {
    const resetToken = await obtainResetToken();
    // Create a session first so we can verify it gets revoked.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    const tokenCount = await RefreshToken.countDocuments({});
    expect(tokenCount).toBeGreaterThan(0);

    const newPassword = 'newSecure123';
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset/i);

    // All refresh tokens are revoked.
    expect(await RefreshToken.countDocuments({})).toBe(0);

    // Old password no longer works.
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(oldLogin.status).toBe(401);

    // New password works.
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'not-a-valid-token', newPassword: 'newSecure123' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired reset token', async () => {
    const resetToken = jwt.sign(
      { id: new mongoose.Types.ObjectId(), purpose: 'password-reset' },
      config.jwtSecret,
      { expiresIn: '0s' }
    );
    // Wait for it to actually expire.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'newSecure123' });
    expect(res.status).toBe(400);
  });

  it('rejects a JWT with wrong purpose (e.g. a regular access token)', async () => {
    await registerVerified(app, creds);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: login.body.accessToken, newPassword: 'newSecure123' });
    expect(res.status).toBe(400);
  });

  it('validates the new password with existing rules', async () => {
    const resetToken = await obtainResetToken();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at least 8/i);
  });

  it('rejects when resetToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'newSecure123' });
    expect(res.status).toBe(400);
  });

  it('the reset token cannot be used twice', async () => {
    const resetToken = await obtainResetToken();
    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'newSecure123' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'anotherPass123' });
    expect(second.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Full end-to-end flow
// ---------------------------------------------------------------------------
describe('full forgot-password flow', () => {
  it('request → verify OTP → set new password → log in with new password', async () => {
    await registerVerified(app, creds);

    // Step 1: Request a reset OTP.
    const reqRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: creds.email });
    expect(reqRes.status).toBe(202);
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    const otp = otpFromMailer();

    // Step 2: Verify the OTP.
    const verifyRes = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    expect(verifyRes.status).toBe(200);

    // Step 3: Set the new password.
    const newPassword = 'brand-new-password';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: verifyRes.body.resetToken, newPassword });
    expect(resetRes.status).toBe(200);

    // Step 4: Log in with the new password.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe('reset@example.com');
  });
});

// ---------------------------------------------------------------------------
// Hardening: concurrency and token confusion
// ---------------------------------------------------------------------------
describe('password reset hardening', () => {
  async function requestOtpForUser() {
    await registerVerified(app, creds);
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    await waitFor(() => mailer.sendPasswordResetEmail.mock.calls.length === 1);
    return otpFromMailer();
  }

  it('evaluates at most MAX_OTP_ATTEMPTS guesses when they arrive in parallel', async () => {
    const otp = await requestOtpForUser();
    const wrong = otp === '000000' ? '000001' : '000000';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const responses = await Promise.all(
      Array.from({ length: 60 }, () =>
        request(app).post('/api/auth/verify-reset-otp').send({ email: creds.email, code: wrong })
      )
    );

    expect(responses.every((res) => res.status === 400)).toBe(true);
    const evaluated = warnSpy.mock.calls.filter(([msg]) => String(msg).includes('incorrect code')).length;
    expect(evaluated).toBeLessThanOrEqual(5);
    // Locked out: the right code no longer works.
    const late = await request(app).post('/api/auth/verify-reset-otp').send({ email: creds.email, code: otp });
    expect(late.status).toBe(400);
  });

  it('a reset token cannot be used as an access token', async () => {
    const otp = await requestOtpForUser();
    const verified = await request(app)
      .post('/api/auth/verify-reset-otp')
      .send({ email: creds.email, code: otp });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verified.body.resetToken}`);
    expect(me.status).toBe(401);
  });

  it('logs a debug line, with no email address, when a reset is skipped for an unverified account', async () => {
    const logSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const previous = config.env;
    config.env = 'development';
    try {
      await User.create({ email: 'unverified@example.com', name: 'U', emailVerified: false });
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'unverified@example.com' });
      expect(res.status).toBe(202);
      await waitFor(() => logSpy.mock.calls.length > 0);
      expect(String(logSpy.mock.calls[0][0])).toContain('not verified');
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain('unverified@example.com');
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    } finally {
      config.env = previous;
    }
  });
});
