"use client";

import { CloseIcon } from "@/components/icons";

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-6 sm:items-center"
    >
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl bg-surface p-6 shadow-xl`}>
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-text-muted hover:bg-bg"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
