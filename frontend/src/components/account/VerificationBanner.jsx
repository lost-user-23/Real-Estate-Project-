"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// Slim notice for signed-in users whose email is not verified yet. The server
// blocks posting, saving and contact reveal for them; this explains why.
export function VerificationBanner() {
  const { isLoggedIn, user } = useAuth();
  const [state, setState] = useState({ status: "idle", message: "" });

  if (!isLoggedIn || !user || user.emailVerified !== false) return null;

  const resend = async () => {
    setState({ status: "sending", message: "" });
    try {
      await api.post("/api/auth/resend-verification", { email: user.email }, { auth: false });
      setState({ status: "sent", message: "Link sent. Check your inbox." });
    } catch (error) {
      setState({ status: "error", message: error?.message || "Could not resend the link." });
    }
  };

  return (
    <div className="border-b border-border bg-bg px-4 py-2 text-center text-sm">
      <span className="text-text-muted">
        Verify your email to post properties, save listings and contact owners. We sent a link to{" "}
        <span className="font-medium text-text">{user.email}</span>.
      </span>{" "}
      <button
        type="button"
        onClick={resend}
        disabled={state.status === "sending"}
        className="font-medium text-primary underline disabled:opacity-60"
      >
        {state.status === "sending" ? "Sending…" : "Resend link"}
      </button>
      {state.status === "sent" ? <span role="status" className="ml-2 text-success">{state.message}</span> : null}
      {state.status === "error" ? <span role="alert" className="ml-2 text-danger">{state.message}</span> : null}
    </div>
  );
}
