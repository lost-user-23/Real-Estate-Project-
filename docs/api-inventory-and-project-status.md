# API Inventory and Project Status

## Scope and source of truth

This inventory reflects the current API surface registered in the backend route tree, not the earlier planning notes or a proposed future state. The authoritative implementation lives in:

- `backend/src/app.js`
- `backend/src/routes/index.js`
- `backend/src/routes/*.js`
- `backend/src/controllers/*.js`
- `backend/src/middleware/*.js`

## API prefix model

The backend uses a hybrid prefix layout:

- `/health` - health checks
- `/api/auth` - authentication and account management
- `/api/v1` - all feature APIs and admin endpoints

This split is intentional in the current codebase and differs from the older architecture note.

## Health and status

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Returns API health and MongoDB connection status. |

## Authentication and account APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create an account; issues a JWT cookie and returns the user. |
| POST | `/api/auth/verify-email` | Public | Verify an emailed token; completes registration or email-change flow. |
| POST | `/api/auth/resend-verification` | Public | Resend a verification email when the current cooldown allows it. |
| POST | `/api/auth/login` | Public | Authenticate with email/password and issue the token cookie. |
| POST | `/api/auth/logout` | Public | Clear the cookie and return success. |
| GET | `/api/auth/me` | Authenticated | Return the current authenticated user profile. |
| PATCH | `/api/auth/me` | Authenticated | Update the user's `name` and/or `phone`. |
| DELETE | `/api/auth/me` | Authenticated | Delete the current account after password confirmation. |
| POST | `/api/auth/change-password` | Authenticated | Change password and reissue the auth cookie. |
| PATCH | `/api/auth/change-email` | Authenticated | Change email after password confirmation and verification. |

Notes:

- Auth routes use rate limiting to protect login and account-mutating actions.
- The backend uses HTTP-only `token` cookies.
- The auth flow also supports account verification and re-verification mail sending.

## Property APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/properties` | Public | Search/list published properties with filters, sorting, and pagination. |
| POST | `/api/v1/properties` | Authenticated + verified | Create a property listing; new listings start as drafts. |
| GET | `/api/v1/properties/mine` | Authenticated | Return the caller's own properties across statuses. |
| GET | `/api/v1/properties/featured` | Public | Return featured property sets for the landing sections. |
| GET | `/api/v1/properties/:id/contact` | Authenticated + verified | Return a private property contact number for a published listing; limited by per-user rate limit. |
| GET | `/api/v1/properties/:slug` | Public | Return a published property by slug. |
| PATCH | `/api/v1/properties/:id` | Authenticated | Update a property owned by the caller or an admin. |
| DELETE | `/api/v1/properties/:id` | Authenticated | Delete a property owned by the caller or an admin. |

Property behavior currently implemented in the backend:

- public property queries filter to `published` listings
- the backend exposes a private contact-number endpoint for verified users
- owner-owned listings can be queried even when not published via `/mine`
- property submission is gated by verification; the API does not auto-publish user submissions

## Location and facility APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/locations/popular` | Public | Return popular locations sorted by rank and active listing count. |
| GET | `/api/v1/locations/suggestions` | Public | Suggest city/locality matches with request throttling. |
| GET | `/api/v1/locations/:locationId/facilities` | Public | Return facility entries for a location. |
| GET | `/api/v1/admin/locations` | Admin | List locations for admin management. |
| PATCH | `/api/v1/admin/locations/:id` | Admin | Update location fields such as popularity and rank. |
| POST | `/api/v1/admin/facilities` | Admin | Create a facility record. |
| PATCH | `/api/v1/admin/facilities/:id` | Admin | Update a facility record. |
| DELETE | `/api/v1/admin/facilities/:id` | Admin | Delete a facility record. |

## Category APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/categories` | Public | List categories. |
| POST | `/api/v1/categories` | Admin | Create a category. |
| PATCH | `/api/v1/categories/:id` | Admin | Update a category. |
| DELETE | `/api/v1/categories/:id` | Admin | Delete a category. |

## Project APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/builders` | Public | List builders derived from published projects, with pagination and optional city filter. |
| GET | `/api/v1/builders/:slug` | Public | Return a builder and its published projects. |
| GET | `/api/v1/projects/new` | Public | Return newly published projects. |
| GET | `/api/v1/projects/builders` | Public | Return builder/developer groupings for project discovery. |
| GET | `/api/v1/projects` | Public | List published projects. |
| GET | `/api/v1/projects/:id` | Public | Return a published project by id. |
| GET | `/api/v1/admin/projects` | Admin | List projects for admin review. |
| POST | `/api/v1/admin/projects` | Admin | Create a project. |
| GET | `/api/v1/admin/projects/:id` | Admin | Read project details for admin work. |
| PATCH | `/api/v1/admin/projects/:id` | Admin | Update a project. |
| PATCH | `/api/v1/admin/projects/:id/publish` | Admin | Publish a project. |
| DELETE | `/api/v1/admin/projects/:id` | Admin | Delete a project. |

## Article and insight APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/articles` | Public | List published articles or insights. |
| GET | `/api/v1/articles/:slug` | Public | Read a published article by slug. |
| GET | `/api/v1/admin/articles` | Admin | List articles for admin management. |
| POST | `/api/v1/admin/articles` | Admin | Create an article. |
| GET | `/api/v1/admin/articles/:id` | Admin | Read an article for admin review. |
| PATCH | `/api/v1/admin/articles/:id` | Admin | Update an article. |
| PATCH | `/api/v1/admin/articles/:id/publish` | Admin | Publish an article. |
| DELETE | `/api/v1/admin/articles/:id` | Admin | Delete an article. |

## Report APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/reports` | Public; optional auth | Submit a listing report. |
| GET | `/api/v1/admin/reports` | Admin | List reports for moderation. |
| GET | `/api/v1/admin/reports/:id` | Admin | Read a report detail record. |
| PATCH | `/api/v1/admin/reports/:id` | Admin | Update the report moderation status. |

## Saved property APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/saved-properties/ids` | Authenticated | Return the caller's saved property ids. |
| GET | `/api/v1/saved-properties` | Authenticated | Return a paginated list of saved properties for the caller. |
| POST | `/api/v1/saved-properties/:propertyId` | Authenticated + verified | Save a property for the caller. |
| DELETE | `/api/v1/saved-properties/:propertyId` | Authenticated | Remove a saved property for the caller. |

## Upload APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/uploads/image` | Authenticated + verified | Upload an image to Cloudinary; the server selects a user-scoped folder. |

## Contact message APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/contact-messages` | Public | Submit a contact message with rate limiting. |
| GET | `/api/v1/admin/contact-messages` | Admin | List incoming contact submissions. |
| PATCH | `/api/v1/admin/contact-messages/:id` | Admin | Update contact message status. |

## Admin dashboard and bulk actions

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Admin | Return dashboard summary data and counts. |
| GET | `/api/v1/admin/properties` | Admin | List properties across states for admin review. |
| PATCH | `/api/v1/admin/properties/bulk` | Admin | Bulk-update supported property fields. |
| DELETE | `/api/v1/admin/properties/bulk` | Admin | Bulk-delete properties. |

## Current implementation status

### Implemented and active

- public property discovery and detail APIs
- owner-managed property CRUD and private contact access
- account registration, login, logout, and verification flows
- admin dashboard, projects, articles, locations, reports, and bulk property actions
- Cloudinary upload flow for property images
- saved-property and contact-message flows
- public data APIs for categories, locations, and projects

### Operational notes

This API is currently production-oriented from a backend perspective, even though a few user-facing product features remain future-scope or not yet fully wired to external vendors. The route tree is therefore the primary contract for the backend and should be used as the source of truth for feature planning and QA.

## Notable validation and security patterns

- `protect` enforces cookie-based auth and invalidates stale tokens.
- `restrictTo('admin')` gates admin routines.
- `requireVerified` blocks unverified users from sensitive listing and media actions.
- rate-limiters are applied to login, verification, reports, uploads, and contact-submission endpoints.
- non-safe requests validate the request `Origin` against an allowlist.
- property contact information is protected from anonymous exposure.

## Documentation note

This document intentionally reflects the implemented route tree; it is not a wishlist for future work. When product scope or requirements drift from the current route registrations, the backend route files should be treated as the authoritative source.
