import { AlertIcon } from "@/components/icons";

export function SectionError({ onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-10 text-center">
      <AlertIcon className="h-8 w-8 text-danger" />
      <p className="text-sm text-text-muted">Something went wrong loading this section.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
      >
        Retry
      </button>
    </div>
  );
}
