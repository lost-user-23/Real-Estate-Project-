"use client";

import { useCallback } from "react";
import { useToast } from "@/lib/toast-context";

// Returns a function that runs an async admin action. On failure it shows the
// server's message in a toast and returns { ok: false } so callers can skip
// their follow-up work.
export function useAttempt() {
  const { show } = useToast();
  return useCallback(
    async (fn) => {
      try {
        const value = await fn();
        return { ok: true, value };
      } catch (e) {
        show(e?.message || "Something went wrong. Please try again.", { error: true });
        return { ok: false };
      }
    },
    [show]
  );
}
