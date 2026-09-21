"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "homenest_analytics_consent_ack";

// Lightweight notice only (PRD §11) - this page doesn't collect PII
// directly, and no analytics provider is wired in yet (see trackEvent.js).
export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // localStorage isn't available during SSR; read after mount to avoid a
    // hydration mismatch rather than computing this during render.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage failures
    }
  };

  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">
          We use basic analytics cookies to understand how this site is used.{" "}
          <a href="/legal/privacy" className="underline hover:text-primary">
            Privacy policy
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
