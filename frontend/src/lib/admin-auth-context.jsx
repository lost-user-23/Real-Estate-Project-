"use client";

import { createContext, useContext, useMemo } from "react";
import { useLocalStorageState } from "@/lib/useLocalStorageState";

const DEFAULT_PROFILE = { name: "Admin User", email: "", title: "Content Admin" };

// Separate from the public-site auth-context - an admin is a different
// actor from a logged-in buyer/renter. No real backend, so this is a mock
// session gate: any email/password combination logs in, and the session
// persists to localStorage so a refresh doesn't kick you back out.
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useLocalStorageState("homenest_admin_session", { loggedIn: false });
  const [profile, setProfile] = useLocalStorageState("homenest_admin_profile", DEFAULT_PROFILE);

  const value = useMemo(
    () => ({
      isLoggedIn: session.loggedIn,
      profile,
      login: (email) => {
        setSession({ loggedIn: true });
        setProfile((prev) => ({ ...prev, email: email || prev.email || "admin@homenest.example" }));
      },
      logout: () => setSession({ loggedIn: false }),
      updateProfile: (patch) => setProfile((prev) => ({ ...prev, ...patch })),
    }),
    [session, profile, setSession, setProfile]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
