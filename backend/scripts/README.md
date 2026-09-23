# scripts

One-off database setup scripts: versioned index-creation/migration scripts,
and the seed script that loads data derived from
`frontend/src/lib/mockData.js` (see docs/backend-architecture.md, "Today's
Implementation Boundary" and "MongoDB Schema Rules" — MongoDB has no SQL
migrations, so schema changes go through explicit, repeatable scripts here
instead).

- `setup-db.js` — run via `npm run db:setup` (see `../README.md` → "Setting
  up database indexes"). Syncs every model's indexes; never drops a
  collection or deletes data.
- `seed.js` — run via `npm run seed` (see `../README.md` → "Seeding the
  database" for usage, what it does, and how to rerun it safely).
- `seedData/` — pure helpers used by `seed.js`: `loadMockData.js` reads
  `frontend/src/lib/mockData.js` at run time, and `transform.js` converts and
  validates each mock record before it's written. Both are unit-tested in
  `../tests/seedTransform.test.js` without needing a MongoDB connection.

No migration scripts exist yet beyond index sync; that remains follow-up work.
