"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // show(message) for plain notices; show(message, { error: true }) stays longer and is styled as an error.
  const show = useCallback((message, { error = false } = {}) => {
    window.clearTimeout(timerRef.current);
    setToast({ message, error });
    timerRef.current = window.setTimeout(() => setToast(null), error ? 6000 : 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-70 flex justify-center px-4">
        {toast ? (
          <div
            role={toast.error ? "alert" : undefined}
            className={`pointer-events-auto max-w-lg rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg ${
              toast.error ? "bg-danger" : "bg-text"
            }`}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
