const crypto = require('crypto');
const { Buffer } = require('buffer');

// 10-minute window: short enough to limit replay risk, long enough for the
// user to read the email and type the code.
const RESET_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 5 * 60 * 1000;
// Audience claim of the reset JWT. It keeps that token from being accepted as
// an access token (see verifyToken in auth.service).
const RESET_TOKEN_AUDIENCE = 'password-reset';

// Maximum wrong attempts before the OTP is locked out.
const MAX_OTP_ATTEMPTS = 5;

function hashResetOtp(otp, secret) {
  if (!secret) {
    throw new Error('JWT_SECRET must be set to hash password reset OTPs');
  }
  return crypto
    .createHmac('sha256', secret)
    .update('password-reset-otp:v1:')
    .update(String(otp))
    .digest('hex');
}

function verifyResetOtp(otp, storedHash, secret) {
  if (typeof storedHash !== 'string' || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }
  const expected = Buffer.from(hashResetOtp(otp, secret), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return crypto.timingSafeEqual(expected, actual);
}

// Generates a cryptographically secure 6-digit OTP. Leading zeros are
// preserved (the code is always exactly 6 characters). Only its keyed HMAC
// is stored; the raw code goes into the email body and nowhere else.
function generateResetOtp(secret) {
  // 3 random bytes → 0–16 777 215; modulo 1 000 000 gives a uniform 6-digit
  // range with negligible bias (2^24 / 1 000 000 ≈ 16.78; bias < 0.5%).
  const raw = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  const otp = String(raw).padStart(6, '0');
  return {
    otp,
    otpHash: hashResetOtp(otp, secret),
    expiresAt: new Date(Date.now() + RESET_OTP_TTL_MS),
  };
}

module.exports = {
  RESET_OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_AUDIENCE,
  MAX_OTP_ATTEMPTS,
  generateResetOtp,
  hashResetOtp,
  verifyResetOtp,
};
