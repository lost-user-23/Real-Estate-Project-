export function SkeletonGrid({ count, className = "" }) {
  return (
    <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-3">
          <div className="aspect-4/3 w-full rounded-xl bg-border" />
          <div className="mt-3 h-4 w-3/4 rounded bg-border" />
          <div className="mt-2 h-3 w-1/2 rounded bg-border" />
        </div>
      ))}
    </div>
  );
}
