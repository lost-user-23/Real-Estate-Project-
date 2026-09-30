// Runs before each test file. auth.service refuses to load without a secret,
// and this value takes precedence over any backend/.env (dotenv doesn't override).
process.env.JWT_SECRET = 'jest-test-secret-not-for-production';
