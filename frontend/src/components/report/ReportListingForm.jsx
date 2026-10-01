"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

const REASONS = [
  "Listing looks outdated or unavailable",
  "Details don't match the photos",
  "Suspected duplicate listing",
  "Incorrect price or location",
  "Something else",
];

const INITIAL = { listingUrl: "", reason: REASONS[0], details: "" };
const OBJECT_ID = /^[a-f0-9]{24}$/i;

// Keyed on the query string so navigating from a pre-filled /report link to
// plain /report (same page, form stays mounted) starts from a fresh form.
export function ReportListingForm() {
  const searchParams = useSearchParams();
  return <ReportForm key={searchParams.toString()} searchParams={searchParams} />;
}

function ReportForm({ searchParams }) {
  // What the "Report this listing" link pre-filled. The id is only trusted
  // while the field still holds this exact text.
  const [linked, setLinked] = useState(() => ({
    listing: searchParams.get("listing") ?? "",
    propertyId: searchParams.get("propertyId") ?? "",
  }));
  const [form, setForm] = useState(() => ({ ...INITIAL, listingUrl: linked.listing }));
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const listingUrlOrId = form.listingUrl.trim();
      const keepPropertyId = OBJECT_ID.test(linked.propertyId) && listingUrlOrId === linked.listing.trim();
      await api.post("/api/v1/reports", {
        listingUrlOrId,
        reason: form.reason,
        details: form.details.trim(),
        ...(keepPropertyId ? { propertyId: linked.propertyId } : {}),
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Your report could not be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-semibold">Report sent.</p>
        <p className="mt-1 text-sm text-text-muted">
          Thanks. Our review team will re-check this listing.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(INITIAL);
            setLinked({ listing: "", propertyId: "" });
            setSubmitted(false);
          }}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
        >
          Report another listing
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Listing URL or ID</span>
        <input
          type="text"
          required
          maxLength={500}
          placeholder="/property/2-bhk-apartment-for-rent-koramangala-bengaluru-x7k2"
          value={form.listingUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, listingUrl: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Reason</span>
        <select
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          {REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Details</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={form.details}
          onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Submit report"}
      </button>
    </form>
  );
}
