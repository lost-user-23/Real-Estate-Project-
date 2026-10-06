# HomeNest: Current Capabilities and File Guide

**Reviewed:** 2026-09-30  
**Purpose:** Describe what the current workspace actually does, distinguish live API behavior from prototype behavior, and provide a directory-by-directory guide to the project files.

This describes the implementation in the current workspace, not every feature described in the planning documents. Generated output and dependency contents (`node_modules`, `.next`, coverage files) are excluded. `backend/.env` is local configuration and must not be shared or committed.

## Project at a Glance

HomeNest is a real-estate discovery and listing prototype with a Next.js 16 / React 19 frontend, an Express 5 / Mongoose backend, and MongoDB persistence. The frontend and backend are separate npm packages. The browser app currently mixes mock data and real HTTP calls (the admin area and the account pages are fully API-backed); the presence of an API endpoint does not mean the corresponding screen uses it.

The backend is mounted at `http://localhost:4000` by default. The frontend API client uses `NEXT_PUBLIC_API_URL` when set, otherwise it calls that default. Local CORS defaults to `http://localhost:3000`.

## What a Public User Can Do Now

| User workflow | Current behavior |
|---|---|
| Browse the home page | Browse the hero, featured properties, popular locations, categories, projects, builders, insights, and static information. Popular locations, categories, projects, and builder data use the API. Featured properties and insights remain mock-backed. |
| Search properties | `/search` calls `GET /api/v1/properties` with intent, city, locality, property type, price range, and pagination query parameters. It displays API results, loading/error/empty states, and pagination. This is the primary public flow currently backed by live property data. |
| Get location suggestions | The home search autocomplete calls `GET /api/v1/locations/suggestions`, debounces input, and supports keyboard selection. The API returns up to six suggestions. |
| Create an account or log in | The login prompt calls `POST /api/auth/register` or `POST /api/auth/login`. The API sets a 7-day HTTP-only `token` cookie, checked through `GET /api/auth/me` on reload. `POST /api/auth/logout` clears the cookie; a 401 on an authenticated API request clears the local session state. The navbar shows the signed-in user's name (plus an `admin` label for admins), Profile and Log out. |
| Submit a property | The Post Property form requires login and at least five images. It requests signed Cloudinary upload parameters, uploads the files, then calls `POST /api/v1/properties`. The backend creates the listing as a `draft`; it is not automatically public. |
| Manage account and listings | `/profile` (login required) lets a user edit name and phone, change password (the server replaces the session cookie and invalidates earlier tokens), change email, delete the account, and list their own listings from `GET /api/v1/properties/mine` with edit and delete through `PATCH`/`DELETE /api/v1/properties/:id`. |
| Save a property | Users can toggle a favorite and are prompted to log in first. Saves are persisted per account through `/api/v1/saved-properties` and survive refresh and new sessions. `/saved` (login required) lists the user's saved properties 20 at a time with a Load more button; un-hearting a card there keeps it on the page until the next load. Saves are removed automatically when a property or the saving account is deleted. |
| View owner contact | Contact numbers are shown to logged-in users only. Logged out, `ContactOwnerCard` shows "Log in to view contact details", opens the login prompt and reveals the number after a successful login. Logged in, "Show contact number" calls `GET /api/v1/properties/:id/contact` through `api.js`. Rate limiting (429), missing listings (404) and other errors show a message in the card. The number is hidden again on logout. Owners also see their own numbers under My listings on `/profile`. |
| Report a listing | `/report` submits `{ listingUrlOrId, reason, details }` to `POST /api/v1/reports` (the reporter is attached when logged in). The button is disabled while sending, server errors are shown, and success appears only after the request succeeds. Reports appear on the admin Reports page. |
| Contact HomeNest | The contact form displays a local confirmation only; no support-message backend is connected. |
| Browse property/project/article details | Property and project detail pages fetch their public API records on demand. The property page has a photo gallery (large photo, thumbnails, previous and next buttons, arrow keys) and per-listing metadata: title, description, canonical URL, Open Graph and Twitter tags, with the first photo as the share image. Article details are fetched from `GET /api/v1/articles/:slug`. Project links use API IDs; a missing or malformed project ID shows not found. |
| Browse tools and informational pages | The EMI and property-value calculators run in the browser. About, careers, FAQs, help, and legal pages are static content. The value estimate uses local city-rate data and is indicative, not a formal appraisal. |
| Resume a recent search / select a city | Recent searches and the selected city are stored in browser localStorage. They are device/browser-local, not user-account data. |

### Home Page Data Sources

| Home section | Source today |
|---|---|
| Featured properties | Mock property data with client-side featured ordering |
| Popular locations | `GET /api/v1/locations/popular` |
| Property categories | `GET /api/v1/categories` |
| New projects | `GET /api/v1/projects/new` |
| Builders | Derived from published projects returned by `GET /api/v1/projects`; there is no separate Builder model/API |
| Insights | Mock article data |

The tracking wrapper logs events to the developer console outside production. No analytics vendor is configured, despite the consent banner copy.

## What an Admin Can Do Now

### In the Admin Web UI

The admin area at `/admin` is backed by the real API. It uses the same cookie-backed session as the public site (`auth-context.jsx`). `/admin` shows a login form until the signed-in user has `role: "admin"`; signing in through it with a non-admin account shows "This account is not an admin" and logs that account out again. The role check in the UI is a convenience only: the backend enforces `protect` plus `restrictTo('admin')` on every admin route.

| Admin screen | Actions available | API |
|---|---|---|
| Dashboard | Counts for published, featured and unverified listings, popular locations, published projects and articles. | `GET /api/v1/admin/dashboard` |
| Listings | Search, add, edit status/verified/featured/rank, bulk update, delete one or many. | `/api/v1/admin/properties`, `/api/v1/properties/:id`, bulk routes |
| Popular locations | Toggle popular flag and order; manage nearby facilities. | `/api/v1/admin/locations`, `/api/v1/admin/facilities` |
| Categories | Create, edit, delete. | `/api/v1/categories` |
| Projects | Add, edit, publish, change status, delete. | `/api/v1/admin/projects` |
| Insights/articles | Add, edit, publish, change status, delete. | `/api/v1/admin/articles` |
| Reports | List and change report status. | `/api/v1/admin/reports` |
| Profile | Admin profile menu and logout. | Shared session |

The seed script's development admin has an intentionally unusable password placeholder and cannot log in. Create a real admin with `npm run admin:create`.

### Admin API Operations

| Operation | API route(s) |
|---|---|
| Dashboard counts | `GET /api/v1/admin/dashboard` |
| List all listings (any status) | `GET /api/v1/admin/properties` |
| Bulk update listing status, verification, featured state/rank, and supported classification fields; bulk-delete listings | `PATCH /api/v1/admin/properties/bulk`, `DELETE /api/v1/admin/properties/bulk` |
| List/update locations, including popular flag and rank | `GET /api/v1/admin/locations`, `PATCH /api/v1/admin/locations/:id` |
| Create/update/delete nearby facilities | `POST /api/v1/admin/facilities`, `PATCH /api/v1/admin/facilities/:id`, `DELETE /api/v1/admin/facilities/:id` |
| Create/update/delete categories | `POST /api/v1/categories`, `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` |
| List/read/create/update/publish/delete projects | `/api/v1/admin/projects` and `/api/v1/admin/projects/:id` routes |
| List/read/create/update/publish/delete articles | `/api/v1/admin/articles` and `/api/v1/admin/articles/:id` routes |
| List/read reports and update report status | `/api/v1/admin/reports` and `/api/v1/admin/reports/:id` routes |
| Edit/delete any property | `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id` |

## API Surface Implemented

All routes below are registered by the current backend. Unless noted, API routes are under `/api/v1`.

| Method and path | Purpose / access |
|---|---|
| `GET /health` | Health and MongoDB connection state; public |
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` | Account creation/login set the HTTP-only auth cookie and return `{ user }`; logout clears that cookie. Register/login are rate limited to 10 attempts per 15 minutes per client IP. |
| `GET /api/auth/me`, `PATCH /api/auth/me`, `DELETE /api/auth/me` | Current user; update name and phone; delete the account (needs the current password; the last admin cannot be deleted). Cookie authentication required. |
| `POST /api/auth/change-password`, `PATCH /api/auth/change-email` | Need the current password; change-password replaces the cookie and invalidates all earlier tokens. Cookie authentication required. |
| Account rate limit | `DELETE /api/auth/me`, change-password and change-email: 10 attempts per 15 minutes per user, separate from the login limiter. |
| `GET /api/v1/properties` | Public published-property search/list with filters and pagination |
| `GET /api/v1/properties/:slug` | Public published property detail |
| `GET /api/v1/properties/mine` | Authenticated: the caller's own listings of any status, paginated, including their `contactNumber`. Registered before `/:slug`. |
| `GET /api/v1/properties/:id/contact` | Authenticated, 20 requests per hour per user. Returns `{ contactNumber }` (or `null`) for published listings; `404` for drafts, archived or unknown ids. `Cache-Control: private, no-store`; the number is never logged. Every other property response strips `contactNumber`. |
| `POST /api/v1/properties` | Authenticated property submission; created as draft. The slug comes from the title; a duplicate gets a random hex suffix. A duplicate-key race on the slug is retried with a new suffix up to 3 times, then returns `409`. |
| `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id` | Authenticated owner/admin update or delete |
| `GET /api/v1/admin/dashboard`, `GET /api/v1/admin/properties`, `PATCH`/`DELETE /api/v1/admin/properties/bulk` | Admin dashboard, all-status listing list, bulk listing operations |
| `GET /api/v1/locations/popular`, `GET /api/v1/locations/suggestions?q=...` | Public popular locations and rate-limited autocomplete |
| `GET /api/v1/locations/:locationId/facilities` | Public facilities near a location |
| `PATCH /api/v1/admin/locations/:id` | Admin location update |
| `GET /api/v1/categories` | Public categories |
| `POST/PATCH/DELETE /api/v1/categories...` | Admin category CRUD |
| `GET /api/v1/projects/new`, `GET /api/v1/projects`, `GET /api/v1/projects/:id` | Public published project reads |
| `GET/POST/PATCH/DELETE /api/v1/admin/projects...` | Admin project management, including explicit publish endpoint |
| `GET /api/v1/articles`, `GET /api/v1/articles/:slug` | Public published article reads |
| `GET/POST/PATCH/DELETE /api/v1/admin/articles...` | Admin article management, including explicit publish endpoint |
| `POST /api/v1/reports` | Public/optional-auth report creation |
| `GET/PATCH /api/v1/admin/reports...` | Admin report review and status updates |
| `POST /api/v1/uploads/image` | Authenticated multipart image upload (field `image`; jpg/jpeg/png/webp, max 5 MB; rate limited per user). Streams to Cloudinary under `<CLOUDINARY_FOLDER>/<userId>` and returns `{ url, publicId }`. |

## Setup and Running

Requirements: Node.js 18 or later, MongoDB for persistent API behavior, and Cloudinary credentials for the photo-upload flow.

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

- `JWT_SECRET` is required in **every** environment. `auth.service.js` throws at load time if it is empty, so the server will not start without it (the test suite sets its own value). Use a long random value.
- With `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` and `CORS_ORIGIN` must all be set or the process refuses to start.
- `MONGODB_DB_NAME`, `PORT` and `CORS_ORIGIN` fall back to local defaults in development.
- Cloudinary settings (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`) are needed for photo uploads.
- `TRUST_PROXY_HOPS` (backend, default `0`): number of reverse proxies in front of the API, passed to Express `trust proxy` as a hop count. Never `true`.
- `COOKIE_SAMESITE` (backend, default `lax`): SameSite policy for the HTTP-only auth cookie.
- Frontend (see `frontend/.env.example`): `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`) and `NEXT_PUBLIC_SITE_URL`, the public origin for canonical URLs, Open Graph tags, robots.txt and the sitemap. It falls back to `http://localhost:3000`, so set it for every deployed build.

`npm run seed` imports the shared mock content into MongoDB; `npm run db:setup` synchronizes model indexes.

### Deploy notes

- Run the backend with `NODE_ENV=production` and set `JWT_SECRET`, `MONGODB_URI` and `CORS_ORIGIN`.
- The login rate limiter keys on the client IP. Behind a reverse proxy or load balancer, set `TRUST_PROXY_HOPS` to the real number of proxies (usually `1`); otherwise every request appears to come from the proxy and all users share one budget.
- Set `NEXT_PUBLIC_SITE_URL` when building the frontend.
- The auth token is held in an HTTP-only cookie; production cookies are `Secure`, so serve the site over HTTPS.

Backend checks: `npm test` and `npm run lint` from `backend/`. Frontend checks: `npm run lint` and `npm run build` from `frontend/`; there is no frontend test script in `frontend/package.json` at this time.

## File Guide

### Backend

#### Package, setup, and scripts

| File | What it does / when it is used |
|---|---|
| `backend/.env` | Local environment values and secrets; keep private and out of version control. |
| `backend/.env.example` | Names and local defaults for MongoDB, port, `TRUST_PROXY_HOPS`, CORS, JWT, and Cloudinary configuration. |
| `backend/.gitignore` | Excludes local dependencies, environment files, and generated files from Git. |
| `backend/eslint.config.js` | Backend lint rules. |
| `backend/package.json` | Backend scripts and dependencies: Express, Mongoose, auth, uploads, Jest. |
| `backend/package-lock.json` | Exact resolved backend dependency versions for reproducible installs. |
| `backend/README.md` | Backend setup, environment variables, API overview, deploy notes, seeding, database index setup, and architecture notes. |
| `backend/scripts/README.md` | Documents seed/index scripts and notes that no general migration suite exists. |
| `backend/scripts/seed.js` | Loads/transforms mock data and upserts it into MongoDB. |
| `backend/scripts/setup-db.js` | Connects models and synchronizes their declared indexes. |
| `backend/scripts/seedData/loadMockData.js` | Loads the frontend mock dataset for the seed process without maintaining a second copy. |
| `backend/scripts/seedData/transform.js` | Converts and validates mock records into MongoDB property/image/location/category/project/article documents. |

#### Backend runtime (`backend/src`)

| File | What it does / when it is used |
|---|---|
| `backend/src/app.js` | Creates the Express app, sets `trust proxy` from `TRUST_PROXY_HOPS`, installs CORS/JSON/logging/mounts routes and central error handling. |
| `backend/src/server.js` | Starts HTTP and MongoDB connection, exposes graceful shutdown. |
| `backend/src/config/index.js` | Loads `.env`, sets defaults, and enforces required production configuration. |
| `backend/src/config/cloudinary.js` | Configures the Cloudinary SDK from environment values. |
| `backend/src/db/connection.js` | Owns MongoDB connect/disconnect lifecycle and reports connection state. |
| `backend/src/controllers/article.controller.js` | Validates public/admin article requests and formats response envelopes. |
| `backend/src/controllers/auth.controller.js` | Registers users, verifies login, issues and clears the HTTP-only auth cookie, returns the current user, and handles profile/password/email/account changes. |
| `backend/src/controllers/category.controller.js` | Lists public categories and handles protected category CRUD requests. |
| `backend/src/controllers/dashboard.controller.js` | Admin dashboard counts. |
| `backend/src/controllers/facility.controller.js` | Lists facilities by location and handles admin facility CRUD. |
| `backend/src/controllers/health.controller.js` | Returns the health-service status. |
| `backend/src/controllers/location.controller.js` | Serves popular locations and suggestions; validates admin location changes. |
| `backend/src/controllers/project.controller.js` | Validates and handles public/admin project operations. |
| `backend/src/controllers/property.controller.js` | Validates property create/search/update/delete and admin bulk operations. |
| `backend/src/controllers/report.controller.js` | Creates user reports and provides admin report list/detail/status operations. |
| `backend/src/controllers/upload.controller.js` | Streams validated images to Cloudinary in a server-chosen per-user folder. |
| `backend/src/middleware/auth.middleware.js` | Verifies bearer JWT, loads the user, and enforces allowed roles. |
| `backend/src/middleware/optionalAuth.js` | Attaches a user when a valid bearer token is present, without requiring login. |
| `backend/src/middleware/errorHandler.js` | Normalizes validation/database errors and writes safe JSON error responses. |
| `backend/src/middleware/notFound.js` | Produces the API 404 response for unmatched routes. |
| `backend/src/middleware/requestLogger.js` | Logs HTTP requests through Morgan. |
| `backend/src/models/Article.js` | Article schema, content state, slug and publication metadata. |
| `backend/src/models/Category.js` | Category name/slug/icon/listing-count schema. |
| `backend/src/models/contentStatus.js` | Shared content status values for publishable content. |
| `backend/src/models/Facility.js` | Nearby facility schema and supported facility types. |
| `backend/src/models/index.js` | Central model registry used by database setup and services. |
| `backend/src/models/Location.js` | City/locality, popular ordering, listing counts, images, and suggestion indexes. |
| `backend/src/models/Project.js` | Development project schema and publication metadata. |
| `backend/src/models/Property.js` | Listing schema, enums, private contact field, and property search indexes. |
| `backend/src/models/PropertyImage.js` | Per-property image records, order, URL/storage key, and relationship index. |
| `backend/src/models/SavedProperty.js` | Saved-property link (`userId`, `propertyId`) with a unique `(userId, propertyId)` index and a `(userId, createdAt)` index for listing. |
| `backend/src/models/Report.js` | Listing report schema and report status values. |
| `backend/src/models/User.js` | User identity, password hash, and `user`/`admin` roles. |
| `backend/src/routes/admin-article.routes.js` | Admin article list/detail/create/update/publish/delete route declarations. |
| `backend/src/routes/admin-project.routes.js` | Admin project list/detail/create/update/publish/delete route declarations. |
| `backend/src/routes/admin-report.routes.js` | Admin report list/detail/status route declarations. |
| `backend/src/routes/admin.router.js` | Applies admin protection to admin route groups and mounts location/facility/property bulk operations. |
| `backend/src/routes/article.routes.js` | Public article list and slug detail routes. |
| `backend/src/routes/auth.routes.js` | Register/login rate limit; login/logout, current-user, profile update, change password/email and account deletion routes. |
| `backend/src/routes/category.routes.js` | Public category list plus protected admin CRUD routes. |
| `backend/src/routes/health.routes.js` | Public health endpoint declaration. |
| `backend/src/routes/index.js` | Mounts feature routers under `/api/v1`. |
| `backend/src/routes/location.routes.js` | Popular locations, rate-limited suggestions, and location facility reads. |
| `backend/src/routes/project.routes.js` | Public new/list/detail project routes. |
| `backend/src/routes/property.routes.js` | Public property search/detail, authenticated `/mine`, and create/update/delete routes. |
| `backend/src/routes/report.routes.js` | Public optional-auth report creation route. |
| `backend/src/routes/upload.routes.js` | Authenticated, rate-limited image upload route. |
| `backend/src/services/article.service.js` | Article database selection, slug creation, publication, and CRUD behavior. |
| `backend/src/services/auth.service.js` | Password hashing/comparison and JWT creation/verification. |
| `backend/src/services/health.service.js` | Builds health response including MongoDB status. |
| `backend/src/services/project.service.js` | Project database listing/order and admin CRUD/publish behavior. |
| `backend/src/services/property.service.js` | Property/image persistence, filter construction, ownership checks, and bulk operations. |
| `backend/src/services/report.service.js` | Report persistence, pagination/filtering, and status updates. |
| `backend/src/utils/AppError.js` | Typed HTTP errors used by controllers/services. |
| `backend/src/utils/asyncHandler.js` | Forwards rejected async route handlers into Express error handling. |
| `backend/src/utils/serializers/article.serializer.js` | Shapes article Mongo documents for API responses. |
| `backend/src/utils/serializers/category.serializer.js` | Shapes category Mongo documents for API responses. |
| `backend/src/utils/serializers/facility.serializer.js` | Shapes facility Mongo documents for API responses. |
| `backend/src/utils/serializers/location.serializer.js` | Shapes location Mongo documents for API responses. |
| `backend/src/utils/serializers/project.serializer.js` | Shapes project Mongo documents for API responses. |
| `backend/src/utils/serializers/property.serializer.js` | Shapes properties/images and strips private contact information, except for the owner's `/properties/mine` list. |
| `backend/src/utils/serializers/report.serializer.js` | Shapes report Mongo documents for API responses. |

#### Backend tests (`backend/tests`)

| File | Coverage focus |
|---|---|
| `backend/tests/admin-properties-bulk.test.js` | Admin bulk listing update/delete authorization and behavior. |
| `backend/tests/articles.test.js` | Public/admin article routes and validation. |
| `backend/tests/auth.account.test.js`, `auth.accountRateLimit.test.js` | Profile update, change password/email, account deletion, and their rate limit. |
| `backend/tests/auth.middleware.test.js`, `auth.secret.test.js` | `protect`/`restrictTo` behavior and the JWT_SECRET startup check. |
| `backend/tests/admin-dashboard.test.js`, `location-admin.test.js`, `projects-admin.test.js` | Admin dashboard, location and project routes. |
| `backend/tests/properties.mine.test.js` | Owner-only `/properties/mine` listing. |
| `backend/tests/properties.contact.test.js` | Contact endpoint access, 404s, rate limit, and that no other property route exposes `contactNumber`. |
| `backend/tests/app.trustProxy.test.js` | `TRUST_PROXY_HOPS` parsing and client IP resolution. |
| `backend/tests/auth.rateLimit.test.js` | Authentication rate limiting. |
| `backend/tests/auth.test.js` | Registration, login, tokens, and current-user behavior. |
| `backend/tests/category.test.js` | Category list and protected CRUD behavior. |
| `backend/tests/facility.test.js` | Facility reads and admin CRUD validation. |
| `backend/tests/health.test.js` | Health response and database-state reporting. |
| `backend/tests/location.test.js` | Popular/suggestion endpoints and admin location updates. |
| `backend/tests/projects.test.js` | Public and admin project operations. |
| `backend/tests/properties.test.js` | Listing validation/search, ownership, serialization, and image behavior. |
| `backend/tests/reports.test.js` | Report creation and admin status workflow. |
| `backend/tests/seedTransform.test.js` | Seed transformation/validation without MongoDB. |
| `backend/tests/upload.test.js` | Image upload endpoint: size/type validation, access control, rate limiting. |

### Frontend

#### Package and configuration

| File | What it does / when it is used |
|---|---|
| `frontend/.gitignore` | Excludes frontend dependencies, build output, and local environment artifacts (except `.env.example`). |
| `frontend/.env.example` | `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` with local defaults. |
| `frontend/AGENTS.md` | Next.js-specific workspace guidance; requires reading the installed Next documentation before edits. |
| `frontend/CLAUDE.md` | Project-local assistant guidance reference. |
| `frontend/eslint.config.mjs` | Frontend lint rules. |
| `frontend/jsconfig.json` | JavaScript project settings and `@/` source alias. |
| `frontend/next.config.js` | Next image remote-host allowlist (Picsum and Cloudinary). |
| `frontend/package.json` | Next dev/build/start/lint scripts and frontend dependencies. |
| `frontend/package-lock.json` | Exact resolved frontend dependency versions. |
| `frontend/postcss.config.mjs` | Tailwind CSS/PostCSS integration. |
| `frontend/README.md` | Generic Next.js starter instructions; not a full HomeNest product guide. |
| `frontend/public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Starter/static SVG assets available under `/`; not central to product behavior. |

#### App routes and global files (`frontend/src/app`)

| File | Route / use |
|---|---|
| `frontend/src/app/layout.jsx` | Root HTML layout, fonts, metadata, structured data, and provider mounting. |
| `frontend/src/app/globals.css` | Tailwind import, theme tokens, and global styles. |
| `frontend/src/app/page.jsx` | Home page composition and section ordering. |
| `frontend/src/app/not-found.jsx` | Shared not-found page. |
| `frontend/src/app/robots.js` | Generates robots rules; disallows crawling `/admin/`; points to the sitemap on `SITE_URL`. |
| `frontend/src/app/sitemap.js` | Sitemap of static routes plus published properties, projects and articles read page by page from the public API. A resource whose API call fails is left out rather than failing the build. Regenerated at most hourly. |
| `frontend/src/app/profile/page.jsx` | `/profile` account page shell (not indexed). |
| `frontend/src/app/admin/categories/page.jsx`, `admin/reports/page.jsx` | Admin category management and report review. |
| `frontend/src/app/favicon.ico` | Browser tab icon. |
| `frontend/src/app/about/page.jsx` | `/about` static company information. |
| `frontend/src/app/admin/layout.jsx` | Wraps admin routes in the admin shell. |
| `frontend/src/app/admin/page.jsx` | `/admin` dashboard backed by the API. |
| `frontend/src/app/admin/articles/page.jsx` | `/admin/articles` article management. |
| `frontend/src/app/admin/listings/page.jsx` | `/admin/listings` listing search, selection, status, verification, featuring, and deletion. |
| `frontend/src/app/admin/locations/page.jsx` | `/admin/locations` popular-location toggles, ordering and facilities. |
| `frontend/src/app/admin/profile/page.jsx` | `/admin/profile` admin profile page. |
| `frontend/src/app/admin/projects/page.jsx` | `/admin/projects` project management. |
| `frontend/src/app/builders/page.jsx` | `/builders` shell/header for the mock-backed builders directory. |
| `frontend/src/app/careers/page.jsx` | `/careers` static careers content. |
| `frontend/src/app/contact/page.jsx` | `/contact` static contact details plus local-only contact form. |
| `frontend/src/app/faqs/page.jsx` | `/faqs` static FAQs. |
| `frontend/src/app/help/page.jsx` | `/help` support/help content. |
| `frontend/src/app/insights/[slug]/page.jsx` | Mock-backed static article detail page. |
| `frontend/src/app/legal/privacy/page.jsx` | `/legal/privacy` policy content. |
| `frontend/src/app/legal/terms/page.jsx` | `/legal/terms` terms content. |
| `frontend/src/app/legal/verified-policy/page.jsx` | `/legal/verified-policy` explanation of verification. |
| `frontend/src/app/post-property/page.jsx` | `/post-property` property form page. |
| `frontend/src/app/project/[id]/page.jsx` | Dynamic project detail page backed by `GET /api/v1/projects/:id`. |
| `frontend/src/app/property/[slug]/page.jsx` | Dynamic property detail page backed by `GET /api/v1/properties/:slug`; server component with `generateMetadata` (title, description, canonical, Open Graph, Twitter). |
| `frontend/src/app/report/page.jsx` | `/report` page containing the report form. |
| `frontend/src/app/search/page.jsx` | `/search` route and Suspense boundary for URL-driven results. |
| `frontend/src/app/tools/page.jsx` | `/tools` calculator directory. |
| `frontend/src/app/tools/emi-calculator/page.jsx` | `/tools/emi-calculator` calculator page. |
| `frontend/src/app/tools/property-value-calculator/page.jsx` | `/tools/property-value-calculator` estimator page. |

#### Shared components (`frontend/src/components`)

| File | What it does / when it is used |
|---|---|
| `frontend/src/components/ConsentBanner.jsx` | Dismissible browser-local consent notice; analytics provider is not connected. |
| `frontend/src/components/icons.jsx` | Shared icon components used by navigation, cards, and controls. |
| `frontend/src/components/PostPropertyButton.jsx` | Reusable post-property CTA with tracking and optional prefill/source. |
| `frontend/src/components/Providers.jsx` | Mounts auth, toast, login prompt, saved-property, and city contexts. |
| `frontend/src/components/admin/AdminField.jsx` | Shared admin form field label/input styling. |
| `frontend/src/components/admin/AdminLoginGate.jsx` | Admin login form using the shared session; rejects non-admin accounts. |
| `frontend/src/components/admin/AdminProfileMenu.jsx` | Admin profile/logout menu. |
| `frontend/src/components/admin/AdminShell.jsx` | Admin login gate, shell, sidebar and store provider. If a stored session cannot be verified because the backend is unreachable, shows an error with Retry and Log out instead of the login gate. |
| `frontend/src/components/admin/AdminSidebar.jsx` | Navigation between admin demo pages. |
| `frontend/src/components/admin/Modal.jsx` | Reusable admin modal wrapper. |
| `frontend/src/components/admin/StatCard.jsx` | Dashboard summary tile. |
| `frontend/src/components/admin/StatusPill.jsx` | Visual content status label. |
| `frontend/src/components/admin/Toggle.jsx` | Accessible boolean toggle used in admin tables. |
| `frontend/src/components/admin/forms/AddArticleForm.jsx` | Adds an article through the admin API. |
| `frontend/src/components/admin/forms/AddListingForm.jsx` | Adds a listing through the admin API. |
| `frontend/src/components/admin/forms/AddProjectForm.jsx` | Adds a project through the admin API. |
| `frontend/src/components/account/ProfileContent.jsx` | `/profile` body: redirects logged-out visitors and composes the account sections. |
| `frontend/src/components/account/AccountSections.jsx` | Details, change-password, change-email and delete-account forms. |
| `frontend/src/components/account/MyListings.jsx` | The user's own listings from `/properties/mine`, with their contact number, edit and delete. |
| `frontend/src/components/account/useFormAction.js` | Shared submit/loading/error helper for the account forms. |
| `frontend/src/components/builders/BuildersDirectory.jsx` | Groups mock projects by developer and offers builder/project links. |
| `frontend/src/components/contact/ContactForm.jsx` | Contact form with local confirmation; does not send a message. |
| `frontend/src/components/home/AppPromotion.jsx` | Static planned-app promotion section. |
| `frontend/src/components/home/BuildersPromo.jsx` | Home-page link/promotion to builders directory. |
| `frontend/src/components/home/FeaturedProperties.jsx` | Loads mock featured properties and handles loading/error states. |
| `frontend/src/components/home/FeaturedShowcase.jsx` | Displays featured property cards/carousel. |
| `frontend/src/components/home/Hero.jsx` | Buy/rent/sell tabs, search submission, recent searches, and sell CTA. |
| `frontend/src/components/home/HeroSlider.jsx` | Hero background media/slide presentation. |
| `frontend/src/components/home/Insights.jsx` | Renders mock insight/article cards. |
| `frontend/src/components/home/LocationInput.jsx` | Debounced city/locality autocomplete backed by the location suggestion API. |
| `frontend/src/components/home/NewProjects.jsx` | Renders mock new-project cards. |
| `frontend/src/components/home/PopularLocations.jsx` | Loads and renders API-backed popular location cards. |
| `frontend/src/components/home/PropertyCard.jsx` | Shared property card with image, price, badges, amenities, save action, and detail link. |
| `frontend/src/components/home/PropertyCategories.jsx` | Loads API-backed categories and links into search. |
| `frontend/src/components/home/RecentSearches.jsx` | Reads and renders browser-local recent searches. |
| `frontend/src/components/home/SearchBar.jsx` | Location, type, budget, and search-submit controls. |
| `frontend/src/components/home/SellBanner.jsx` | Static post-property promotion. |
| `frontend/src/components/home/WhyChooseUs.jsx` | Static trust/benefit section. |
| `frontend/src/components/layout/CitySelector.jsx` | Site-wide city selector backed by browser-local city context. |
| `frontend/src/components/layout/Footer.jsx` | Shared footer and site links. |
| `frontend/src/components/layout/Navbar.jsx` | Responsive navigation, city selector, post-property CTA, login prompt, and when signed in the user's name, an `admin` label for admins, Profile and Log out. |
| `frontend/src/components/layout/PageHeader.jsx` | Reusable eyebrow/title/description header. |
| `frontend/src/components/layout/PageShell.jsx` | Shared public-page navbar/main/footer wrapper. |
| `frontend/src/components/legal/LegalSections.jsx` | Reusable layout for legal/policy pages. |
| `frontend/src/components/post-property/PostPropertyForm.jsx` | Authenticated property submission and Cloudinary upload flow. |
| `frontend/src/components/property/ContactOwnerCard.jsx` | Login-gated contact number reveal backed by `GET /api/v1/properties/:id/contact`. |
| `frontend/src/components/property/PropertyGallery.jsx` | Client gallery: large photo, thumbnails, wrapping previous/next buttons and arrow keys; placeholder for no photos, no controls for one. |
| `frontend/src/components/property/SaveButton.jsx` | Property save toggle backed by the saved-properties context (persisted via the API). |
| `frontend/src/components/report/ReportListingForm.jsx` | Report form that submits to `POST /api/v1/reports`. |
| `frontend/src/components/search/SearchResults.jsx` | URL filter parsing, API search, card normalization, states, and pagination. |
| `frontend/src/components/tools/EmiCalculator.jsx` | Browser-side loan EMI calculator. |
| `frontend/src/components/tools/PropertyValueCalculator.jsx` | Browser-side indicative estimate using local rates. |
| `frontend/src/components/ui/Carousel.jsx` | Shared carousel interaction/scroll behavior. |
| `frontend/src/components/ui/Container.jsx` | Shared max-width content wrapper. |
| `frontend/src/components/ui/Section.jsx` | Shared home/content section layout. |
| `frontend/src/components/ui/SectionError.jsx` | Retryable section error presentation. |
| `frontend/src/components/ui/SkeletonGrid.jsx` | Reusable loading placeholder grid. |

#### Frontend shared logic (`frontend/src/lib`)

| File | What it does / when it is used |
|---|---|
| `frontend/src/lib/admin-auth-context.jsx` | Admin view of the shared session; rejects non-admin logins with "This account is not an admin". |
| `frontend/src/lib/admin-store.jsx` | Admin data store and write actions, all through `api.js`. |
| `frontend/src/lib/api.js` | The API client: base URL, cookie credentials, 401 handling. `api.delete(path, { body })` accepts a body. A request that gets no response throws `ApiError` with status `0` and a "Could not reach the server" message; validation details from the backend are appended to the error message. |
| `frontend/src/lib/site.js` | Site URL (from `NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000`), site name and default share image used by layout, page metadata, robots.txt and the sitemap. |
| `frontend/src/lib/amenities.js` | Amenity options, display priority, and card selection helpers. |
| `frontend/src/lib/api-client.js` | Unauthenticated `fetch` wrapper for public and server-side reads. |
| `frontend/src/lib/auth-context.jsx` | The one shared session for the public site and `/admin`: register/login/logout, current user, token replacement. Exposes `sessionError` and `verifySession` when a stored token could not be checked for a reason other than 401. |
| `frontend/src/lib/budgetPresets.js` | Buy/rent budget preset definitions and lookup. |
| `frontend/src/lib/city-context.jsx` | Shared selected-city state stored in localStorage. |
| `frontend/src/lib/cityRates.js` | City-level rates consumed by the value estimator. |
| `frontend/src/lib/dataSource.js` | Home section fetchers; API-backed for locations, categories, new projects, and builders; mock-backed for featured properties and insights. |
| `frontend/src/lib/format.js` | Price, area, and date formatting helpers. |
| `frontend/src/lib/locationSuggestions.js` | Calls location-suggestion API and groups/caps city/locality matches. |
| `frontend/src/lib/login-prompt-context.jsx` | Login/register prompt and post-login continuation. The form state lives in `LoginPromptModal`, which unmounts on close, so typed values never persist. |
| `frontend/src/lib/mockData.js` | Shared sample properties, locations, categories, projects, and articles used by UI and seed script. |
| `frontend/src/lib/propertyTypes.js` | Property type labels/options by intent. |
| `frontend/src/lib/recentSearches.js` | Adds/reads up to five recent searches in browser localStorage. |
| `frontend/src/lib/saved-properties-context.jsx` | Saved-property ID set loaded from `GET /api/v1/saved-properties/ids`, toggled through `POST`/`DELETE /api/v1/saved-properties/:propertyId`, plus the login prompt. |
| `frontend/src/app/saved/page.jsx` | `/saved` page: paginated (20 per page, Load more) list of the user's saved properties. |
| `frontend/src/lib/slugify.js` | Slug and random suffix helpers. |
| `frontend/src/lib/toast-context.jsx` | Shared toast notification state and presentation. |
| `frontend/src/lib/trackEvent.js` | Analytics event payload wrapper; currently console-only in development. |
| `frontend/src/lib/useDebouncedValue.js` | Generic debounced React value hook used for autocomplete. |
| `frontend/src/lib/useLocalStorageState.js` | Hydrates and persists React state to browser localStorage. |
| `frontend/src/lib/useSectionData.js` | Fetch lifecycle/retry state for home sections. |

### Planning and product documentation (`docs`)

| File | What it is used for |
|---|---|
| `docs/backend-architecture.md` | Backend model/API planning baseline; some statements describe earlier state and should be checked against current routes before relying on them. |
| `docs/landing-page-prd.md` | Home-page behavior, content, design, and quality requirements. |
| `docs/landing-page-prd.pdf` | PDF export of the landing-page brief. |
| `docs/current-capabilities-and-file-guide.md` | This current-state guide. |

## Important Documentation and Integration Gaps

- The architecture document is a planning baseline. Some endpoint names and requirements in it are planned rather than present; inspect `backend/src/routes` for actual registrations.
- The contact form and analytics delivery remain follow-up work.
