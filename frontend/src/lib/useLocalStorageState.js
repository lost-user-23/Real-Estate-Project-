"use client";

import { useEffect, useState } from "react";

// Admin has no backend yet (see admin-store.jsx) - edits persist to this
// browser's localStorage only, so a refresh doesn't lose demo changes.
export function useLocalStorageState(key, initial) {
  const [state, setState] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time hydration from a client-only store (localStorage isn't
    // available during SSR, so this can't be computed during render
    // without a hydration mismatch).
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore malformed/unavailable storage, fall back to initial
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [key, state, hydrated]);

  return [state, setState];
}
