# HomeNest: Current Capabilities and File Guide

**Reviewed:** 2026-09-29  
**Purpose:** Describe what the current workspace actually does, distinguish live API behavior from prototype behavior, and provide a directory-by-directory guide to the project files.

This describes the implementation in the current workspace, not every feature described in the planning documents. Generated output and dependency contents (`node_modules`, `.next`, coverage files) are excluded. `backend/.env` is local configuration and must not be shared or committed.

## Project at a Glance

HomeNest is a real-estate discovery and listing prototype with a Next.js 16 / React 19 frontend, an Express 5 / Mongoose backend, and MongoDB persistence. The frontend and backend are separate npm packages. The browser app currently mixes mock data, browser-local demo state, and real HTTP calls; the presence of an API endpoint does not mean the corresponding screen uses it.

The backend is mounted at `http://localhost:4000` by default. The frontend API client uses `NEXT_PUBLIC_API_URL` when set, otherwise it calls that default. Local CORS defaults to `http://localhost:3000`.

## What a Public User Can Do Now

| User workflow | Current behavior |
|---|---|
| Browse the home page | Browse the hero, featured properties, popular locations, categories, projects, builders, insights, and static information. Popular locations, categories, projects, and builder data use the API. Featured properties and insights remain mock-backed. |
| Search properties | `/search` calls `GET /api/v1/properties` with intent, city, locality, property type, price range, and pagination query parameters. It displays API results, loading/error/empty states, and pagination. This is the primary public flow currently backed by live property data. |
| Get location suggestions | The home search autocomplete calls `GET /api/v1/locations/suggestions`, debounces input, and supports keyboard selection. The API returns up to six suggestions. |
| Create an account or log in | The login prompt calls `POST /api/auth/register` or `POST /api/auth/login`. The JWT is stored in browser localStorage and checked through `GET /api/auth/me` on reload. A user can log out by clearing the local token. |
| Submit a property | The Post Property form requires login and at least five images. It requests signed Cloudinary upload parameters, uploads the files, then calls `POST /api/v1/properties`. The backend creates the listing as a `draft`; it is not automatically public. |
| Manage submitted listings | There is no user-facing "My listings" page. The API supports authenticated owner updates/deletes at `/api/v1/properties/:id`, but the public UI does not expose those operations. |
| Save a property | Users can toggle a favorite and are prompted to log in first. Saved IDs only live in React memory: they are not sent to an API, do not survive a refresh, and there is no saved-properties page. |
| View owner contact | A logged-in user can reveal a generated mock number. No authenticated contact-number API is connected; it is not the listing owner's real number. |
| Report a listing | The form displays a local success message only. It does not submit to the available `POST /api/v1/reports` endpoint. |
| Contact HomeNest | The contact form displays a local confirmation only; no support-message backend is connected. |
| Browse property/project/article details | Property and project detail pages fetch their public API records on demand. Article details remain generated from the frontend mock dataset at build time. Project links use API IDs; a missing or malformed project ID shows not found. |
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

The UI is a **demo**, not a protected production admin console. Any syntactically valid email and non-empty password pass its login gate; the credentials are not checked by a server. The gate and profile are stored in localStorage, separate from the real user JWT. The page itself warns that changes are local and do not affect the live site.

| Admin screen | Demo actions available | Persistence |
|---|---|---|
| Dashboard | View counts for published/featured/unverified listings, popular locations, published projects, and articles; navigate to management screens. | Derived from local demo data |
| Listings | Search by title/location; add a sample listing; edit status, verified flag, featured flag and rank; bulk set status/verification/featured; delete one or many. The UI enforces an eight-featured-listing limit. | Browser localStorage only |
| Popular locations | Toggle whether a location is popular and set its order. The UI enforces a five-listing eligibility threshold. | Browser localStorage only |
| Projects | Add a sample project, change status, or delete it. | Browser localStorage only |
| Insights/articles | Add a sample article, change status, or delete it. | Browser localStorage only |
| Profile | Change the displayed admin name, email, and title. | Browser localStorage only |

These edits do not update MongoDB and do not change live API results. The app has no admin reports or facilities screen, and no category management screen.

### Admin API Operations

Protected admin APIs are implemented independently of the demo UI. They require a real bearer token belonging to a database user with `role: "admin"`; the frontend demo login does not issue such a token. Registration creates ordinary users. The seed script's development admin has an intentionally unusable password placeholder, so it cannot log in as seeded.

| Operation | API route(s) |
|---|---|
| Bulk update listing status, verification, featured state/rank, and supported classification fields; bulk-delete listings | `PATCH /api/v1/admin/properties/bulk`, `DELETE /api/v1/admin/properties/bulk` |
| Update location fields, including popular flag and rank | `PATCH /api/v1/admin/locations/:id` |
| Create/update/delete nearby facilities | `POST /api/v1/admin/facilities`, `PATCH /api/v1/admin/facilities/:id`, `DELETE /api/v1/admin/facilities/:id` |
| Create/update/delete categories | `POST /api/v1/categories`, `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` |
| List/read/create/update/publish/delete projects | `/api/v1/admin/projects` and `/api/v1/admin/projects/:id` routes |
| List/read/create/update/publish/delete articles | `/api/v1/admin/articles` and `/api/v1/admin/articles/:id` routes |
| List/read reports and update report status | `/api/v1/admin/reports` and `/api/v1/admin/reports/:id` routes |
| Edit/delete an owned property (or any property as admin) | `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id` |

Admin routes use `protect` and `restrictTo('admin')`. They are not wired into the admin frontend, which continues to use `admin-store` and localStorage.

## API Surface Implemented

All routes below are registered by the current backend. Unless noted, API routes are under `/api/v1`.

| Method and path | Purpose / access |
|---|---|
| `GET /health` | Health and MongoDB connection state; public |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Account creation, login, and current user; `/me` requires bearer token. Login/register are rate-limited. |
| `GET /api/v1/properties` | Public published-property search/list with filters and pagination |
| `GET /api/v1/properties/:slug` | Public published property detail |
| `POST /api/v1/properties` | Authenticated property submission; created as draft |
| `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id` | Authenticated owner/admin update or delete |
| `PATCH /api/v1/admin/properties/bulk`, `DELETE /api/v1/admin/properties/bulk` | Admin bulk listing operations |
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
| `POST /api/v1/uploads/signature` | Authenticated Cloudinary upload-signature request |

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

The frontend defaults to `http://localhost:4000` for the API. Set `NEXT_PUBLIC_API_URL` before starting the frontend if the backend uses another URL. Backend production mode requires `MONGODB_URI`, `JWT_SECRET`, and `CORS_ORIGIN`; Cloudinary settings are needed for uploads. `npm run seed` imports the shared mock content into MongoDB; `npm run db:setup` synchronizes model indexes.

Backend checks: `npm test` and `npm run lint` from `backend/`. Frontend checks: `npm run lint` and `npm run build` from `frontend/`; there is no frontend test script in `frontend/package.json` at this time.

## File Guide

### Backend

#### Package, setup, and scripts

| File | What it does / when it is used |
|---|---|
| `backend/.env` | Local environment values and secrets; keep private and out of version control. |
| `backend/.env.example` | Names and local defaults for MongoDB, port/CORS, JWT, and Cloudinary configuration. |
| `backend/.gitignore` | Excludes local dependencies, environment files, and generated files from Git. |
| `backend/eslint.config.js` | Backend lint rules. |
| `backend/package.json` | Backend scripts and dependencies: Express, Mongoose, auth, uploads, Jest. |
| `backend/package-lock.json` | Exact resolved backend dependency versions for reproducible installs. |
| `backend/README.md` | Backend setup, health, seeding, database index setup, and architecture notes; its opening status section is older than the current endpoint implementation. |
| `backend/scripts/README.md` | Documents seed/index scripts and notes that no general migration suite exists. |
| `backend/scripts/seed.js` | Loads/transforms mock data and upserts it into MongoDB. |
| `backend/scripts/setup-db.js` | Connects models and synchronizes their declared indexes. |
| `backend/scripts/seedData/loadMockData.js` | Loads the frontend mock dataset for the seed process without maintaining a second copy. |
| `backend/scripts/seedData/transform.js` | Converts and validates mock records into MongoDB property/image/location/category/project/article documents. |

#### Backend runtime (`backend/src`)

| File | What it does / when it is used |
|---|---|
| `backend/src/app.js` | Creates the Express app, installs CORS/JSON/logging/mounts routes and central error handling. |
| `backend/src/server.js` | Starts HTTP and MongoDB connection, exposes graceful shutdown. |
| `backend/src/config/index.js` | Loads `.env`, sets defaults, and enforces required production configuration. |
| `backend/src/config/cloudinary.js` | Configures the Cloudinary SDK from environment values. |
| `backend/src/db/connection.js` | Owns MongoDB connect/disconnect lifecycle and reports connection state. |
| `backend/src/controllers/article.controller.js` | Validates public/admin article requests and formats response envelopes. |
| `backend/src/controllers/auth.controller.js` | Registers users, verifies login credentials, issues tokens, returns current user. |
| `backend/src/controllers/category.controller.js` | Lists public categories and handles protected category CRUD requests. |
| `backend/src/controllers/facility.controller.js` | Lists facilities by location and handles admin facility CRUD. |
| `backend/src/controllers/health.controller.js` | Returns the health-service status. |
| `backend/src/controllers/location.controller.js` | Serves popular locations and suggestions; validates admin location changes. |
| `backend/src/controllers/project.controller.js` | Validates and handles public/admin project operations. |
| `backend/src/controllers/property.controller.js` | Validates property create/search/update/delete and admin bulk operations. |
| `backend/src/controllers/report.controller.js` | Creates user reports and provides admin report list/detail/status operations. |
| `backend/src/controllers/upload.controller.js` | Generates authenticated Cloudinary upload signatures. |
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
| `backend/src/models/Report.js` | Listing report schema and report status values. |
| `backend/src/models/User.js` | User identity, password hash, and `user`/`admin` roles. |
| `backend/src/routes/admin-article.routes.js` | Admin article list/detail/create/update/publish/delete route declarations. |
| `backend/src/routes/admin-project.routes.js` | Admin project list/detail/create/update/publish/delete route declarations. |
| `backend/src/routes/admin-report.routes.js` | Admin report list/detail/status route declarations. |
| `backend/src/routes/admin.router.js` | Applies admin protection to admin route groups and mounts location/facility/property bulk operations. |
| `backend/src/routes/article.routes.js` | Public article list and slug detail routes. |
| `backend/src/routes/auth.routes.js` | Register/login rate limits and protected current-user route. |
| `backend/src/routes/category.routes.js` | Public category list plus protected admin CRUD routes. |
| `backend/src/routes/health.routes.js` | Public health endpoint declaration. |
| `backend/src/routes/index.js` | Mounts feature routers under `/api/v1`. |
| `backend/src/routes/location.routes.js` | Popular locations, rate-limited suggestions, and location facility reads. |
| `backend/src/routes/project.routes.js` | Public new/list/detail project routes. |
| `backend/src/routes/property.routes.js` | Public property search/detail and authenticated create/update/delete routes. |
| `backend/src/routes/report.routes.js` | Public optional-auth report creation route. |
| `backend/src/routes/upload.routes.js` | Authenticated upload-signature route. |
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
| `backend/src/utils/serializers/property.serializer.js` | Shapes properties/images and strips private contact information. |
| `backend/src/utils/serializers/report.serializer.js` | Shapes report Mongo documents for API responses. |

#### Backend tests (`backend/tests`)

| File | Coverage focus |
|---|---|
| `backend/tests/admin-properties-bulk.test.js` | Admin bulk listing update/delete authorization and behavior. |
| `backend/tests/articles.test.js` | Public/admin article routes and validation. |
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
| `backend/tests/upload.test.js` | Upload-signature endpoint and access control. |

### Frontend

#### Package and configuration

| File | What it does / when it is used |
|---|---|
| `frontend/.gitignore` | Excludes frontend dependencies, build output, and local environment artifacts. |
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
| `frontend/src/app/robots.js` | Generates robots rules; disallows crawling `/admin/`. |
| `frontend/src/app/sitemap.js` | Generates sitemap using static routes and current mock property/project/article data. |
| `frontend/src/app/favicon.ico` | Browser tab icon. |
| `frontend/src/app/about/page.jsx` | `/about` static company information. |
| `frontend/src/app/admin/layout.jsx` | Wraps admin routes in the admin shell. |
| `frontend/src/app/admin/page.jsx` | `/admin` demo dashboard and sample-data summaries. |
| `frontend/src/app/admin/articles/page.jsx` | `/admin/articles` demo insight/article management. |
| `frontend/src/app/admin/listings/page.jsx` | `/admin/listings` demo listing search, selection, status, verification, featuring, and deletion. |
| `frontend/src/app/admin/locations/page.jsx` | `/admin/locations` demo popular-location toggles and ordering. |
| `frontend/src/app/admin/profile/page.jsx` | `/admin/profile` local demo profile settings. |
| `frontend/src/app/admin/projects/page.jsx` | `/admin/projects` demo project management. |
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
| `frontend/src/app/property/[slug]/page.jsx` | Dynamic property detail page backed by `GET /api/v1/properties/:slug`. |
| `frontend/src/app/report/page.jsx` | `/report` page containing the local-only report form. |
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
| `frontend/src/components/admin/AdminLoginGate.jsx` | Demo-only admin login form; accepts any email/password. |
| `frontend/src/components/admin/AdminProfileMenu.jsx` | Admin profile/logout menu. |
| `frontend/src/components/admin/AdminShell.jsx` | Admin demo gate, shell, sidebar, banner, and store provider. |
| `frontend/src/components/admin/AdminSidebar.jsx` | Navigation between admin demo pages. |
| `frontend/src/components/admin/Modal.jsx` | Reusable admin modal wrapper. |
| `frontend/src/components/admin/NoBackendBanner.jsx` | Explains local-only admin changes and offers sample-data reset. |
| `frontend/src/components/admin/StatCard.jsx` | Dashboard summary tile. |
| `frontend/src/components/admin/StatusPill.jsx` | Visual content status label. |
| `frontend/src/components/admin/Toggle.jsx` | Accessible boolean toggle used in admin tables. |
| `frontend/src/components/admin/forms/AddArticleForm.jsx` | Adds a sample article to local admin storage. |
| `frontend/src/components/admin/forms/AddListingForm.jsx` | Adds a sample property to local admin storage. |
| `frontend/src/components/admin/forms/AddProjectForm.jsx` | Adds a sample project to local admin storage. |
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
| `frontend/src/components/layout/Navbar.jsx` | Responsive navigation, auth prompt/logout, city selector, and post-property CTA. |
| `frontend/src/components/layout/PageHeader.jsx` | Reusable eyebrow/title/description header. |
| `frontend/src/components/layout/PageShell.jsx` | Shared public-page navbar/main/footer wrapper. |
| `frontend/src/components/legal/LegalSections.jsx` | Reusable layout for legal/policy pages. |
| `frontend/src/components/post-property/PostPropertyForm.jsx` | Authenticated property submission and Cloudinary upload flow. |
| `frontend/src/components/property/ContactOwnerCard.jsx` | Login-gated display of a generated mock phone number. |
| `frontend/src/components/property/SaveButton.jsx` | Property save toggle using in-memory saved-property state. |
| `frontend/src/components/report/ReportListingForm.jsx` | Local-only report form; backend report API is not invoked. |
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
| `frontend/src/lib/admin-auth-context.jsx` | Demo admin login/profile/session in browser localStorage; not the backend auth system. |
| `frontend/src/lib/admin-store.jsx` | LocalStorage-backed mock admin content and demo mutations. |
| `frontend/src/lib/amenities.js` | Amenity options, display priority, and card selection helpers. |
| `frontend/src/lib/api-client.js` | Shared `fetch` wrapper, API base URL, bearer token header, and error extraction. |
| `frontend/src/lib/auth-context.jsx` | Real user register/login/current-user/logout state with JWT storage. |
| `frontend/src/lib/budgetPresets.js` | Buy/rent budget preset definitions and lookup. |
| `frontend/src/lib/city-context.jsx` | Shared selected-city state stored in localStorage. |
| `frontend/src/lib/cityRates.js` | City-level rates consumed by the value estimator. |
| `frontend/src/lib/dataSource.js` | Home section fetchers; API-backed for locations, categories, new projects, and builders; mock-backed for featured properties and insights. |
| `frontend/src/lib/format.js` | Price, area, and date formatting helpers. |
| `frontend/src/lib/locationSuggestions.js` | Calls location-suggestion API and groups/caps city/locality matches. |
| `frontend/src/lib/login-prompt-context.jsx` | Login/register modal and post-login continuation behavior. |
| `frontend/src/lib/mockData.js` | Shared sample properties, locations, categories, projects, and articles used by UI and seed script. |
| `frontend/src/lib/mockPhone.js` | Generates contact-number placeholders for property detail UI. |
| `frontend/src/lib/propertyTypes.js` | Property type labels/options by intent. |
| `frontend/src/lib/recentSearches.js` | Adds/reads up to five recent searches in browser localStorage. |
| `frontend/src/lib/saved-properties-context.jsx` | In-memory saved-property set and login prompt; no persistence/API integration. |
| `frontend/src/lib/slugify.js` | Slug generation and random suffix helpers for demo admin forms. |
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

- The backend README's initial status says authentication/admin/public endpoints are not implemented. That is stale: current routes and tests include these features.
- The architecture document is a planning baseline. Some endpoint names and requirements in it are planned rather than present; inspect `backend/src/routes` for actual registrations.
- Admin web screens are deliberately labeled local-only, and are not wired to protected admin APIs.
- Article details and some home sections still use frontend mock data. API availability alone does not make database records visible in those screens.
- The report/contact forms, saved-property persistence, real owner contact retrieval, and analytics delivery remain follow-up work.
