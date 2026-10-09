# Production checklist

No secret values belong in this file, in git, or in logs. Variable names only.

## Backend environment (`backend/.env` or the host's secret store)

With `NODE_ENV=production` the server refuses to start (clear error naming the variable) if any "required" variable is missing or invalid.

| Variable | Purpose | Required |
| --- | --- | --- |
| `NODE_ENV` | Set to `production` | Yes |
| `MONGODB_URI` | MongoDB connection string (for example `mongodb+srv://...`). No localhost fallback in production | Yes |
| `MONGODB_DB_NAME` | Database name (default `homenest`) | No |
| `PORT` | HTTP port (default `4000`) | No |
| `JWT_SECRET` | Signs auth tokens. At least 32 characters, random, not a placeholder (`openssl rand -hex 64`) | Yes |
| `CORS_ORIGIN` | Exact frontend origin(s), comma-separated. See CORS rules below | Yes |
| `TRUST_PROXY_HOPS` | Number of reverse proxies in front of the API (usually `1`). Never `true` | Yes |
| `APP_URL` | Public frontend URL; verification emails link to `<APP_URL>/verify-email` | Yes |
| `SMTP_HOST` | SMTP server for verification emails | Yes |
| `SMTP_PORT` | SMTP port (default `587`; `465` uses TLS) | No |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials, if the provider needs them | No (provider-dependent) |
| `MAIL_FROM` | From address, for example `HomeNest <no-reply@your-domain>` | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name (image upload) | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret, used to sign uploads | Yes |
| `CLOUDINARY_FOLDER` | Upload folder (default `property-images`) | No |
| `COOKIE_SAMESITE` | `strict` (default), `lax` or `none` for the refresh-token cookie. Use `none` only if frontend and API are on different sites | No |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Global per-IP rate limit (defaults 200 per 15 min) | No |

## Frontend environment (build time)

| Variable | Purpose | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Public https URL of the backend API | Yes |
| `NEXT_PUBLIC_SITE_URL` | Public origin of the site (canonical URLs, sitemap) | Yes |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 ID (`G-XXXXXXXXXX`). Empty disables analytics entirely: no banner, no script, no events. | No |

`NEXT_PUBLIC_*` values are inlined by `next build`. Set them before building and rebuild after any change; changing them on a running server does nothing. A build made without `NEXT_PUBLIC_API_URL` calls `http://localhost:4000`.

## CORS rules

- `CORS_ORIGIN` is one exact origin or a comma-separated list, for example `https://www.example.com,https://example.com`.
- Each entry is scheme + host (+ port) only: no path, no query. Spaces and trailing slashes are trimmed.
- `*` is rejected at startup. Credentials (the auth cookie) are always allowed, so wildcards are never valid.
- State-changing requests (POST/PUT/PATCH/DELETE) carrying an `Origin` not in the list get `403`.
- The frontend's origin must appear in `CORS_ORIGIN` exactly (`www` and non-`www` are different origins).

## Database setup order (run once per environment, safe to rerun)

1. `cd backend && npm run db:setup` builds or syncs indexes. It never drops a collection or deletes documents; it only drops indexes that are no longer defined on a schema.
2. `npm run backfill:email-verified` marks accounts created before email verification as verified. Only users with no `emailVerified` field are touched, so reruns change nothing.
3. `npm run admin:create` to create the first admin, if needed.

Run these with the production environment loaded, so they hit the production database.

## Before the first deploy

- Rotate every credential that has ever been in `passwords.txt`. The file was committed once (commit `417e406`) and removed from tracking in `d239800`, but it remains in git history.
- Confirm `backend/.env` and `frontend/.env.local` are not tracked (`git ls-files | grep env` lists only `.env.example` files).

## Post-deploy smoke tests

Replace `$API` and `$APP` with the deployed API and frontend origins.

1. **Health**: `curl -i $API/health` returns `200`.
2. **Login**: log in through the frontend with a verified account. Confirm the auth cookie is `HttpOnly` and `Secure`, and that `/api/auth/me` works afterwards.
3. **CORS, allowed origin**: `curl -i -H "Origin: $APP" $API/health` includes `Access-Control-Allow-Origin: <that origin>` and `Access-Control-Allow-Credentials: true`.
4. **CORS, foreign origin**: `curl -i -H "Origin: http://evil.example" $API/health` has no `Access-Control-Allow-Origin` header.
5. **Signed Cloudinary upload**: logged in as a verified user, upload an image through the "post property" form. Confirm the image appears in the Cloudinary folder (`CLOUDINARY_FOLDER/<user id>`) and renders on the listing.
6. **Verification email**: register a new account and confirm the email arrives from `MAIL_FROM` and the link opens `<APP_URL>/verify-email`, then verifies the account.
7. **Startup guard**: on a staging copy, remove one required variable and confirm the process exits with an error naming it.

## Analytics and consent

- Analytics is opt-in. With `NEXT_PUBLIC_GA_MEASUREMENT_ID` empty, the banner, the GA script and all events are off.
- With an ID set, the banner appears on every page until the visitor chooses. Nothing loads and `trackEvent` sends nothing until they click Accept. Decline stores the choice and keeps everything off; the banner does not return.
- The choice is stored in `localStorage` as `homenest_analytics_consent` (`granted` or `denied`). Clearing site data asks again. The older "Got it" flag does not count as consent.
- Events never include the search keyword, emails or phone numbers. `trackEvent` strips those keys even if a caller passes them. The page_view is sent by `AnalyticsLoader` with `page_location` set to the origin plus the path only, so `?q=` and other search parameters never reach GA. In GA4, turn off Enhanced measurement "Page changes based on browser history events" so GA does not send its own page_view with the full URL.
- The footer "Manage consent" link withdraws consent: it forgets the choice, deletes the GA cookies and reloads, and the banner asks again.
- Verify: set a test ID in `frontend/.env.local`, restart `npm run dev`, click Accept, and look for `collect?v=2` requests in the Network tab (and the events in GA DebugView). After Decline, or with the ID empty, no `googletagmanager.com` or `collect` request should appear.
