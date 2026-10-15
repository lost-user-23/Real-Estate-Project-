"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatHomeIcon } from "@/components/icons";
import { PropertyFinderChat } from "@/components/assistant/PropertyFinderChat";

// Floating launcher for the property finder. It stays out of the admin area and
// off the finder's own page, where the chat is already on screen.
const HIDDEN_PREFIXES = ["/admin", "/property-finder"];

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Height of the analytics consent banner while it is on screen, so the launcher
  // sits above it instead of covering its Accept/Decline buttons.
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      const banner = document.querySelector('[aria-label="Analytics consent"]');
      setBannerHeight(banner ? Math.ceil(banner.getBoundingClientRect().height) : 0);
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-label="HomeNest Property Finder"
          style={{ bottom: bannerHeight + 72, height: `min(40rem, calc(100dvh - ${bannerHeight + 72 + 16}px))` }}
          className="fixed inset-x-3 z-50 overflow-hidden rounded-3xl border border-border shadow-2xl sm:inset-x-auto sm:right-5 sm:w-104"
        >
          <PropertyFinderChat onClose={() => setOpen(false)} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ bottom: bannerHeight + 16 }}
        aria-label={open ? "Close HomeNest AI property finder" : "Open HomeNest AI property finder"}
        className="group fixed right-4 z-50 flex items-center gap-2 rounded-full bg-primary py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-dark hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark sm:right-5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/35 ring-1 ring-white/30 transition-transform group-hover:scale-105">
          <ChatHomeIcon className="h-5 w-5 text-white" />
        </span>
        {open ? "Close finder" : "Find my home"}
      </button>
    </>
  );
}
