"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const LoginPromptContext = createContext(null);

export function LoginPromptProvider({ children }) {
  const { login } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const onSuccessRef = useRef(undefined);

  const requestLogin = useCallback((onSuccess) => {
    onSuccessRef.current = onSuccess;
    setError("");
    setOpen(true);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const session = await login({ email, password, name, mode });
      setOpen(false);
      onSuccessRef.current?.(session);
      onSuccessRef.current = undefined;
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
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
          <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h2 id="login-prompt-title" className="text-lg font-semibold">
              {mode === "register" ? "Create your account" : "Log in to continue"}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Use your account to save properties, contact owners, and submit listings.
            </p>
            <div className="mt-5 flex gap-2 border-b border-border text-sm">
              {["login", "register"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    setError("");
                  }}
                  className={`border-b-2 px-2 pb-2 font-medium ${mode === option ? "border-primary text-primary" : "border-transparent text-text-muted"}`}
                >
                  {option === "login" ? "Log in" : "Create account"}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {mode === "register" ? (
                <label className="text-xs font-medium text-text-muted">
                  Name
                  <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
                </label>
              ) : null}
              <label className="text-xs font-medium text-text-muted">
                Email
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
              </label>
              <label className="text-xs font-medium text-text-muted">
                Password
                <input required type="password" minLength={8} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
              </label>
            </div>
            {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg"
              >
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
                {isSubmitting ? "Please wait…" : mode === "register" ? "Create account" : "Log in"}
              </button>
            </div>
          </form>
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
