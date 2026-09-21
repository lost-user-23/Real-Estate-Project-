"use client";

import { useSavedProperties } from "@/lib/saved-properties-context";
import { HeartFilledIcon, HeartIcon } from "@/components/icons";

export function SaveButton({ propertyId }) {
  const { isSaved, toggleSave } = useSavedProperties();
  const saved = isSaved(propertyId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleSave(propertyId)}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
    >
      {saved ? <HeartFilledIcon className="h-4 w-4 text-danger" /> : <HeartIcon className="h-4 w-4" />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
