// On Vercel the backend is a bound service: server-side code reaches it through
// BACKEND_URL (injected at runtime, not available during builds), while the
// browser uses same-origin /api/* paths that vercel.json rewrites to it.
// NEXT_PUBLIC_API_URL still overrides both; localhost:4000 remains the dev default.
function resolveBaseUrl() {
    const explicit = process.env.NEXT_PUBLIC_API_URL;
    if (explicit) return explicit;
    if (typeof window === "undefined") return process.env.BACKEND_URL || "http://localhost:4000";
    return process.env.NODE_ENV === "production" ? "" : "http://localhost:4000";
}
const BASE_URL = resolveBaseUrl().replace(/\/$/, "");
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Check your connection and try again.";

export class ApiError extends Error {
    constructor(message,status, data){
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn){
    onUnauthorized = fn;
}

// The short-lived access token lives in this module variable only (never in
// localStorage), so a page reload starts without one and restores the session
// through the httpOnly refresh cookie (see refreshSession).
let accessToken = null;
export function setAccessToken(token){
    accessToken = token || null;
}

// One refresh at a time: requests that hit a 401 while a refresh is running
// wait for that same refresh instead of starting their own. The refresh token
// rotates on every use, so a second parallel refresh would look like a replay.
let refreshInFlight = null;
export function refreshSession(){
    if (!refreshInFlight) {
        refreshInFlight = request("/api/auth/refresh", { method: "POST", auth: false })
            .then((data) => {
                setAccessToken(data.accessToken);
                return data;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

// `auth` controls session clearing on 401; cookies are sent on every request.
// `retried` is internal: it marks the single retry after a token refresh.
export async function request(
  path,
  { method = "GET", body, headers, auth = true, retried = false, ...fetchOptions } = {}
) {
  // FormData must go out as-is so the browser sets the multipart boundary itself.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      // Extra options (signal, cache, next, ...) go first so they can't override method, headers or body.
      ...fetchOptions,
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined && !isFormData ? JSON.stringify(body) : body,
    });
  } catch (err) {
    // An aborted request also rejects; callers cancelling on purpose must see it untouched.
    if (err?.name === "AbortError") throw err;
    // fetch only rejects when no response arrived (server down, offline, CORS).
    // Browsers word that differently ("Failed to fetch", "Load failed"), so
    // callers get one readable message and status 0 instead.
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, null);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty body (e.g. 204) is fine
  }

  if (!res.ok) {
    // A login 401 is invalid credentials, not an expired session. On an
    // authenticated request the access token has most likely just expired:
    // refresh once and replay the request; only a failed refresh ends the session.
    if (res.status === 401 && auth) {
      if (!retried) {
        try {
          await refreshSession();
          return request(path, { method, body, headers, auth, retried: true, ...fetchOptions });
        } catch (refreshError) {
          if (refreshError?.status !== 401) throw refreshError;
        }
      }
      if (onUnauthorized) onUnauthorized();
    }
    // Every backend error goes through the shared error handler and arrives as
    // { error: { message, details? } }. Non-JSON bodies (e.g. a proxy error page)
    // fall back to the generic status message.
    const message = data?.error?.message || `Request failed (${res.status})`;
    const details = data?.error?.details;
    // Validation errors carry the reasons in details; "Validation failed" alone
    // gives the user nothing to fix.
    const detailText = Array.isArray(details) ? details.filter((d) => typeof d === "string").join("; ") : "";
    throw new ApiError(detailText ? `${message}: ${detailText}` : message, res.status, details ?? data);
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};