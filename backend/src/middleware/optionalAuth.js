const { verifyToken, isTokenStale, isSessionAlive } = require('../services/auth.service');
const User = require('../models/User');
const { bearerToken } = require('./auth.middleware');
const config = require('../config');

async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return next();

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return next();
  }

  try {
    const user = await User.findById(decoded.id);
    // A token from before a password change is treated as anonymous.
    // A logged-out or revoked session is anonymous too.
    if (user && !isTokenStale(user, decoded) && (await isSessionAlive(user._id, decoded.sid))) req.user = user;
    return next();
  } catch (error) {
    if (config.env !== 'test') {
      console.error('Optional auth user lookup failed:', error);
    }
    return next();
  }
}

module.exports = optionalAuth;