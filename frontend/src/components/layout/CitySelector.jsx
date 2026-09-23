"use client";

import { useEffect, useRef, useState } from "react";
import { useCity } from "@/lib/city-context";
import { MOCK_LOCATIONS } from "@/lib/mockData";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";

// Sorted once at module scope - MOCK_LOCATIONS doesn't change at runtime.
const CITIES = [...MOCK_LOCATIONS].sort((a, b) => b.activeListingCount - a.activeListingCount);

export function CitySelector({ transparent = false }) {
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const select = (nextCity) => {
    setCity(nextCity);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${
          transparent ? "text-white hover:bg-white/10" : "text-text hover:bg-bg"
        }`}
      >
        <MapPinIcon className="h-4 w-4 shrink-0" />
        <span className="max-w-24 truncate">{city ?? "All India"}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select a city"
          className="absolute left-0 top-full z-50 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 text-text shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={city === null}
            onClick={() => select(null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-bg ${
              city === null ? "font-semibold text-primary" : ""
            }`}
          >
            All India
          </button>
          {CITIES.map((location) => (
            <button
              key={location.id}
              type="button"
              role="option"
              aria-selected={city === location.city}
              onClick={() => select(location.city)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-bg ${
                city === location.city ? "font-semibold text-primary" : ""
              }`}
            >
              <span>{location.city}</span>
              <span className="text-xs text-text-muted">{location.activeListingCount.toLocaleString("en-IN")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
