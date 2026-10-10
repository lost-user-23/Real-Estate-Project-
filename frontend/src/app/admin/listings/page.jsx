"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { Toggle } from "@/components/admin/Toggle";
import { Modal } from "@/components/admin/Modal";
import { AddListingForm } from "@/components/admin/forms/AddListingForm";

const PAGE_SIZE = 20;

// Runs an async store action. On failure it alerts the message and returns { ok: false }.
async function attempt(fn) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    window.alert(e?.message || "Something went wrong. Please try again.");
    return { ok: false };
  }
}

// Keeps typing local and only saves on blur or Enter, so "12" is one request, not two.
function RankInput({ property, onSave }) {
  const saved = property.featuredRank ?? "";
  const [draft, setDraft] = useState(saved);
  const [prevSaved, setPrevSaved] = useState(saved);

  // Resync the local draft when the server value changes underneath us
  // (e.g. another tab's edit lands via reload). Adjusting state while
  // rendering, rather than in an effect, avoids an extra render pass.
  if (saved !== prevSaved) {
    setPrevSaved(saved);
    setDraft(saved);
  }

  const commit = async () => {
    const next = draft === "" ? null : Number(draft);
    // Rank is a positive whole number; empty means unranked (null), never 0.
    if (next !== null && (!Number.isInteger(next) || next < 1)) {
      setDraft(saved);
      return;
    }
    if (next === (property.featuredRank ?? null)) return;
    const ok = await onSave(property, next);
    if (!ok) setDraft(saved);
  };

  return (
    <input
      type="number"
      min={1}
      disabled={!property.featured}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label={`Feature rank for ${property.title}`}
      placeholder="Auto"
      className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40"
    />
  );
}

export default function AdminListingsPage() {
  const {
    properties,
    propertiesMeta,
    propertiesLoading,
    propertiesError,
    loadProperties,
    toggleVerified,
    toggleFeatured,
    setFeaturedRank,
    setPropertyStatus,
    deleteProperty,
    bulkSetVerified,
    bulkSetFeatured,
    bulkSetStatus,
    bulkDeleteProperties,
    maxFeaturedListings,
  } = useAdminStore();

  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const reload = useCallback(
    () =>
      loadProperties({
        page,
        limit: PAGE_SIZE,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(sort !== "newest" ? { sort } : {}),
      }),
    [loadProperties, page, statusFilter, sort]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Selection belongs to the page being viewed, so drop it when the view changes.
  const [selectionKey, setSelectionKey] = useState(`${page}:${statusFilter}`);
  if (selectionKey !== `${page}:${statusFilter}`) {
    setSelectionKey(`${page}:${statusFilter}`);
    setSelectedIds([]);
  }

  const featuredCount = useMemo(() => properties.filter((p) => p.featured && p.status === "published").length, [properties]);

  // Search only covers the page currently loaded.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        (p.locality ?? "").toLowerCase().includes(q)
    );
  }, [properties, query]);

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      allFilteredSelected ? prev.filter((id) => !filteredIds.includes(id)) : [...new Set([...prev, ...filteredIds])]
    );
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  // After a delete the page may be short or empty, so refetch to keep counts and pages right.
  const afterDelete = (deletedCount = 1) => {
    if (properties.length <= deletedCount && page > 1) setPage((p) => p - 1);
    else reload();
  };

  const handleDelete = async (property) => {
    if (!window.confirm(`Delete "${property.title}"? This can't be undone.`)) return;
    const res = await attempt(() => deleteProperty(property.id));
    if (res.ok) afterDelete();
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected listing(s)? This can't be undone.`)) return;
    const res = await attempt(() => bulkDeleteProperties(selectedIds));
    if (!res.ok) return;
    afterDelete(selectedIds.length);
    clearSelection();
  };

  // Refetch after status changes so the list matches the server response.
  const handleBulkSetStatus = async (status) => {
    const res = await attempt(() => bulkSetStatus(selectedIds, status));
    if (!res.ok) {
      reload();
      return;
    }
    clearSelection();
    reload();
  };

  const handleBulkSetVerified = async (verified) => {
    const res = await attempt(() => bulkSetVerified(selectedIds, verified));
    if (res.ok) clearSelection();
  };

  const handleBulkSetFeatured = async (featured) => {
    const res = await attempt(() => bulkSetFeatured(selectedIds, featured));
    if (!res.ok) {
      // The backend message was alerted; resync with the server (the local count may be stale).
      reload();
      return;
    }
    const result = res.value;
    if (!result.ok && result.reason === "not_published") {
      window.alert(`${result.count} selected listing(s) aren't published. Publish them first; drafts can't be featured.`);
      return;
    }
    clearSelection();
  };

  const handleToggleFeatured = async (property) => {
    const res = await attempt(() => toggleFeatured(property.id));
    if (res.ok && !res.value.ok && res.value.reason === "not_published") {
      window.alert("Publish this listing first. Only published listings can be featured on the home page.");
    }
    // On a rejected request (e.g. 409 featured limit) the backend message was alerted;
    // resync so the checkbox matches the real server state.
    if (!res.ok) reload();
  };

  const handleToggleVerified = (property) => attempt(() => toggleVerified(property.id));

  const handleStatusChange = async (property, status) => {
    await attempt(() => setPropertyStatus(property.id, status));
    reload();
  };

  // Empty rank means "unranked", which the backend stores as null (its default).
  const handleRankSave = async (property, rank) => {
    const res = await attempt(() => setFeaturedRank(property.id, rank ?? null));
    return res.ok;
  };

  const totalPages = propertiesMeta?.totalPages ?? 1;

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
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            aria-label="Sort listings"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="newest">Sort: Newest</option>
            <option value="featured">Featured first</option>
            <option value="verified">Verified first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this page"
            aria-label="Search listings on this page"
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

      {propertiesError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load listings: {propertiesError}</span>
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-primary-light px-4 py-3 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <select
            defaultValue=""
            aria-label="Bulk set status"
            onChange={(e) => {
              if (!e.target.value) return;
              handleBulkSetStatus(e.target.value);
              e.target.value = "";
            }}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
          >
            <option value="" disabled>
              Set status…
            </option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            type="button"
            onClick={() => handleBulkSetVerified(true)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => handleBulkSetVerified(false)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface"
          >
            Unverify
          </button>
          <button
            type="button"
            onClick={() => handleBulkSetFeatured(true)}
            disabled={featuredCount >= maxFeaturedListings}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            Feature
          </button>
          <button
            type="button"
            onClick={() => handleBulkSetFeatured(false)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface"
          >
            Unfeature
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            className="rounded-full border border-danger px-3 py-1 text-xs font-medium text-danger hover:bg-danger/10"
          >
            Delete
          </button>
          <button type="button" onClick={clearSelection} className="ml-auto text-xs text-text-muted hover:underline">
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-210 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all listings"
                />
              </th>
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
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(property.id)}
                    onChange={() => toggleSelectRow(property.id)}
                    aria-label={`Select ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{property.title}</p>
                  <p className="text-xs text-text-muted">
                    {[property.locality, property.city].filter(Boolean).join(", ")}
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
                    onChange={(e) => handleStatusChange(property, e.target.value)}
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
                    onChange={() => handleToggleVerified(property)}
                    label={`Toggle verified for ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={property.featured}
                    disabled={!property.featured && featuredCount >= maxFeaturedListings}
                    onChange={() => handleToggleFeatured(property)}
                    label={`Toggle featured for ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <RankInput property={property} onSave={handleRankSave} />
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
            {propertiesLoading && properties.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                  Loading listings…
                </td>
              </tr>
            ) : null}
            {!propertiesLoading && !propertiesError && filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                  {query.trim() ? <>No listings on this page match &ldquo;{query}&rdquo;.</> : "No listings found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          {propertiesMeta ? `${propertiesMeta.total} listings, page ${propertiesMeta.page} of ${totalPages}` : ""}
          {propertiesLoading && properties.length > 0 ? " (refreshing…)" : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || propertiesLoading}
            className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || propertiesLoading}
            className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Unranked featured listings fall back to most-recently-published order, appended after the ranked ones.
      </p>

      {showAdd ? (
        <Modal wide title="Add listing" onClose={() => setShowAdd(false)}>
          <AddListingForm
            onDone={() => {
              setShowAdd(false);
              if (page === 1) reload();
              else setPage(1);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}