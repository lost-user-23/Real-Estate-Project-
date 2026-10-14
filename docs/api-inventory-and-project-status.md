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
- `/api/auth` - authentication and account management (mounted outside the versioned router)
- `/api/v1` - all feature APIs and admin endpoints

This split is intentional in the current codebase and differs from the older architecture note. There is no `/api/v1/auth`, `/api/v1/me` or `/api/v1/users`.

## Conventions

- **Auth**: protected routes need `Authorization: Bearer <access token>`. The access token is a 15-minute JWT returned in the JSON body of login, verify-email, refresh and change-password. It is never a cookie. The only cookie is the HTTP-only `refreshToken`, scoped to `/api/auth`.
- **Access levels** used below: *Public*; *Optional auth* (`optionalAuth` attaches the user when a valid token is sent); *Authenticated* (`protect`); *Verified* (`protect` + `requireVerified`, 403 until the email is verified); *Admin* (`protect` + `restrictTo('admin')`).
- **Pagination**: default `limit` is 20 and is silently capped at 50.
- **Errors**: `{ "error": { "message", "details"? } }`. Rate-limit rejections are `429`.
- **Rate limits** use `express-rate-limit` with standard headers and are skipped when `NODE_ENV=test`.

## Health and status

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Returns `{ status, uptimeSeconds, timestamp, mongo: { status } }`. Excluded from the global rate limiter. |

## Authentication and account APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public; 10 / 15 min / IP | Body `{ email, name? }`. No password at this step. Always returns `202` with a generic message; the account and verification email are handled in the background. |
| POST | `/api/auth/verify-email` | Public; 10 / 15 min / IP | Body `{ token, password? }`. Register flow: sets the password (min 8 chars), marks the email verified and starts a session. Email-change flow: swaps in the pending email. |
| POST | `/api/auth/resend-verification` | Public; 5 / hour / IP | Always `202`. Resends the link for an unverified account or pending email, subject to a 60 s per-account cooldown. |
| POST | `/api/auth/login` | Public; 10 / 15 min / IP | Returns `{ user, accessToken }` and sets the refresh cookie. |
| POST | `/api/auth/refresh` | Public (cookie) | Rotates the refresh token and returns `{ user, accessToken }`. |
| POST | `/api/auth/logout` | Public (cookie) | Revokes the current session and clears the cookie. Idempotent. |
| POST | `/api/auth/logout-all` | Authenticated | Revokes every session for the user. |
| GET | `/api/auth/me` | Authenticated | Returns `{ user: { id, email, name, phone, role, emailVerified } }`. |
| PATCH | `/api/auth/me` | Authenticated | Update `name` (max 100 chars) and/or `phone`. Other fields are ignored. |
| DELETE | `/api/auth/me` | Authenticated; 10 / 15 min / user | Delete the account after password confirmation. The last admin cannot be deleted. |
| POST | `/api/auth/request-action-code` | Authenticated; 10 / 15 min / user | Body `{ purpose: "change-password" \| "change-email" }`. Emails a 6-digit code to the current address (60 s cooldown). Returns `202`. |
| POST | `/api/auth/change-password` | Authenticated; 10 / 15 min / user | Body `{ currentPassword, newPassword, code }`. Revokes all sessions and starts a new one. |
| PATCH | `/api/auth/change-email` | Authenticated; 10 / 15 min / user | Body `{ currentPassword, newEmail, code }`. Stores a pending email and mails a link to the new address; the email only changes after the link is used. |
| POST | `/api/auth/forgot-password` | Public; 5 / hour / IP (not enforced in development) | Always `202`. Mails a 6-digit reset code to verified accounts. |
| POST | `/api/auth/verify-reset-otp` | Public; 10 / 15 min / IP | Body `{ email, code }`. Returns a 5-minute `resetToken`. |
| POST | `/api/auth/reset-password` | Public; 10 / 15 min / IP | Body `{ resetToken, newPassword }`. Revokes all sessions; the user must log in again. |

Notes:

- Sensitive changes (`change-password`, `change-email`) require the current password **and** an emailed one-time code. Codes last 10 minutes, allow 5 attempts and are bound to their purpose.
- Refresh tokens are 7-day, rotating and stored only as SHA-256 hashes. Replaying a spent token (after a 10 s grace window for two-tab races) revokes all of that user's sessions.
- There is no endpoint that lists or revokes individual sessions; only `logout` (this session) and `logout-all`.
- Wrong current-password errors return `400`, not `401`, so the client does not log the user out.

## Property APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/properties` | Public | Search/list published properties with filters, sorting and pagination. |
| POST | `/api/v1/properties` | Verified | Create a listing; new listings start as `draft`, unverified and unfeatured. Needs 5 to 20 images. |
| GET | `/api/v1/properties/mine` | Authenticated | The caller's own properties across statuses, including `contactNumber`, `ownerId` and `status`. |
| GET | `/api/v1/properties/featured` | Public | Featured listings (default 8, max 50). Optional `?city`; a city with no featured listings falls back to the national list (`scope: "city" \| "national"`). |
| GET | `/api/v1/properties/:id/contact` | Verified; 20 / hour / user | Returns `{ contactNumber }` for a published listing with `Cache-Control: private, no-store`. |
| GET | `/api/v1/properties/:slug` | Public | Published property by slug. |
| PATCH | `/api/v1/properties/:id` | Authenticated (owner or admin) | Update a property. |
| DELETE | `/api/v1/properties/:id` | Authenticated (owner or admin) | Delete a property; returns `204`. |

List query parameters (`GET /properties`): `intent`, `propertyType`, `featured`, `sort` (`newest`, `featured`, `verified`, `price-asc`, `price-desc`), `city`, `locality`, `q` (keyword, max 100 chars, matched against title/locality/city), `bhk` (comma list of 0-20 plus at most one `N+`), `minPrice`, `maxPrice` (min must not exceed max), `page`, `limit`.

Property behavior currently implemented in the backend:

- public queries only return `published` listings; `ownerId`, `status`, `cityLower` and `contactNumber` are stripped from public responses
- slugs come from the title, with a random hex suffix when taken; a duplicate-key race is retried up to 3 times, then answered with `409`; slugs never change on update
- owners can edit title, description, area, price, BHK, locality, amenities, contact number, images and detail fields; `status`, `verified`, `featured`, `featuredRank`, `city`, `intent` and `propertyType` are admin-only and silently ignored for owners
- **unverify rule**: when a non-admin owner changes a verified listing's title, contact number or photo set (a pure reorder does not count), `verified` is reset to `false` in the same save
- **approval gate**: an admin update that publishes or verifies a listing requires a description and at least 5 images
- **featured limit**: at most 8 listings can be featured and published at once; going over returns `409`
- listing images must be this project's own Cloudinary URLs; deleting a listing (or replacing its photos) removes the Cloudinary assets on a best-effort basis

## Location and facility APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/locations/popular` | Public | Up to 12 popular locations sorted by rank, with live listing counts. |
| GET | `/api/v1/locations/suggestions` | Public; 60 / min / IP | `?q=` is required. Prefix-matches city/locality; returns at most 6. |
| GET | `/api/v1/locations/:locationId/facilities` | Public | Facility entries for a location. |
| GET | `/api/v1/admin/locations` | Admin | List locations for admin management. |
| PATCH | `/api/v1/admin/locations/:id` | Admin | Update location fields such as popularity, rank and image. |
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

## Builder and project APIs

There is no Builder model: builders are derived from published projects grouped by `developer` (case variants collapse into one builder).

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/builders` | Public | List builders, with `page`, `limit` (max 50) and optional `?city`. |
| GET | `/api/v1/builders/:slug` | Public | A builder and up to 100 of its published projects; optional `?city`. |
| GET | `/api/v1/projects/new` | Public | The 4 newest published projects. |
| GET | `/api/v1/projects` | Public | List published projects. |
| GET | `/api/v1/projects/:id` | Public | Published project by id. |
| GET | `/api/v1/admin/projects` | Admin | List projects for admin review. |
| POST | `/api/v1/admin/projects` | Admin | Create a project. |
| GET | `/api/v1/admin/projects/:id` | Admin | Read project details. |
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
| POST | `/api/v1/reports` | Optional auth; 5 / hour / IP (failed requests not counted) | Submit a listing report. Returns `201 { report, tracked }`. |
| GET | `/api/v1/reports/mine` | Authenticated | The caller's own reports, paginated, with a trimmed view (no reporter id or details). |
| GET | `/api/v1/admin/reports` | Admin | List reports for moderation. |
| GET | `/api/v1/admin/reports/:id` | Admin | Read a report, including a summary of the reported property. |
| PATCH | `/api/v1/admin/reports/:id` | Admin | Body exactly `{ status }`: `open`, `reviewing`, `resolved` or `rejected`. |

Report rules: `listingUrlOrId` is required (max 500 chars) and may be an id, a `/property/<slug>` path or a full property URL; `reason` must be one of five fixed reasons; `details` is max 2000 chars. A logged-in reporter can have only one live (`open` or `reviewing`) report per listing (`409` otherwise); anonymous reports are not de-duplicated.

## Saved property APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/saved-properties/ids` | Authenticated | Ids of the caller's saved, still-published properties. |
| GET | `/api/v1/saved-properties` | Authenticated | Paginated list of saved properties. |
| POST | `/api/v1/saved-properties/:propertyId` | Verified | Save a published property (idempotent). |
| DELETE | `/api/v1/saved-properties/:propertyId` | Authenticated | Remove a saved property. |

## Upload APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/uploads/image` | Verified; 10 / 15 min and 50 / day per user | Multipart field `image` (jpg/jpeg/png/webp, max 5 MB). Streams to Cloudinary folder `<CLOUDINARY_FOLDER>/<userId>` and returns `201 { url, publicId }`. |

## Contact message APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/contact-messages` | Public; 5 / hour / IP (failed requests not counted) | Submit a contact message (name 2-80, email, optional phone, message 10-2000). A hidden `website` honeypot field is silently accepted and discarded. |
| GET | `/api/v1/admin/contact-messages` | Admin | List submissions; optional `?status`, `page`, `limit`. |
| PATCH | `/api/v1/admin/contact-messages/:id` | Admin | Body exactly `{ status }`: `new`, `read` or `archived`. |

## Admin dashboard and bulk actions

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Admin | Counts for published, featured, awaiting-verification listings, popular locations, published projects and articles, and open reports. |
| GET | `/api/v1/admin/properties` | Admin | List properties across all states. |
| GET | `/api/v1/admin/properties/:id` | Admin | Read one property for admin review. |
| PATCH | `/api/v1/admin/properties/bulk` | Admin | Body `{ ids, updates }`; supports `status`, `verified`, `featured`, `featuredRank`, `city`, `intent`, `propertyType`. Returns `{ matchedCount, modifiedCount, ids }`. |
| DELETE | `/api/v1/admin/properties/bulk` | Admin | Body `{ ids }`. Returns `{ deletedCount, ids }`. |

## Current implementation status

### Implemented and active

- public property discovery, featured and detail APIs
- owner-managed property CRUD and private contact access
- passwordless-start registration with email verification, login, rotating refresh tokens, email-OTP step-up for sensitive changes and an OTP password reset
- admin dashboard, projects, articles, locations, facilities, reports, contact messages and bulk property actions
- Cloudinary upload flow for property images, with ownership-checked cleanup
- saved-property, report (including "my reports") and contact-message flows
- public data APIs for categories, locations, projects and builders

### Operational notes

This API is production-oriented from a backend perspective. The route tree is the primary contract for the backend and should be used as the source of truth for feature planning and QA. Known gaps: no per-session list/revoke endpoint, and `ContactMessage` is not part of the model registry, so `npm run db:setup` does not sync its index.

## Notable validation and security patterns

- `protect` verifies the Bearer access token, loads the user, rejects tokens issued before `passwordChangedAt`, and requires the token's session (`sid`) to still have a live refresh-token record, so revoking a session ends its access token immediately.
- `restrictTo('admin')` gates admin routes; admin routers add no extra limiters beyond the global one.
- `requireVerified` blocks unverified users from listing creation, contact lookup, saving and uploads.
- rate limiters are applied to auth, verification, password reset, reports, uploads, contact messages, contact-number lookups and location suggestions; a global per-IP limiter (200 per 15 minutes by default) sits underneath.
- non-safe requests (anything but GET/HEAD/OPTIONS) carrying an `Origin` outside the CORS allowlist get `403`.
- auth responses are deliberately uniform (`register`, `resend-verification`, `forgot-password` always answer `202`) to avoid revealing which emails have accounts.
- property contact information is protected from anonymous exposure and never logged.

## Documentation note

This document intentionally reflects the implemented route tree; it is not a wishlist for future work. When product scope or requirements drift from the current route registrations, the backend route files should be treated as the authoritative source.
