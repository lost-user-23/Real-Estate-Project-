const path = require('path');
const { URL } = require('url');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_IN_PRODUCTION = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'TRUST_PROXY_HOPS',
  'APP_URL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'IMPORT_API_KEY',
];

const MIN_JWT_SECRET_LENGTH = 32;
// Fragments of the values people leave in after copying .env.example.
const PLACEHOLDER_FRAGMENTS = ['changeme', 'change-me', 'change_me', 'replace', 'placeholder', 'example', 'your-', 'your_', 'jest-test'];

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// CORS_ORIGIN: one exact origin or a comma-separated list. Entries are trimmed
// and lose trailing slashes; each must be a bare http(s) origin (no path). "*"
// is never valid because the API answers with credentials.
function parseCorsOrigins(value) {
  const origins = String(value)
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }
  for (const origin of origins) {
    if (origin === '*') {
      throw new Error('CORS_ORIGIN must not be "*"; list the exact frontend origin(s)');
    }
    let url;
    try {
      url = new URL(origin);
    } catch {
      url = null;
    }
    if (!url || !/^https?:$/.test(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGIN entry "${origin}" is not a bare http(s) origin (for example https://www.example.com)`);
    }
  }
  return origins;
}

function jwtSecretProblem(secret) {
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
  }
  const lower = secret.toLowerCase();
  if (PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return 'JWT_SECRET looks like a placeholder; generate a random value (for example `openssl rand -hex 64`)';
  }
  return null;
}

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  // The localhost fallback is for development only; production requires MONGODB_URI (checked below).
  mongodbUri: process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://127.0.0.1:27017'),
  mongodbDbName: process.env.MONGODB_DB_NAME || 'homenest',
  corsOrigins: [],
  // Frontend base URL; verification emails link to <APP_URL>/verify-email.
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: positiveInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'HomeNest <no-reply@localhost>',
  // Cheap under jest so the many register/login calls stay fast; production always uses 10.
  bcryptRounds: process.env.NODE_ENV === 'test' ? 4 : 10,
  jwtSecret: process.env.JWT_SECRET || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  rateLimitWindowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: positiveInt(process.env.RATE_LIMIT_MAX, 200),
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'property-images',
};

if (config.env === 'production') {
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
}

// Outside production a missing import key is allowed, but the scraper endpoint
// then answers 401 to everything. Say so in the server log (never to callers).
if (config.env !== 'production' && config.env !== 'test' && !process.env.IMPORT_API_KEY) {
  console.warn('IMPORT_API_KEY is not set: POST /api/v1/admin/import/properties will reject every request.');
}

// Non-production keeps the local-frontend default when CORS_ORIGIN is unset.
config.corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN || 'http://localhost:3000');

// These two are read straight from process.env elsewhere and would otherwise
// degrade silently: a typo in COOKIE_SAMESITE becomes "strict" and a bad
// TRUST_PROXY_HOPS becomes 0 (every client sharing the proxy's rate-limit key).
if (config.env === 'production') {
  const sameSite = String(process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (sameSite && !['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('Invalid environment variable in production: COOKIE_SAMESITE must be lax, strict or none');
  }
  if (!/^\d+$/.test(String(process.env.TRUST_PROXY_HOPS).trim())) {
    throw new Error('Invalid environment variable in production: TRUST_PROXY_HOPS must be a whole number of proxy hops (0, 1, 2, ...)');
  }
}

if (config.env === 'production') {
  const problem = jwtSecretProblem(config.jwtSecret);
  if (problem) {
    throw new Error(`Invalid environment variable in production: ${problem}`);
  }
}

module.exports = config;
