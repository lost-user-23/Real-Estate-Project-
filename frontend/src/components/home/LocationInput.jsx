"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { getLocationSuggestions } from "@/lib/locationSuggestions";
import { MapPinIcon } from "@/components/icons";

function suggestionLabel(s) {
  return s.locality ? `${s.locality}, ${s.city}` : s.city;
}

export function LocationInput({ value, onSelect }) {
  const [query, setQuery] = useState(value ? suggestionLabel(value) : "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const listboxId = useId();
  const containerRef = useRef(null);

  const [fetchedSuggestions, setFetchedSuggestions] = useState([]);
  const hasSearchableQuery = debouncedQuery.trim().length >= 2;
  // Derived rather than cleared from the effect: a query that is too short
  // shows nothing, whatever the last fetch returned.
  const suggestions = hasSearchableQuery ? fetchedSuggestions : [];

  useEffect(() => {
    if (!hasSearchableQuery) return;

    const controller = new AbortController();
    getLocationSuggestions(debouncedQuery, { signal: controller.signal })
      .then(setFetchedSuggestions)
      .catch((error) => {
        if (error.name === "AbortError") return;
        setFetchedSuggestions([]);
      });

    return () => controller.abort();
  }, [debouncedQuery, hasSearchableQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitSelection = (suggestion) => {
    onSelect({ city: suggestion.city, locality: suggestion.locality });
    setQuery(suggestionLabel(suggestion));
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleChange = (next) => {
    setQuery(next);
    setIsOpen(true);
    setActiveIndex(-1);
    if (next.trim().length === 0) {
      onSelect(null);
    } else if (value && suggestionLabel(value) !== next) {
      onSelect(null);
    }
  };

  const handleKeyDown = (event) => {
    if (!isOpen || suggestions.length === 0) {
      if (event.key === "ArrowDown") setIsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        commitSelection(suggestions[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const showEmptyState = isOpen && hasSearchableQuery && suggestions.length === 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <label htmlFor="hero-location" className="mb-1.5 block text-xs font-medium text-text-muted">
        Location
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-primary">
        <MapPinIcon className="h-5 w-5 shrink-0 text-text-muted" />
        <input
          id="hero-location"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Search city or locality"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
        />
      </div>

      {isOpen && (suggestions.length > 0 || showEmptyState) ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Location suggestions"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <li key={`${suggestion.city}-${suggestion.locality ?? ""}`} role="presentation">
                <button
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(suggestion)}
                  className={`flex w-full flex-col px-4 py-2.5 text-left text-sm ${
                    index === activeIndex ? "bg-primary-light" : "hover:bg-bg"
                  }`}
                >
                  <span className="font-medium">{suggestion.locality ?? suggestion.city}</span>
                  {suggestion.locality ? <span className="text-xs text-text-muted">{suggestion.city}</span> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-text-muted">No matches, try a nearby city</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
