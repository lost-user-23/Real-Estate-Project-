import { apiRequest } from "@/lib/api-client";

const MAX_SUGGESTIONS = 6;

// Grouped City-then-Locality, capped at 6 (PRD §5 autocomplete contract).
export async function getLocationSuggestions(query, { signal } = {}) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({ q: trimmed });
  const { locations } = await apiRequest(`/api/v1/locations/suggestions?${params.toString()}`, { signal });

  const cityMatches = locations.filter((l) => l.locality === null);
  const localityMatches = locations.filter((l) => l.locality !== null);

  return [...cityMatches, ...localityMatches].slice(0, MAX_SUGGESTIONS);
}
