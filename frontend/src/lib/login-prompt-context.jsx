"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const LoginPromptContext = createContext(null);

export function LoginPromptProvider({ children }) {
  const { login } = useAuth();
  const [open, setOpen] = useState(false);
  const onSuccessRef = useRef(undefined);

  const requestLogin = useCallback((onSuccess) => {
    onSuccessRef.current = onSuccess;
    setOpen(true);
  }, []);

  const handleConfirm = () => {
    login();
    setOpen(false);
    onSuccessRef.current?.();
    onSuccessRef.current = undefined;
  };

  const handleClose = () => {
    setOpen(false);
    onSuccessRef.current = undefined;
  };

  return (
    <LoginPromptContext.Provider value={{ requestLogin }}>
      {children}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-prompt-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h2 id="login-prompt-title" className="text-lg font-semibold">
              Log in to continue
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Log in or create a free account to save properties and contact owners directly.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Log in (demo)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </LoginPromptContext.Provider>
  );
}

export function useLoginPrompt() {
  const ctx = useContext(LoginPromptContext);
  if (!ctx) throw new Error("useLoginPrompt must be used within LoginPromptProvider");
  return ctx;
}
