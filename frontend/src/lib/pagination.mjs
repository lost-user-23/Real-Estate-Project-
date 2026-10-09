// When the URL asks for a page past the end (an old link, or a filter that
// shrank the result set), return the last page to show instead. Returns null
// when no redirect is needed, including when there are no results at all.
export function lastPageRedirect(page, meta) {
  const totalPages = Number(meta?.totalPages);
  const total = Number(meta?.total);
  if (!Number.isInteger(totalPages) || totalPages < 1 || !(total > 0)) return null;
  return page > totalPages ? totalPages : null;
}
