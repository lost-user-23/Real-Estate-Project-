"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { useToast } from "@/lib/toast-context";
import { createSavedSync } from "@/lib/saved-sync";

const SavedPropertiesContext = createContext(null);
const BASE = "/api/v1/saved-properties";

export function SavedPropertiesProvider({ children }) {
  const { isLoggedIn, token } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const { show } = useToast();
  const [savedIds, setSavedIds] = useState(new Set());

  // Created once; `show` comes from a useCallback with no dependencies, so it never changes.
  const [sync] = useState(() =>
    createSavedSync({
      send: (id, saved) => (saved ? api.post(`${BASE}/${id}`, {}) : api.delete(`${BASE}/${id}`)),
      onChange: (id, saved) =>
        setSavedIds((prev) => {
          if (prev.has(id) === saved) return prev;
          const next = new Set(prev);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        }),
      onSaved: () => show("Saved to your favourites"),
      onFailure: () => show("Could not update favourites. Try again."),
    })
  );

  // Restore saved hearts when a session exists, clear them when it ends.
  useEffect(() => {
    if (!token) {
      sync.reset();
      Promise.resolve().then(() => setSavedIds(new Set()));
      return;
    }
    let cancelled = false;
    api
      .get(`${BASE}/ids`)
      .then(({ propertyIds }) => {
        // union, so a save made during login is not wiped by this response
        if (!cancelled) sync.hydrate(propertyIds);
      })
      .catch(() => {
        // One toast, current state kept, no retry loop.
        if (!cancelled) show("Could not load your saved properties.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, sync, show]);

  const toggleSave = useCallback(
    (id) => {
      if (!isLoggedIn) {
        // Property saves automatically once login succeeds.
        requestLogin(() => sync.set(id, true));
        return;
      }
      sync.toggle(id);
    },
    [isLoggedIn, requestLogin, sync]
  );

  const value = useMemo(
    () => ({
      isSaved: (id) => savedIds.has(id),
      toggleSave,
    }),
    [savedIds, toggleSave]
  );

  return <SavedPropertiesContext.Provider value={value}>{children}</SavedPropertiesContext.Provider>;
}

export function useSavedProperties() {
  const ctx = useContext(SavedPropertiesContext);
  if (!ctx) throw new Error("useSavedProperties must be used within SavedPropertiesProvider");
  return ctx;
}
