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
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:gap-3"
    >
      <LocationInput
        value={value.location}
        onSelect={(location) => onChange({ ...value, location })}
        onTextChange={setTypedText}
      />

      <div className="flex-1">
        <label htmlFor="hero-property-type" className="mb-1.5 block text-xs font-medium text-text-muted">
          Property type
        </label>
        <select
          id="hero-property-type"
          value={value.propertyType}
          onChange={(e) => onChange({ ...value, propertyType: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
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
        <label htmlFor="hero-bhk" className="mb-1.5 block text-xs font-medium text-text-muted">
          BHK
        </label>
        <select
          id="hero-bhk"
          value={value.bhk ?? ""}
          onChange={(e) => onChange({ ...value, bhk: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
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
        <label htmlFor="hero-budget" className="mb-1.5 block text-xs font-medium text-text-muted">
          Budget
        </label>
        <select
          id="hero-budget"
          value={value.budgetPresetId ?? ""}
          onChange={(e) => onChange({ ...value, budgetPresetId: e.target.value || null })}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
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
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
      >
        <SearchIcon className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
