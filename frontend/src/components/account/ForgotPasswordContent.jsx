"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { Container } from "@/components/ui/Container";

const MIN_PASSWORD_LENGTH = 8;
const inputClass = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary";
const primaryButtonClass =
  "w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60 transition-colors";

export function ForgotPasswordContent() {
  const { requestLogin } = useLoginPrompt();
  
  // Steps: 'request' -> 'verify' -> 'reset' -> 'success'
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", { email }, { auth: false });
      setStep("verify");
      setInfoMessage("If an account exists for that email, a 6-digit code will arrive shortly. Check your inbox.");
    } catch (err) {
      setError(err?.message || "Failed to send reset code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/verify-reset-otp", { email, code: otp.trim() }, { auth: false });
      if (res?.resetToken) {
        setResetToken(res.resetToken);
        setStep("reset");
      } else {
        setError("Invalid response from server. Please try again.");
      }
    } catch (err) {
      setError(err?.message || "Invalid or expired code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setInfoMessage("");
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", { email }, { auth: false });
      setInfoMessage("If an account exists for that email, a new code will arrive shortly.");
    } catch (err) {
      setError(err?.message || "Could not resend code right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setInfoMessage("");
    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { resetToken, newPassword }, { auth: false });
      setStep("success");
    } catch (err) {
      setError(err?.message || "Failed to reset password. The session may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        {step === "request" && (
          <>
            <h1 className="text-xl font-bold text-text">Forgot your password?</h1>
            <p className="mt-2 text-sm text-text-muted">
              Enter your account&apos;s email address. If an account exists, we&apos;ll send a 6-digit verification code.
            </p>
            <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-4 text-left">
              <div>
                <label htmlFor="fp-email" className="text-xs font-medium text-text-muted">Email address</label>
                <input
                  id="fp-email"
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <button type="submit" disabled={submitting} className={`mt-2 ${primaryButtonClass}`}>
                {submitting ? "Sending code…" : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {step === "verify" && (
          <>
            <h1 className="text-xl font-bold text-text">Enter verification code</h1>
            <p className="mt-2 text-sm text-text-muted">
              If an account exists for <span className="font-semibold text-text">{email}</span>, a 6-digit code is on its way.
            </p>
            {infoMessage ? <p className="mt-3 text-xs text-primary bg-primary/10 p-2.5 rounded-lg">{infoMessage}</p> : null}
            <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-4 text-left">
              <div>
                <label htmlFor="fp-code" className="text-xs font-medium text-text-muted">6-digit code</label>
                <input
                  id="fp-code"
                  required
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className={`${inputClass} tracking-widest text-center text-lg font-mono`}
                />
              </div>
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <button type="submit" disabled={submitting || otp.length !== 6} className={`mt-2 ${primaryButtonClass}`}>
                {submitting ? "Verifying…" : "Verify code"}
              </button>
            </form>
            <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
              <button
                type="button"
                onClick={() => { setStep("request"); setError(""); setInfoMessage(""); }}
                className="hover:underline text-text-muted"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={submitting}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </>
        )}

        {step === "reset" && (
          <>
            <h1 className="text-xl font-bold text-text">Set new password</h1>
            <p className="mt-2 text-sm text-text-muted">
              Please choose a new strong password for your account.
            </p>
            <form onSubmit={handleResetPassword} className="mt-6 flex flex-col gap-4 text-left">
              <div>
                <label htmlFor="fp-new-password" className="text-xs font-medium text-text-muted">New password</label>
                <input
                  id="fp-new-password"
                  required
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="fp-confirm-password" className="text-xs font-medium text-text-muted">Confirm new password</label>
                <input
                  id="fp-confirm-password"
                  required
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                <p className="text-xs text-danger">Passwords do not match.</p>
              ) : null}
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting || newPassword.length < MIN_PASSWORD_LENGTH || newPassword !== confirmPassword}
                className={`mt-2 ${primaryButtonClass}`}
              >
                {submitting ? "Updating password…" : "Reset password"}
              </button>
            </form>
          </>
        )}

        {step === "success" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-text">Password reset complete</h1>
            <p className="mt-2 text-sm text-text-muted">
              Your password has been successfully reset. All active sessions have been invalidated for security.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => requestLogin()}
                className={primaryButtonClass}
              >
                Log in with new password
              </button>
              <Link href="/" className="text-xs text-text-muted hover:underline mt-1">
                Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
