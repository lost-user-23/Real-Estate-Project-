"use client";

import { useEffect, useRef, useState } from "react";
import { useCity } from "@/lib/city-context";
import { isSameCity, normalizeCity, SUPPORTED_CITIES } from "@/lib/city";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";


export function CitySelector({ transparent = false }) {
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
    setQuery("");
  };

  const needle = normalizeCity(query);
  const filteredCities = SUPPORTED_CITIES.filter((name) => normalizeCity(name).includes(needle));
  const showAllIndia = "all india".includes(needle);

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
        <div className="absolute left-0 top-full z-50 mt-2 w-xl max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 text-text shadow-lg">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city"
            aria-label="Search cities"
            className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div
            role="listbox"
            aria-label="Select a city"
            className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3 md:grid-cols-4"
          >
            {showAllIndia ? (
              <button
                type="button"
                role="option"
                aria-selected={city === null}
                onClick={() => select(null)}
                className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-bg ${
                  city === null ? "font-semibold text-primary" : ""
                }`}
              >
                All India
              </button>
            ) : null}
            {filteredCities.map((cityName) => (
              <button
                key={cityName}
                type="button"
                role="option"
                aria-selected={isSameCity(city, cityName)}
                onClick={() => select(cityName)}
                className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-bg ${
                  isSameCity(city, cityName) ? "font-semibold text-primary" : ""
                }`}
              >
                {cityName}
              </button>
            ))}
            {!showAllIndia && filteredCities.length === 0 ? (
              <p className="col-span-full px-3 py-2 text-sm text-text-muted">No cities found</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
