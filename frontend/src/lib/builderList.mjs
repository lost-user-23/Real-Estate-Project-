// The directory asks the API for at most this many builders per page load.
export const BUILDER_LIST_LIMIT = 50;

// Note shown under the builder list when the API has more builders than were
// fetched, so the list is never presented as complete when it is not.
// Returns null when everything is on screen.
export function builderListNote(shown, total) {
  if (!Number.isInteger(shown) || !Number.isInteger(total) || total <= shown) return null;
  return `Showing ${shown} of ${total} builders.`;
}
