const mongoose = require('mongoose');
const {
  assertSafeTestUri,
  assertSafeDbName,
  resolveDbName,
  dbNameFromUri,
  isAtlas,
  hostOf,
} = require('./setup/dbSafety');

// None of these tests connect to anything: they only check the rules that stop
// the test suite from ever running against real data.

describe('test database safety rules', () => {
  const ATLAS = 'mongodb+srv://someone:secret@cluster0.abc123.mongodb.net/?retryWrites=true';
  const ATLAS_STANDARD = 'mongodb://u:p@shard-00-00.abc123.mongodb.net:27017/db';

  it('recognises Atlas hosts, both srv and standard form', () => {
    expect(isAtlas(ATLAS)).toBe(true);
    expect(isAtlas(ATLAS_STANDARD)).toBe(true);
    expect(isAtlas('mongodb://127.0.0.1:27017')).toBe(false);
    expect(isAtlas('mongodb://localhost:27017/homenest_test')).toBe(false);
  });

  it('refuses an Atlas URI without printing its credentials', () => {
    expect(() => assertSafeTestUri(ATLAS)).toThrow(/Atlas host/);
    try {
      assertSafeTestUri(ATLAS);
    } catch (err) {
      expect(err.message).not.toContain('secret');
      expect(err.message).toContain('cluster0.abc123.mongodb.net');
    }
  });

  it('refuses the same URI the app uses in backend/.env', () => {
    expect(() => assertSafeTestUri('mongodb://db.internal:27017', ' mongodb://db.internal:27017 ')).toThrow(/identical/);
  });

  it('accepts a local URI', () => {
    expect(() => assertSafeTestUri('mongodb://127.0.0.1:27017', 'mongodb+srv://x@cluster0.y.mongodb.net/')).not.toThrow();
  });

  it.each(['homenest', 'production', 'app_db', '', undefined])('refuses database name %p', (name) => {
    expect(() => assertSafeDbName(name)).toThrow(/does not contain "test"/);
  });

  it.each(['homenest_test', 'homenest_test_import_upsert', 'MyTestDB'])('accepts database name %p', (name) => {
    expect(() => assertSafeDbName(name)).not.toThrow();
  });

  it('resolves the database name the way mongoose does: option, then URI path, then "test"', () => {
    expect(resolveDbName('mongodb://h/fromuri', { dbName: 'fromoption' })).toBe('fromoption');
    expect(resolveDbName('mongodb://h/fromuri?x=1', {})).toBe('fromuri');
    expect(resolveDbName('mongodb://h:27017', undefined)).toBe('test');
    expect(dbNameFromUri('mongodb+srv://u:p@c.mongodb.net/?a=b')).toBe('');
  });

  it('strips credentials when naming a host', () => {
    expect(hostOf(ATLAS)).toBe('cluster0.abc123.mongodb.net');
  });
});

describe('jest.setup.js enforcement', () => {
  it('has pointed this test run at the local test database, not backend/.env', () => {
    expect(process.env.MONGODB_URI).not.toMatch(/mongodb\.net|mongodb\+srv/i);
    expect(process.env.MONGODB_DB_NAME).toMatch(/test/i);
  });

  it('blocks mongoose.connect to an Atlas host before any network call', () => {
    expect(() => mongoose.connect(ATLAS_URL, { dbName: 'homenest_test_x' })).toThrow(/Atlas host/);
  });

  it('blocks mongoose.connect to a database whose name lacks "test"', () => {
    expect(() => mongoose.connect('mongodb://127.0.0.1:27017', { dbName: 'homenest' })).toThrow(/does not contain "test"/);
    expect(() => mongoose.connect('mongodb://127.0.0.1:27017/homenest')).toThrow(/does not contain "test"/);
  });

  it('blocks mongoose.createConnection the same way', () => {
    expect(() => mongoose.createConnection('mongodb://127.0.0.1:27017', { dbName: 'homenest' })).toThrow(/does not contain "test"/);
  });

  it('makes the whole test run refuse to start when MONGODB_URI_TEST is an Atlas URI', () => {
    const saved = { ...process.env };
    process.env.MONGODB_URI_TEST = ATLAS_URL;
    try {
      jest.isolateModules(() => {
        expect(() => require('./setup/jest.setup')).toThrow(/Atlas host/);
      });
    } finally {
      process.env.MONGODB_URI_TEST = saved.MONGODB_URI_TEST;
      if (saved.MONGODB_URI_TEST === undefined) delete process.env.MONGODB_URI_TEST;
    }
  });
});

const ATLAS_URL = 'mongodb+srv://someone:secret@cluster0.abc123.mongodb.net/?retryWrites=true';
