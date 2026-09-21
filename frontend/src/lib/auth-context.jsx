"use client";

import { createContext, useContext, useMemo, useState } from "react";

// No backend yet, so "login" is a client-side stand-in that lets the rest of
// the UI (save icon, Sell panel note, phone reveal) demonstrate both the
// logged-out and logged-in states described in the PRD.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const value = useMemo(
    () => ({
      isLoggedIn,
      login: () => setIsLoggedIn(true),
      logout: () => setIsLoggedIn(false),
    }),
    [isLoggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
