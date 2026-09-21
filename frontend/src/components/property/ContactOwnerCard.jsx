"use client";

import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { getMockContactNumber } from "@/lib/mockPhone";

// The number never renders in page markup for a logged-out visitor - it
// only appears once `isLoggedIn` flips, mirroring the authenticated-fetch
// behaviour described in PRD §6 even though this build has no real API.
export function ContactOwnerCard({ propertyId }) {
  const { isLoggedIn } = useAuth();
  const { requestLogin } = useLoginPrompt();

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="font-semibold">Contact the owner</p>
      <p className="mt-1 text-sm text-text-muted">
        {isLoggedIn ? "Shown because you're logged in." : "Log in to view the contact number."}
      </p>
      {isLoggedIn ? (
        <p className="mt-3 text-lg font-semibold text-primary">{getMockContactNumber(propertyId)}</p>
      ) : (
        <button
          type="button"
          onClick={() => requestLogin()}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Show contact number
        </button>
      )}
    </div>
  );
}
