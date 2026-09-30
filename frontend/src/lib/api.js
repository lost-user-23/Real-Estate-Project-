const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'auth_token';
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Check your connection and try again.";

export class ApiError extends Error {
    constructor(message,status, data){
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

export const tokenStore = {
    get() {
        try{
            return localStorage.getItem(TOKEN_KEY);
        }
        catch{
            return null;
        }
    },
    set(token) {
        try{
            localStorage.setItem(TOKEN_KEY, token);
        } catch{}
    },
    clear(){
        try{
            localStorage.removeItem(TOKEN_KEY);
        } catch{}
    },
};

let onUnauthorized = null;
export function setUnauthorizedHandler(fn){
    onUnauthorized = fn;
}

export async function request(
  path,
  { method = "GET", body, headers, auth = true } = {}
) {
  const token = auth ? tokenStore.get() : null;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
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
    //  treat 401 as "session expired" if we actually sent a token. wrong password on the login form is also a 401 and must not trigger a logout.
    if (res.status === 401 && token) {
      tokenStore.clear();
      if (onUnauthorized) onUnauthorized();
    }
    // Auth endpoints (register/login) respond with a flat { message }; property
    // and admin endpoints go through the shared error handler, which nests it
    // as { error: { message, details } }. Handle both shapes.
    const message = data?.error?.message || data?.message || `Request failed (${res.status})`;
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
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};