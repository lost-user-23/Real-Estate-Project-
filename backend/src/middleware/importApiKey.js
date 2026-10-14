const crypto = require('crypto');
const AppError = require('../utils/AppError');

// SHA-256 turns any input into 32 bytes, so timingSafeEqual (which throws on
// different lengths) can always be used and the key length is not leaked.
function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

// Guards the scraper import endpoint: the caller must send the shared secret in
// the x-api-key header. Read from process.env on each request so a missing
// variable fails closed (everything is rejected) instead of crashing startup.
function requireImportKey(req, res, next) {
  const expected = process.env.IMPORT_API_KEY;
  const provided = req.get('x-api-key');

  if (!expected || !provided || !crypto.timingSafeEqual(digest(provided), digest(expected))) {
    return next(AppError.unauthorized('Invalid or missing API key'));
  }
  next();
}

module.exports = requireImportKey;
