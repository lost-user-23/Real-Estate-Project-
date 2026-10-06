# Backend Architecture

## Overview

The backend lives in `backend/` and is the production-facing API layer for the HomeNest real-estate application. The implementation is centered on:

- Node.js + Express for HTTP routing and middleware
- MongoDB via Mongoose for persistence
- JWT-based authentication stored in an HTTP-only `token` cookie
- Cloudinary for image upload hosting
- Rate limiting, origin validation, and verification-gated account flows for account and listing safety

The frontend (`frontend/`) talks to this API through `frontend/src/lib/api.js` and `frontend/src/lib/dataSource.js`, while the backend remains the source of truth for listing, account, moderation, and admin data.

## Runtime and request lifecycle

Entrypoints:

- `backend/src/server.js` starts the HTTP server
- `backend/src/app.js` creates the Express app and mounts middleware and route groups
- `backend/src/db/connection.js` manages MongoDB connection state and health reporting

The startup flow is intentionally resilient:

1. The HTTP server starts immediately.
2. `connectToDatabase()` is attempted in the background.
3. `GET /health` stays available even when MongoDB is disconnected.
4. The app reports connection state through the health endpoint rather than blocking startup.

This means the service can be brought up for local development and partial outage recovery without failing the whole API stack.

## Application structure

```text
backend/
+-- src/
�   +-- app.js                    # Express app factory and global middleware
�   +-- server.js                 # startup/shutdown lifecycle
�   +-- config/                  # env parsing and shared configuration
�   +-- controllers/             # route handlers
�   +-- db/                      # MongoDB connection logic
�   +-- middleware/              # auth, validation, rate limiting, error handling
�   +-- models/                  # Mongoose schemas and model exports
�   +-- routes/                  # API route registration
�   +-- services/                # auth, email, Cloudinary, reporting logic
�   +-- utils/                  # helpers, AppError, serializers, query helpers
�   +-- tests/                  # Jest integration tests
+-- scripts/                     # seed, admin creation, db setup utilities
+-- package.json                 # backend dependencies and scripts
+-- README.md                   # backend setup and operational notes
+-- .env.example                 # environment template
```

## Core architecture patterns

### 1. Route versioning and prefixing

The API is split into two public prefixes:

- `/health` for service health checks
- `/api/auth` for authentication and account management
- `/api/v1` for all feature and admin APIs

The versioned feature router is created in `backend/src/routes/index.js` and mounts all feature domains:

- properties
- articles
- categories
- locations
- admin
- reports
- projects
- uploads
- saved properties
- contact messages

### 2. Middleware stack

Global middleware in `src/app.js` includes:

- `helmet()` for HTTP headers
- `cors({ origin: config.corsOrigins, credentials: true })`
- `cookie-parser` for JWT cookie access
- origin validation for non-GET requests
- global rate limiting
- JSON body parsing
- request logging

Feature- and route-level middleware is then applied by the route files and includes:

- `protect` for authenticated access
- `restrictTo('admin')` for admin-only endpoints
- `requireVerified` to block unverified users from sensitive actions
- route-specific rate limiters for login, editing account settings, reports, uploads, suggestions, and contact messages
- error handling via `AppError` and the global error middleware

### 3. Authentication model

Authentication is cookie-based and uses a signed JWT issued on register/login.

Important details in the current implementation:

- Cookies are HTTP-only and stored under the `token` name.
- `protect` verifies the cookie and loads the user from MongoDB.
- `isTokenStale` and `passwordChangedAt` validations invalidate older tokens after password changes.
- `restrictTo(...)` enforces role-based access for admin operations.
- `requireVerified` prevents unverified users from creating listings or uploading media.

The auth flow includes both standard account management and a verification pipeline for email confirmation and re-send flows.

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
- `ContactMessage`

Schema patterns include:

- `timestamps: true` for create/update tracking
- enums for business status values such as property intent and status
- private fields such as `Property.contactNumber` hidden from public projections
- normalized location fields used by search and filters
- unique constraints on domain keys such as property slug, article slug, and user email

### 5. Business domain responsibilities

Main backend domains and responsibilities:

- Auth and accounts: sign-up, login, logout, verification, email changes, password changes, account deletion
- Properties: listing search, published detail reads, owner property management, contact number access, property creation and update, admin moderation and bulk actions
- Locations and facilities: suggested search, popular location list, location-facility relations, admin location updates
- Projects and articles: public discovery and admin publishing flows
- Reports: public listing reports and admin moderation
- Saved properties: authenticated wishlist / save list management
- Contact messages: public inbound contact submission and admin triage
- Uploads: multipart image uploads to Cloudinary with user-scoped storage directories
- Dashboard: admin metrics and summary views

## Middleware and security design

### Public API safety

The API intentionally validates request provenance and resource access before many write operations:

- CORS is limited to configured origins only; wildcard is rejected
- requests with non-safe methods must match an allowed `Origin` header
- rate limiters protect authentication and abuse-prone actions
- `globalRateLimiter` adds defense-in-depth at the app entry point
- public routes are explicitly separated from authenticated/admin paths

### Validation and normalization

The backend combines Mongoose validation with controller-level checks for request payloads on sensitive endpoints. Examples include:

- email normalization and uniqueness enforcement
- password and current-password validation flows
- strict limits on profile updates
- property price, area, city, and status validation
- slug generation rules with retry logic for collisions
- upload rules such as file type and size constraints

## Environment and operational configuration

The app reads configuration from `.env` and validates required values when running in production.

Current configuration categories include:

- MongoDB: `MONGODB_URI`, `MONGODB_DB_NAME`
- JWT: `JWT_SECRET`
- app identity: `APP_URL`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`
- email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- image storage: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

The server is designed to use the local frontend default `http://localhost:3000` when `CORS_ORIGIN` is unset in non-production mode, while production explicitly requires essential secret values.

## Operational scripts

Backend scripts cover running, database setup, seeding, and admin bootstrap:

- `npm run dev` - Nodemon development mode
- `npm start` - production server boot
- `npm run lint` - ESLint validation
- `npm test` - Jest test suite
- `npm run db:setup` - sync schema indexes to MongoDB
- `npm run seed` - seed mock catalog content into MongoDB
- `npm run admin:create` - create an initial admin user

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
- `backend/src/middleware/*.js`
- `backend/src/config/index.js`
