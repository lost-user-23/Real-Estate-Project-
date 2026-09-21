const STYLES = {
  published: "bg-success/10 text-success",
  draft: "bg-text-muted/10 text-text-muted",
  archived: "bg-danger/10 text-danger",
};

const LABELS = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
