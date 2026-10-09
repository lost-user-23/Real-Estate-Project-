const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const RefreshToken = require('../models/RefreshToken');
const { hashToken } = require('../utils/verificationToken');

const SALT_ROUNDS = 10;
// Short-lived: a copied access token is useless after this. Sessions last as
// long as the refresh token (REFRESH_TOKEN_TTL_MS), which the server can revoke.
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A rotated token presented again within this window is treated as a lost race
// (two tabs refreshing at once), not as theft.
const REFRESH_REUSE_GRACE_MS = 10 * 1000;
// No fallback: a missing secret is a startup error in every environment (tests
// set one in tests/setup/jest.setup.js), so tokens can never be signed with a
// publicly known key.
if (!config.jwtSecret) {
  throw new Error('JWT_SECRET must be set (see backend/.env.example)');
}
const JWT_SECRET = config.jwtSecret;

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

async function comparePasswords(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// True when the token predates the user's last password change. Tokens are
// stamped in whole seconds, so compare at that granularity; a token issued in
// the same second as the change is not rejected (<= 1s window).
function isTokenStale(user, decoded) {
  return Boolean(
    user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
  );
}

// Creates a refresh token for the user and returns the raw value (for the
// cookie). Only its hash is stored.
async function createRefreshToken(userId, req) {
  const token = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 255),
    ip: String(req?.ip || ''),
  });
  return token;
}

// Redeems a refresh token exactly once. Returns the userId on success, or null
// when the token is unknown, expired or already used. A token that was already
// used outside the grace window is a replay, so every session of that user is
// revoked.
async function consumeRefreshToken(token) {
  const tokenHash = hashToken(token);
  const now = new Date();

  // The claim is one atomic update, so two requests with the same token cannot
  // both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } }
  );
  if (claimed) return claimed.userId;

  const record = await RefreshToken.findOne({ tokenHash });
  if (record?.usedAt && now - record.usedAt > REFRESH_REUSE_GRACE_MS) {
    await RefreshToken.deleteMany({ userId: record.userId });
  }
  return null;
}

function revokeRefreshToken(token) {
  return RefreshToken.deleteOne({ tokenHash: hashToken(token) });
}

function revokeAllRefreshTokens(userId) {
  return RefreshToken.deleteMany({ userId });
}

module.exports = {
  REFRESH_TOKEN_TTL_MS,
  createRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  isTokenStale,
  hashPassword,
  comparePasswords,
  generateToken,
  verifyToken,
};