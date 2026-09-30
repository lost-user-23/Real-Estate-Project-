export function AdminField({ label, required = false, children }) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

export const adminFieldInputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";
