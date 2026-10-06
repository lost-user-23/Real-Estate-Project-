"use client";

import { useState } from "react";
import { api } from "@/lib/api";

// Shown after sign-up and after an email change. The server answers the same
// way whether or not the address could be used, so the copy stays neutral.
// Resending goes through the shared API client; the server rate-limits it and
// its error message (e.g. "Too many requests") is shown as-is.
export function CheckInbox({ email, title = "Check your inbox", children }) {
  const [state, setState] = useState({ status: "idle", message: "" });

  const resend = async () => {
    setState({ status: "sending", message: "" });
    try {
      const { message } = await api.post("/api/auth/resend-verification", { email }, { auth: false });
      setState({ status: "sent", message: message || "If the address is waiting for verification, a new link is on its way." });
    } catch (error) {
      setState({ status: "error", message: error?.message || "Could not resend the link." });
    }
  };

  return (
    <div role="status" className="flex flex-col gap-3 text-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-text-muted">
        If <span className="font-medium text-text">{email}</span> can be used, we&apos;ve sent it a verification link. It
        expires in 24 hours.
      </p>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={state.status === "sending"}
          className="rounded-full border border-border px-4 py-1.5 font-medium text-text hover:bg-bg disabled:opacity-60"
        >
          {state.status === "sending" ? "Sending…" : "Resend link"}
        </button>
        {state.status === "sent" ? <span className="text-success">{state.message}</span> : null}
        {state.status === "error" ? (
          <span role="alert" className="text-danger">
            {state.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
