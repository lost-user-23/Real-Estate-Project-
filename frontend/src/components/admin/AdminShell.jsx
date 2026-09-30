"use client";

import Link from "next/link";
import { AdminStoreProvider } from "@/lib/admin-store";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import { AdminProfileMenu } from "@/components/admin/AdminProfileMenu";

function AdminShellInner({ children }) {
  const { isAuthenticated, loading, sessionError, retrySession, logout } = useAdminAuth();

  // Avoid flashing the login gate while the session is still being restored
  // from localStorage.
  if (loading) return <div className="p-8 text-sm text-text-muted">Loading…</div>;

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-danger bg-surface px-4 py-3 text-sm text-danger">
          <span>Could not verify your admin session: {sessionError}</span>
          <div className="flex gap-4">
            <button type="button" onClick={retrySession} className="font-medium underline">
              Retry
            </button>
            <button type="button" onClick={logout} className="font-medium text-text-muted underline">
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginGate />;
  }

  return (
    <AdminStoreProvider>
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
          <Link href="/admin" className="text-sm font-bold tracking-tight text-primary">
            HomeNest Admin
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-text-muted hover:text-primary">
              View site
            </Link>
            <AdminProfileMenu />
          </div>
        </header>
        <div className="flex flex-1 flex-col lg:flex-row">
          <aside className="border-b border-border bg-surface lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
            <AdminSidebar />
          </aside>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </AdminStoreProvider>
  );
}

export function AdminShell({ children }) {
  return (
    <AdminAuthProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminAuthProvider>
  );
}
