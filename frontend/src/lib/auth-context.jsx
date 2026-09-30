"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore, setUnauthorizedHandler } from "@/lib/api";

// Single source of truth for the session: the public site and /admin both read
// from here, share one token (tokenStore) and one 401 handler.
const AuthContext = createContext(null);
// Session keys from earlier auth implementations. Nothing reads or writes them
// any more; they are removed on load and on logout so stale credentials/user
// blobs don't linger in browsers that used the old builds.
const LEGACY_SESSION_KEYS = [
  "homenest_auth_token",
  "admin",
  "admin_token",
  "homenest_admin_session",
  "auth_user",
];

function removeLegacySessionKeys() {
  try {
    LEGACY_SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  // True until the stored session (if any) has been checked against /me.
  const [loading, setLoading] = useState(true);
  // Set when a stored token could not be checked because /me failed for a
  // reason other than 401 (backend down, 500). The token is kept, user stays
  // null, and screens that need the user can offer verifySession as a retry.
  const [sessionError, setSessionError] = useState(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    removeLegacySessionKeys();
    setToken(null);
    setUser(null);
    setSessionError(null);
  }, []);

  const verifySession = useCallback(() => {
    const storedToken = tokenStore.get();
    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Optimistic: treat the stored token as valid while /me is in flight so
    // the UI doesn't flash logged-out. A 401 clears it via the unauthorized
    // handler; a network failure keeps the session so a flaky connection
    // doesn't log the user out.
    setToken(storedToken);
    setLoading(true);
    setSessionError(null);
    api
      .get("/api/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((error) => {
        if (error?.status !== 401) setSessionError(error?.message || "Could not verify your session.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Any 401 on a request that carried a token means the session is gone.
    setUnauthorizedHandler(clearSession);

    removeLegacySessionKeys();

    // Deferred a tick so the state updates don't run synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(verifySession);
  }, [clearSession, verifySession]);

  const value = useMemo(
    () => ({
      isLoggedIn: Boolean(token),
      loading,
      token,
      user,
      sessionError,
      verifySession,
      login: async ({ email, password, name, mode }) => {
        const isRegister = mode === "register";
        const result = await api.post(
          isRegister ? "/api/auth/register" : "/api/auth/login",
          { email, password, ...(isRegister ? { name } : {}) },
          { auth: false }
        );
        tokenStore.set(result.token);
        setToken(result.token);
        setUser(result.user);
        setSessionError(null);
        return result;
      },
      logout: clearSession,
      // Account-management hooks: keep the one shared session in sync after the
      // server changes the user (profile/email) or re-issues the token
      // (password change invalidates every earlier token).
      updateUser: setUser,
      replaceSession: ({ token: nextToken, user: nextUser }) => {
        tokenStore.set(nextToken);
        setToken(nextToken);
        setUser(nextUser);
      },
    }),
    [token, user, loading, sessionError, verifySession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
