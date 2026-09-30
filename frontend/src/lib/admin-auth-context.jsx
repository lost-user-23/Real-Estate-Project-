"use client";

import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

// Admin view of the shared session (see auth-context.jsx). The session is
// verified against /api/auth/me on load; the role check here is UI-only, the
// backend enforces it on every /admin route.
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const { user, isLoggedIn, loading, sessionError, verifySession, login: sharedLogin, logout } = useAuth();

  const value = useMemo(() => {
    const adminUser = user?.role === "admin" ? user : null;
    return {
      user: adminUser,
      isAuthenticated: Boolean(adminUser),
      loading,
      // A stored session that could not be checked (backend unreachable).
      // Showing the login gate here would look like a silent logout.
      sessionError: isLoggedIn && !user ? sessionError : null,
      retrySession: verifySession,
      logout,
      login: async (email, password) => {
        const { user: loggedIn } = await sharedLogin({ email, password, mode: "login" });
        if (loggedIn?.role !== "admin") {
          logout();
          throw new Error("This account is not an admin");
        }
        return loggedIn;
      },
    };
  }, [user, isLoggedIn, loading, sessionError, verifySession, sharedLogin, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AdminAuthContext);
