"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";

export const MAX_KEYWORD_LENGTH = 100;
export const BHK_OPTIONS = ["1", "2", "3", "4+"];

// Keeps only values the API accepts, so a hand-edited URL never causes a 400.
export function parseBhkParam(raw) {
  if (!raw) return [];
  return BHK_OPTIONS.filter((option) => raw.split(",").includes(option));
}

export function normalizeKeyword(raw) {
  return (raw ?? "").trim().slice(0, MAX_KEYWORD_LENGTH);
}

// Draft state lives here; the URL (owned by SearchResults) only changes on
// submit. The parent remounts this form when the URL changes, so back/forward
// and refresh always show the applied values.
export function SearchFilters({ initialKeyword, initialBhk, onApply }) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [bhk, setBhk] = useState(initialBhk);
  const isValid = keyword.trim().length <= MAX_KEYWORD_LENGTH;

  const toggleBhk = (option) =>
    setBhk((current) => (current.includes(option) ? current.filter((o) => o !== option) : [...current, option]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isValid) onApply({ keyword: normalizeKeyword(keyword), bhk: BHK_OPTIONS.filter((o) => bhk.includes(o)) });
      }}
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label htmlFor="search-keyword" className="mb-1.5 block text-xs font-medium text-text-muted">
          Keyword
        </label>
        <input
          id="search-keyword"
          type="search"
          value={keyword}
          maxLength={MAX_KEYWORD_LENGTH}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Title, locality or city"
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-xs font-medium text-text-muted">BHK</legend>
        <div className="flex gap-2">
          {BHK_OPTIONS.map((option) => {
            const selected = bhk.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleBhk(option)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-text-muted hover:text-text"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!isValid}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
      >
        <SearchIcon className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
