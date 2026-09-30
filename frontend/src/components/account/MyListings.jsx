"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatArea, formatPrice } from "@/lib/format";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";
import { Modal } from "@/components/admin/Modal";
import { StatusPill } from "@/components/admin/StatusPill";
import { Section } from "@/components/account/AccountSections";
import { useFormAction } from "@/components/account/useFormAction";

const PAGE_SIZE = 20;

// The API serializes Mongo documents with _id; normalise once so the rest of the
// component (keys, PATCH/DELETE urls) only deals with id.
const withId = (p) => ({ ...p, id: p.id ?? p._id });

function EditListingModal({ listing, onClose, onSaved }) {
  const [title, setTitle] = useState(listing.title ?? "");
  const [description, setDescription] = useState(listing.description ?? "");
  const [priceInRupees, setPriceInRupees] = useState(String(listing.priceInRupees ?? ""));
  const [areaSqft, setAreaSqft] = useState(String(listing.areaSqft ?? ""));
  const [locality, setLocality] = useState(listing.locality ?? "");
  const action = useFormAction();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { ok, result } = await action.run(
      () =>
        api.patch(`/api/v1/properties/${listing.id}`, {
          title,
          description,
          priceInRupees: Number(priceInRupees),
          areaSqft: Number(areaSqft),
          locality: locality.trim() || null,
        }),
      "Listing updated."
    );
    if (ok) onSaved(withId(result.property));
  };

  return (
    <Modal title="Edit listing" onClose={action.saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AdminField label="Title" required>
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={adminFieldInputClass} />
        </AdminField>
        <AdminField label="Description">
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={adminFieldInputClass} />
        </AdminField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Price (₹)" required>
            <input required type="number" min={0} value={priceInRupees} onChange={(e) => setPriceInRupees(e.target.value)} className={adminFieldInputClass} />
          </AdminField>
          <AdminField label="Area (sq ft)" required>
            <input required type="number" min={0} value={areaSqft} onChange={(e) => setAreaSqft(e.target.value)} className={adminFieldInputClass} />
          </AdminField>
        </div>
        <AdminField label="Locality">
          <input value={locality} onChange={(e) => setLocality(e.target.value)} className={adminFieldInputClass} />
        </AdminField>
        {action.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {action.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={action.saving} className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg">
            Cancel
          </button>
          <button type="submit" disabled={action.saving} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
            {action.saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteListingModal({ listing, onClose, onDeleted }) {
  const action = useFormAction();

  const handleDelete = async () => {
    const { ok } = await action.run(() => api.delete(`/api/v1/properties/${listing.id}`), "Deleted.");
    if (ok) onDeleted(listing.id);
  };

  return (
    <Modal title="Delete listing?" onClose={action.saving ? () => {} : onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          &ldquo;{listing.title}&rdquo; and its images will be permanently removed.
        </p>
        {action.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {action.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={action.saving} className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg">
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={action.saving} className="rounded-full bg-danger px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
            {action.saving ? "Deleting…" : "Delete listing"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function MyListings() {
  const [listings, setListings] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/v1/properties/mine?page=${page}&limit=${PAGE_SIZE}`);
      setListings((current) => (append ? [...current, ...data.properties.map(withId)] : data.properties.map(withId)));
      setMeta(data.meta);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so the loading state update isn't synchronous in the effect body.
    Promise.resolve().then(() => load(1));
  }, [load]);

  const hasMore = meta && meta.page < meta.totalPages;

  return (
    <Section title="My listings" description="Properties you have posted. New listings are reviewed before going live.">
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          <span>Could not load your listings: {error}</span>
          <button type="button" onClick={() => load(1)} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      {loading && listings.length === 0 && !error ? (
        <p className="text-sm text-text-muted">Loading your listings…</p>
      ) : null}

      {!loading && !error && listings.length === 0 ? (
        <p className="text-sm text-text-muted">
          You have not posted any listings yet.{" "}
          <Link href="/post-property" className="font-medium text-primary hover:underline">
            Post a property
          </Link>
        </p>
      ) : null}

      {listings.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{listing.title}</p>
                  <StatusPill status={listing.status} />
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  {formatPrice(listing.priceInRupees)} · {formatArea(listing.areaSqft)}
                  {listing.locality ? ` · ${listing.locality}` : ""}
                  {listing.city ? `, ${listing.city}` : ""}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Contact number: {listing.contactNumber || "not provided"}
                </p>
                {listing.status === "published" ? (
                  <Link href={`/property/${listing.slug}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                    View listing
                  </Link>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setEditing(listing)} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-bg">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleting(listing)} className="rounded-full border border-danger px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(meta.page + 1, true)}
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-bg disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {editing ? (
        <EditListingModal
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            // PATCH responses never carry contactNumber (only /mine does) and this
            // modal does not edit it, so keep the value already shown.
            setListings((current) =>
              current.map((l) => (l.id === updated.id ? { ...updated, contactNumber: l.contactNumber } : l))
            );
            setEditing(null);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteListingModal
          listing={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setListings((current) => current.filter((l) => l.id !== id));
            setMeta((current) => (current ? { ...current, total: current.total - 1 } : current));
            setDeleting(null);
          }}
        />
      ) : null}
    </Section>
  );
}
