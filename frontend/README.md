# HomeNest Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 frontend for HomeNest. It talks to the Express API in `../backend` and has no mock data: every home section, search, detail page, account page and the admin area read the live API. See `../docs/current-capabilities-and-file-guide.md` for what each screen does and `../docs/landing-page-prd.md` for the home-page brief.

> This Next.js version has breaking changes from older releases. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env.local   # then edit values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend should be running at `http://localhost:4000` (see `../backend/README.md`).

## Scripts

- `npm run dev` - development server (webpack).
- `npm run build` - production build.
- `npm start` - serve the production build.
- `npm run lint` - ESLint.
- `npm test` - Node's built-in test runner over `src/**/*.test.mjs` (pure helpers such as pagination, image sources, session hint and analytics location).

## Environment variables

See `.env.example`. `NEXT_PUBLIC_*` values are inlined at build time, so set them before `npm run build` and rebuild after changing them.

- `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- `NEXT_PUBLIC_SITE_URL` - public origin used for canonical URLs, Open Graph tags, `robots.txt` and the sitemap (default `http://localhost:3000`). Set it for every deployed build.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - GA4 ID. Empty disables analytics entirely (no banner, script or events). When set, GA loads only after the visitor accepts the consent banner.

## Project layout

```text
src/
  app/          routes (home, search, property, project, insights, builders, saved,
                profile, post-property, report, contact, forgot-password,
                verify-email, tools, legal, admin/*), robots.js, sitemap.js
  components/   UI by area: home, search, property, account, admin, layout, ui, ...
  lib/          API client (api.js), auth/session contexts, data fetchers
                (dataSource.js), analytics (trackEvent.js, consent.js), helpers
                and their *.test.mjs tests
```

## How it works

- **Session**: the access token is kept in memory only; a 7-day HTTP-only refresh cookie restores it. A 401 triggers one refresh and a retry (`src/lib/api.js`). A localStorage flag (`homenest_session_hint`) avoids a refresh call for visitors who were never logged in.
- **Admin**: `/admin` uses the same session; the UI only shows its screens to `role: "admin"`, and the backend enforces the role on every admin route.
- **Images**: remote hosts are allowlisted in `src/lib/imageHosts.cjs` (Cloudinary, Unsplash, Picsum) and used by `next.config.js`.
- **Browser storage**: `homenest_session_hint`, `homenest_selected_city`, `homenest_recent_searches`, `homenest_analytics_consent`, and `homenest_session_id` (sessionStorage). No tokens are stored.
