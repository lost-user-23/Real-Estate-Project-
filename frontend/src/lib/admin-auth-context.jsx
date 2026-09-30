"use client";

import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";

// Admin view of the shared session (see auth-context.jsx). The session is
// verified against /api/auth/me on load; the role check here is UI-only, the
// backend enforces it on every /admin route.
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const { user, loading, login: sharedLogin, logout } = useAuth();

  const value = useMemo(() => {
    const adminUser = user?.role === "admin" ? user : null;
    return {
      user: adminUser,
      isAuthenticated: Boolean(adminUser),
      loading,
      logout,
      login: async (email, password) => {
        const { user: loggedIn } = await sharedLogin({ email, password, mode: "login" });
        if (loggedIn?.role !== "admin") {
          logout();
          throw new Error("This account does not have admin access");
        }
        return loggedIn;
      },
    };
  }, [user, loading, sharedLogin, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AdminAuthContext);
