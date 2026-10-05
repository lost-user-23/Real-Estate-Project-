# HomeNest API Inventory and Project Status

**Reviewed:** 2026-09-30  
**Scope:** Current workspace implementation, including existing uncommitted changes.  
**Audience:** Project review and mentor walkthrough.

## Executive Summary

**Estimated project completion: approximately 70% for the current MVP/prototype scope.** This is an informed estimate, not an automatically measured metric: the repository does not contain one complete, approved product requirements checklist against which every feature can be scored. The estimate reflects a substantial working API and admin experience, a production-buildable frontend, and passing automated checks, balanced against unfinished product integrations and launch-readiness work listed below.

The backend currently registers **57 distinct HTTP method/path operations** across 12 API areas. The API uses two prefixes: health checks are under `/health`, account/authentication routes are under `/api/auth`, and the feature API is under `/api/v1`. This prefix split is intentional in the current implementation; it differs from the older architecture proposal.

### Verification performed

| Check | Result |
|---|---|
| Backend tests | Passed: 23 suites, 318 tests |
| Backend lint | Passed |
| Frontend lint | Passed |
| Frontend production build | Passed; Next.js generated 30 routes |

The Jest run emitted non-blocking Mongoose deprecation warnings for the `new` option in `findOneAndUpdate`/`findOneAndReplace`. The working tree already contained report-related edits; this review includes the current contents and does not alter or discard those edits.

## API Inventory

“Implemented” means the method/path is registered in the current Express router and has a controller implementation. Authentication requirements are noted per route. Unless stated otherwise, request and response bodies are JSON. Protected endpoints use `Authorization: Bearer <token>`.

### Health

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/health` | Service health and MongoDB connection state; public. | Implemented |

### Authentication and Account

These routes use `/api/auth` (not `/api/v1/auth`). Register/login are rate-limited by client IP; sensitive account operations are rate-limited by user.

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| POST | `/api/auth/register` | Create an account and return a token/user; public. | Implemented |
| POST | `/api/auth/login` | Authenticate and return a token/user; public. | Implemented |
| GET | `/api/auth/me` | Return the authenticated user's profile. | Implemented |
| PATCH | `/api/auth/me` | Update the authenticated user's name/phone. | Implemented |
| DELETE | `/api/auth/me` | Delete the account after password confirmation; protected. | Implemented |
| POST | `/api/auth/change-password` | Change password and issue a replacement token; protected. | Implemented |
| PATCH | `/api/auth/change-email` | Change email after password confirmation; protected. | Implemented |

### Properties

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/properties` | Search/list published properties with filters and pagination; public. | Implemented |
| GET | `/api/v1/properties/mine` | List the caller's own properties, including non-public statuses; authenticated owner. | Implemented |
| GET | `/api/v1/properties/:id/contact` | Return contact number for a published property; authenticated, limited to 20 requests per user per hour. | Implemented |
| GET | `/api/v1/properties/:slug` | Read a published property by slug; public. | Implemented |
| POST | `/api/v1/properties` | Submit a property; authenticated; new submissions are drafts. | Implemented |
| PATCH | `/api/v1/properties/:id` | Update a property; authenticated owner or admin. | Implemented |
| DELETE | `/api/v1/properties/:id` | Delete a property; authenticated owner or admin. | Implemented |

### Locations

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/locations/popular` | List popular locations; public. | Implemented |
| GET | `/api/v1/locations/suggestions?q=...` | Autocomplete suggestions; public and rate-limited. | Implemented |
| GET | `/api/v1/locations/:locationId/facilities` | List facilities associated with a location; public. | Implemented |
| GET | `/api/v1/admin/locations` | List locations for administration; admin only. | Implemented |
| PATCH | `/api/v1/admin/locations/:id` | Update location fields such as popular flag/order; admin only. | Implemented |

### Facilities

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| POST | `/api/v1/admin/facilities` | Create a nearby facility; admin only. | Implemented |
| PATCH | `/api/v1/admin/facilities/:id` | Update a nearby facility; admin only. | Implemented |
| DELETE | `/api/v1/admin/facilities/:id` | Delete a nearby facility; admin only. | Implemented |

### Categories

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/categories` | List categories; public. | Implemented |
| POST | `/api/v1/categories` | Create a category; admin only. | Implemented |
| PATCH | `/api/v1/categories/:id` | Update a category; admin only. | Implemented |
| DELETE | `/api/v1/categories/:id` | Delete a category; admin only. | Implemented |

### Projects

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/projects/new` | List newly published projects; public. | Implemented |
| GET | `/api/v1/projects` | List published projects; public. | Implemented |
| GET | `/api/v1/projects/:id` | Read a published project; public. | Implemented |
| GET | `/api/v1/admin/projects` | List projects for administration; admin only. | Implemented |
| POST | `/api/v1/admin/projects` | Create a project; admin only. | Implemented |
| GET | `/api/v1/admin/projects/:id` | Read a project for administration; admin only. | Implemented |
| PATCH | `/api/v1/admin/projects/:id` | Update a project; admin only. | Implemented |
| PATCH | `/api/v1/admin/projects/:id/publish` | Publish a project; admin only. | Implemented |
| DELETE | `/api/v1/admin/projects/:id` | Delete a project; admin only. | Implemented |

### Articles / Insights

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/articles` | List published articles; public. | Implemented |
| GET | `/api/v1/articles/:slug` | Read a published article by slug; public. | Implemented |
| GET | `/api/v1/admin/articles` | List articles for administration; admin only. | Implemented |
| POST | `/api/v1/admin/articles` | Create an article; admin only. | Implemented |
| GET | `/api/v1/admin/articles/:id` | Read an article for administration; admin only. | Implemented |
| PATCH | `/api/v1/admin/articles/:id` | Update an article; admin only. | Implemented |
| PATCH | `/api/v1/admin/articles/:id/publish` | Publish an article; admin only. | Implemented |
| DELETE | `/api/v1/admin/articles/:id` | Delete an article; admin only. | Implemented |

### Reports

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| POST | `/api/v1/reports` | Submit a listing report; public, with optional authentication; rate-limited. | Implemented |
| GET | `/api/v1/admin/reports` | List reports for moderation; admin only. | Implemented |
| GET | `/api/v1/admin/reports/:id` | Read a report; admin only. | Implemented |
| PATCH | `/api/v1/admin/reports/:id` | Update report moderation status; admin only. | Implemented |

### Saved Properties

All routes require authentication and are scoped to the caller. Backed by the `SavedProperty` model, which has a unique `(userId, propertyId)` index. Saves are deleted when the property is deleted (single or bulk) and when the user's account is deleted.

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/saved-properties/ids` | List the IDs of the caller's saved properties; authenticated. | Implemented |
| GET | `/api/v1/saved-properties` | Paginated list of the caller's saved properties (`page`, `limit`); authenticated. | Implemented |
| POST | `/api/v1/saved-properties/:propertyId` | Save a property; authenticated. | Implemented |
| DELETE | `/api/v1/saved-properties/:propertyId` | Remove a saved property; authenticated. | Implemented |

### Admin Dashboard and Bulk Property Actions

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Return dashboard counts/summary; admin only. | Implemented |
| GET | `/api/v1/admin/properties` | List properties across statuses for administration; admin only. | Implemented |
| PATCH | `/api/v1/admin/properties/bulk` | Bulk-update supported property fields; admin only. | Implemented |
| DELETE | `/api/v1/admin/properties/bulk` | Bulk-delete properties; admin only. | Implemented |

### Uploads

| Method | Endpoint | Purpose and access | Status |
|---|---|---|---|
| POST | `/api/v1/uploads/image` | Upload one image (multipart field `image`, max 5 MB, jpg/jpeg/png/webp) to Cloudinary in a server-selected user folder; authenticated and rate limited. | Implemented |

## Not Implemented or Not Exposed as Dedicated APIs

These are absent as dedicated endpoints in the current route tree. Some behavior is available through a broader existing endpoint; those cases are distinguished below so they are not mistaken for missing functionality.

| Capability or proposed route | Current state |
|---|---|
| `POST /api/v1/auth/logout` | No server logout endpoint. The frontend logs out by clearing the locally stored token; tokens are otherwise invalidated through account/password changes or expiry. |
| `GET /api/v1/properties/featured` | No dedicated route. Featured listings are fetched through `GET /api/v1/properties?featured=true&limit=50` and ordered/capped in the frontend. |
| `GET /api/v1/articles/insights` | No dedicated route. The frontend uses `GET /api/v1/articles?limit=3`. |
| Builder/developer API | No Builder model or endpoint. Builder cards are derived from published projects. |
| Contact/support message API | Not implemented; the contact form's confirmation is local UI behavior. |
| Analytics event ingestion API/vendor integration | Not implemented; the current tracking wrapper is not connected to a configured analytics service. |
| Saved-search alerts, map search, mobile app, multi-language APIs | Not part of the current API; the product brief identifies these as future scope. |

## Project Findings and Estimate

### What is working

- The backend has a broad, versioned feature API with public, authenticated-owner, and admin-only operations.
- The frontend includes public discovery/detail flows, search, account/profile management, property submission, owner contact access, reporting, and admin management pages.
- API-backed workflows include admin operations, account pages, property search/details, location/category/project/article content, property submission, and reports.
- Automated checks passed as recorded above.

### Remaining work / limits

- The contact/support form has no backend submission, and analytics has no real provider/ingestion integration.
- There is no separate Builder API; builder data is derived from projects.
- Cloudinary uploads require valid credentials, and persistent runtime behavior requires MongoDB. Deployment configuration, production credentials, and live deployment were not verified in this review.
- The architecture document is a planning baseline and is stale in places: it describes an empty backend/localStorage-based admin and proposes routes/prefixes that differ from the current implementation. The current Express route declarations in `backend/src/routes/` are authoritative for the inventory above.
- `docs/current-capabilities-and-file-guide.md` says featured properties and insights are mock-backed, but the current `frontend/src/lib/dataSource.js` fetches both through the API. That part of the guide should be reconciled with the code.

### Completion estimate

**Approximately 70% complete as an MVP/prototype.** The core application and API are substantially implemented and build/test clean. The remaining estimate reflects missing product integrations, future-scope features, and unverified production deployment/readiness. This percentage should not be presented as an exact audit score until the team agrees on a complete requirements checklist and weights each requirement.

## Source of Truth

- Current API registration: `backend/src/app.js`, `backend/src/routes/index.js`, and the individual files in `backend/src/routes/`.
- Current frontend data access: `frontend/src/lib/dataSource.js`, `frontend/src/lib/api.js`, and `frontend/src/lib/admin-store.jsx`.
- Product scope references: `docs/backend-architecture.md` (planning baseline), `docs/landing-page-prd.md`, and `docs/current-capabilities-and-file-guide.md` (contains the noted drift).