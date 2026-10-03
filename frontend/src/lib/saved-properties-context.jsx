"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { useToast } from "@/lib/toast-context";

const SavedPropertiesContext = createContext(null);
const BASE = "/api/v1/saved-properties";

export function SavedPropertiesProvider({ children }) {
  const { isLoggedIn, token } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const { show } = useToast();
  const [savedIds, setSavedIds] = useState(new Set());

  const setLocal = useCallback((id, saved) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Restore saved hearts when a session exists, clear them when it ends.
  useEffect(() => {
    if (!token) {
      Promise.resolve().then(() => setSavedIds(new Set()));
      return;
    }
    let cancelled = false;
    api
      .get(`${BASE}/ids`)
      .then(({ propertyIds }) => {
        // union, so a save made during login is not wiped by this response
        if (!cancelled) setSavedIds((prev) => new Set([...propertyIds, ...prev]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Optimistic update with rollback if the server call fails.
  const persist = useCallback(
    async (id, saved) => {
      setLocal(id, saved);
      try {
        if (saved) {
          await api.post(`${BASE}/${id}`, {});
          show("Saved to your favourites");
        } else {
          await api.delete(`${BASE}/${id}`);
        }
      } catch {
        setLocal(id, !saved);
        show("Could not update favourites. Try again.");
      }
    },
    [setLocal, show]
  );

  const toggleSave = useCallback(
    (id) => {
      if (!isLoggedIn) {
        // Property saves automatically once login succeeds.
        requestLogin(() => persist(id, true));
        return;
      }
      persist(id, !savedIds.has(id));
    },
    [isLoggedIn, requestLogin, persist, savedIds]
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