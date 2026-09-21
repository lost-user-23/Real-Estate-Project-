"use client";

import Link from "next/link";
import { AdminStoreProvider } from "@/lib/admin-store";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { NoBackendBanner } from "@/components/admin/NoBackendBanner";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import { AdminProfileMenu } from "@/components/admin/AdminProfileMenu";

function AdminShellInner({ children }) {
  const { isLoggedIn } = useAdminAuth();

  if (!isLoggedIn) {
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
        <NoBackendBanner />
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
