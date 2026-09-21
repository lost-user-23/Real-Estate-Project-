"use client";

import { useMemo, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { Toggle } from "@/components/admin/Toggle";
import { Modal } from "@/components/admin/Modal";
import { AddListingForm } from "@/components/admin/forms/AddListingForm";

export default function AdminListingsPage() {
  const { properties, toggleVerified, toggleFeatured, setFeaturedRank, setPropertyStatus, deleteProperty } =
    useAdminStore();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) => p.title.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.locality.toLowerCase().includes(q)
    );
  }, [properties, query]);

  const handleDelete = (property) => {
    if (window.confirm(`Delete "${property.title}"? This can't be undone.`)) {
      deleteProperty(property.id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-text-muted">
            Verified controls the review badge; Featured controls home page placement and order (up to 8 shown).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or location"
            aria-label="Search listings"
            className="w-full max-w-xs rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Add listing
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-210 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Featured</th>
              <th className="px-4 py-3 font-medium">Feature rank</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((property) => (
              <tr key={property.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{property.title}</p>
                  <p className="text-xs text-text-muted">
                    {property.locality}, {property.city}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-muted">{PROPERTY_TYPE_LABELS[property.propertyType]}</td>
                <td className="px-4 py-3">
                  {formatPrice(property.priceInRupees)}
                  {property.intent === "rent" ? "/mo" : ""}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={property.status}
                    onChange={(e) => setPropertyStatus(property.id, e.target.value)}
                    aria-label={`Status for ${property.title}`}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={property.verified}
                    onChange={() => toggleVerified(property.id)}
                    label={`Toggle verified for ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={property.featured}
                    onChange={() => toggleFeatured(property.id)}
                    label={`Toggle featured for ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    disabled={!property.featured}
                    value={property.featuredRank ?? ""}
                    onChange={(e) =>
                      setFeaturedRank(property.id, e.target.value === "" ? null : Number(e.target.value))
                    }
                    aria-label={`Feature rank for ${property.title}`}
                    placeholder="Auto"
                    className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(property)}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No listings match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        Unranked featured listings fall back to most-recently-published order, appended after the ranked ones.
      </p>

      {showAdd ? (
        <Modal title="Add listing" onClose={() => setShowAdd(false)}>
          <AddListingForm onDone={() => setShowAdd(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
