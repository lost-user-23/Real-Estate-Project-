// Safety rules for the test database. Tests create, fill and DROP whole
// databases, so they must never run against real data. Used by jest.setup.js
// (and unit-tested in tests/dbSafety.test.js).

const DEFAULT_TEST_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_TEST_DB = 'homenest_test';

// "user:pass@host" -> "host", so error messages never print credentials.
function hostOf(uri) {
  return String(uri)
    .replace(/^mongodb(\+srv)?:\/\//i, '')
    .replace(/^[^@/]*@/, '')
    .replace(/[/?].*$/, '');
}

// Database name written in the URI path ("mongodb://host/name?x=1"), or ''.
function dbNameFromUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]*)/i.exec(String(uri));
  return match ? decodeURIComponent(match[1]) : '';
}

function isAtlas(uri) {
  return /^mongodb\+srv:/i.test(String(uri)) || /\.mongodb\.net/i.test(hostOf(uri));
}

// Throws unless the URI is safe to run destructive tests against.
// appUri is the MONGODB_URI from backend/.env (the database the app really
// uses); the tests may never share it.
function assertSafeTestUri(uri, appUri) {
  if (isAtlas(uri)) {
    throw new Error(
      `Refusing to run tests: MONGODB_URI_TEST points at an Atlas host (${hostOf(uri)}). ` +
        'Tests drop databases; use a local mongod, e.g. mongodb://127.0.0.1:27017.'
    );
  }
  if (appUri && String(uri).trim() === String(appUri).trim()) {
    throw new Error(
      'Refusing to run tests: MONGODB_URI_TEST is identical to MONGODB_URI in backend/.env, the app\'s real database.'
    );
  }
}

// Throws unless the database name contains "test" (case-insensitive).
function assertSafeDbName(dbName) {
  if (!/test/i.test(String(dbName || ''))) {
    throw new Error(
      `Refusing to run tests: database name "${dbName}" does not contain "test". ` +
        'Set process.env.MONGODB_DB_NAME to a homenest_test_* name before requiring the app.'
    );
  }
}

// What mongoose.connect(uri, { dbName }) will actually use. The dbName option
// wins over the URI path; with neither, the driver falls back to "test".
function resolveDbName(uri, options) {
  return (options && options.dbName) || dbNameFromUri(uri) || 'test';
}

module.exports = {
  DEFAULT_TEST_URI,
  DEFAULT_TEST_DB,
  hostOf,
  dbNameFromUri,
  isAtlas,
  assertSafeTestUri,
  assertSafeDbName,
  resolveDbName,
};
