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
| `TRUST_PROXY_HOPS` | Number of reverse proxies in front of the API (usually `1`). Never `true`. Must match the real hop count: too high lets a client forge its IP with its own `X-Forwarded-For` (bypassing the contact and loan-enquiry rate limits); too low makes everyone share the proxy's IP. Verify it on the deployed host (see "Verifying TRUST_PROXY_HOPS" below) | Yes |
| `LOAN_ENQUIRY_NOTIFY_EMAIL` | Optional internal recipient for new loan-enquiry alerts (reference ID and loan type only). Empty = no alerts | No |
| `APP_URL` | Public frontend URL; verification emails link to `<APP_URL>/verify-email` | Yes |
| `SMTP_HOST` | SMTP server for verification links and one-time codes (account verification, password reset, password/email changes) | Yes |
| `SMTP_PORT` | SMTP port (default `587`; `465` uses TLS) | No |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials | Yes (the server refuses to start without them) |
| `MAIL_FROM` | From address, for example `HomeNest <no-reply@your-domain>` | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name (image upload) | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret, used by the server to upload and delete images | Yes |
| `CLOUDINARY_FOLDER` | Upload folder (default `property-images`) | No |
| `COOKIE_SAMESITE` | `strict` (default), `lax` or `none` for the refresh-token cookie (an invalid value stops startup in production). Use `none` only if frontend and API are on different sites | No |
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
3. `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create` to create the first admin, if needed (`ADMIN_NAME` is optional; the password must be at least 8 characters). Set these only for the command; they are not server settings.
4. Optional: `npm run audit:image-urls` lists stored image URLs that are not own-Cloudinary URLs (the seed's placeholder images appear here). Do not seed demo data into production.

Run these with the production environment loaded, so they hit the production database.

## Before the first deploy

- Rotate every credential that has ever been in `passwords.txt`. The file was committed once (commit `417e406`) and removed from tracking in `d239800`, but it remains in git history.
- Confirm `backend/.env` and `frontend/.env.local` are not tracked (`git ls-files | grep env` lists only `.env.example` files).

## Post-deploy smoke tests

Replace `$API` and `$APP` with the deployed API and frontend origins.

1. **Health**: `curl -i $API/health` returns `200`.
2. **Login**: log in through the frontend with a verified account. Confirm the `refreshToken` cookie is `HttpOnly` and `Secure` (path `/api/auth`), that the session survives a page reload (a `POST /api/auth/refresh` succeeds), and that logging out clears it.
3. **CORS, allowed origin**: `curl -i -H "Origin: $APP" $API/health` includes `Access-Control-Allow-Origin: <that origin>` and `Access-Control-Allow-Credentials: true`.
4. **CORS, foreign origin**: `curl -i -H "Origin: http://evil.example" $API/health` has no `Access-Control-Allow-Origin` header.
5. **Cloudinary upload**: logged in as a verified user, upload images through the "post property" form (it sends each photo to `POST /api/v1/uploads/image`). Confirm the image appears in the Cloudinary folder (`CLOUDINARY_FOLDER/<user id>`) and renders on the listing.
6. **Verification email**: register a new account and confirm the email arrives from `MAIL_FROM` and the link opens `<APP_URL>/verify-email`, where choosing a password verifies the account and signs you in. Also check that the password-reset code and the change-password code emails arrive.
7. **Startup guard**: on a staging copy, remove one required variable and confirm the process exits with an error naming it.

## Analytics and consent

- Analytics is opt-in. With `NEXT_PUBLIC_GA_MEASUREMENT_ID` empty, the banner, the GA script and all events are off.
- With an ID set, the banner appears on every page until the visitor chooses. Nothing loads and `trackEvent` sends nothing until they click Accept. Decline stores the choice and keeps everything off; the banner does not return.
- The choice is stored in `localStorage` as `homenest_analytics_consent` (`granted` or `denied`). Clearing site data asks again. The older "Got it" flag does not count as consent.
- Events never include the search keyword, emails or phone numbers. `trackEvent` strips those keys even if a caller passes them. The page_view is sent by `AnalyticsLoader` with `page_location` set to the origin plus the path only, so `?q=` and other search parameters never reach GA. In GA4, turn off Enhanced measurement "Page changes based on browser history events" so GA does not send its own page_view with the full URL.
- The footer "Manage consent" link withdraws consent: it forgets the choice, deletes the GA cookies and reloads, and the banner asks again.
- Verify: set a test ID in `frontend/.env.local`, restart `npm run dev`, click Accept, and look for `collect?v=2` requests in the Network tab (and the events in GA DebugView). After Decline, or with the ID empty, no `googletagmanager.com` or `collect` request should appear.

## Verifying TRUST_PROXY_HOPS

The hop count cannot be determined from this repository: `vercel.json` routes `/api/*` to the backend service, but how many proxies Vercel puts between the client and Express is a platform detail not recorded here. Verify it on the deployed API instead:

1. Temporarily log or return `req.ip` and `req.ips` from a throwaway route, or inspect the `RateLimit-*` behaviour from two different networks.
2. Send a request with a forged header, e.g. `curl -H "X-Forwarded-For: 6.6.6.6" https://<site>/api/...`. The IP the app uses must be your real address, not `6.6.6.6`.
3. Set `TRUST_PROXY_HOPS` to the smallest value where that holds and the IP is not the proxy's. Re-test from a second network to confirm the limiters key on different clients.

The in-memory limiters are per serverless instance, so they remain a speed bump rather than strict abuse prevention.
