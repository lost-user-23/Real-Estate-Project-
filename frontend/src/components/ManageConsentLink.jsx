"use client";

import { GA_MEASUREMENT_ID, withdrawConsent } from "@/lib/consent";

// Footer link for changing the analytics choice. Rendered only when analytics
// is configured; otherwise there is nothing to manage.
export function ManageConsentLink() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <button type="button" onClick={withdrawConsent} className="text-xs text-text-muted underline hover:text-primary [footer_&]:text-white/60 [footer_&]:hover:text-white">
      Manage consent
    </button>
  );
}
