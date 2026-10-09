"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useConsent } from "@/lib/consent";
import { trackEvent } from "@/lib/trackEvent";
import { normalizeKeyword, parseBhkParam } from "@/components/search/SearchFilters";

// Fires `search_submitted` once per distinct set of filters (not on paging or
// re-sorting). It sends which filters were used and the result count, never
// the keyword text. The count comes from its own limit=1 request, made only
// when the visitor has accepted analytics, so there is no cost otherwise.
export function SearchAnalytics() {
  const searchParams = useSearchParams();
  const { consent } = useConsent();
  const lastSent = useRef(null);

  const keyword = normalizeKeyword(searchParams.get("q"));
  const bhk = parseBhkParam(searchParams.get("bhk")).join(",");
  const filters = {
    intent: searchParams.get("intent") || "",
    city: searchParams.get("city") || "",
    locality: searchParams.get("locality") || "",
    propertyType: searchParams.get("propertyType") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  };
  const apiParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) apiParams.set(key, value);
  if (keyword) apiParams.set("q", keyword);
  if (bhk) apiParams.set("bhk", bhk);
  const filterKey = apiParams.toString();

  useEffect(() => {
    if (consent !== "granted" || lastSent.current === filterKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams(filterKey);
    params.set("limit", "1");

    api.get(`/api/v1/properties?${params.toString()}`, { auth: false, signal: controller.signal })
      .then((result) => {
        lastSent.current = filterKey;
        trackEvent("search_submitted", {
          intent: filters.intent || "any",
          property_type: filters.propertyType || "any",
          has_city: Boolean(filters.city),
          has_locality: Boolean(filters.locality),
          has_price_filter: Boolean(filters.minPrice || filters.maxPrice),
          has_keyword: Boolean(keyword),
          bhk: bhk || "any",
          result_count: result?.meta?.total ?? 0,
        });
      })
      .catch(() => {
        // analytics must never surface errors to the visitor
      });

    return () => controller.abort();
    // `filters` is derived from filterKey, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, filterKey]);

  return null;
}
