"use client";

import { useState } from "react";
import { AMENITY_PRIORITY } from "@/lib/amenities";

const MAX_CUSTOM_LENGTH = 50;

// `value` is the selected amenity array; custom entries are kept in it
// alongside the predefined ones and shown as extra chips.
export function AmenityPicker({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const customAmenities = value.filter((a) => !AMENITY_PRIORITY.includes(a));
  const options = [...AMENITY_PRIORITY, ...customAmenities];

  const toggle = (amenity) =>
    onChange(value.includes(amenity) ? value.filter((a) => a !== amenity) : [...value, amenity]);

  const addCustom = () => {
    const text = draft.trim().slice(0, MAX_CUSTOM_LENGTH);
    if (!text) return;
    const existing = [...AMENITY_PRIORITY, ...value].find((a) => a.toLowerCase() === text.toLowerCase());
    if (!existing) onChange([...value, text]);
    else if (!value.includes(existing)) onChange([...value, existing]);
    setDraft("");
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Amenities</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((amenity) => {
          const checked = value.includes(amenity);
          return (
            <button
              key={amenity}
              type="button"
              aria-pressed={checked}
              onClick={() => toggle(amenity)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                checked ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted"
              }`}
            >
              {amenity}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          maxLength={MAX_CUSTOM_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add your own amenity"
          aria-label="Add custom amenity"
          className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim()}
          className="rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
