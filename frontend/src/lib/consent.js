"use client";

import { useEffect, useState } from "react";

// Analytics is opt-in: nothing loads or is sent until the visitor accepts.
// "Got it" from the old banner was an acknowledgement, not consent, so its key
// (homenest_analytics_consent_ack) is deliberately ignored and treated as
// undecided.
const STORAGE_KEY = "homenest_analytics_consent";
const LEGACY_KEY = "homenest_analytics_consent_ack";
const CHANGE_EVENT = "homenest:consent-change";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

// "granted" | "denied" | null (undecided or storage unavailable)
export function getStoredConsent() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage blocked: the choice only lasts for this page view
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

export function hasAnalyticsConsent() {
  return Boolean(GA_MEASUREMENT_ID) && getStoredConsent() === "granted";
}

// Reads storage after mount (not during render) to avoid a hydration mismatch.
// `ready` is false until that first read, so callers render nothing meanwhile.
export function useConsent() {
  const [state, setState] = useState({ ready: false, consent: null });

  useEffect(() => {
    const sync = (event) =>
      setState({ ready: true, consent: event?.detail ?? getStoredConsent() });
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return state;
}
