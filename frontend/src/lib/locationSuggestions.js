import { MOCK_LOCALITIES } from "@/lib/mockData";

const MAX_SUGGESTIONS = 6;

// Grouped City-then-Locality, capped at 6 (PRD §5 autocomplete contract).
export function getLocationSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const matches = MOCK_LOCALITIES.filter(
    (entry) =>
      entry.city.toLowerCase().includes(normalized) ||
      (entry.locality?.toLowerCase().includes(normalized) ?? false)
  );

  const cityMatches = matches.filter((m) => m.locality === null);
  const localityMatches = matches.filter((m) => m.locality !== null);

  return [...cityMatches, ...localityMatches].slice(0, MAX_SUGGESTIONS);
}
