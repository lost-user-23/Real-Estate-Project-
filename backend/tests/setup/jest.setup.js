// Runs before each test file. auth.service refuses to load without a secret,
// and this value takes precedence over any backend/.env (dotenv doesn't override).
process.env.JWT_SECRET = 'jest-test-secret-not-for-production';

// Keeps image-deletion paths hermetic: no test fixture URL can ever match the
// developer's real Cloudinary cloud from backend/.env, so no real asset is touched.
process.env.CLOUDINARY_CLOUD_NAME = 'jest-test-cloud';

// No test may reach a real SMTP server from backend/.env; with no host the
// mailer is a silent no-op, and tests that care spy on it.
process.env.SMTP_HOST = '';
