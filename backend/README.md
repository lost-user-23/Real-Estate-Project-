# HomeNest Backend

Node.js + Express + Mongoose (MongoDB) API for HomeNest. See
`../docs/backend-architecture.md` for the full contract this implements
against.

## Status

Implemented: health check, email-verified registration with JWT access
tokens and rotating refresh tokens, email one-time codes for sensitive account
changes and password reset, public read APIs (properties, featured listings,
locations, categories, builders, projects, articles), authenticated property
submission and owner management, Cloudinary image uploads, listing reports
(with "my reports"), saved properties, contact messages, an owner
contact-number endpoint for verified users, and an admin API. See "API
overview" below and `../docs/api-inventory-and-project-status.md`.

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

- `npm run dev` - start with nodemon (auto-restart).
- `npm start` - start once, for production/process managers.
- `npm run lint` - ESLint over the backend source.
- `npm test` - Jest + Supertest. Needs a **local** `mongod` (see "Running the tests" below); each test file uses its own `homenest_test_*` database.
- `npm run db:setup` - create/sync MongoDB indexes for every model in the registry.
- `npm run seed` - import every CSV in the `DataSet/` folder into MongoDB (properties, plus locations, categories and demo builder projects derived from them). See "Seeding the database" below.
- `npm run backfill:city-lower` - fill `cityLower`/`localityLower` on documents created before those fields existed.
- `npm run backfill:email-verified` - mark accounts created before email verification as verified.
- `npm run audit:image-urls` - read-only report of stored image URLs that are not own-Cloudinary URLs.
- `npm run admin:create` - create or promote an admin account (needs `ADMIN_EMAIL` and `ADMIN_PASSWORD`; optional `ADMIN_NAME`).

## API overview

Auth routes live under `/api/auth`; everything else under `/api/v1`.
Protected routes use the HTTP-only `token` cookie set by login or registration.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /api/auth/register` (email only, always `202`), `/verify-email`, `/resend-verification`, `/login`, `/refresh`, `/logout`, `/logout-all`; `GET/PATCH/DELETE /api/auth/me`; `POST /api/auth/request-action-code`, `POST /api/auth/change-password`, `PATCH /api/auth/change-email` (current password plus emailed code); `POST /api/auth/forgot-password`, `/verify-reset-otp`, `/reset-password`. Register, login, verify-email and reset-password: 10 attempts per 15 minutes per IP; account actions: 10 per 15 minutes per user; resend: 5 per hour per IP; forgot-password: 5 per hour per IP |
| Properties | `GET /properties`, `GET /properties/featured`, `GET /properties/:slug` (published only, public); `GET /properties/mine` (owner, any status, includes the owner's `contactNumber`); `GET /properties/:id/contact` (verified, 20 per hour per user, see below); `POST /properties` (verified, created as draft, 5 to 20 own-Cloudinary images); `PATCH/DELETE /properties/:id` (owner or admin) |
| Locations | `GET /locations/popular`, `GET /locations/suggestions` (60 per minute per IP), `GET /locations/:locationId/facilities` |
| Categories | `GET /categories`; admin `POST/PATCH/DELETE` |
| Builders, projects, articles | Public `GET /builders`, `/builders/:slug`, `/projects`, `/projects/new`, `/projects/:id`, `/articles`, `/articles/:slug` (builders are derived from published projects) |
| Reports | `POST /reports` (optional auth, 5 per hour per IP), `GET /reports/mine` (auth) |
| Saved properties | `GET /saved-properties/ids`, `GET /saved-properties`, `POST /saved-properties/:propertyId` (verified), `DELETE /saved-properties/:propertyId` |
| Contact messages | `POST /contact-messages` (public, 5 per hour per IP, honeypot field `website`) |
| Uploads | `POST /uploads/image` (verified; multipart field `image`, max 5 MB, jpg/jpeg/png/webp; 10 per 15 minutes and 50 per day per user; the server picks the Cloudinary folder `<CLOUDINARY_FOLDER>/<userId>`) |
| Admin (role `admin`) | `/admin/dashboard`, `/admin/properties` (+ `/:id`, `/bulk`), `/admin/locations`, `/admin/facilities`, `/admin/projects`, `/admin/articles`, `/admin/reports`, `/admin/contact-messages` |

Authentication is a 15-minute JWT access token (returned in the JSON body and
sent as `Authorization: Bearer`) plus a 7-day rotating refresh token. The
refresh token is an HTTP-only cookie named `refreshToken`, scoped to
`/api/auth`; only its SHA-256 hash is stored (`RefreshToken`, with a TTL
index). `POST /api/auth/refresh` rotates it, `POST /api/auth/logout` revokes
the current session, `POST /api/auth/logout-all` revokes every session, and
replaying a spent token (after a 10-second grace window for two-tab races)
revokes all of that user's sessions. Each session has an id carried in the
access token as `sid`, so revoking a session ends its access token at once;
at most 10 sessions per user are kept. Admin access is the `role` on the user.
A password change or reset revokes every session (a change starts a new one
for the caller). `COOKIE_SAMESITE` configures the cookie's SameSite policy
(defaults to `strict`).

Registration takes only an email (and optional name) and always answers `202`;
the account and the emailed link (`<APP_URL>/verify-email`, valid 24 hours)
are handled in the background, and the password is set when the link is used.
Password changes and email changes need the current password and a 6-digit
code emailed by `request-action-code` (10 minutes, 5 attempts); a new email
only takes effect after the link sent to it is used. Password reset is a
three-step OTP flow. Without `SMTP_HOST`, development prints these emails to
the console and production refuses to start.

Slugs for new properties come from the title, with a random hex suffix added
when the slug is already taken. If two creates race and the insert still hits
a duplicate slug, it is retried with a new suffix up to 3 times, then answered
with 409. Existing slugs never change.

Listing rules worth knowing: owners cannot change `status`, `verified`,
`featured`, `featuredRank`, `city`, `intent` or `propertyType` (silently
ignored). When a non-admin owner changes a verified listing's title, contact
number or photo set, `verified` is reset to `false`. An admin cannot publish or
verify a listing that lacks a description or has fewer than 5 photos. At most 8
listings (`MAX_FEATURED`) can be featured and published at once; going over
returns `409`.

### Contact numbers

`contactNumber` is private. Every property response strips it except two:

- `GET /api/v1/properties/:id/contact` returns `{ "contactNumber": "..." }`
  (or `null` if the owner gave none) to any logged-in user with a verified
  email, for published listings only. Drafts, archived and unknown ids are
  `404`; anonymous callers get `401`; unverified users get `403`; more than 20
  lookups per hour by one user get `429`. The response
  is `Cache-Control: private, no-store` and the number is never logged.
- `GET /api/v1/properties/mine` includes it on the caller's own listings.

## Running the tests

The tests create, fill and **drop whole databases**, so they never touch the
database in `MONGODB_URI`. They use `MONGODB_URI_TEST`, which defaults to
`mongodb://127.0.0.1:27017`, so you need a local MongoDB running first:

- **Windows:** install MongoDB Community Server (it can install a service), then
  `net start MongoDB`, or run it by hand: `mongod --dbpath C:\data\db`
  (create the folder first).
- **macOS (Homebrew):** `brew services start mongodb-community`
- **Linux:** `sudo systemctl start mongod`
- **Docker (any OS):** `docker run -d --name homenest-test-mongo -p 27017:27017 mongo:8`

Then `npm test`. Check it is reachable with `mongosh --eval "db.runCommand({ping:1})"`.

Safety rules, enforced in `tests/setup/jest.setup.js` (unit-tested in
`tests/dbSafety.test.js`):

- The run **refuses to start** if `MONGODB_URI_TEST` points at an Atlas host
  (`*.mongodb.net` / `mongodb+srv://`) or equals the `MONGODB_URI` in `.env`.
- Every connection is checked again when it is made: the database name must
  contain `test`, otherwise the test file fails before anything is written.
- Each test file picks its own `homenest_test_<area>` name by setting
  `process.env.MONGODB_DB_NAME` before it requires the app.

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
npm run seed                          # all CSVs in ../DataSet
npm run seed -- Pune_property_details.csv
npm run seed -- --replace-seeded      # wipe old seeded data first
npm run seed -- --full-mumbai         # import every Mumbai row
```

Required environment variables (see `.env.example`): `MONGODB_URI` and
`MONGODB_DB_NAME`. Both fall back to local defaults
(`mongodb://127.0.0.1:27017` / `homenest`) if unset, so the command above
works against a local `mongod` with no `.env` changes.

### What it does

`scripts/seed.js` reads the CSV files in `DataSet/` (one per city; the Mumbai
file is a real export, the other twelve are synthetic, 600 rows each, produced
by `scripts/seedData/generateCityDatasets.js`). Rows are mapped by
`scripts/seedData/transformDataset.js` and written to:

- `properties` - published, unverified, not featured, `ownerId: null`, with a
  placeholder `contactNumber`. Upserted by slug (`<title-slug>-<key>`), so
  reruns update in place.
- `propertyImages` - five `picsum.photos` placeholder images per listing
  (these are not Cloudinary URLs, so `npm run audit:image-urls` reports them).
- `locations` - one city row plus one row per locality, with live listing
  counts; the 12 busiest localities per run are flagged popular. Upserted on
  `cityLower` + `localityLower`.
- `categories` - derived from property type counts; upserted by slug.
- `projects` - demo projects from `scripts/seedData/builders.js` (five real
  developer names per city, two projects each; names, prices and possession
  labels are invented). The builders directory is derived from these.

By default only every second Mumbai row is imported (the file has about 23,400
rows); pass `--full-mumbai` to import all of them. Rows with no title, price,
area or a known property type are skipped and counted in the summary.

The seed no longer creates any users. Create an admin with
`npm run admin:create`.

### Replacing seeded data

`--replace-seeded` first deletes the images and properties with no owner
(`ownerId: null`) and **all** locations, categories, projects and articles,
including ones created by admins. It never touches user-owned listings. Without
the flag the seed only upserts and never deletes.

`scripts/seed-featured.js` (run with `node scripts/seed-featured.js`, no npm
alias) upserts a handful of featured demo listings and refuses to run if it
would exceed the 8-listing featured limit.

## Project layout

```text
src/
  server.js       entry point: starts HTTP server, connects Mongo, graceful shutdown
  app.js          Express app: middleware, routes, error handling
  config/         env var loading + validation, constants, Cloudinary and upload config
  db/             Mongoose connection lifecycle
  models/         Mongoose schemas, model registry, normalizedLocation plugin
  routes/         Express routers (auth, /api/v1 feature routers, admin)
  controllers/    route handler functions
  middleware/     auth (protect, restrictTo, optionalAuth, requireVerified), rate limiters, upload, request logging, 404, error handler
  services/       business logic used by controllers (auth, mail, property, builder, report, Cloudinary)
  utils/          AppError, asyncHandler, OTP/token helpers, validation, query parsing, response serializers
scripts/          DB setup (index sync), seed, backfills, audits, create-admin
tests/            Jest test suites
```

## Environment variables

See `.env.example`.

- `JWT_SECRET` is required in every environment. `src/services/auth.service.js`
  throws when it is empty, so the server will not start without it. Use a long
  random value (for example `openssl rand -hex 64`).
- With `NODE_ENV=production` the process refuses to start unless `MONGODB_URI`,
  `JWT_SECRET`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`, `APP_URL`, `SMTP_HOST`,
  `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
  `CLOUDINARY_API_SECRET` are all set. In production `JWT_SECRET` must also be
  at least 32 characters and not a placeholder (values copied from
  `.env.example` are rejected).
- `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT` and `CORS_ORIGIN` fall back to local
  defaults outside production only.
- `CORS_ORIGIN` is one exact origin or a comma-separated list (for example
  `https://www.example.com,https://example.com`). Entries are trimmed and lose
  trailing slashes; paths and `*` are rejected at startup.
- `CLOUDINARY_FOLDER` (default `property-images`) is optional.
- `TRUST_PROXY_HOPS` (default `0`) is the number of reverse proxies in front of
  the server. It is passed to Express `trust proxy` as a hop count; anything
  that is not a positive whole number (including `true`) is treated as `0`.
- `COOKIE_SAMESITE` (default `strict`; `lax` or `none` also allowed, anything
  else is rejected in production) configures the SameSite policy for the
  HTTP-only refresh-token cookie. It is `Secure` in production.
- `APP_URL` (default `http://localhost:3000`) is the frontend base URL used in
  emailed links. `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_USER`,
  `SMTP_PASS` and `MAIL_FROM` configure email.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 8 characters) and optional
  `ADMIN_NAME` are read only by `npm run admin:create`.
- `RATE_LIMIT_MAX` (default `200`) and `RATE_LIMIT_WINDOW_MS` (default
  `900000`, 15 minutes) set the global per-IP limit that sits under the
  stricter per-route limiters.

## Deploy notes

- Run with `NODE_ENV=production` and set every variable listed above; see
  `PRODUCTION_CHECKLIST.md` at the repo root.
- The login rate limiter keys on the client IP. Behind a reverse proxy or load
  balancer, set `TRUST_PROXY_HOPS` to the number of proxies (usually `1`), or
  every request appears to come from the proxy and all users share one budget.
  Do not set it higher than the real hop count: clients could then spoof their
  IP through `X-Forwarded-For`.
- Serve over HTTPS; the production refresh cookie is marked `Secure` and `HttpOnly`.

## Architectural decisions made during this setup

The architecture doc left some choices open, or didn't specify them at the
level needed to write code. Decisions made here, to be revisited if wrong:

1. **CommonJS, not ESM**, for the backend source (`require`/`module.exports`).
   The frontend is ESM under Next.js, but the backend is an independent
   package; CommonJS avoids extra Jest/ESM interop configuration. Easy to
   switch later since nothing outside `backend/` imports this code.
2. **Property status enum** uses exactly `draft`/`published`/`archived`. User
   submissions start as `draft` and an admin publishes them; a separate
   `pending_review` state was deliberately left out.
3. **Project and Article reuse the same `draft`/`published`/`archived` enum**
   as Property. The doc doesn't enumerate their status values explicitly, but
   the API section says "Only `published` properties, projects, and articles
   are public," implying a shared vocabulary. Factored into
   `src/models/contentStatus.js`.
4. **`PropertyImage` allows either `storageKey` or `url`**, enforced with a
   `pre('validate')` check requiring at least one. Uploaded images store the
   Cloudinary `url` and `publicId` (used for cleanup on delete or replace).
5. **Location/Category/Facility have no `timestamps`**, unlike User, Property,
   Project, Article, Report, SavedProperty and ContactMessage, which do.
   `PropertyImage` and `RefreshToken` get `createdAt` only.
6. **Location autocomplete** uses anchored prefix matching on the lower-cased
   `cityLower` / `localityLower` fields (single-field indexes), kept in sync by
   the `normalizedLocation` plugin. Query-level writes (`updateMany`,
   `findByIdAndUpdate`) skip that plugin, so those call sites set the fields
   themselves; `npm run backfill:city-lower` repairs older documents.
7. **Images live in Cloudinary.** The server streams uploads to a per-user
   folder, and listings may only reference own-Cloudinary URLs.
   `STORAGE_*` variables from the early design were never used.
8. **Response body shape for `/health`** (`{ status, uptimeSeconds, timestamp,
   mongo: { status } }`) is small and explicitly avoids leaking the Mongo URI
   or credentials. Errors use `{ error: { message, details? } }`; successful
   responses are plain resource objects rather than a `{ data, meta }`
   envelope.
9. **DB connection does not block server startup.** `connectToDatabase()` is
   fired without awaiting it in `server.js`, so the HTTP server (and
   `/health`) comes up even when MongoDB is briefly unreachable. This wasn't
   specified either way; it was chosen so `/health` can meaningfully report a
   `disconnected` status rather than the whole process failing to boot.
10. **Lint/test tooling**: ESLint (flat config, `eslint:recommended`) and
    Jest + Supertest, since the doc doesn't specify either and these are
    the ecosystem defaults for an Express + Mongoose service.
11. **No `legacyId` field was added to any schema.** The seed upserts on
    natural keys: `slug` (`Property`, `Category`), `cityLower`+`localityLower`
    (`Location`) and `name`+`cityLower` (`Project`, not schema-enforced).
12. **There is no Builder model.** Builders are derived from published
    `Project` documents grouped by `developer`, using a collated
    (case-insensitive) index so spelling variants count as one builder.
13. **Refresh-token rotation with session ids** replaced a single long-lived
    token, so a session can be revoked immediately and a replayed, stolen
    token revokes all of the account's sessions.

## Follow-up work

- Add `ContactMessage` to `src/models/index.js` so `npm run db:setup` syncs
  its index.
- Endpoints to list and revoke individual sessions (only logout and
  logout-everywhere exist today).
- The password-reset token `jti` is generated once per process in
  `auth.controller.js`; it is still checked against a per-user hash and
  consumed once, but generating it per request would be cleaner.
