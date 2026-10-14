"use client";

import { useState } from "react";
import { getLocationSuggestions } from "@/lib/locationSuggestions";
import { getBudgetPresets } from "@/lib/budgetPresets";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { BHK_OPTIONS, normalizeKeyword } from "@/components/search/SearchFilters";
import { LocationInput } from "@/components/home/LocationInput";
import { SearchIcon } from "@/components/icons";

export function SearchBar({ intent, value, onChange, onSubmit }) {
  const propertyTypeOptions = PROPERTY_TYPE_OPTIONS_BY_INTENT[intent];
  const budgetPresets = getBudgetPresets(intent);
  const [typedText, setTypedText] = useState("");
  const [resolving, setResolving] = useState(false);

  // The user may type a place and press Search without picking a suggestion.
  // Resolve the text to the best matching suggestion, else submit it as a keyword.
  const resolveAndSubmit = async () => {
    if (value.location) {
      onSubmit(value);
      return;
    }
    const text = typedText.trim();
    if (!text) {
      onSubmit(value);
      return;
    }
    setResolving(true);
    let location = null;
    try {
      const suggestions = await getLocationSuggestions(text);
      if (suggestions?.length > 0) {
        location = { city: suggestions[0].city, locality: suggestions[0].locality ?? null };
      }
    } catch {
      // no suggestions available: fall through to a keyword search
    }
    setResolving(false);
    if (location) {
      const next = { ...value, location };
      onChange(next);
      onSubmit(next);
      return;
    }
    // Keyword-only: kept out of the shared value so it doesn't linger in the form.
    onSubmit({ ...value, keyword: normalizeKeyword(text) });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!resolving) resolveAndSubmit();
      }}
      className="flex flex-col gap-3 rounded-3xl bg-white/95 p-4 shadow-2xl shadow-black/30 ring-1 ring-white/60 backdrop-blur sm:flex-row sm:items-end sm:gap-3 sm:p-5"
    >
      <LocationInput
        value={value.location}
        onSelect={(location) => onChange({ ...value, location })}
        onTextChange={setTypedText}
      />

      <div className="flex-1">
        <label htmlFor="hero-property-type" className="mb-1.5 block text-xs font-semibold tracking-wide text-text-muted uppercase">
          Property type
        </label>
        <select
          id="hero-property-type"
          value={value.propertyType}
          onChange={(e) => onChange({ ...value, propertyType: e.target.value })}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm font-medium outline-none transition-colors hover:border-primary/50 focus:border-primary focus:bg-surface"
        >
          <option value="all">All types</option>
          {propertyTypeOptions.map((type) => (
            <option key={type} value={type}>
              {PROPERTY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="hero-bhk" className="mb-1.5 block text-xs font-semibold tracking-wide text-text-muted uppercase">
          BHK
        </label>
        <select
          id="hero-bhk"
          value={value.bhk ?? ""}
          onChange={(e) => onChange({ ...value, bhk: e.target.value })}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm font-medium outline-none transition-colors hover:border-primary/50 focus:border-primary focus:bg-surface"
        >
          <option value="">Any BHK</option>
          {BHK_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} BHK
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="hero-budget" className="mb-1.5 block text-xs font-semibold tracking-wide text-text-muted uppercase">
          Budget
        </label>
        <select
          id="hero-budget"
          value={value.budgetPresetId ?? ""}
          onChange={(e) => onChange({ ...value, budgetPresetId: e.target.value || null })}
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm font-medium outline-none transition-colors hover:border-primary/50 focus:border-primary focus:bg-surface"
        >
          <option value="">Any budget</option>
          {budgetPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={resolving}
        className="flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-primary to-primary-dark px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 disabled:cursor-not-allowed disabled:bg-border disabled:from-border disabled:to-border disabled:text-text-muted disabled:shadow-none"
      >
        <SearchIcon className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
