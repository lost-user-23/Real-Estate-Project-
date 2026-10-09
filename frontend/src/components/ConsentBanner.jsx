"use client";

import { GA_MEASUREMENT_ID, setStoredConsent, useConsent } from "@/lib/consent";

const BUTTON_CLASS =
  "rounded-full border border-primary px-5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-light";

// Opt-in analytics notice (PRD §11). Shown only when a GA ID is configured and
// the visitor has not chosen yet; Accept and Decline are deliberately identical.
export function ConsentBanner() {
  const { ready, consent } = useConsent();

  if (!GA_MEASUREMENT_ID || !ready || consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">
          May we use analytics cookies to understand how this site is used? Nothing is collected unless you accept.{" "}
          <a href="/legal/privacy" className="underline hover:text-primary">
            Privacy policy
          </a>
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setStoredConsent("granted")} className={BUTTON_CLASS}>
            Accept
          </button>
          <button type="button" onClick={() => setStoredConsent("denied")} className={BUTTON_CLASS}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
