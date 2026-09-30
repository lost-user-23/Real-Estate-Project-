"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { ChevronDownIcon } from "@/components/icons";

export function AdminProfileMenu() {
  const { user, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm hover:border-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden font-medium sm:inline">{user?.name}</span>
        <ChevronDownIcon className="h-4 w-4 text-text-muted" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-surface py-1 shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-text-muted">{user?.email}</p>
            </div>
            <Link
              href="/admin/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm hover:bg-bg"
            >
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-bg"
            >
              Log out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
