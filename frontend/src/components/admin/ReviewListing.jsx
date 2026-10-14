"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { formatArea, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { StatusPill } from "@/components/admin/StatusPill";

// What the admin sees before approving: every photo, the full description and the key fields.
// Approve publishes and verifies; Reject sends the listing back to draft and removes the badge.
export function ReviewListing({ item, onDone }) {
  const { updateProperty } = useAdminStore();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const decide = async (updates) => {
    setError("");
    setSubmitting(true);
    try {
      await updateProperty(item.id, updates);
      onDone();
    } catch (e) {
      // The message carries the backend's reasons when the listing lacks photos or a description.
      setError(e?.message || "Could not save the decision. Please try again.");
      setSubmitting(false);
    }
  };

  const images = item.images ?? [];
  const facts = [
    ["Type", PROPERTY_TYPE_LABELS[item.propertyType]],
    ["For", item.intent === "rent" ? "Rent" : "Sale"],
    ["Price", `${formatPrice(item.priceInRupees)}${item.intent === "rent" ? "/mo" : ""}`],
    ["Area", formatArea(item.areaSqft)],
    ["BHK", item.bhk ?? "—"],
    ["Location", [item.locality, item.city].filter(Boolean).join(", ")],
    ["Contact", item.contactNumber ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-5">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{item.title}</h3>
          <StatusPill status={item.status} />
          {item.verified ? <span className="text-xs font-medium text-success">Verified</span> : null}
        </div>
      </div>

      <section aria-label="Photos">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Photos ({images.length})</p>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((image) => (
              <a key={image.id ?? image.url} href={image.url} target="_blank" rel="noreferrer">
                <img src={image.url} alt={image.alt || item.title} className="h-32 w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-danger">No photos.</p>
        )}
      </section>

      <section aria-label="Description">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Description</p>
        {item.description?.trim() ? (
          <p className="whitespace-pre-wrap text-sm">{item.description}</p>
        ) : (
          <p className="text-sm text-danger">No description.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => decide({ status: "published", verified: true })}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => decide({ status: "draft", verified: false })}
          className="rounded-full border border-danger px-5 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
