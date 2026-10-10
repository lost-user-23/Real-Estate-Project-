"use client";

import { useCallback, useState } from "react";

// Tracks one async form submission: idle -> saving -> success | error.
// `run` never rejects; the message is surfaced through `status`/`message`.
export function useFormAction() {
  const [state, setState] = useState({ status: "idle", message: "" });

  const run = useCallback(async (action, successMessage) => {
    setState({ status: "saving", message: "" });
    try {
      const result = await action();
      setState({ status: "success", message: successMessage });
      return { ok: true, result };
    } catch (error) {
      setState({ status: "error", message: error?.message || "Something went wrong" });
      return { ok: false, error };
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle", message: "" }), []);

  return { ...state, saving: state.status === "saving", run, reset };
}
