const crypto = require('crypto');
const { Buffer } = require('buffer');

// Step-up codes for sensitive account changes (password, email). Emailed to the
// address currently on the account, so a stolen session plus a guessed password
// is still not enough.
const ACTION_OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ACTION_OTP_ATTEMPTS = 5;
const ACTION_PURPOSES = ['change-password', 'change-email'];

// Bound to the purpose, so a code requested for one action cannot authorise another.
function hashActionOtp(otp, purpose, secret) {
  if (!secret) {
    throw new Error('JWT_SECRET must be set to hash action OTPs');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`action-otp:v1:${purpose}:`)
    .update(String(otp))
    .digest('hex');
}

function verifyActionOtp(otp, purpose, storedHash, secret) {
  if (typeof storedHash !== 'string' || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }
  const expected = Buffer.from(hashActionOtp(otp, purpose, secret), 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return crypto.timingSafeEqual(expected, actual);
}

function generateActionOtp(purpose, secret) {
  const raw = crypto.randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  const otp = String(raw).padStart(6, '0');
  return {
    otp,
    otpHash: hashActionOtp(otp, purpose, secret),
    expiresAt: new Date(Date.now() + ACTION_OTP_TTL_MS),
  };
}

module.exports = {
  ACTION_OTP_TTL_MS,
  MAX_ACTION_OTP_ATTEMPTS,
  ACTION_PURPOSES,
  generateActionOtp,
  verifyActionOtp,
};
