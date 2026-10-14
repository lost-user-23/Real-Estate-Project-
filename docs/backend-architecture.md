# Backend Architecture

## Overview

The backend lives in `backend/` and is the production-facing API layer for the HomeNest real-estate application. The implementation is centered on:

- Node.js + Express 5 for HTTP routing and middleware (CommonJS)
- MongoDB via Mongoose 9 for persistence
- Short-lived JWT access tokens (sent as `Authorization: Bearer`) plus rotating refresh tokens in an HTTP-only `refreshToken` cookie
- Nodemailer (SMTP) for verification links, one-time codes and account notices
- Cloudinary for image upload hosting
- Rate limiting, origin validation, and verification-gated account flows for account and listing safety

The frontend (`frontend/`) talks to this API through `frontend/src/lib/api.js` and `frontend/src/lib/dataSource.js`, while the backend remains the source of truth for listing, account, moderation, and admin data.

## Runtime and request lifecycle

Entrypoints:

- `backend/src/server.js` starts the HTTP server and handles graceful shutdown
- `backend/src/app.js` creates the Express app and mounts middleware and route groups
- `backend/src/db/connection.js` manages MongoDB connection state and health reporting

The startup flow is intentionally resilient:

1. The HTTP server starts immediately.
2. `connectToDatabase()` is attempted in the background; a failure is swallowed rather than crashing the process.
3. `GET /health` stays available even when MongoDB is disconnected.
4. The app reports connection state through the health endpoint rather than blocking startup.

On `SIGINT`/`SIGTERM` the server closes, disconnects MongoDB and force-exits after 10 seconds.

This means the service can be brought up for local development and partial outage recovery without failing the whole API stack.

## Application structure

```text
backend/
+-- src/
|   +-- app.js                    # Express app factory and global middleware
|   +-- server.js                 # startup/shutdown lifecycle
|   +-- config/                   # env parsing, constants, Cloudinary and upload config
|   +-- controllers/              # route handlers
|   +-- db/                       # MongoDB connection logic
|   +-- middleware/               # auth, verification gate, rate limiting, uploads, error handling
|   +-- models/                   # Mongoose schemas, model registry, normalizedLocation plugin
|   +-- routes/                   # API route registration
|   +-- services/                 # auth, mail, Cloudinary, property, builder, report logic
|   +-- utils/                    # AppError, OTP/token helpers, validation, serializers, query helpers
+-- tests/                        # Jest integration tests (real MongoDB, one DB per file)
+-- scripts/                      # seed, index sync, backfills, admin creation, audits
+-- package.json                  # backend dependencies and scripts
+-- README.md                     # backend setup and operational notes
+-- .env.example                  # environment template
```

## Core architecture patterns

### 1. Route versioning and prefixing

The API is split into three public prefixes:

- `/health` for service health checks
- `/api/auth` for authentication and account management
- `/api/v1` for all feature and admin APIs

The versioned feature router is created in `backend/src/routes/index.js` and mounts, in order:

- properties
- articles
- categories
- locations
- admin
- reports
- builders
- projects
- uploads
- saved properties
- contact messages

### 2. Middleware stack

Global middleware in `src/app.js` runs in this order:

1. `trust proxy` set from `TRUST_PROXY_HOPS` (a hop count, never `true`)
2. `helmet()` for HTTP headers
3. `cors({ origin: config.corsOrigins, credentials: true })`
4. `cookie-parser` for the refresh-token cookie
5. origin validation for non-GET/HEAD/OPTIONS requests
6. global rate limiting
7. JSON body parsing (default 100 kb limit)
8. request logging (Morgan)
9. routes, then `notFound`, then the global error handler

Feature- and route-level middleware is then applied by the route files and includes:

- `protect` for authenticated access
- `restrictTo('admin')` for admin-only endpoints
- `requireVerified` to block unverified users from sensitive actions
- `optionalAuth` for routes that work anonymously but attach the user when a valid token is present (reports)
- route-specific rate limiters for auth, account actions, password reset, reports, uploads (per 15 minutes and per day), suggestions, contact numbers and contact messages
- `uploadImage` (multer) for single-image multipart uploads
- error handling via `AppError` and the global error middleware, which returns `{ error: { message, details? } }`

### 3. Authentication model

Authentication uses a short-lived access token plus a rotating refresh token.

- **Access token**: a 15-minute JWT with payload `{ id, role, sid }`. It is returned in the JSON body and sent as `Authorization: Bearer <token>`. It is not a cookie.
- **Refresh token**: 64 random bytes, stored only as a SHA-256 hash in the `RefreshToken` collection (TTL-indexed). It travels in the HTTP-only `refreshToken` cookie, scoped to `/api/auth`, valid for 7 days. `COOKIE_SAMESITE` sets its SameSite policy; the cookie is `Secure` in production.
- **Sessions**: each login creates a `sessionId`, carried as `sid` in the access token and kept across rotations. `protect` requires the session to still have a live refresh-token record, so deleting the records ends the session and its access token immediately. At most 10 sessions per user are kept; the oldest are pruned.
- **Rotation and reuse detection**: `POST /api/auth/refresh` atomically claims the token and issues a new one. Replaying a spent token within a 10-second grace window just returns `401`; after that it is treated as theft and every session of that user is revoked.
- **Stale tokens**: `isTokenStale` and `passwordChangedAt` invalidate access tokens issued before a password change. Password change, password reset, logout-all, account deletion and replay detection revoke all sessions.
- `restrictTo(...)` enforces role-based access for admin operations.
- `requireVerified` prevents unverified users from creating listings, reading contact numbers, saving properties or uploading media.

Registration does not take a password. `POST /api/auth/register` always answers `202`, and in the background either creates an unverified user and mails a link, re-sends a link (60 s cooldown), or mails an "account exists" notice. The link (`<APP_URL>/verify-email?token=...`) lasts 24 hours; the password is set when it is redeemed.

Sensitive account changes use **email step-up codes**: `POST /api/auth/request-action-code` mails a 6-digit code (10 minutes, 5 attempts, bound to the purpose) to the current address, and `change-password` / `change-email` require it alongside the current password. A changed email only takes effect after the link mailed to the new address is used.

Password reset is a three-step OTP flow: `forgot-password` (always `202`), `verify-reset-otp` (returns a 5-minute single-use reset token) and `reset-password`.

### 4. Persistence model

MongoDB is the system of record. Models are defined with Mongoose in `backend/src/models/`.

Current domains include:

- `User`
- `Property`
- `PropertyImage`
- `Location`
- `Facility`
- `Category`
- `Project`
- `Article`
- `Report`
- `SavedProperty`
- `RefreshToken`
- `ContactMessage` (defined but not in the `models/index.js` registry used by `db:setup`)

There is no Builder model: the builders directory is derived by grouping published `Project` records by `developer`, with a collated index so name case variants count as one builder.

Schema patterns include:

- `timestamps: true` for create/update tracking on most models
- enums for business status values such as property intent, type and status (`draft`/`published`/`archived`) and report status
- private fields hidden by default with `select: false`, such as `Property.contactNumber`, password and token hashes, and OTP fields
- a `normalizedLocation` plugin that maintains `cityLower` (and `localityLower` on `Location`) for case-insensitive filters; query-level writes such as `updateMany` skip it, so those call sites set the fields themselves
- unique constraints on domain keys such as property slug, article slug, category slug and user email, plus a unique `(userId, propertyId)` index on saved properties
- a TTL index on `RefreshToken.expiresAt`

### 5. Business domain responsibilities

Main backend domains and responsibilities:

- Auth and accounts: registration with email verification, login, refresh, logout, step-up codes, password reset, email and password changes, account deletion (with cascade cleanup)
- Properties: listing search, published detail reads, featured lists, owner property management, contact number access, creation and update, the unverify-on-trust-edit rule, the 8-listing featured limit, admin moderation and bulk actions
- Locations and facilities: suggested search, popular location list with live counts, location-facility relations, admin location updates
- Builders, projects and articles: public discovery and admin publishing flows
- Reports: public/optional-auth listing reports, "my reports" for reporters, and admin moderation
- Saved properties: authenticated wishlist / save list management
- Contact messages: public inbound contact submission (with honeypot) and admin triage
- Uploads: multipart image uploads to Cloudinary with user-scoped storage directories and ownership-checked cleanup
- Dashboard: admin metrics and summary views

## Middleware and security design

### Public API safety

The API intentionally validates request provenance and resource access before many write operations:

- CORS is limited to configured origins only; wildcard is rejected
- requests with non-safe methods must match an allowed `Origin` header when one is sent
- rate limiters protect authentication and abuse-prone actions
- `globalRateLimiter` (200 requests per 15 minutes per IP by default) adds defense-in-depth at the app entry point
- public routes are explicitly separated from authenticated/admin paths
- auth responses avoid account enumeration (`register`, `resend-verification` and `forgot-password` answer identically whether or not the email exists)

### Validation and normalization

The backend combines Mongoose validation with controller-level checks for request payloads on sensitive endpoints. Examples include:

- email normalization and uniqueness enforcement
- password, current-password and one-time-code validation flows
- strict limits on profile updates (name, phone format)
- property title, description, price, area, city, contact number (Indian mobile) and status validation
- listing images restricted to this project's own Cloudinary URLs, 5 to 20 per listing
- slug generation rules with retry logic for collisions
- upload rules such as file type, size and per-user rate constraints
- query parameter parsing (`utils/queryParams.js`) for city, free-text and keyword filters

## Environment and operational configuration

The app reads configuration from `.env` and validates required values when running in production.

Current configuration categories include:

- MongoDB: `MONGODB_URI`, `MONGODB_DB_NAME`
- JWT: `JWT_SECRET` (at least 32 non-placeholder characters in production)
- app identity: `APP_URL`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`, `COOKIE_SAMESITE`
- email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- image storage: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- rate limiting: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`

The server is designed to use the local frontend default `http://localhost:3000` when `CORS_ORIGIN` is unset in non-production mode, while production explicitly requires `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`, `APP_URL`, the SMTP host, user, password and `MAIL_FROM`, and the three Cloudinary credentials. Without `SMTP_HOST`, development prints emails (including links and codes) to the console and production refuses to send.

## Operational scripts

Backend scripts cover running, database setup, seeding, backfills and admin bootstrap:

- `npm run dev` - Nodemon development mode
- `npm start` - production server boot
- `npm run lint` - ESLint validation
- `npm test` - Jest test suite (needs a reachable MongoDB; each test file uses its own database)
- `npm run db:setup` - sync schema indexes to MongoDB
- `npm run seed` - import the CSV datasets in `DataSet/` (properties, derived locations and categories, demo builder projects)
- `npm run backfill:city-lower` - fill `cityLower`/`localityLower` on older documents
- `npm run backfill:email-verified` - mark pre-verification accounts as verified
- `npm run audit:image-urls` - read-only report of image URLs that are not own-Cloudinary URLs
- `npm run admin:create` - create or promote an admin user (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)

`scripts/seed-featured.js` and `scripts/migrate-legacy-image-urls.js` have no npm alias and run with `node`.

## Status and architectural notes

The backend is no longer a planning stub. It is an implemented service with real Mongo data models, authenticated flows, public catalog APIs, admin operations, and integration points for Cloudinary/email. The architecture is therefore a current-state design document rather than a future-state proposal.

The routes and controllers are the authoritative source of truth for the API surface. Documentation should reflect what is registered in `backend/src/routes/`, not what earlier planning documents described as a target state.

## Source of truth

Primary implementation references:

- `backend/src/app.js`
- `backend/src/server.js`
- `backend/src/routes/index.js`
- `backend/src/routes/*.js`
- `backend/src/models/*.js`
- `backend/src/controllers/*.js`
- `backend/src/services/*.js`
- `backend/src/middleware/*.js`
- `backend/src/config/index.js`
