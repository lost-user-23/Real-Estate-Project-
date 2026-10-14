const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const RefreshToken = require('../models/RefreshToken');
const { hashToken } = require('../utils/verificationToken');

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
  const salt = await bcrypt.genSalt(config.bcryptRounds);
  return bcrypt.hash(password, salt);
}

async function comparePasswords(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

function newSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// `sid` ties the access token to its login session (see isSessionAlive).
function generateToken(user, sessionId) {
  return jwt.sign(
    { id: user._id, role: user.role, sid: sessionId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Access tokens only: a token with an audience or a purpose (the password-reset
// token) is signed with the same secret but must never authenticate a request.
function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.aud || decoded.purpose) {
    throw new jwt.JsonWebTokenError('not an access token');
  }
  return decoded;
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

// At most this many live (unspent) refresh tokens per user. Spent records are
// kept for replay detection and expire on their own.
const MAX_ACTIVE_REFRESH_TOKENS = 10;

async function pruneOldSessions(userId) {
  const surplus = await RefreshToken.find({ userId, usedAt: null })
    .sort({ createdAt: -1, _id: -1 })
    .skip(MAX_ACTIVE_REFRESH_TOKENS)
    .select('_id sessionId')
    .lean();
  if (surplus.length > 0) {
    // Drop the whole session, spent records included, so its access token dies too.
    const sessionIds = surplus.map((row) => row.sessionId).filter(Boolean);
    await RefreshToken.deleteMany({
      $or: [{ _id: { $in: surplus.map((row) => row._id) } }, { userId, sessionId: { $in: sessionIds } }],
    });
  }
}

// Creates a refresh token for the user and returns the raw value (for the
// cookie). Only its hash is stored. A rotation passes the session's existing id.
async function createRefreshToken(userId, req, sessionId) {
  const token = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    sessionId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 255),
    ip: String(req?.ip || ''),
  });
  await pruneOldSessions(userId);
  return token;
}

// Redeems a refresh token exactly once. Returns { userId, sessionId } on success.
// Otherwise { userId: null, inGrace } where inGrace is true only for a token
// that was spent less than REFRESH_REUSE_GRACE_MS ago: that is a lost race
// between two tabs, and the caller must not clear the cookie because the
// winning response carries the live replacement. A token that was already used
// outside the grace window is a replay, so every session of that user is
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
  if (claimed) return { userId: claimed.userId, sessionId: claimed.sessionId, inGrace: false };

  const record = await RefreshToken.findOne({ tokenHash });
  if (record?.usedAt && now - record.usedAt <= REFRESH_REUSE_GRACE_MS) {
    return { userId: null, inGrace: true };
  }
  if (record?.usedAt) {
    await RefreshToken.deleteMany({ userId: record.userId });
  }
  return { userId: null, inGrace: false };
}

// Ends the session the token belongs to (every record sharing its sessionId),
// so the access token issued for it stops working too. Unknown token: no-op.
async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  const record = await RefreshToken.findOne({ tokenHash }).select('sessionId').lean();
  if (!record) return;
  if (record.sessionId) await RefreshToken.deleteMany({ sessionId: record.sessionId });
  else await RefreshToken.deleteOne({ tokenHash });
}

// A session is alive while any unexpired record carries its id. Logout, revoke-all,
// replay detection and pruning all delete records, which ends the session.
async function isSessionAlive(userId, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return false;
  return Boolean(
    await RefreshToken.exists({ userId, sessionId, expiresAt: { $gt: new Date() } })
  );
}

// Fallback for a logout that arrives without the refresh cookie: a valid access
// token (unexpired, signed by us) names its session through `sid`. Anything
// else is ignored, so the call stays harmless for anonymous callers.
async function revokeSessionByAccessToken(token) {
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return;
  }
  if (typeof decoded.sid !== 'string' || !decoded.sid) return;
  await RefreshToken.deleteMany({ userId: decoded.id, sessionId: decoded.sid });
}

function revokeAllRefreshTokens(userId) {
  return RefreshToken.deleteMany({ userId });
}

module.exports = {
  REFRESH_TOKEN_TTL_MS,
  newSessionId,
  isSessionAlive,
  createRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeSessionByAccessToken,
  revokeAllRefreshTokens,
  isTokenStale,
  hashPassword,
  comparePasswords,
  generateToken,
  verifyToken,
};