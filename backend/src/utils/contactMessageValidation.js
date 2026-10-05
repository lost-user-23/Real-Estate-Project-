const AppError = require('./AppError');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

function validateContactMessage(body = {}) {
  const name = asString(body.name);
  const email = asString(body.email);
  const message = asString(body.message);
  const phone = asString(body.phone).replace(/[\s\-()]/g, '');

  const errors = [];

  if (name.length < 2 || name.length > 80) {
    errors.push('Name must be 2 to 80 characters');
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    errors.push('Enter a valid email address');
  }
  const phoneIsValidType = body.phone === undefined || body.phone === null || typeof body.phone === 'string';
  if (!phoneIsValidType || (phone && !PHONE_RE.test(phone))) {
    errors.push('Enter a valid phone number');
  }
  if (message.length < 10 || message.length > 2000) {
    errors.push('Message must be 10 to 2000 characters');
  }

  if (errors.length) {
    throw new AppError(errors.join(', '), 400);
  }

  const clean = { name, email, message };
  if (phone) clean.phone = phone;
  return clean;
}

module.exports = { validateContactMessage };
