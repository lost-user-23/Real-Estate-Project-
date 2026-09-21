"use client";

import { useEffect, useState } from "react";
import { getRecentSearches } from "@/lib/recentSearches";

export function RecentSearches({ onSelect }) {
  const [searches, setSearches] = useState([]);

  useEffect(() => {
    // localStorage isn't available during SSR; read after mount to avoid a
    // hydration mismatch rather than computing this during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearches(getRecentSearches());
  }, []);

  if (searches.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-white/90">Recent:</span>
      {searches.map((search) => (
        <button
          key={search.id}
          type="button"
          onClick={() => onSelect(search)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-primary hover:text-primary"
        >
          {search.label}
        </button>
      ))}
    </div>
  );
}
