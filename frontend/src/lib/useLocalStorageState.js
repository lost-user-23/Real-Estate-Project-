"use client";

import { useEffect, useState } from "react";

// useState that persists to this browser's localStorage, for per-browser
// preferences (e.g. the selected city). Not for data that must live server-side.
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
