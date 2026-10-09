"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { Container } from "@/components/ui/Container";

const MIN_PASSWORD_LENGTH = 8;
const inputClass = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";
const primaryButtonClass =
  "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60";

// Nothing is sent on page load: the token is single-use, and link scanners or
// prefetchers that open the page must not spend it. The user submits a form.
// `flow` comes from the link the server generated; anything other than
// "email-change" (including old links without it) shows the password form,
// which also works for an email-change token because the server ignores the
// password there.
export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isEmailChange = searchParams.get("flow") === "email-change";
  const { isLoggedIn, verifySession } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState({ status: "idle", message: "", flow: "" });

  const mismatch = !isEmailChange && confirmPassword !== "" && password !== confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mismatch) return;
    setState({ status: "submitting", message: "", flow: "" });
    try {
      const result = await api.post(
        "/api/auth/verify-email",
        isEmailChange ? { token } : { token, password },
        { auth: false }
      );
      setState({ status: "success", message: "", flow: result?.flow || "" });
      // A registration sets the session cookie; an email change updates the
      // signed-in user. Either way, reload the session from /me.
      verifySession({ force: true });
    } catch (error) {
      // A password problem leaves the link usable, so keep the form on screen.
      setState({ status: "error", message: error?.message || "Could not verify this link.", flow: "" });
    }
  };

  if (!token) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This link is incomplete</h1>
        <p role="alert" className="mt-2 text-sm text-danger">
          The verification link is missing its token. Open the link from the email again.
        </p>
      </Shell>
    );
  }

  if (state.status === "success") {
    const signedIn = state.flow === "register" || isLoggedIn;
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Email verified</h1>
        <p role="status" className="mt-2 text-sm text-text-muted">
          {state.flow === "register"
            ? "Your account is ready and you're signed in."
            : "Thanks, your new email address is confirmed."}
        </p>
        {signedIn ? (
          <Link href="/" className={`mt-6 inline-flex ${primaryButtonClass}`}>
            Continue
          </Link>
        ) : (
          <button type="button" onClick={() => requestLogin()} className={`mt-6 ${primaryButtonClass}`}>
            Log in
          </button>
        )}
      </Shell>
    );
  }

  const submitting = state.status === "submitting";

  return (
    <Shell>
      <h1 className="text-xl font-semibold">{isEmailChange ? "Confirm your new email" : "Finish creating your account"}</h1>
      <p className="mt-2 text-sm text-text-muted">
        {isEmailChange
          ? "Confirm that this is your new email address."
          : "Choose a password to verify your email and sign in."}
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 text-left">
        {isEmailChange ? null : (
          <>
            <label className="text-xs font-medium text-text-muted">
              Password
              <input
                required
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-xs font-medium text-text-muted">
              Confirm password
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            {mismatch ? <p className="text-sm text-danger">Passwords do not match.</p> : null}
          </>
        )}
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
        <button type="submit" disabled={submitting || mismatch} className={`mt-2 self-center ${primaryButtonClass}`}>
          {submitting ? "Please wait…" : isEmailChange ? "Confirm email" : "Verify and sign in"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">{children}</div>
    </Container>
  );
}
