// Single wrapper around whichever analytics SDK gets confirmed (PRD §3, §12).
// Components call trackEvent(), never a vendor SDK directly, so swapping
// providers later is a change in this file only.

const SESSION_STORAGE_KEY = "homenest_session_id";

function getViewport() {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getSessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

export function trackEvent(name, props = {}) {
  const payload = {
    event: name,
    page: "home",
    viewport: getViewport(),
    sessionId: getSessionId(),
    ...props,
  };

  if (process.env.NODE_ENV !== "production") {
    console.debug("[trackEvent]", payload);
  }

  // TODO(PRD §12): forward `payload` to the confirmed analytics provider.
}
