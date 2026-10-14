"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAdminStore } from "@/lib/admin-store";
import { useAttempt } from "@/lib/attempt";
import { useToast } from "@/lib/toast-context";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { formatPrice } from "@/lib/format";
import { fetchAdminProperty } from "@/lib/properties";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { Toggle } from "@/components/admin/Toggle";
import { Modal } from "@/components/admin/Modal";

// Only rendered inside a modal, so they are split out of the page's first load.
const AddListingForm = dynamic(
  () => import("@/components/admin/forms/AddListingForm").then((mod) => mod.AddListingForm),
  { loading: () => null }
);
const ReviewListing = dynamic(
  () => import("@/components/admin/ReviewListing").then((mod) => mod.ReviewListing),
  { loading: () => null }
);

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_KEYWORD_LENGTH = 100;

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
    // Rank is a whole number from 0 (the backend sorts 0 first); empty means unranked (null).
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
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
      min={0}
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
  const attempt = useAttempt();
  const confirm = useConfirm();
  const { show } = useToast();

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const reload = useCallback(
    () =>
      loadProperties({
        page,
        limit: PAGE_SIZE,
        ...(search ? { q: search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(sort !== "newest" ? { sort } : {}),
      }),
    [loadProperties, page, search, statusFilter, sort]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // The keyword is sent to the server once typing pauses; a new keyword starts from page 1.
  useEffect(() => {
    const next = query.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Selection belongs to the page being viewed, so drop it when the view changes.
  const viewKey = `${page}:${statusFilter}:${search}`;
  const [selectionKey, setSelectionKey] = useState(viewKey);
  if (selectionKey !== viewKey) {
    setSelectionKey(viewKey);
    setSelectedIds([]);
  }

  const filteredIds = useMemo(() => properties.map((p) => p.id), [properties]);
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
    const ok = await confirm({
      title: "Delete listing?",
      message: `Delete "${property.title}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await attempt(() => deleteProperty(property.id));
    if (res.ok) afterDelete();
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: "Delete selected listings?",
      message: `Delete ${selectedIds.length} selected listing(s)? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
      show(`${result.count} selected listing(s) aren't published. Publish them first; drafts can't be featured.`, { error: true });
      return;
    }
    clearSelection();
  };

  const handleToggleFeatured = async (property) => {
    const res = await attempt(() => toggleFeatured(property.id));
    if (res.ok && !res.value.ok && res.value.reason === "not_published") {
      show("Publish this listing first. Only published listings can be featured on the home page.", { error: true });
    }
    // On a rejected request (e.g. 409 featured limit) the backend message was alerted;
    // resync so the checkbox matches the real server state.
    if (!res.ok) reload();
  };

  // The list rows lack the contact number, so the edit form is filled from a detail fetch.
  const handleEdit = async (property) => {
    const res = await attempt(() => fetchAdminProperty(property.id));
    if (res.ok) setEditing(res.value);
  };

  // Review needs the full photo set and description, which also come from the detail fetch.
  const handleReview = async (property) => {
    const res = await attempt(() => fetchAdminProperty(property.id));
    if (res.ok) setReviewing(res.value);
  };

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
            Verified controls the review badge; Featured controls home page placement and order (up to {maxFeaturedListings} shown; the server enforces the limit).
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
            <option value="published">Published</option>
            <option value="draft">Draft</option>
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
            placeholder="Search title, locality, city"
            aria-label="Search listings"
            maxLength={MAX_KEYWORD_LENGTH}
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
            onClick={() => handleBulkSetVerified(false)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface"
          >
            Unverify
          </button>
          <button
            type="button"
            onClick={() => handleBulkSetFeatured(true)}
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
            {properties.map((property) => (
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
                    <option value="published" disabled={property.status !== "published"}>
                      Published
                    </option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={property.verified ? "text-xs font-medium text-success" : "text-xs text-text-muted"}>
                    {property.verified ? "Verified" : "Not verified"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={property.featured}
                    
                    onChange={() => handleToggleFeatured(property)}
                    label={`Toggle featured for ${property.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <RankInput property={property} onSave={handleRankSave} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleReview(property)}
                      aria-label={`Review ${property.title}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(property)}
                      aria-label={`Edit ${property.title}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(property)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
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
            {!propertiesLoading && !propertiesError && properties.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                  {search ? <>No listings match &ldquo;{search}&rdquo;.</> : "No listings found."}
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

      {reviewing ? (
        <Modal wide title="Review listing" onClose={() => setReviewing(null)}>
          <ReviewListing
            item={reviewing}
            onDone={() => {
              setReviewing(null);
              reload();
            }}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal wide title="Edit listing" onClose={() => setEditing(null)}>
          <AddListingForm
            item={editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}