"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ConfirmContext = createContext(null);

// useConfirm() returns confirm({ title, message, confirmLabel, destructive }) -> Promise<boolean>.
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    // Hand focus back to whatever opened the dialog (if it is still on the page).
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && trigger.isConnected) trigger.focus();
    if (resolve) resolve(result);
  }, []);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        // A second request while one is open cancels the first.
        if (resolverRef.current) resolverRef.current(false);
        else triggerRef.current = document.activeElement;
        resolverRef.current = resolve;
        setDialog({
          title: options.title ?? "Are you sure?",
          message: options.message ?? "",
          confirmLabel: options.confirmLabel ?? "Confirm",
          destructive: Boolean(options.destructive),
        });
      }),
    []
  );

  // Destructive actions start on Cancel so a stray Enter can't delete anything.
  useEffect(() => {
    if (!dialog) return;
    (dialog.destructive ? cancelRef : confirmRef).current?.focus();
  }, [dialog]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      settle(false);
      return;
    }
    if (event.key !== "Tab") return;
    // Keep Tab inside the dialog: it only has the two buttons.
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) settle(false);
          }}
          onKeyDown={handleKeyDown}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
          >
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">
              {dialog.title}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm text-text-muted">
              {dialog.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => settle(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-bg"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => settle(true)}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                  dialog.destructive ? "bg-danger" : "bg-primary"
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
