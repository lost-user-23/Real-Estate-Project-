// A non-secret flag ("a session probably exists in this browser") that tells the
// app whether it is worth calling POST /api/auth/refresh on page load. It holds
// no token and grants nothing: the httpOnly cookie is still the only credential.
// Without it every anonymous visitor makes a refresh call that is bound to fail
// with a 401.
const KEY = "homenest_session_hint";

export function hasSessionHint(storage) {
  try {
    return storage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionHint(storage) {
  try {
    storage.setItem(KEY, "1");
  } catch {
    // storage blocked: the next page load just skips the restore
  }
}

export function clearSessionHint(storage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
