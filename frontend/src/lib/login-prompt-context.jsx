"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CheckInbox } from "@/components/account/CheckInbox";

const LoginPromptContext = createContext(null);

export function LoginPromptProvider({ children }) {
  const [open, setOpen] = useState(false);
  const onSuccessRef = useRef(undefined);

  const requestLogin = useCallback((onSuccess) => {
    onSuccessRef.current = onSuccess;
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    onSuccessRef.current = undefined;
  }, []);

  const handleSuccess = useCallback((session) => {
    setOpen(false);
    const onSuccess = onSuccessRef.current;
    onSuccessRef.current = undefined;
    onSuccess?.(session);
  }, []);

  return (
    <LoginPromptContext.Provider value={{ requestLogin }}>
      {children}
      {open ? (
        <LoginPromptModal onClose={handleClose} onSuccess={handleSuccess} />
      ) : null}
    </LoginPromptContext.Provider>
  );
}

// Owns every field of the form. It is only mounted while the prompt is open,
// so closing it or finishing a login discards the typed name, email and password.
function LoginPromptModal({ onClose, onSuccess }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set after sign-up: the account is not usable until the emailed link is opened.
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    let session;
    try {
      session = await login(mode === "register" ? { email, name, mode } : { email, password, mode });
    } catch (requestError) {
      setError(requestError.message);
      setIsSubmitting(false);
      return;
    }
    if (session.registered) {
      setRegisteredEmail(email);
      setIsSubmitting(false);
      return;
    }
    // Unmounts this component, so no state updates after this point.
    onSuccess(session);
  };

  if (registeredEmail) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      >
        <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
          <span id="login-prompt-title" className="sr-only">Check your inbox</span>
          <CheckInbox email={registeredEmail}>
            <p className="text-text-muted">Open the link to choose your password. You&apos;ll be signed in right after.</p>
          </CheckInbox>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setRegisteredEmail("");
                setPassword("");
                setMode("login");
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg"
            >
              Back to log in
            </button>
            <button type="button" onClick={onClose} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
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
          {mode === "register" ? (
            <p className="text-xs text-text-muted">We&apos;ll email you a link to verify your address and choose a password.</p>
          ) : (
            <label className="text-xs font-medium text-text-muted">
              Password
              <input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
            </label>
          )}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
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
  );
}

export function useLoginPrompt() {
  const ctx = useContext(LoginPromptContext);
  if (!ctx) throw new Error("useLoginPrompt must be used within LoginPromptProvider");
  return ctx;
}
