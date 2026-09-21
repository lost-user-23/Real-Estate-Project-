"use client";

import { useState } from "react";

const REASONS = [
  "Listing looks outdated or unavailable",
  "Details don't match the photos",
  "Suspected duplicate listing",
  "Incorrect price or location",
  "Something else",
];

const INITIAL = { listingUrl: "", reason: REASONS[0], details: "" };

export function ReportListingForm() {
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-semibold">Report captured.</p>
        <p className="mt-1 text-sm text-text-muted">
          There&apos;s no backend connected yet, so this wasn&apos;t actually sent to our review team — in the
          live product it would be queued for a listing re-check.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(INITIAL);
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
          value={form.details}
          onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Submit report
      </button>
    </form>
  );
}
