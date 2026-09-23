# HomeNest Backend

Node.js + Express + Mongoose (MongoDB) API for HomeNest. See
`../docs/backend-architecture.md` for the full contract this implements
against.

## Status

This is the initial setup pass, plus a seed script:

- App/server scaffolding, config, DB connection, middleware.
- `GET /health`.
- Mongoose schemas for all documented collections (fields, enums, timestamps,
  references, and the indexes listed in the architecture doc).
- `scripts/setup-db.js`, which creates/syncs those indexes in MongoDB (see
  "Setting up database indexes" below).
- `scripts/seed.js`, which loads `frontend/src/lib/mockData.js` and writes it
  into MongoDB (see "Seeding the database" below).

No authentication, admin CRUD, file uploads, or public read endpoints (e.g.
`/api/v1/properties/featured`) are implemented yet. The `/api/v1` router is
mounted and empty, ready for those routes.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # edit values, especially MONGODB_URI, for your machine
npm run dev             # or: npm start
```

`GET /health` will respond as soon as the server is up, even if MongoDB is
unreachable — it reports MongoDB connectivity rather than requiring it.

```bash
curl http://localhost:4000/health
```

```json
{
  "status": "ok",
  "uptimeSeconds": 3,
  "timestamp": "2026-09-22T12:00:00.000Z",
  "mongo": { "status": "disconnected" }
}
```

`mongo.status` is one of `connected`, `connecting`, `disconnecting`, or
`disconnected` — never the connection string or any credential.

## Scripts

- `npm run dev` — start with nodemon (auto-restart).
- `npm start` — start once, for production/process managers.
- `npm run lint` — ESLint over the backend source.
- `npm test` — Jest + Supertest.
- `npm run db:setup` — create/sync MongoDB indexes for every model. See
  "Setting up database indexes" below.
- `npm run seed` — load `frontend/src/lib/mockData.js` into MongoDB. See
  "Seeding the database" below.

## Setting up database indexes

```bash
cd backend
npm run db:setup
```

Required environment variables: the same `MONGODB_URI`/`MONGODB_DB_NAME` as
`npm run seed`, with the same local defaults.

`scripts/setup-db.js` connects to MongoDB, loads every Mongoose model from
`src/models/`, and calls `Model.syncIndexes()` for each one — this creates
any index declared on the schema that's missing in the database, and drops
any index in the database that's no longer declared on the schema. It only
ever touches index metadata: **it never drops a collection or deletes a
document**, on this or any other run. Each model is synced independently, so
one model's index failure is reported without blocking the rest; the script
exits non-zero if MongoDB is unreachable or if any model failed to sync, and
prints the indexes confirmed for every collection that did succeed either
way, e.g.:

```text
[db:setup] indexes confirmed:
  Property (properties):
    - _id_ { _id:1 }
    - slug_1 { slug:1 } [unique]
    - status_1 { status:1 }
    - featured_1 { featured:1 }
    - featuredRank_1 { featuredRank:1 }
    - publishedAt_-1 { publishedAt:-1 }
    - city_1 { city:1 }
    - locality_1 { locality:1 }
    - intent_1 { intent:1 }
    - propertyType_1 { propertyType:1 }
  ...

[db:setup] done.
```

It's safe to rerun any time (e.g. after pulling a schema change), and safe to
run before or after `npm run seed` — Mongoose already auto-creates indexes
the first time a model connects, so `db:setup` mainly makes that step
explicit, repeatable, and able to clean up indexes a schema no longer
declares (the "explicit, repeatable database setup scripts" MongoDB needs in
place of SQL migrations, per the architecture doc).

## Seeding the database

```bash
cd backend
npm run seed
```

Required environment variables (see `.env.example`): `MONGODB_URI` and
`MONGODB_DB_NAME`. Both fall back to local defaults
(`mongodb://127.0.0.1:27017` / `homenest`) if unset, so the command above
works against a local `mongod` with no `.env` changes.

### What it does

`scripts/seed.js` reads `frontend/src/lib/mockData.js` at run time (via
`scripts/seedData/loadMockData.js`, which strips the file's `export`
keywords and evaluates it — the dataset is never hand-copied into the
backend, so it can't drift from the frontend) and writes it into these
collections: `users` (one dev admin only), `properties`, `propertyImages`,
`locations`, `categories`, `projects`, `articles`.

Conversions applied along the way:

- `publishedAt` strings become BSON `Date` values.
- Each property's `image.src`/`image.alt` becomes a separate `PropertyImage`
  document (`url`, `alt`) linked by `propertyId`; the same mapping applies to
  the `imageUrl`/`imageAlt` fields on `Location`, `Project`, and `Article`.
  Raw frontend image objects are never stored in MongoDB.
- Slugs (`properties.slug`, `articles.slug`), `featuredRank`, `popularRank`,
  statuses, prices, areas, amenities, and listing counts are carried over
  unchanged.
- `contactNumber` and `ownerId` are never invented — mock data has no owner
  contact numbers, so `properties.contactNumber` is left unset and
  `ownerId` is `null` (admin-seeded, per the architecture doc).

All records are validated (intent, propertyType, status enums; required
slugs; numeric price/area; numeric-or-null ranks) **before** any database
write happens. If any mock record fails validation, the script prints the
offending record and exits non-zero without touching MongoDB.

### Dev admin user

The `User` schema has `role` (`user`/`admin`) and an optional `passwordHash`,
but there's no authentication or password-hashing flow yet, so there is no
real hash to store. The script seeds exactly one admin user
(`dev-admin@homenest.local`) with `passwordHash` set to a random value
prefixed `unusable-seed-placeholder:` — this is **not a valid hash for any
algorithm** and cannot ever match a real password check. This account cannot
log in until authentication is implemented and a real credential is set for
it through that flow.

### Rerunning safely

The script only performs upserts keyed by each collection's natural unique
key (`email`, `slug`, or a `city`+`locality`/`propertyId`+`displayOrder`
pair) — it never deletes data. Rerunning `npm run seed` updates the same
seeded documents in place instead of creating duplicates, and never touches
unrelated documents in the same database.

### Expected summary

A successful run prints one line per collection, e.g.:

```text
[seed] summary:
  users           inserted: 0  updated: 1  total: 1
  properties      inserted: 0  updated: 12  total: 12
  propertyImages  inserted: 0  updated: 12  total: 12
  locations       inserted: 0  updated: 11  total: 11
  categories      inserted: 0  updated: 6  total: 6
  projects        inserted: 0  updated: 5  total: 5
  articles        inserted: 0  updated: 4  total: 4

[seed] done.
```

The first run reports `inserted` counts; later reruns report `updated`
counts for the same totals. If MongoDB is unreachable, the script prints a
clear connection error and exits with a non-zero status instead of hanging
or partially writing data.

## Project layout

```text
src/
  server.js       entry point: starts HTTP server, connects Mongo, graceful shutdown
  app.js          Express app: middleware, routes, error handling
  config/         env var loading + validation
  db/             Mongoose connection lifecycle
  models/         Mongoose schemas for each collection
  routes/         Express routers (health, versioned /api/v1 aggregator)
  controllers/    route handler functions
  middleware/     request logging, 404, centralized error handler
  services/       business logic used by controllers
scripts/          DB setup (index sync) and seed scripts
tests/            Jest test suites
```

## Environment variables

See `.env.example`. `MONGODB_URI`, `SESSION_SECRET`, and `CORS_ORIGIN` are
required in production (`NODE_ENV=production`); in development, missing
values fall back to local defaults so the server still starts.

## Architectural decisions made during this setup

The architecture doc left some choices open, or didn't specify them at the
level needed to write code. Decisions made here, to be revisited if wrong:

1. **CommonJS, not ESM**, for the backend source (`require`/`module.exports`).
   The frontend is ESM under Next.js, but the backend is an independent
   package; CommonJS avoids extra Jest/ESM interop configuration. Easy to
   switch later since nothing outside `backend/` imports this code.
2. **Property status enum** uses exactly `draft`/`published`/`archived`, matching
   the doc's "Current Frontend Contract" section. The doc's "First
   authenticated endpoints" section separately mentions a future
   `pending_review` state for user submissions — that's follow-up work and
   was deliberately left out of the enum for now.
3. **Project and Article reuse the same `draft`/`published`/`archived` enum**
   as Property. The doc doesn't enumerate their status values explicitly, but
   the API section says "Only `published` properties, projects, and articles
   are public," implying a shared vocabulary. Factored into
   `src/models/contentStatus.js`.
4. **`PropertyImage` allows either `storageKey` or `url`** (doc says
   "storageKey or url"), enforced with a `pre('validate')` check requiring at
   least one. No storage provider is wired up yet, so both stay plain string
   fields.
5. **Location/Category have no `timestamps`**, since the doc's field lists for
   those two collections don't mention `createdAt`/`updatedAt` (unlike User,
   Property, Project, Article, Report, which do). `PropertyImage` gets
   `createdAt` only, per its documented field list.
6. **Location autocomplete index**: the doc says a "text or prefix-search
   index... depending on the selected autocomplete strategy" and lists that
   strategy as unresolved. A plain MongoDB text index on `city`+`locality` was
   added as the minimal default so the documented index exists; if the
   frontend's `q=kor`-style prefix search needs different behavior (e.g. a
   dedicated prefix index or a search service), this should be revisited.
   No compound indexes were added beyond what's explicitly listed in the doc's
   "MongoDB Indexes" section, per its own "don't index speculatively"
   guidance.
7. **`.env.example` omits `STORAGE_*` variables** that appear in the doc's
   example env block. The task scope for this pass explicitly excludes file
   uploads/object storage, and no code reads those variables yet; adding
   unused config would be premature. They should be added back in the file
   upload follow-up.
8. **Response body shape for `/health`** (`{ status, uptimeSeconds, timestamp,
   mongo: { status } }`) is not specified by the doc beyond "simple service
   status" — chosen to be small and to explicitly avoid leaking the Mongo URI
   or credentials. The doc's broader "final public API response envelope"
   question (`{ data, error, meta }` vs. direct arrays) is still open and
   applies to future `/api/v1` endpoints, not this one.
9. **DB connection does not block server startup.** `connectToDatabase()` is
   fired without awaiting it in `server.js`, so the HTTP server (and
   `/health`) comes up even when MongoDB is briefly unreachable. This wasn't
   specified either way; it was chosen so `/health` can meaningfully report a
   `disconnected` status rather than the whole process failing to boot.
10. **Lint/test tooling**: ESLint (flat config, `eslint:recommended`) and
    Jest + Supertest, since the doc doesn't specify either and these are
    the ecosystem defaults for an Express + Mongoose service.
11. **No `legacyId` field was added to any schema.** The seed script needs a
    stable key per record so reruns update instead of duplicate, but every
    collection already had one: `email` (`User`), `slug` (`Property`,
    `Article`, `Category`), `city`+`locality` (`Location`), or
    `propertyId`+`displayOrder` (`PropertyImage`). `Project` has no unique
    field in the schema; the seed script upserts on `name`, which is unique
    across the 5 mock projects but isn't schema-enforced — worth revisiting
    if real project data can repeat names. No schema change was needed.
12. **Seed script uses a self-built `export` → `module.exports` rewrite**
    (`scripts/seedData/loadMockData.js`) to read
    `frontend/src/lib/mockData.js` at run time, rather than hand-copying the
    dataset into the backend. The frontend package has no `"type": "module"`,
    so neither `require()` nor dynamic `import()` can load that file as-is;
    adding a transpiler dependency for one file seemed heavier than a ~15
    line regex-based rewrite. Revisit if `mockData.js` grows imports of its
    own (this approach assumes the file is self-contained).

## Follow-up work (not in this pass)

- `GET /api/v1/properties/featured` and the rest of the public read API.
- Authentication (sessions/tokens) and admin authorization.
- Object storage integration for `PropertyImage`.
- Connecting `frontend/src/lib/dataSource.js` to the real API.
