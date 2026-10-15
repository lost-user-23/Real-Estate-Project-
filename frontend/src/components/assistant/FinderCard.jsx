"use client";

import Link from "next/link";
import { formatArea, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { emiHref, loanHref } from "@/lib/assistantLinks.mjs";
import { SafeImage } from "@/components/ui/SafeImage";
import { CheckBadgeIcon, MapPinIcon } from "@/components/icons";

const actionClass =
  "rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:border-primary hover:text-primary";

// A real listing returned by the property-finder API. Every figure shown is
// the stored value; the "why" lines come from the server's match result.
export function FinderCard({ property, selected, canSelect, onToggleCompare, onEnquire }) {
  const { match } = property;
  const exact = match?.tier === "exact";
  const typeLabel = PROPERTY_TYPE_LABELS[property.propertyType] ?? property.propertyType;
  const title = property.bhk ? `${property.bhk} BHK ${typeLabel}` : typeLabel;
  const emi = emiHref(property);
  const loans = loanHref(property);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-bg">
          <SafeImage src={property.image.src} alt={property.image.alt} fill sizes="112px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold text-text">
              {formatPrice(property.priceInRupees)}
              {property.intent === "rent" ? <span className="text-xs font-medium text-text-muted">/month</span> : null}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                exact ? "bg-primary-light text-primary-dark" : "bg-accent/25 text-accent-ink"
              }`}
            >
              {exact ? "Exact match" : "Close match"}
            </span>
            {property.verified ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary">
                <CheckBadgeIcon className="h-3.5 w-3.5" aria-hidden />
                Verified
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-text">
            {title} &middot; {formatArea(property.areaSqft)}
          </p>
          <p className="flex items-center gap-1 text-xs text-text-muted">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{[property.locality, property.city].filter(Boolean).join(", ")}</span>
          </p>
        </div>
      </div>

      {match?.reasons?.length ? (
        <ul className="space-y-0.5 px-3 text-xs text-text-muted">
          {match.reasons.map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <span aria-hidden className="text-primary">&#10003;</span>
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
      {match?.gaps?.length ? (
        <ul className="mt-1 space-y-0.5 px-3 text-xs text-accent-dark">
          {match.gaps.map((gap) => (
            <li key={gap} className="flex gap-1.5">
              <span aria-hidden>&#8800;</span>
              {gap}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border p-3">
        <Link href={`/property/${property.slug}`} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary">
          View details
        </Link>
        {emi ? <Link href={emi} className={actionClass}>Estimate EMI</Link> : null}
        {loans ? <Link href={loans} className={actionClass}>Loan options</Link> : null}
        <button type="button" onClick={() => onEnquire(property)} className={actionClass}>
          Request callback
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text-muted">
          <input
            type="checkbox"
            checked={selected}
            disabled={!selected && !canSelect}
            onChange={() => onToggleCompare(property)}
            className="h-4 w-4 accent-primary"
          />
          Compare
        </label>
      </div>
    </article>
  );
}
