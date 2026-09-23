# HomeNest Backend Architecture

Status: Planning baseline
Date: 2026-09-22

## Purpose

The frontend is currently a Next.js prototype. Public content is read from mock data and simulated data-source functions. Admin changes are stored in browser localStorage. This document defines the backend contract that will replace those temporary implementations without requiring a redesign of the frontend.

## Current Frontend Contract

The backend must initially support these content types:

- `Property`
- `Location`
- `Category`
- `Project`
- `Article`
- `Report`
- `User`
- `PropertyImage`

Property values currently used by the frontend include:

- `id`, `slug`, `title`
- `intent`: `buy` or `rent`
- `propertyType`: `apartment`, `villa`, `independent-house`, `plot`, `pg-hostel`, or `commercial`
- `bhk`, `areaSqft`, `priceInRupees`
- `city`, `locality`, `amenities`
- `verified`, `featured`, `featuredRank`
- `publishedAt`, `status`
- `image` with `src` and `alt`

The existing frontend uses these property statuses:

- `draft`: not visible publicly
- `published`: visible in public API results
- `archived`: retained for administration but not publicly listed

## Proposed Architecture

### Application

- REST API service in the empty `backend/` directory.
- Node.js with a framework selected during setup, preferably Fastify or Express.
- Mongoose as the database access and validation layer.
- MongoDB as the primary document database.
- JSON responses using stable, camelCase API fields matching the frontend where practical.
- Version endpoints under `/api/v1` so future breaking changes do not silently break the frontend.

### Authentication

- Public users and administrators are separate roles.
- Use secure, HTTP-only session cookies or short-lived access tokens with refresh handling.
- Never trust an admin role supplied by the client.
- Admin write endpoints require authenticated admin authorization.
- Owner or agent phone numbers must not be included in anonymous property responses.

### Files and Images

Property images should be uploaded to object storage, not stored as database blobs. The database stores the object URL or storage key, alt text, display order, and the property relationship. The first implementation may use local development storage, but production storage must be configurable through environment variables.

## Initial Database Model

The following collections should be created in MongoDB. References should use MongoDB `ObjectId` values. Keep repeated display data embedded where it is read together, but keep users, reports, and properties as separate collections so permissions and moderation remain clear.

### User

- `id`
- `email` (unique)
- `passwordHash` or external-auth identifier
- `name`
- `role`: `user` or `admin`
- `createdAt`, `updatedAt`

### Property

- `id`
- `ownerId` (nullable for admin-created seed records; stored as an `ObjectId` reference)
- `slug` (unique)
- `title`
- `intent`
- `propertyType`
- `bhk` (nullable)
- `areaSqft`
- `priceInRupees`
- `city`
- `locality` (nullable)
- `amenities` (array of strings)
- `description`
- `contactNumber` (private field; never returned anonymously)
- `verified`
- `featured`
- `featuredRank` (nullable)
- `status`
- `publishedAt` (nullable)
- `createdAt`, `updatedAt`

### PropertyImage

- `id`
- `propertyId` (stored as an `ObjectId` reference)
- `storageKey` or `url`
- `alt`
- `displayOrder`
- `createdAt`

### Location

- `id`
- `city`
- `locality` (nullable)
- `activeListingCount`
- `popular`
- `popularRank` (nullable)
- `imageUrl` and `imageAlt` (nullable)

### Category

- `id`
- `name`
- `slug` (unique)
- `listingCount`
- `icon`

### Project

- `id`
- `name`
- `developer`
- `city`
- `locality`
- `imageUrl`
- `imageAlt`
- `startingPriceInRupees`
- `possessionLabel`
- `status`
- `publishedAt` (nullable)
- `createdAt`, `updatedAt`

### Article

- `id`
- `title`
- `slug` (unique)
- `excerpt`
- `content`
- `imageUrl`
- `imageAlt`
- `status`
- `publishedAt` (nullable)
- `createdAt`, `updatedAt`

### Report

- `id`
- `reporterId` (nullable `ObjectId` reference)
- `propertyId` (nullable `ObjectId` reference)
- `listingUrlOrId`
- `reason`
- `details`
- `status`: `open`, `reviewing`, `resolved`, or `rejected`
- `createdAt`, `updatedAt`

## MongoDB Indexes

Create these indexes during application startup or as part of the database setup process:

- `users.email` unique
- `properties.slug` unique
- `properties.status`, `properties.featured`, `properties.featuredRank`, and `properties.publishedAt`
- `properties.city`, `properties.locality`, `properties.intent`, and `properties.propertyType`
- `projects.status` and `projects.publishedAt`
- `articles.slug` unique
- `articles.status` and `articles.publishedAt`
- `locations.city`, `locations.popular`, and `locations.popularRank`
- A text or prefix-search index for location city/locality suggestions, depending on the selected autocomplete strategy

Use compound indexes for the most common query paths after measuring them, especially public property search and featured listings. Do not add indexes speculatively to every field.

## MongoDB Schema Rules

- Validate request bodies with the API layer and Mongoose schemas; MongoDB validation alone is not sufficient.
- Store prices as integer rupee values, not formatted strings.
- Store dates as BSON `Date` values; format them only in API responses.
- Use enum validation for `intent`, `propertyType`, `status`, and report status.
- Keep `contactNumber` in the property document but exclude it from anonymous projections.
- Use timestamps for `createdAt` and `updatedAt`.
- Use transactions for multi-document operations such as creating a property with its image records when the deployment supports them.

MongoDB does not use SQL migrations. Schema changes must be handled through versioned migration scripts or explicit, repeatable database setup scripts. Every schema change should document its rollout and rollback or compatibility strategy.

## Initial Public API

All endpoints use the `/api/v1` prefix.

### Health

```text
GET /health
```

Returns a simple service status and should not require authentication.

### Home page content

```text
GET /api/v1/properties/featured
GET /api/v1/locations/popular
GET /api/v1/categories
GET /api/v1/projects/new
GET /api/v1/articles/insights
```

Selection rules:

- Only `published` properties, projects, and articles are public.
- Featured properties are ordered by `featuredRank` ascending.
- Unranked featured properties follow by `publishedAt` descending.
- Featured properties are limited to 8.
- Popular locations require at least 5 active listings and are ordered by `popularRank`.
- Popular locations are limited to 12.
- New projects are ordered by `publishedAt` descending and limited to 4.
- Insights are ordered by `publishedAt` descending and limited to 3.

### Property details and search

```text
GET /api/v1/properties/:slug
GET /api/v1/properties?intent=buy&city=Bengaluru&locality=Koramangala&propertyType=apartment&minPrice=0&maxPrice=20000000
GET /api/v1/locations/suggestions?q=kor
```

The search endpoint must validate numeric price ranges, allowed intent values, and allowed property types. Location suggestions should return at most 6 results and should be rate-limited.

### First authenticated endpoints

These are planned after the public read API:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/me
POST /api/v1/properties
POST /api/v1/reports
```

The property submission endpoint starts new listings as `draft` or `pending_review`; it must not publish user submissions automatically.

### Admin endpoints

```text
GET   /api/v1/admin/properties
PATCH /api/v1/admin/properties/:id
DELETE /api/v1/admin/properties/:id
GET   /api/v1/admin/projects
POST  /api/v1/admin/projects
PATCH /api/v1/admin/projects/:id
DELETE /api/v1/admin/projects/:id
GET   /api/v1/admin/articles
POST  /api/v1/admin/articles
PATCH /api/v1/admin/articles/:id
DELETE /api/v1/admin/articles/:id
PATCH /api/v1/admin/locations/:id
```

Admin endpoints must enforce role authorization and validate every request body. Publishing, verification, featuring, and ranking are server-side operations, not only frontend toggles.

## Frontend Integration Boundary

The first frontend integration should replace the functions in `frontend/src/lib/dataSource.js` with HTTP requests while preserving the existing exported function names:

- `fetchFeaturedProperties()` -> `GET /api/v1/properties/featured`
- `fetchPopularLocations()` -> `GET /api/v1/locations/popular`
- `fetchCategories()` -> `GET /api/v1/categories`
- `fetchNewProjects()` -> `GET /api/v1/projects/new`
- `fetchInsights()` -> `GET /api/v1/articles/insights`

The components should continue to receive the same response shapes. API errors should continue to reach the existing loading/error UI. Mock data should remain available behind an explicit development fallback until the real endpoints are verified.

## Environment Variables

The backend should document these variables in `.env.example`:

```text
MONGODB_URI=
MONGODB_DB_NAME=homenest
PORT=4000
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

Secrets must not be committed. Production values must be configured by the deployment environment.

## Today’s Implementation Boundary

Today’s backend work should finish with:

1. A running backend service and `GET /health`.
2. The initial MongoDB collections, indexes, and versioned setup script.
3. Seed data derived from `frontend/src/lib/mockData.js`.
4. `GET /api/v1/properties/featured` backed by the database.
5. Request and response examples documented for the first API.
6. A clear follow-up task to connect `dataSource.js` to the API.

Authentication, file uploads, admin authorization, full search, and all write workflows are follow-up work. They should not be treated as complete just because the database can be queried.

## Open Decisions

- Choose Fastify or Express for the API service.
- Confirm MongoDB hosting for development and production, such as MongoDB Atlas.
- Decide whether to use Mongoose models or the official MongoDB driver directly.
- Choose session cookies or token-based authentication.
- Choose object storage provider for images.
- Decide whether amenities remain JSON or become normalized database records.
- Confirm the final public API response envelope, for example `{ data, error, meta }` versus direct arrays.
