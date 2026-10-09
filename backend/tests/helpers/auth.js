const request = require('supertest');
const { URL } = require('url');

// The short-lived access token returned in the response body.
function tokenFromResponse(response) {
  if (!response.body?.accessToken) {
    throw new Error('Auth response did not include an accessToken');
  }
  return response.body.accessToken;
}

// The refresh cookie as a "refreshToken=<value>" pair, ready for a Cookie header.
function refreshCookieFromResponse(response) {
  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('refreshToken='));
  if (!cookie) {
    throw new Error('Auth response did not set the refresh cookie');
  }
  return cookie.split(';', 1)[0];
}

// Registration takes no password and finishes in the background, and the
// password is normally set through the emailed link. Test setup that just needs
// a working account waits for the background insert, stores the password hash
// and the verified flag directly, then logs in. The returned login response has
// `body.user` plus the token cookie. Tests of the verification flow itself use
// the real link instead (see auth.verification.test.js).
async function registerVerified(app, { email, password, ...rest }) {
  const User = require('../../src/models/User');
  const { hashPassword } = require('../../src/services/auth.service');
  const reg = await request(app).post('/api/auth/register').send({ email, ...rest });
  if (reg.status !== 202) {
    return reg;
  }
  const normalized = email.trim().toLowerCase();
  const end = Date.now() + 5000;
  while (!(await User.exists({ email: normalized }))) {
    if (Date.now() > end) throw new Error(`registration of ${normalized} did not complete`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  await User.updateOne(
    { email: normalized },
    {
      $set: { emailVerified: true, passwordHash: await hashPassword(password) },
      $unset: { verifyTokenHash: 1, verifyTokenExpiry: 1, verifyTokenPurpose: 1 },
    }
  );
  return request(app).post('/api/auth/login').send({ email, password });
}

// The raw token from a verification link passed to the (mocked) mailer.
function tokenFromLink(link) {
  return new URL(link).searchParams.get('token');
}

module.exports = { tokenFromResponse, refreshCookieFromResponse, registerVerified, tokenFromLink };
