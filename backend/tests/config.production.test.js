// Loads src/config in isolation under NODE_ENV=production. dotenv never
// overrides a variable that is already defined, so "missing" is simulated with
// an empty string; that keeps the developer's backend/.env out of the picture.
const KEYS = [
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'TRUST_PROXY_HOPS',
  'APP_URL',
  'SMTP_HOST',
  'MAIL_FROM',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const VALID = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://fake-user:fake-pass@cluster.invalid/',
  JWT_SECRET: 'a3f9c1d27b6e45f08a91c4d3e2b7f6a05c8d9e1f2a3b4c5d6e7f8091a2b3c4d5',
  CORS_ORIGIN: 'https://www.example.com',
  TRUST_PROXY_HOPS: '1',
  APP_URL: 'https://www.example.com',
  SMTP_HOST: 'smtp.fake.invalid',
  MAIL_FROM: 'HomeNest <no-reply@fake.invalid>',
  CLOUDINARY_CLOUD_NAME: 'fake-cloud',
  CLOUDINARY_API_KEY: '000000000000000',
  CLOUDINARY_API_SECRET: 'fake-api-secret',
};

describe('production config validation', () => {
  const saved = {};

  beforeAll(() => KEYS.forEach((key) => { saved[key] = process.env[key]; }));
  afterEach(() => {
    KEYS.forEach((key) => { process.env[key] = saved[key]; });
    jest.resetModules();
  });

  function load(overrides = {}) {
    Object.assign(process.env, VALID, overrides);
    jest.resetModules();
    return require('../src/config');
  }

  it('accepts a complete, valid environment', () => {
    const config = load();
    expect(config.corsOrigins).toEqual(['https://www.example.com']);
    expect(config.mongodbUri).toBe(VALID.MONGODB_URI);
  });

  it.each(KEYS.filter((key) => key !== 'NODE_ENV'))('refuses to start without %s', (key) => {
    expect(() => load({ [key]: '' })).toThrow(`Missing required environment variables in production: ${key}`);
  });

  it('never falls back to localhost for MongoDB in production', () => {
    expect(() => load({ MONGODB_URI: '' })).toThrow(/MONGODB_URI/);
  });

  it('keeps the localhost MongoDB fallback outside production', () => {
    const config = load({ NODE_ENV: 'development', MONGODB_URI: '' });
    expect(config.mongodbUri).toBe('mongodb://127.0.0.1:27017');
  });

  describe('JWT_SECRET', () => {
    it('rejects a secret shorter than 32 characters', () => {
      expect(() => load({ JWT_SECRET: 'x'.repeat(31) })).toThrow(/at least 32 characters/);
    });

    it('accepts a 32 character random secret', () => {
      expect(() => load({ JWT_SECRET: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' })).not.toThrow();
    });

    it('rejects the placeholder shipped in .env.example', () => {
      const fs = require('fs');
      const path = require('path');
      const example = fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
      const placeholder = example.match(/^JWT_SECRET=(.*)$/m)[1].trim();
      expect(placeholder.length).toBeGreaterThanOrEqual(32);
      expect(() => load({ JWT_SECRET: placeholder })).toThrow(/placeholder/);
    });

    it.each(['changeme-changeme-changeme-changeme-1', 'your-secret-your-secret-your-secret-1', 'jest-test-secret-not-for-production'])(
      'rejects placeholder-looking secret %s',
      (secret) => {
        expect(() => load({ JWT_SECRET: secret })).toThrow(/placeholder/);
      }
    );
  });

  describe('CORS_ORIGIN', () => {
    it('trims spaces and trailing slashes and accepts a comma-separated list', () => {
      const config = load({ CORS_ORIGIN: ' https://www.example.com/ , https://example.com:8443// ,' });
      expect(config.corsOrigins).toEqual(['https://www.example.com', 'https://example.com:8443']);
    });

    it('rejects "*" in production', () => {
      expect(() => load({ CORS_ORIGIN: '*' })).toThrow(/must not be "\*"/);
      expect(() => load({ CORS_ORIGIN: 'https://www.example.com,*' })).toThrow(/must not be "\*"/);
    });

    it.each(['www.example.com', 'ftp://example.com', 'https://example.com/app', 'https://example.com?x=1'])(
      'rejects malformed origin %s',
      (origin) => {
        expect(() => load({ CORS_ORIGIN: origin })).toThrow(/not a bare http\(s\) origin/);
      }
    );

    it('defaults to the local frontend outside production', () => {
      const config = load({ NODE_ENV: 'development', CORS_ORIGIN: '' });
      expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    });
  });
});
