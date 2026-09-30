const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';
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

module.exports = {
  isTokenStale,
  hashPassword,
  comparePasswords,
  generateToken,
  verifyToken,
};