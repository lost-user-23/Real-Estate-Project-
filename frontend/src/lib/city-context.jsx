"use client";

import { createContext, useContext, useMemo } from "react";
import { useLocalStorageState } from "@/lib/useLocalStorageState";

// Site-wide "current city" filter (navbar city selector). `null` means no
// city chosen yet / "All India" - sections that scope to a city treat that
// as "show everything" rather than an empty state.
const CityContext = createContext(null);

export function CityProvider({ children }) {
  const [city, setCity] = useLocalStorageState("homenest_selected_city", null);

  const value = useMemo(() => ({ city, setCity }), [city, setCity]);

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
