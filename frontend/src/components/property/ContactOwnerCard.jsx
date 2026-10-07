"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";

const IDLE = { status: "idle" };

function contactErrorMessage(error) {
  if (error?.status === 429) {
    return "You have viewed too many contact numbers recently. Please try again in an hour.";
  }
  if (error?.status === 404) return "This listing is no longer available.";
  if (error?.status === 401) return "Your session has expired. Please log in again.";
  return error?.message || "Contact details could not be loaded. Please try again.";
}

// Contact numbers are only served to logged-in users (GET
// /api/v1/properties/:id/contact). The fetched number is remembered together
// with the user it was fetched for, so it disappears on logout or when a
// different account logs in.
export function ContactOwnerCard({ propertyId }) {
  const { isLoggedIn, user, sessionVersion } = useAuth();
  const userId = user?.id;
  const { requestLogin } = useLoginPrompt();
  const [state, setState] = useState(IDLE);

  const revealed =
    state.status === "revealed" &&
    state.userId === userId &&
    state.sessionVersion === sessionVersion
      ? state
      : null;
  const isLoading = state.status === "loading";

  const fetchContact = async (
    authenticatedUserId = userId,
    authenticatedSessionVersion = sessionVersion
  ) => {
    setState({ status: "loading" });
    try {
      const { contactNumber } = await api.get(`/api/v1/properties/${encodeURIComponent(propertyId)}/contact`);
      setState({
        status: "revealed",
        userId: authenticatedUserId,
        sessionVersion: authenticatedSessionVersion,
        contactNumber,
      });
    } catch (error) {
      setState({ status: "error", message: contactErrorMessage(error) });
    }
  };

  let body;
  if (revealed) {
    body = revealed.contactNumber ? (
      <a
        href={`tel:${revealed.contactNumber.replace(/[^\d+]/g, "")}`}
        className="mt-3 block text-lg font-semibold text-primary hover:underline"
      >
        {revealed.contactNumber}
      </a>
    ) : (
      <p className="mt-3 text-sm text-text-muted">The owner has not shared a contact number for this listing.</p>
    );
  } else if (!isLoggedIn) {
    body = (
      <button
        type="button"
        onClick={() =>
          requestLogin(({ user: loggedInUser, sessionVersion: loggedInSessionVersion }) =>
            fetchContact(loggedInUser.id, loggedInSessionVersion)
          )
        }
        className="mt-4 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
      >
        Log in to view contact details
      </button>
    );
  } else {
    body = (
      <button
        type="button"
        onClick={() => fetchContact()}
        disabled={isLoading}
        className="mt-4 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {isLoading ? "Loading..." : "Show contact number"}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="font-semibold">Contact the owner</p>
      <p className="mt-1 text-sm text-text-muted">
        {isLoggedIn ? "Contact details are shared with logged-in members only." : "Log in to see the owner's contact number."}
      </p>
      {body}
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
