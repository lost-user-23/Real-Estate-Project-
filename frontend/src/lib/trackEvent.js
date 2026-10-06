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

// "/" is "home"; any other route is labelled by its first path segment
// (e.g. "/builders" -> "builders"). Callers can still override via props.
function getPage() {
  if (typeof window === "undefined") return "home";
  const segment = window.location.pathname.split("/").filter(Boolean)[0];
  return segment || "home";
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
    page: getPage(),
    viewport: getViewport(),
    sessionId: getSessionId(),
    ...props,
  };

  if (process.env.NODE_ENV !== "production") {
    console.debug("[trackEvent]", payload);
  }

  // Events are forwarded to GA4 when it is loaded. This file is the only
  // place that knows about GA.
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    const { event, page, sessionId, ...rest } = payload;
    window.gtag("event", name, { ...rest, page_name: page });
  }
}
