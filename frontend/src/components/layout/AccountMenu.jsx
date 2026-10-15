"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "@/components/icons";

// Name button with Saved / Profile / Log out tucked into a dropdown, so the
// header bar doesn't carry three extra links.
export function AccountMenu({ user, isAdmin, logout, transparent = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass = "block w-full rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-bg hover:text-primary";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${
          transparent ? "text-white hover:bg-white/10" : "text-text hover:bg-bg"
        }`}
      >
        <span className="max-w-28 truncate">{user?.name || "Account"}</span>
        {isAdmin ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            admin
          </span>
        ) : null}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          <Link role="menuitem" href="/saved" onClick={() => setOpen(false)} className={itemClass}>
            Saved
          </Link>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={itemClass}>
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className={itemClass}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
