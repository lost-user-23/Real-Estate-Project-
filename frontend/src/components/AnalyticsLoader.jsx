"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { GA_MEASUREMENT_ID, useConsent } from "@/lib/consent";

// Mounts the GA4 script only when an ID is configured AND the visitor accepted.
// Until then no gtag.js request is made.
export function AnalyticsLoader() {
  const { consent } = useConsent();
  if (!GA_MEASUREMENT_ID || consent !== "granted") return null;
  return <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />;
}
