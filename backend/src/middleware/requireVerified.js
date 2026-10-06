const AppError = require('../utils/AppError');

// Soft gate: use after `protect`. Unverified accounts can log in and browse but
// cannot post, save or reveal contact details until the email is confirmed.
function requireVerified(req, res, next) {
  if (!req.user?.emailVerified) {
    return next(AppError.forbidden('Please verify your email address to do this'));
  }
  return next();
}

module.exports = requireVerified;
