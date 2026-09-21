const STORAGE_KEY = "homenest_recent_searches";
const MAX_ENTRIES = 5;

export function getRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addRecentSearch(entry) {
  if (typeof window === "undefined") return [];
  const existing = getRecentSearches().filter(
    (s) => !(s.intent === entry.intent && s.city === entry.city && s.locality === entry.locality)
  );
  const next = [
    { ...entry, id: crypto.randomUUID(), savedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc.) - recent searches just won't persist.
  }
  return next;
}
