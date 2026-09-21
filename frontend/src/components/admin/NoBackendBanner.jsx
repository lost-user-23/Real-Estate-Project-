"use client";

import { useAdminStore } from "@/lib/admin-store";

export function NoBackendBanner() {
  const { resetToMockData } = useAdminStore();

  return (
    <div className="flex flex-col gap-2 border-b border-accent-dark/30 bg-accent/15 px-4 py-2.5 text-sm text-accent-ink sm:flex-row sm:items-center sm:justify-between">
      <p>
        No backend is connected yet. Changes here are saved to this browser only and won&apos;t affect the live
        site.
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Reset all admin data in this browser back to the sample data?")) {
            resetToMockData();
          }
        }}
        className="self-start rounded-full border border-accent-dark/40 px-3 py-1 text-xs font-semibold hover:bg-accent/30 sm:self-auto"
      >
        Reset sample data
      </button>
    </div>
  );
}
