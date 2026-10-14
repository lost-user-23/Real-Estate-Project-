const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const {
  DEFAULT_TEST_URI,
  DEFAULT_TEST_DB,
  assertSafeTestUri,
  assertSafeDbName,
  resolveDbName,
} = require('./dbSafety');

// Runs before each test file. auth.service refuses to load without a secret,
// and this value takes precedence over any backend/.env (dotenv doesn't override).
process.env.JWT_SECRET = 'jest-test-secret-not-for-production';

// --- Test database: local only, name must contain "test" ---------------------
// Tests create, fill and DROP whole databases, so they never use the app's
// MONGODB_URI from backend/.env (which may be Atlas). They use MONGODB_URI_TEST,
// defaulting to a local mongod. Because dotenv never overrides a variable that
// is already set, putting it into MONGODB_URI here wins over backend/.env.
function appUriFromEnvFile() {
  try {
    const file = path.resolve(__dirname, '../../.env');
    return dotenv.parse(fs.readFileSync(file)).MONGODB_URI;
  } catch {
    return undefined;
  }
}

const testUri = process.env.MONGODB_URI_TEST || DEFAULT_TEST_URI;
assertSafeTestUri(testUri, appUriFromEnvFile());
process.env.MONGODB_URI = testUri;

// Default name for any test file that forgets to pick its own; every file that
// connects sets its own homenest_test_* name right after this runs.
process.env.MONGODB_DB_NAME = DEFAULT_TEST_DB;

// Second line of defence: check again at the moment of connecting, so a test
// file that sets a bad name (or a future change to config) is still caught.
function guardConnect(original) {
  return function guardedConnect(uri, options, ...rest) {
    assertSafeTestUri(uri, appUriFromEnvFile());
    assertSafeDbName(resolveDbName(uri, options));
    return original.call(this, uri, options, ...rest);
  };
}
mongoose.connect = guardConnect(mongoose.connect);
mongoose.createConnection = guardConnect(mongoose.createConnection);

// Keeps image-deletion paths hermetic: no test fixture URL can ever match the
// developer's real Cloudinary cloud from backend/.env, so no real asset is touched.
process.env.CLOUDINARY_CLOUD_NAME = 'jest-test-cloud';

// No test may reach a real SMTP server from backend/.env; with no host the
// mailer is a silent no-op, and tests that care spy on it.
process.env.SMTP_HOST = '';
