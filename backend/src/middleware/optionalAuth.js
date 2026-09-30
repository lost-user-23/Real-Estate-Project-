const { verifyToken, isTokenStale } = require('../services/auth.service');
const User = require('../models/User');
const config = require('../config');

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  let decoded;
  try {
    decoded = verifyToken(authHeader.slice(7));
  } catch {
    return next();
  }

  try {
    const user = await User.findById(decoded.id);
    // A token from before a password change is treated as anonymous.
    if (user && !isTokenStale(user, decoded)) req.user = user;
    return next();
  } catch (error) {
    if (config.env !== 'test') {
      console.error('Optional auth user lookup failed:', error);
    }
    return next();
  }
}

module.exports = optionalAuth;