"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID, useConsent } from "@/lib/consent";
import { pageLocation } from "@/lib/analyticsLocation.mjs";

// Mounts GA4 only when an ID is configured AND the visitor accepted. Until then
// no gtag.js request is made. The page_view is sent by us, not by GA's
// automatic one, so page_location can be the path without the query string
// (a search keyword lives in ?q=).
export function AnalyticsLoader() {
  const { consent } = useConsent();
  const active = Boolean(GA_MEASUREMENT_ID) && consent === "granted";
  const pathname = usePathname();

  useEffect(() => {
    if (!active) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
    }
    const location = pageLocation(window.location);
    // `set` also covers GA's own history-change events, which would otherwise
    // read the full URL.
    window.gtag("set", { page_location: location });
    window.gtag("event", "page_view", { page_location: location, page_title: document.title });
  }, [active, pathname]);

  if (!active) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`} strategy="afterInteractive" />;
}
