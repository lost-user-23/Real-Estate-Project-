const crypto = require('crypto');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// The raw token goes in the email only; the database stores just its hash, so a
// leaked collection cannot be used to verify anything.
function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  };
}

module.exports = { VERIFICATION_TTL_MS, hashToken, generateVerificationToken };
