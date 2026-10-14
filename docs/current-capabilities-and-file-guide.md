# HomeNest: Current Capabilities and File Guide

**Reviewed:** 2026-10-13  
**Purpose:** Describe what the current workspace actually does, distinguish live API behavior from static content, and provide a directory-by-directory guide to the project files.

This describes the implementation in the current workspace, not every feature described in the planning documents. Generated output and dependency contents (`node_modules`, `.next`, coverage files) are excluded. `backend/.env` is local configuration and must not be shared or committed.

## Project at a Glance

HomeNest is a real-estate discovery and listing platform with a Next.js 16 / React 19 frontend, an Express 5 / Mongoose 9 backend, and MongoDB persistence. The frontend and backend are separate npm packages. The browser app is API-backed end to end: every home-page section, search, property/project/article pages, the account pages and the whole admin area read live data. The only mock-style content left is static copy (about, careers, FAQs, legal, "why choose us") and the hero background slides, which are placeholder images.

The backend is mounted at `http://localhost:4000` by default. The frontend API client uses `NEXT_PUBLIC_API_URL` when set, otherwise it calls that default. Local CORS defaults to `http://localhost:3000`.

## What a Public User Can Do Now

| User workflow | Current behavior |
|---|---|
| Browse the home page | Hero search with recent searches, a featured showcase, popular locations, categories, new projects, a builders promo, why-choose-us, insights and an app-promotion note. Every data section is API-backed, hides itself when empty, shows skeletons while loading and has its own Retry on failure. |
| Search properties | `/search` calls `GET /api/v1/properties` with `intent`, `city`, `locality`, `propertyType`, `minPrice`/`maxPrice`, keyword `q` (max 100 chars, matches title/locality/city), `bhk` (e.g. `2,3` or `4+`), `sort` (`newest`, `featured`, `verified`, `price-asc`, `price-desc`) and `page`, 12 results per page. Filters live in the URL so refresh and back work; a page past the end redirects to the last page. |
| Get location suggestions | The hero autocomplete calls `GET /api/v1/locations/suggestions`, after 2 characters with a 300 ms debounce, shows up to 6 results (cities first, then localities), supports Arrow/Enter/Escape and shows "No matches, try a nearby city" when empty. |
| Create an account | The login prompt registers with email (and optional name) only: `POST /api/auth/register` always answers `202` and a verification link is emailed. The password is chosen on `/verify-email`, which also signs the user in. Unverified users see a verification banner with a resend link. |
| Log in and stay logged in | `POST /api/auth/login` returns a 15-minute access token, kept only in memory, and sets a 7-day HTTP-only refresh cookie. A 401 triggers one single-flight `POST /api/auth/refresh` and a retry. A non-secret `homenest_session_hint` flag tells the app whether a refresh on page load is worthwhile. |
| Reset a forgotten password | `/forgot-password`: request a 6-digit code by email, verify it, then set a new password. Copy never reveals whether an account exists. |
| Submit a property | `/post-property` is a single form (city/type prefill from the query string). It requires at least five photos, uploads each through `POST /api/v1/uploads/image`, then calls `POST /api/v1/properties`. Submitting while logged out opens the login prompt and continues afterwards. The listing is created as a `draft` and must be approved by an admin. |
| Manage account and listings | `/profile` (login required) lets a user edit name and phone, change password and change email (both need the current password **and** an emailed 6-digit code), delete the account, edit or delete their own listings (from `GET /api/v1/properties/mine`) and see their submitted reports. Changing the password keeps the current session and signs other devices out. A changed email applies only after the link sent to the new address is opened. |
| Keep a listing verified | If an owner edits a verified listing's title, contact number or photos, the listing is un-verified until an admin reviews it again. Description, price and location edits do not. |
| Save a property | Users can toggle a favourite; logged-out clicks open the login prompt and save after login. Saves are persisted per account through `/api/v1/saved-properties`, with optimistic updates that roll back on failure. `/saved` (login required) lists them 20 at a time with a Load more button; un-hearting a card there keeps it on the page until the next load. |
| View owner contact | Contact numbers are shown to logged-in, verified users only. Logged out, `ContactOwnerCard` prompts to log in and reveals the number after login. "Show contact number" calls `GET /api/v1/properties/:id/contact` (20 per hour per user). Rate limiting, missing listings and other errors show a message in the card. Owners also see their own numbers under My listings. |
| Report a listing | The property page links to `/report` with the listing prefilled. The form submits `{ listingUrlOrId, reason, details }` (one of five fixed reasons) to `POST /api/v1/reports`; the reporter is attached when logged in, and a duplicate live report for the same listing is rejected. Logged-in reporters track status (Received, Under review, Action taken, Closed) under My reports on `/profile`. |
| Contact HomeNest | `/contact` submits to `POST /api/v1/contact-messages` (rate limited, with a hidden honeypot field). Admins triage messages at `/admin/messages`. |
| Browse property/project/article details | The property page is server-rendered with a keyboard-navigable gallery, detail rows, amenities, `generateMetadata` (title, description, canonical, Open Graph, Twitter, first photo as share image) and Save, Report and Contact controls. Project pages (`/project/[id]`) and articles (`/insights/[slug]`) are fetched from the API; a malformed or missing id shows not found. |
| Browse builders | `/builders` lists popular and all builders derived from published projects (up to 50, with a note when truncated) and loads a builder's projects on demand. |
| Browse tools and informational pages | The EMI and property-value calculators run in the browser. The value estimate uses local city-rate data and is indicative, not a formal appraisal. About, careers, FAQs, help and legal pages are static content. |
| Resume a recent search / select a city | Recent searches (up to five) and the selected city (13 supported cities plus "All India") are stored in browser localStorage. They are device-local, not account data. |

### Home Page Data Sources

| Home section | Source today |
|---|---|
| Featured properties | `GET /api/v1/properties/featured?limit=5[&city]`; falls back to a nationwide list when the selected city has none. Shown as one showcase panel with a thumbnail rail, pause button and reduced-motion support. |
| Popular locations | `GET /api/v1/locations/popular`, filtered client-side to `activeListingCount >= 5` and sorted by rank |
| Property categories | `GET /api/v1/categories` |
| New projects | `GET /api/v1/projects/new`; filtered to the selected city when possible, otherwise nationwide with a notice |
| Builders promo | Static, city-aware copy linking to `/builders` |
| Why choose us | Static (four benefits) |
| Insights | `GET /api/v1/articles?limit=3` |
| App promotion | Static note that an app is planned; no store buttons or waitlist |

Analytics is opt-in: with `NEXT_PUBLIC_GA_MEASUREMENT_ID` empty there is no banner, script or event. With an ID set, GA4 loads only after the visitor clicks Accept, and the footer "Manage consent" link withdraws consent.

## What an Admin Can Do Now

### In the Admin Web UI

The admin area at `/admin` is backed by the real API. It uses the same refresh-cookie session as the public site (`auth-context.jsx`). `/admin` shows a login form until the signed-in user has `role: "admin"`; signing in through it with a non-admin account shows "This account is not an admin" and logs that account out again. If the session cannot be verified because the backend is unreachable, a Retry / Log out panel is shown. The role check in the UI is a convenience only: the backend enforces `protect` plus `restrictTo('admin')` on every admin route. Destructive actions use a promise-based confirmation dialog.

| Admin screen | Actions available | API |
|---|---|---|
| Dashboard | Counts for published, featured and awaiting-verification listings, popular locations, published projects and articles, and open reports. | `GET /api/v1/admin/dashboard` |
| Listings | Search, filter and sort; add a listing (5+ photos); edit; change status, featured flag and rank; bulk update or delete; open the Review modal (photos, description, facts) to Approve (published + verified) or Reject (draft + unverified). Featuring beyond 8 is refused by the backend. | `/api/v1/admin/properties`, `/api/v1/properties/:id`, `/api/v1/admin/properties/bulk`, `/api/v1/uploads/image` |
| Popular locations | Toggle popular flag and rank (a location needs 5+ active listings to appear); manage nearby facilities. | `/api/v1/admin/locations`, `/api/v1/admin/facilities` |
| Categories | Create, edit, delete. | `/api/v1/categories` |
| Projects | Add, edit, publish, change status, delete. | `/api/v1/admin/projects` |
| Insights/articles | Add, edit, publish, change status, delete. | `/api/v1/admin/articles` |
| Reports | List, filter and change report status (open, reviewing, resolved, rejected). | `/api/v1/admin/reports` |
| Messages | List contact messages and mark them new, read or archived. | `/api/v1/admin/contact-messages` |
| Profile | Account forms and logout. | Shared session |

Create a real admin with `npm run admin:create` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). The seed script no longer creates any users.

### Admin API Operations

| Operation | API route(s) |
|---|---|
| Dashboard counts | `GET /api/v1/admin/dashboard` |
| List / read all listings (any status) | `GET /api/v1/admin/properties`, `GET /api/v1/admin/properties/:id` |
| Bulk update listing status, verification, featured state/rank, and city/intent/type; bulk-delete listings | `PATCH /api/v1/admin/properties/bulk`, `DELETE /api/v1/admin/properties/bulk` |
| Edit/delete any property | `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id` |
| List/update locations, including popular flag and rank | `GET /api/v1/admin/locations`, `PATCH /api/v1/admin/locations/:id` |
| Create/update/delete nearby facilities | `POST /api/v1/admin/facilities`, `PATCH /api/v1/admin/facilities/:id`, `DELETE /api/v1/admin/facilities/:id` |
| Create/update/delete categories | `POST /api/v1/categories`, `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` |
| List/read/create/update/publish/delete projects | `/api/v1/admin/projects` and `/api/v1/admin/projects/:id` routes |
| List/read/create/update/publish/delete articles | `/api/v1/admin/articles` and `/api/v1/admin/articles/:id` routes |
| List/read reports and update report status | `/api/v1/admin/reports` and `/api/v1/admin/reports/:id` routes |
| List contact messages and update status | `/api/v1/admin/contact-messages` and `/api/v1/admin/contact-messages/:id` routes |

## API Surface Implemented

All routes below are registered by the current backend. Unless noted, API routes are under `/api/v1`. See `docs/api-inventory-and-project-status.md` for the full table with rate limits.

| Method and path | Purpose / access |
|---|---|
| `GET /health` | Health and MongoDB connection state; public |
| `POST /api/auth/register`, `/verify-email`, `/resend-verification` | Passwordless-start registration (always `202`), link redemption that sets the password and starts a session, and a cooldown-limited resend. |
| `POST /api/auth/login`, `/refresh`, `/logout`, `/logout-all` | Login returns `{ user, accessToken }` and sets the refresh cookie; refresh rotates it; logout revokes this session; logout-all revokes every session. Login, register and verify-email are limited to 10 attempts per 15 minutes per IP. |
| `GET/PATCH/DELETE /api/auth/me` | Current user; update name and phone; delete the account (needs the current password; the last admin cannot be deleted). Bearer authentication required. |
| `POST /api/auth/request-action-code`, `POST /api/auth/change-password`, `PATCH /api/auth/change-email` | Emailed 6-digit step-up code plus the current password. Change-password revokes all sessions and starts a fresh one. Account actions: 10 attempts per 15 minutes per user. |
| `POST /api/auth/forgot-password`, `/verify-reset-otp`, `/reset-password` | OTP password reset: always-`202` request (5 per hour per IP), code check that returns a 5-minute reset token, and the reset itself. |
| `GET /api/v1/properties`, `/properties/featured`, `/properties/:slug` | Public published-property search, featured list and detail |
| `GET /api/v1/properties/mine` | Authenticated: the caller's own listings of any status, paginated, including their `contactNumber`. Registered before `/:slug`. |
| `GET /api/v1/properties/:id/contact` | Verified, 20 requests per hour per user. Returns `{ contactNumber }` for published listings; `404` for drafts, archived or unknown ids. `Cache-Control: private, no-store`; the number is never logged. Every other property response strips `contactNumber`. |
| `POST /api/v1/properties` | Verified property submission (5 to 20 own-Cloudinary images); created as draft. The slug comes from the title; a duplicate gets a random hex suffix, with up to 3 retries on a race, then `409`. |
| `PATCH/DELETE /api/v1/properties/:id` | Authenticated owner/admin update or delete |
| `GET /api/v1/admin/dashboard`, `/admin/properties[/:id]`, `PATCH`/`DELETE /admin/properties/bulk` | Admin dashboard, all-status listing list/detail, bulk listing operations |
| `GET /api/v1/locations/popular`, `/locations/suggestions?q=...`, `/locations/:locationId/facilities` | Public popular locations, rate-limited autocomplete (60 per minute per IP) and nearby facilities |
| `GET/PATCH /api/v1/admin/locations`, `POST/PATCH/DELETE /api/v1/admin/facilities...` | Admin location and facility management |
| `GET /api/v1/categories`; `POST/PATCH/DELETE /api/v1/categories...` | Public categories; admin category CRUD |
| `GET /api/v1/builders`, `/builders/:slug` | Public builders derived from published projects |
| `GET /api/v1/projects/new`, `/projects`, `/projects/:id` | Public published project reads |
| `GET/POST/PATCH/DELETE /api/v1/admin/projects...` | Admin project management, including explicit publish endpoint |
| `GET /api/v1/articles`, `/articles/:slug` | Public published article reads |
| `GET/POST/PATCH/DELETE /api/v1/admin/articles...` | Admin article management, including explicit publish endpoint |
| `POST /api/v1/reports`, `GET /api/v1/reports/mine` | Optional-auth report creation (5 per hour per IP); the reporter's own reports |
| `GET/PATCH /api/v1/admin/reports...` | Admin report review and status updates |
| `GET/POST/DELETE /api/v1/saved-properties...` | Saved ids, paginated list, save (verified) and unsave |
| `POST /api/v1/contact-messages`; `GET/PATCH /api/v1/admin/contact-messages...` | Public contact form (5 per hour per IP, honeypot); admin triage |
| `POST /api/v1/uploads/image` | Verified multipart image upload (field `image`; jpg/jpeg/png/webp, max 5 MB; 10 per 15 minutes and 50 per day per user). Streams to Cloudinary under `<CLOUDINARY_FOLDER>/<userId>` and returns `{ url, publicId }`. |

## Setup and Running

Requirements: Node.js 18 or later, MongoDB for the API (and for the backend tests), Cloudinary credentials for the photo-upload flow, and SMTP settings for verification and code emails (without `SMTP_HOST`, development prints the emails to the server console).

```bash
cd backend
npm install
# Copy .env.example to .env and configure local values.
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:4000` for the API. Set `NEXT_PUBLIC_API_URL` before starting the frontend if the backend uses another URL.

### Required environment variables

- `JWT_SECRET` is required in **every** environment. `auth.service.js` throws at load time if it is empty, so the server will not start without it (the test suite sets its own value). Use a long random value; in production it must be at least 32 characters and not a placeholder.
- With `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS`, `APP_URL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and the three Cloudinary credentials must all be set or the process refuses to start.
- `MONGODB_DB_NAME`, `PORT`, `CORS_ORIGIN` and `APP_URL` fall back to local defaults in development.
- Cloudinary settings (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`) are needed for photo uploads.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` configure email; `APP_URL` is the base of emailed links (`<APP_URL>/verify-email`).
- `TRUST_PROXY_HOPS` (backend, default `0`): number of reverse proxies in front of the API, passed to Express `trust proxy` as a hop count. Never `true`.
- `COOKIE_SAMESITE` (backend, default `strict`): SameSite policy for the HTTP-only refresh-token cookie.
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` (backend, defaults 200 / 15 minutes): global per-IP limit.
- Frontend (see `frontend/.env.example`): `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`), `NEXT_PUBLIC_SITE_URL`, the public origin for canonical URLs, Open Graph tags, robots.txt and the sitemap (falls back to `http://localhost:3000`, so set it for every deployed build), and `NEXT_PUBLIC_GA_MEASUREMENT_ID` (empty disables analytics).

`npm run seed` imports the CSV datasets in `DataSet/` into MongoDB (properties, derived locations and categories, plus demo builder projects); `npm run db:setup` synchronizes model indexes.

### Deploy notes

- Run the backend with `NODE_ENV=production` and set every required variable listed above; see `PRODUCTION_CHECKLIST.md`.
- The rate limiters key on the client IP. Behind a reverse proxy or load balancer, set `TRUST_PROXY_HOPS` to the real number of proxies (usually `1`); otherwise every request appears to come from the proxy and all users share one budget.
- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` when building the frontend; they are inlined at build time.
- The refresh token is an HTTP-only cookie; production cookies are `Secure`, so serve the site over HTTPS.

Backend checks: `npm test` (needs MongoDB) and `npm run lint` from `backend/`. Frontend checks: `npm run lint`, `npm test` (Node's built-in runner over `src/**/*.test.mjs`) and `npm run build` from `frontend/`.

## File Guide

### Backend

#### Package, setup, and scripts

| File | What it does / when it is used |
|---|---|
| `backend/.env` | Local environment values and secrets; keep private and out of version control. |
| `backend/.env.example` | Names and local defaults for MongoDB, port, `TRUST_PROXY_HOPS`, CORS, cookies, `APP_URL`, SMTP, JWT and Cloudinary configuration. |
| `backend/.gitignore` | Excludes local dependencies, environment files, and generated files from Git. |
| `backend/eslint.config.js` | Backend lint rules. |
| `backend/package.json` | Backend scripts and dependencies: Express, Mongoose, auth, uploads, mail, Jest. |
| `backend/package-lock.json` | Exact resolved backend dependency versions for reproducible installs. |
| `backend/README.md` | Backend setup, environment variables, API overview, deploy notes, index setup and architectural decisions. |
| `backend/scripts/README.md` | Documents the seed, index, backfill, audit and migration scripts. |
| `backend/scripts/seed.js` | Imports the `DataSet/` CSVs and upserts properties, images, locations, categories and demo projects. |
| `backend/scripts/seed-featured.js` | Upserts a few featured demo listings (respects the 8-listing featured limit); run with `node`. |
| `backend/scripts/setup-db.js` | Connects models and synchronizes their declared indexes. |
| `backend/scripts/create-admin.js` | Creates or promotes an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. |
| `backend/scripts/backfill-city-lower.js` | Fills `cityLower` / `localityLower` for older documents. |
| `backend/scripts/backfill-email-verified.js` | Marks accounts created before email verification as verified. |
| `backend/scripts/audit-image-urls.js` | Read-only report of stored image URLs that are not own-Cloudinary URLs. |
| `backend/scripts/migrate-legacy-image-urls.js` | Re-hosts legacy image URLs on Cloudinary (dry run unless `--apply`). |
| `backend/scripts/seedData/parseCsv.js` | RFC 4180 CSV parser used by the seed. |
| `backend/scripts/seedData/transformDataset.js` | Converts and validates CSV rows into property documents. |
| `backend/scripts/seedData/builders.js` | Popular developers per city, turned into demo projects by the seed. |
| `backend/scripts/seedData/generateCityDatasets.js` | Regenerates the synthetic per-city CSVs in `DataSet/`. |

#### Backend runtime (`backend/src`)

| File | What it does / when it is used |
|---|---|
| `backend/src/app.js` | Creates the Express app, sets `trust proxy`, installs helmet/CORS/cookies/origin check/rate limit/JSON/logging, mounts routes and central error handling. |
| `backend/src/server.js` | Starts HTTP and MongoDB connection, exposes graceful shutdown. |
| `backend/src/config/index.js` | Loads `.env`, sets defaults, parses CORS origins and enforces required production configuration. |
| `backend/src/config/cloudinary.js` | Configures the Cloudinary SDK from environment values. |
| `backend/src/config/constants.js` | Shared constants (`MAX_FEATURED = 8`). |
| `backend/src/config/uploadConfig.js` | Image size/format limits and upload rate-limit numbers. |
| `backend/src/db/connection.js` | Owns MongoDB connect/disconnect lifecycle and reports connection state. |
| `backend/src/controllers/article.controller.js` | Validates public/admin article requests and formats response envelopes. |
| `backend/src/controllers/auth.controller.js` | Registration, verification, login, refresh/logout, step-up codes, password reset, profile/password/email changes and account deletion. |
| `backend/src/controllers/builder.controller.js` | Builder list and detail handlers. |
| `backend/src/controllers/category.controller.js` | Lists public categories and handles protected category CRUD requests. |
| `backend/src/controllers/contactMessage.controller.js` | Public contact submission (honeypot) plus admin list and status update. |
| `backend/src/controllers/dashboard.controller.js` | Admin dashboard counts. |
| `backend/src/controllers/facility.controller.js` | Lists facilities by location and handles admin facility CRUD. |
| `backend/src/controllers/health.controller.js` | Returns the health-service status. |
| `backend/src/controllers/location.controller.js` | Serves popular locations and suggestions; validates admin location changes. |
| `backend/src/controllers/project.controller.js` | Validates and handles public/admin project operations. |
| `backend/src/controllers/property.controller.js` | Validates property create/search/update/delete and admin bulk operations. |
| `backend/src/controllers/report.controller.js` | Creates reports, lists a reporter's own reports and provides admin report list/detail/status operations. |
| `backend/src/controllers/savedProperty.controller.js` | Saved-property ids, list, save and unsave handlers. |
| `backend/src/controllers/upload.controller.js` | Streams validated images to Cloudinary in a server-chosen per-user folder. |
| `backend/src/middleware/auth.middleware.js` | `protect` (Bearer access token, user, stale-token and live-session checks) and `restrictTo` role checks. |
| `backend/src/middleware/optionalAuth.js` | Attaches a user when a valid access token is present, without requiring login. |
| `backend/src/middleware/requireVerified.js` | Blocks users whose email is not verified. |
| `backend/src/middleware/globalRateLimiter.js` | Global per-IP rate limiter factory. |
| `backend/src/middleware/contactRateLimiter.js` | Rate limit for contact-message submissions. |
| `backend/src/middleware/reportRateLimiter.js` | Rate limit for report submissions. |
| `backend/src/middleware/uploadRateLimiter.js` | Per-user 15-minute and daily upload limiters. |
| `backend/src/middleware/uploadImage.js` | Multer single-image handler with friendly errors. |
| `backend/src/middleware/errorHandler.js` | Normalizes validation/database errors and writes safe JSON error responses. |
| `backend/src/middleware/notFound.js` | Produces the API 404 response for unmatched routes. |
| `backend/src/middleware/requestLogger.js` | Logs HTTP requests through Morgan. |
| `backend/src/models/Article.js` | Article schema, content state, slug and publication metadata. |
| `backend/src/models/Category.js` | Category name/slug/icon/listing-count schema. |
| `backend/src/models/ContactMessage.js` | Contact message schema and statuses (`new`, `read`, `archived`). |
| `backend/src/models/contentStatus.js` | Shared content status values for publishable content. |
| `backend/src/models/Facility.js` | Nearby facility schema and supported facility types. |
| `backend/src/models/index.js` | Central model registry used by database setup. |
| `backend/src/models/Location.js` | City/locality, popular ordering, listing counts, images, and lookup indexes. |
| `backend/src/models/plugins/normalizedLocation.js` | Keeps `cityLower` / `localityLower` in sync on save. |
| `backend/src/models/Project.js` | Development project schema, publication metadata and the collated developer index. |
| `backend/src/models/Property.js` | Listing schema, enums, private contact field, and property search indexes. |
| `backend/src/models/PropertyImage.js` | Per-property image records, order, URL / Cloudinary public id, and relationship index. |
| `backend/src/models/RefreshToken.js` | Hashed refresh tokens with session id, rotation marker and TTL index. |
| `backend/src/models/Report.js` | Listing report schema, reasons and status values. |
| `backend/src/models/SavedProperty.js` | Saved-property link (`userId`, `propertyId`) with a unique `(userId, propertyId)` index and a `(userId, createdAt)` index. |
| `backend/src/models/User.js` | User identity, password hash, `user`/`admin` roles, verification and one-time-code fields (all hidden by default). |
| `backend/src/routes/admin-article.routes.js` | Admin article list/detail/create/update/publish/delete routes. |
| `backend/src/routes/admin-contactMessage.routes.js` | Admin contact-message list and status routes. |
| `backend/src/routes/admin-project.routes.js` | Admin project list/detail/create/update/publish/delete routes. |
| `backend/src/routes/admin-report.routes.js` | Admin report list/detail/status routes. |
| `backend/src/routes/admin.router.js` | Applies admin protection and mounts dashboard, location, facility, property and sub-routers. |
| `backend/src/routes/article.routes.js` | Public article list and slug detail routes. |
| `backend/src/routes/auth.routes.js` | All `/api/auth` routes and their five rate limiters. |
| `backend/src/routes/builder.routes.js` | Public builder list and detail routes. |
| `backend/src/routes/category.routes.js` | Public category list plus protected admin CRUD routes. |
| `backend/src/routes/contactMessage.routes.js` | Public rate-limited contact submission route. |
| `backend/src/routes/health.routes.js` | Public health endpoint declaration. |
| `backend/src/routes/index.js` | Mounts feature routers under `/api/v1`. |
| `backend/src/routes/location.routes.js` | Popular locations, rate-limited suggestions, and location facility reads. |
| `backend/src/routes/project.routes.js` | Public new/list/detail project routes. |
| `backend/src/routes/property.routes.js` | Public search/featured/detail, authenticated `/mine`, contact lookup, and create/update/delete routes. |
| `backend/src/routes/report.routes.js` | Optional-auth report creation and `/mine`. |
| `backend/src/routes/savedProperty.routes.js` | Authenticated saved-property routes. |
| `backend/src/routes/upload.routes.js` | Verified, rate-limited image upload route. |
| `backend/src/services/article.service.js` | Article database selection, slug creation, publication, and CRUD behavior. |
| `backend/src/services/auth.service.js` | Password hashing, access JWTs, refresh-token rotation, sessions and revocation. |
| `backend/src/services/builder.service.js` | Builder aggregation from projects and slug encoding. |
| `backend/src/services/cloudinaryAssets.service.js` | Own-Cloudinary URL validation and ownership-checked asset deletion. |
| `backend/src/services/contactMessage.service.js` | Contact message create, list and status update. |
| `backend/src/services/health.service.js` | Builds health response including MongoDB status. |
| `backend/src/services/mailer.service.js` | SMTP delivery and email templates (verification, account-exists, reset code, action code). |
| `backend/src/services/project.service.js` | Project database listing/order and admin CRUD/publish behavior. |
| `backend/src/services/property.service.js` | Property/image persistence, filter construction, ownership checks, unverify rule, featured limit and bulk operations. |
| `backend/src/services/report.service.js` | Report persistence, listing resolution, duplicate checks, pagination/filtering and status updates. |
| `backend/src/services/savedProperty.service.js` | Saved-property persistence and listing. |
| `backend/src/utils/AppError.js` | Typed HTTP errors used by controllers/services. |
| `backend/src/utils/actionOtp.js` | Step-up code generation and verification for sensitive account changes. |
| `backend/src/utils/asyncHandler.js` | Forwards rejected async route handlers into Express error handling. |
| `backend/src/utils/contactMessageValidation.js` | Contact form validation. |
| `backend/src/utils/normalizeCity.js` | City normalization for case-insensitive filters. |
| `backend/src/utils/propertyValidation.js` | Shared listing field rules and phone normalization. |
| `backend/src/utils/queryParams.js` | City, free-text and keyword query parsers. |
| `backend/src/utils/resetOtp.js` | Password-reset code generation and verification. |
| `backend/src/utils/verificationToken.js` | Email verification token generation and hashing. |
| `backend/src/utils/serializers/article.serializer.js` | Shapes article Mongo documents for API responses. |
| `backend/src/utils/serializers/builder.serializer.js` | Shapes builder results. |
| `backend/src/utils/serializers/category.serializer.js` | Shapes category Mongo documents for API responses. |
| `backend/src/utils/serializers/contactMessage.serializer.js` | Shapes contact messages and strips the IP address. |
| `backend/src/utils/serializers/facility.serializer.js` | Shapes facility Mongo documents for API responses. |
| `backend/src/utils/serializers/location.serializer.js` | Shapes location Mongo documents for API responses. |
| `backend/src/utils/serializers/project.serializer.js` | Shapes project Mongo documents for API responses. |
| `backend/src/utils/serializers/property.serializer.js` | Shapes properties/images; strips `contactNumber`, `ownerId` and `status` except for the owner's own views. |
| `backend/src/utils/serializers/report.serializer.js` | Shapes reports for public, admin and "my reports" views. |

#### Backend tests (`backend/tests`)

Tests use a real MongoDB; each file sets its own `MONGODB_DB_NAME`. `tests/setup/jest.setup.js` sets a test `JWT_SECRET`, a test Cloudinary name and an empty `SMTP_HOST`. `tests/helpers/` provides `auth.js` (register/login/token helpers), `verification.js` (mail-link helpers) and `imageUrls.js` (own-Cloudinary URL fixtures).

| File | Coverage focus |
|---|---|
| `admin-dashboard.test.js` | Admin dashboard counts and access. |
| `admin-properties-bulk.test.js` | Admin bulk listing update/delete authorization and behavior. |
| `app.trustProxy.test.js` | `TRUST_PROXY_HOPS` parsing and client IP resolution. |
| `articles.test.js` | Public/admin article routes and validation. |
| `auth.test.js` | Registration, login, tokens, logout, origin check and current-user behavior. |
| `auth.account.test.js`, `auth.accountRateLimit.test.js` | Profile update, change password/email, account deletion, and their rate limit. |
| `auth.actionCode.test.js` | Step-up codes for sensitive account changes. |
| `auth.cooldown.test.js`, `auth.resendRateLimit.test.js` | Verification mail cooldown and resend rate limit. |
| `auth.forgotPassword.test.js`, `auth.forgotPasswordLimiter.test.js` | OTP password reset flow, hardening and limiter by environment. |
| `auth.middleware.test.js`, `auth.secret.test.js` | `protect`/`restrictTo` behavior and the `JWT_SECRET` startup check. |
| `auth.rateLimit.test.js` | Authentication rate limiting. |
| `auth.sessions.test.js` | Session ids, logout and session revocation paths. |
| `auth.verification.test.js` | Email verification, email-change confirmation and token hygiene. |
| `builders.test.js`, `builders.caseVariants.test.js` | Builders list/detail and case-variant merging. |
| `category.test.js` | Category list and protected CRUD behavior. |
| `cityLower.test.js` | City normalization, hook sync, query-level writes and the backfill script. |
| `cloudinaryCleanup.test.js`, `cloudinaryImageUrl.test.js` | Cloudinary asset cleanup and own-URL validation. |
| `config.production.test.js` | Production configuration validation. |
| `contactMessages.test.js` | Public contact messages, rate limit, admin list and update. |
| `cors.test.js` | CORS with a list of origins. |
| `createAdmin.test.js` | `admin:create` script. |
| `facility.test.js` | Facility reads and admin CRUD validation. |
| `health.test.js` | Health response and database-state reporting. |
| `location.test.js`, `location-admin.test.js`, `location.liveCounts.test.js` | Popular/suggestion endpoints, admin location updates and live listing counts. |
| `mailer.test.js` | SMTP transport options and mail logging without SMTP. |
| `projects.test.js`, `projects-admin.test.js` | Public and admin project operations. |
| `properties.test.js` | Listing validation/search, ownership, serialization, slugs and image behavior. |
| `properties.contact.test.js` | Contact endpoint access, 404s, rate limit, and that no other route exposes `contactNumber`. |
| `properties.featured.test.js`, `properties.featuredLimit.test.js` | Featured list and the 8-listing featured limit. |
| `properties.mine.test.js` | Owner-only `/properties/mine` listing. |
| `reports.test.js` | Report creation, listing resolution, duplicates, my reports and admin status workflow. |
| `savedProperty.test.js` | Saved-property add, list, ids, delete and unpublished handling. |
| `security.test.js` | Invalid JSON, security headers and the global rate limit. |
| `seedDataset.test.js` | Seed parsing/transform functions without MongoDB. |
| `upload.test.js` | Image upload endpoint: size/type validation, access control, rate limiting. |

### Dataset (`DataSet`)

| File | What it is used for |
|---|---|
| `DataSet/<City>_property_details.csv` | Thirteen per-city listing datasets read by `npm run seed`. Mumbai is the real export (every second row is imported by default); the other twelve cities are synthetic, 600 rows each, produced by `generateCityDatasets.js`. |

### Frontend

#### Package and configuration

| File | What it does / when it is used |
|---|---|
| `frontend/.gitignore` | Excludes frontend dependencies, build output, and local environment artifacts (except `.env.example`). |
| `frontend/.env.example` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` with local defaults. |
| `frontend/AGENTS.md` | Next.js-specific workspace guidance; requires reading the installed Next documentation before edits. |
| `frontend/CLAUDE.md` | Project-local assistant guidance reference (includes `AGENTS.md`). |
| `frontend/eslint.config.mjs` | Frontend lint rules. |
| `frontend/jsconfig.json` | JavaScript project settings and `@/` source alias. |
| `frontend/next.config.js` | Next image remote-host allowlist built from `src/lib/imageHosts.cjs`. |
| `frontend/package.json` | Next dev/build/start/lint/test scripts and frontend dependencies. |
| `frontend/package-lock.json` | Exact resolved frontend dependency versions. |
| `frontend/postcss.config.mjs` | Tailwind CSS/PostCSS integration. |
| `frontend/README.md` | HomeNest frontend setup, scripts, environment and layout. |
| `frontend/public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Starter/static SVG assets available under `/`; `next.svg` is currently the default Open Graph image. |

#### App routes and global files (`frontend/src/app`)

| File | Route / use |
|---|---|
| `frontend/src/app/layout.jsx` | Root HTML layout, `next/font` fonts, metadata, Organization/WebSite JSON-LD, providers, consent banner and analytics loader. |
| `frontend/src/app/globals.css` | Tailwind import, theme tokens, and global styles. |
| `frontend/src/app/page.jsx` | Home page composition and section ordering. |
| `frontend/src/app/not-found.jsx` | Shared not-found page. |
| `frontend/src/app/favicon.ico` | Browser tab icon. |
| `frontend/src/app/robots.js` | Generates robots rules; disallows crawling `/admin/`; points to the sitemap on `SITE_URL`. |
| `frontend/src/app/sitemap.js` | Sitemap of static routes plus published properties, projects and articles read page by page from the public API. A resource whose API call fails is left out rather than failing the build. Regenerated at most hourly. |
| `frontend/src/app/about/page.jsx` | `/about` static company information. |
| `frontend/src/app/builders/page.jsx` | `/builders` shell/header for the API-backed builders directory. |
| `frontend/src/app/careers/page.jsx` | `/careers` static careers content. |
| `frontend/src/app/contact/page.jsx` | `/contact` contact details plus the contact form. |
| `frontend/src/app/faqs/page.jsx` | `/faqs` static FAQs. |
| `frontend/src/app/forgot-password/page.jsx` | `/forgot-password` OTP reset page (not indexed). |
| `frontend/src/app/help/page.jsx` | `/help` support/help content. |
| `frontend/src/app/insights/[slug]/page.jsx` | Article detail page backed by `GET /api/v1/articles/:slug`. |
| `frontend/src/app/legal/privacy/page.jsx`, `terms/page.jsx`, `verified-policy/page.jsx` | Policy content and the explanation of verification. |
| `frontend/src/app/post-property/page.jsx` | `/post-property` property form page. |
| `frontend/src/app/profile/page.jsx` | `/profile` account page shell (not indexed). |
| `frontend/src/app/project/[id]/page.jsx` | Project detail page backed by `GET /api/v1/projects/:id`. |
| `frontend/src/app/property/[slug]/page.jsx` | Property detail page backed by `GET /api/v1/properties/:slug`; server component with `generateMetadata`. |
| `frontend/src/app/report/page.jsx` | `/report` page containing the report form. |
| `frontend/src/app/saved/page.jsx` | `/saved` page: paginated (20 per page, Load more) list of the user's saved properties. |
| `frontend/src/app/search/page.jsx` | `/search` route and Suspense boundary for URL-driven results. |
| `frontend/src/app/tools/page.jsx`, `tools/emi-calculator/page.jsx`, `tools/property-value-calculator/page.jsx` | Calculator directory and the two calculators. |
| `frontend/src/app/verify-email/page.jsx` | `/verify-email` link landing page (not indexed, no referrer). |
| `frontend/src/app/admin/layout.jsx` | Wraps admin routes in the admin shell (noindex). |
| `frontend/src/app/admin/page.jsx` | `/admin` dashboard backed by the API. |
| `frontend/src/app/admin/articles/page.jsx` | `/admin/articles` article management. |
| `frontend/src/app/admin/categories/page.jsx` | `/admin/categories` category management. |
| `frontend/src/app/admin/listings/page.jsx` | `/admin/listings` search, selection, status, featuring, review and deletion. |
| `frontend/src/app/admin/locations/page.jsx` | `/admin/locations` popular-location toggles, ordering and facilities. |
| `frontend/src/app/admin/messages/page.jsx` | `/admin/messages` contact-message triage. |
| `frontend/src/app/admin/profile/page.jsx` | `/admin/profile` admin profile page. |
| `frontend/src/app/admin/projects/page.jsx` | `/admin/projects` project management. |
| `frontend/src/app/admin/reports/page.jsx` | `/admin/reports` report review. |

#### Shared components (`frontend/src/components`)

| File | What it does / when it is used |
|---|---|
| `frontend/src/components/AmenityPicker.jsx` | Toggle chips for amenities plus custom entries, used by listing forms. |
| `frontend/src/components/AnalyticsLoader.jsx` | Loads the GA4 script only after consent is granted; sends path-only page views. |
| `frontend/src/components/ConsentBanner.jsx` | Opt-in analytics banner (Accept / Decline), shown only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set and the choice is undecided. |
| `frontend/src/components/ManageConsentLink.jsx` | Footer "Manage consent" button that withdraws consent. |
| `frontend/src/components/PostPropertyButton.jsx` | Reusable post-property CTA with tracking and optional prefill/source. |
| `frontend/src/components/Providers.jsx` | Mounts auth, toast, login prompt, saved-property, and city contexts. |
| `frontend/src/components/icons.jsx` | Shared icon components used by navigation, cards, and controls. |
| `frontend/src/components/account/AccountSections.jsx` | Details, change-password, change-email and delete-account forms, plus the 6-digit action-code field. |
| `frontend/src/components/account/CheckInbox.jsx` | "Check your inbox" panel with resend verification. |
| `frontend/src/components/account/ForgotPasswordContent.jsx` | Four-step OTP password reset. |
| `frontend/src/components/account/MyListings.jsx` | The user's own listings from `/properties/mine`, with their contact number, edit and delete. |
| `frontend/src/components/account/MyReports.jsx` | The user's submitted reports with friendly status labels and Load more. |
| `frontend/src/components/account/ProfileContent.jsx` | `/profile` body: redirects logged-out visitors and composes the account sections. |
| `frontend/src/components/account/VerificationBanner.jsx` | Banner for unverified users with a resend link. |
| `frontend/src/components/account/VerifyEmailContent.jsx` | Email-link verification form (set password, or confirm an email change). |
| `frontend/src/components/account/useFormAction.js` | Shared submit/loading/error helper for the account forms. |
| `frontend/src/components/admin/AdminField.jsx` | Shared admin form field label/input styling. |
| `frontend/src/components/admin/AdminLoginGate.jsx` | Admin login form using the shared session; rejects non-admin accounts. |
| `frontend/src/components/admin/AdminProfileMenu.jsx` | Admin profile/logout menu. |
| `frontend/src/components/admin/AdminShell.jsx` | Admin login gate, shell, sidebar and store provider. If a stored session cannot be verified because the backend is unreachable, shows an error with Retry and Log out. |
| `frontend/src/components/admin/AdminSidebar.jsx` | Navigation between admin pages. |
| `frontend/src/components/admin/ConfirmDialog.jsx` | Promise-based confirmation dialog (`useConfirm()`) with focus trap. |
| `frontend/src/components/admin/FacilitiesManager.jsx` | Facility CRUD per location. |
| `frontend/src/components/admin/Modal.jsx` | Reusable admin modal wrapper. |
| `frontend/src/components/admin/Pagination.jsx` | Prev/Next controls with a total count. |
| `frontend/src/components/admin/ReviewListing.jsx` | Listing review modal with Approve / Reject. |
| `frontend/src/components/admin/StatCard.jsx` | Dashboard summary tile. |
| `frontend/src/components/admin/StatusPill.jsx` | Visual content status label. |
| `frontend/src/components/admin/Toggle.jsx` | Accessible boolean toggle used in admin tables. |
| `frontend/src/components/admin/forms/AddArticleForm.jsx` | Adds/edits an article through the admin API. |
| `frontend/src/components/admin/forms/AddListingForm.jsx` | Adds a listing through the admin API. |
| `frontend/src/components/admin/forms/AddProjectForm.jsx` | Adds/edits a project through the admin API. |
| `frontend/src/components/builders/BuildersDirectory.jsx` | Lists API-backed builders and loads a selected builder's published projects on demand. |
| `frontend/src/components/contact/ContactForm.jsx` | Contact form that posts to the contact-messages API; includes a honeypot field. |
| `frontend/src/components/home/AppPromotion.jsx` | Static planned-app promotion section. |
| `frontend/src/components/home/BuildersPromo.jsx` | Home-page link/promotion to the builders directory. |
| `frontend/src/components/home/FeaturedProperties.jsx` | Loads featured properties (up to 5, city-aware) and handles loading/error/fallback states. |
| `frontend/src/components/home/FeaturedShowcase.jsx` | Displays the featured showcase with thumbnail rail, pause and prev/next. |
| `frontend/src/components/home/Hero.jsx` | Buy/rent/sell tabs, search submission, recent searches, and sell CTA. |
| `frontend/src/components/home/HeroSlider.jsx` | Hero background slides (placeholder images). |
| `frontend/src/components/home/Insights.jsx` | Renders the three latest articles. |
| `frontend/src/components/home/LocationInput.jsx` | Debounced city/locality autocomplete backed by the location suggestion API. |
| `frontend/src/components/home/NewProjects.jsx` | Renders new-project cards, city-aware. |
| `frontend/src/components/home/PopularLocations.jsx` | Loads and renders API-backed popular location cards. |
| `frontend/src/components/home/PropertyCard.jsx` | Shared property card with image, price, badges, amenities, save action, and detail link (search and saved pages). |
| `frontend/src/components/home/PropertyCategories.jsx` | Loads API-backed categories and links into search. |
| `frontend/src/components/home/RecentSearches.jsx` | Reads and renders browser-local recent searches. |
| `frontend/src/components/home/SearchBar.jsx` | Location, type, BHK, budget, and search-submit controls. |
| `frontend/src/components/home/SellBanner.jsx` | Static post-property promotion. |
| `frontend/src/components/home/WhyChooseUs.jsx` | Static trust/benefit section. |
| `frontend/src/components/layout/CitySelector.jsx` | Site-wide city selector backed by browser-local city context. |
| `frontend/src/components/layout/Footer.jsx` | Shared footer and site links. |
| `frontend/src/components/layout/Navbar.jsx` | Responsive navigation, city selector, post-property CTA, login prompt, and when signed in the user's name, an `admin` label for admins, Profile and Log out. |
| `frontend/src/components/layout/PageHeader.jsx` | Reusable eyebrow/title/description header. |
| `frontend/src/components/layout/PageShell.jsx` | Shared public-page navbar/main/footer wrapper, with the verification banner. |
| `frontend/src/components/legal/LegalSections.jsx` | Reusable layout for legal/policy pages. |
| `frontend/src/components/post-property/PostPropertyForm.jsx` | Authenticated property submission and Cloudinary upload flow. |
| `frontend/src/components/property/ContactOwnerCard.jsx` | Login-gated contact number reveal backed by `GET /api/v1/properties/:id/contact`. |
| `frontend/src/components/property/PropertyGallery.jsx` | Client gallery: large photo, thumbnails, wrapping previous/next buttons and arrow keys; placeholder for no photos, no controls for one. |
| `frontend/src/components/property/SaveButton.jsx` | Property save toggle backed by the saved-properties context. |
| `frontend/src/components/report/ReportListingForm.jsx` | Report form that submits to `POST /api/v1/reports`. |
| `frontend/src/components/search/SearchAnalytics.jsx` | Fires `search_submitted` (filters used + result count, never the keyword) when consent is granted. |
| `frontend/src/components/search/SearchFilters.jsx` | Keyword and BHK filter form. |
| `frontend/src/components/search/SearchResults.jsx` | URL filter parsing, API search, card normalization, states, and pagination. |
| `frontend/src/components/tools/EmiCalculator.jsx` | Browser-side loan EMI calculator. |
| `frontend/src/components/tools/PropertyValueCalculator.jsx` | Browser-side indicative estimate using local rates. |
| `frontend/src/components/ui/Carousel.jsx` | Shared carousel interaction/scroll behavior. |
| `frontend/src/components/ui/Container.jsx` | Shared max-width content wrapper. |
| `frontend/src/components/ui/SafeImage.jsx` | `next/image` wrapper with host check and fallback. |
| `frontend/src/components/ui/Section.jsx` | Shared home/content section layout. |
| `frontend/src/components/ui/SectionError.jsx` | Retryable section error presentation. |
| `frontend/src/components/ui/SkeletonGrid.jsx` | Reusable loading placeholder grid. |

#### Frontend shared logic (`frontend/src/lib`)

| File | What it does / when it is used |
|---|---|
| `frontend/src/lib/admin-auth-context.jsx` | Admin view of the shared session; rejects non-admin logins with "This account is not an admin". |
| `frontend/src/lib/admin-content.js` | Maps admin API documents (`_id`) to UI shapes. |
| `frontend/src/lib/admin-store.jsx` | Admin data store and write actions, all through `api.js`. |
| `frontend/src/lib/amenities.js` | Amenity options, display priority, and card selection helpers. |
| `frontend/src/lib/analyticsLocation.mjs` | Path-only page location and GA cookie-name helpers (unit tested). |
| `frontend/src/lib/api.js` | The API client: base URL, cookie credentials, in-memory access token, single-flight refresh with one retry on 401, `ApiError` (status `0` when the server is unreachable), validation details appended to messages. |
| `frontend/src/lib/attempt.js` | `useAttempt()` helper that runs an admin action and toasts any error. |
| `frontend/src/lib/auth-context.jsx` | The one shared session for the public site and `/admin`: register/login/logout, current user, session restore and replacement. Exposes `sessionError` and `verifySession`. |
| `frontend/src/lib/budgetPresets.js` | Buy/rent budget preset definitions and lookup. |
| `frontend/src/lib/builderList.mjs` | Builder list limit (50) and truncation note (unit tested). |
| `frontend/src/lib/city.js` | Supported cities (13) and city normalization/comparison. |
| `frontend/src/lib/city-context.jsx` | Shared selected-city state stored in localStorage. |
| `frontend/src/lib/cityRates.js` | City-level rates consumed by the value estimator. |
| `frontend/src/lib/consent.js` | Reads/writes the consent choice and exposes `useConsent()` and `withdrawConsent()`. |
| `frontend/src/lib/dataSource.js` | Home section and builder fetchers and normalizers, all API-backed. |
| `frontend/src/lib/format.js` | Price (₹ L / Cr), area, and date formatting helpers. |
| `frontend/src/lib/imageHosts.cjs` | Allowed image hostnames shared by `next.config.js` and the client. |
| `frontend/src/lib/locationSuggestions.js` | Calls location-suggestion API and groups/caps city/locality matches. |
| `frontend/src/lib/login-prompt-context.jsx` | Login/register prompt and post-login continuation. The form state lives in a modal that unmounts on close, so typed values never persist. |
| `frontend/src/lib/pagination.mjs` | Out-of-range page redirect helper (unit tested). |
| `frontend/src/lib/properties.js` | Admin property fetch and mapping helpers. |
| `frontend/src/lib/propertyImages.mjs` | Primary-image and safe-image helpers (unit tested). |
| `frontend/src/lib/propertyTypes.js` | Property type labels/options by intent. |
| `frontend/src/lib/propertyValidation.js` | Client-side listing field rules mirroring the backend. |
| `frontend/src/lib/recentSearches.js` | Adds/reads up to five recent searches in browser localStorage. |
| `frontend/src/lib/safeImageSrc.mjs` | Allowed-host check with placeholder fallback (unit tested). |
| `frontend/src/lib/saved-properties-context.jsx` | Saved-property ID set loaded from `GET /api/v1/saved-properties/ids`, toggled through `POST`/`DELETE`, plus the login prompt. |
| `frontend/src/lib/saved-sync.js` | Framework-free optimistic save/unsave sync with rollback. |
| `frontend/src/lib/sessionHint.mjs` | Non-secret localStorage flag saying a refresh on load is worthwhile (unit tested). |
| `frontend/src/lib/site.js` | Site URL, name and default share image used by layout, page metadata, robots.txt and the sitemap. |
| `frontend/src/lib/slugify.js` | Slug and random suffix helpers. |
| `frontend/src/lib/toast-context.jsx` | Shared toast notification state and presentation. |
| `frontend/src/lib/trackEvent.js` | Single analytics wrapper; adds page/viewport/session id, strips personal-data keys, and forwards to `gtag` only with an ID and granted consent. |
| `frontend/src/lib/useDebouncedValue.js` | Generic debounced React value hook used for autocomplete. |
| `frontend/src/lib/useLocalStorageState.js` | Hydrates and persists React state to browser localStorage. |
| `frontend/src/lib/useSectionData.js` | Fetch lifecycle/retry state for home sections. |
| `frontend/src/lib/*.test.mjs` | Node test-runner tests for the `.mjs` helpers above (analytics location, builder list, pagination, property images, safe image source, session hint). |

### Planning and product documentation (`docs`)

| File | What it is used for |
|---|---|
| `docs/api-inventory-and-project-status.md` | Current API route inventory, access levels, rate limits and implementation status. |
| `docs/backend-architecture.md` | Current backend architecture: runtime, middleware, auth model, persistence and configuration. |
| `docs/landing-page-prd.md` | Home-page behavior, content, design, and quality requirements, with a current-implementation status section. |
| `docs/landing-page-prd.pdf` | PDF export of the landing-page brief (not regenerated with the latest edits). |
| `docs/current-capabilities-and-file-guide.md` | This current-state guide. |

Other root files: `PRODUCTION_CHECKLIST.md` (deploy variables, CORS rules, setup order, smoke tests, analytics consent) and `TO-DO LIST.txt` (informal personal notes).

## Important Documentation and Integration Gaps

- There is no UI or API to list or revoke individual sessions; only logout and logout-everywhere exist.
- `ContactMessage` is not in the `models/index.js` registry, so `npm run db:setup` does not sync its index.
- No frontend skip-to-content link, dark mode, store buttons or app waitlist exist; the Open Graph default image is the starter `next.svg` and the hero slides are placeholder images.
- Property detail pages have Open Graph/Twitter metadata but no `RealEstateListing` JSON-LD.
- `docs/landing-page-prd.pdf` is a snapshot and does not reflect the current-implementation notes in the markdown brief.
- The FAQ page still describes saved properties as in-memory and says editing listings is unsupported; both are now outdated.
