"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, refreshSession, setAccessToken, setUnauthorizedHandler } from "@/lib/api";

// Single source of truth for the session: the public site and /admin both read
// from here and share one 401 handler.
const AuthContext = createContext(null);
// Session keys from earlier auth implementations. Nothing reads or writes them
// any more; they are removed on load and on logout so stale credentials/user
// blobs don't linger in browsers that used the old builds.
const LEGACY_SESSION_KEYS = [
  "auth_token",
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
  const [hasSession, setHasSession] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const sessionVersionRef = useRef(0);
  const [user, setUser] = useState(null);
  // True until the refresh cookie has been exchanged for an access token.
  const [loading, setLoading] = useState(true);
  // Set when /me could not be checked for a reason other than 401.
  const [sessionError, setSessionError] = useState(null);

  const advanceSessionVersion = useCallback(() => {
    sessionVersionRef.current += 1;
    setSessionVersion(sessionVersionRef.current);
    return sessionVersionRef.current;
  }, []);

  const clearSession = useCallback(() => {
    removeLegacySessionKeys();
    setAccessToken(null);
    advanceSessionVersion();
    setHasSession(false);
    setUser(null);
    setSessionError(null);
  }, [advanceSessionVersion]);

  const verifySession = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      // The access token is memory-only, so every page load restores the
      // session from the httpOnly refresh cookie.
      const { user: currentUser } = await refreshSession();
      advanceSessionVersion();
      setUser(currentUser);
      setHasSession(true);
    } catch (error) {
      setUser(null);
      setHasSession(false);
      if (error?.status !== 401) {
        setSessionError(error?.message || "Could not verify your session.");
      }
    } finally {
      setLoading(false);
    }
  }, [advanceSessionVersion]);

  useEffect(() => {
    // A 401 that survives a token refresh means the session is gone.
    setUnauthorizedHandler(clearSession);

    removeLegacySessionKeys();

    // Deferred a tick so the state updates don't run synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(verifySession);
  }, [clearSession, verifySession]);

  const value = useMemo(
    () => ({
      isLoggedIn: hasSession,
      sessionVersion,
      loading,
      user,
      sessionError,
      verifySession,
      login: async ({ email, password, name, mode }) => {
        const isRegister = mode === "register";
        if (isRegister) {
          // Registering takes no password and never starts a session: the
          // password is chosen on the /verify-email page the emailed link opens,
          // and the server answers the same way whether or not the address was
          // already taken.
          const { message } = await api.post("/api/auth/register", { email, name }, { auth: false });
          return { registered: true, message };
        }
        const result = await api.post(
          "/api/auth/login",
          { email, password },
          { auth: false }
        );
        setAccessToken(result.accessToken);
        const nextSessionVersion = advanceSessionVersion();
        setHasSession(true);
        setUser(result.user);
        setSessionError(null);
        return { ...result, sessionVersion: nextSessionVersion };
      },
      logout: async () => {
        try {
          await api.post("/api/auth/logout", {}, { auth: false });
        } catch {
          // Network failure or server error: the UI must still be cleared.
        } finally {
          clearSession();
        }
      },
      // Account-management hooks: keep the one shared session in sync after the
      // server changes the user (profile/email) or re-issues the cookie
      // (password change revokes every earlier session).
      updateUser: setUser,
      replaceSession: ({ user: nextUser, accessToken: nextAccessToken }) => {
        setAccessToken(nextAccessToken);
        advanceSessionVersion();
        setHasSession(true);
        setUser(nextUser);
      },
    }),
    [hasSession, sessionVersion, user, loading, sessionError, verifySession, clearSession, advanceSessionVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
