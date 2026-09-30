export function Pagination({ meta, label, loading, page, onPageChange }) {
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex items-center justify-between text-xs text-text-muted">
      <span>{meta ? `${meta.total} ${label}, page ${meta.page} of ${totalPages}` : ""}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
          className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading}
          className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
