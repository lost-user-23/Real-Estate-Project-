"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

export function AdminLoginGate() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    login(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <Link href="/" className="text-sm font-bold tracking-tight text-primary">
          HomeNest Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-text-muted">
          Demo mode — there&apos;s no backend yet, so any email and password will get you in.
        </p>

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
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
