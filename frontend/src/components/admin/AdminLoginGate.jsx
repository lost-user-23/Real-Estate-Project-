"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

export function AdminLoginGate() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e?.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <Link href="/" className="text-sm font-bold tracking-tight text-primary">
          HomeNest Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in with your admin account.</p>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <AdminField label="Email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={adminFieldInputClass}
            />
          </AdminField>
          <AdminField label="Password" required>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={adminFieldInputClass}
            />
          </AdminField>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
