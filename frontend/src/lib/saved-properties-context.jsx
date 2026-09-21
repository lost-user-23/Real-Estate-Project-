"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { useToast } from "@/lib/toast-context";

const SavedPropertiesContext = createContext(null);

export function SavedPropertiesProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const { show } = useToast();
  const [savedIds, setSavedIds] = useState(new Set());

  const save = useCallback(
    (id) => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      show("Saved to your favourites");
    },
    [show]
  );

  const toggleSave = useCallback(
    (id) => {
      if (!isLoggedIn) {
        // Property saves automatically once login succeeds.
        requestLogin(() => save(id));
        return;
      }
      const willSave = !savedIds.has(id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      if (willSave) {
        show("Saved to your favourites");
      }
    },
    [isLoggedIn, requestLogin, save, show, savedIds]
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
