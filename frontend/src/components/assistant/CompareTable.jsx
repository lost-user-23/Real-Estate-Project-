"use client";

import Link from "next/link";
import { formatArea, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";

const ROWS = [
  ["Price", (p) => `${formatPrice(p.priceInRupees)}${p.intent === "rent" ? "/month" : ""}`],
  ["Type", (p) => PROPERTY_TYPE_LABELS[p.propertyType] ?? p.propertyType],
  ["Location", (p) => [p.locality, p.city].filter(Boolean).join(", ") || "Not listed"],
  ["Area", (p) => formatArea(p.areaSqft)],
  ["Bedrooms", (p) => (p.bhk != null ? `${p.bhk} BHK` : "Not listed")],
  ["Furnishing", (p) => p.furnished ?? "Not listed"],
  ["Built", (p) => p.yearOfConstruction ?? "Not listed"],
  ["Amenities", (p) => (p.amenities?.length ? p.amenities.join(", ") : "Not listed")],
  ["Verified", (p) => (p.verified ? "Yes" : "No")],
];

// Side-by-side view of up to three recommended properties, from stored data only.
export function CompareTable({ properties, onClose }) {
  return (
    <section aria-label="Property comparison" className="rounded-2xl border border-primary/30 bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">Comparing {properties.length} properties</h3>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-primary hover:underline">
          Close comparison
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th scope="col" className="w-20 py-1.5 pr-2 font-medium text-text-muted">&nbsp;</th>
              {properties.map((p) => (
                <th key={p.id} scope="col" className="px-2 py-1.5 align-top font-semibold">
                  <Link href={`/property/${p.slug}`} className="text-primary hover:underline">
                    {p.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, read]) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className="py-1.5 pr-2 font-medium text-text-muted">{label}</th>
                {properties.map((p) => (
                  <td key={p.id} className="px-2 py-1.5">{read(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
