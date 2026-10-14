"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { useAttempt } from "@/lib/attempt";
import { Toggle } from "@/components/admin/Toggle";
import { Pagination } from "@/components/admin/Pagination";
import { Modal } from "@/components/admin/Modal";
import { FacilitiesManager } from "@/components/admin/FacilitiesManager";

const PAGE_SIZE = 50;

// Keeps typing local and only saves on blur or Enter. Empty means unranked (null), never 0.
function RankInput({ location, onSave }) {
  const saved = location.popularRank ?? "";
  const [draft, setDraft] = useState(saved);
  const [prevSaved, setPrevSaved] = useState(saved);

  if (saved !== prevSaved) {
    setPrevSaved(saved);
    setDraft(saved);
  }

  const commit = async () => {
    const next = draft === "" ? null : Number(draft);
    if (next !== null && (!Number.isInteger(next) || next < 1)) {
      setDraft(saved);
      return;
    }
    if (next === (location.popularRank ?? null)) return;
    const ok = await onSave(location, next);
    if (!ok) setDraft(saved);
  };

  return (
    <input
      type="number"
      min={1}
      disabled={!location.popular}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label={`Order for ${location.city}`}
      placeholder="Auto"
      className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40"
    />
  );
}

export default function AdminLocationsPage() {
  const {
    locations,
    locationsMeta,
    locationsLoading,
    locationsError,
    loadLocations,
    togglePopular,
    setPopularRank,
    minActiveListingsForPopular,
  } = useAdminStore();
  const attempt = useAttempt();
  const [page, setPage] = useState(1);
  const [facilitiesFor, setFacilitiesFor] = useState(null);

  const reload = useCallback(() => loadLocations({ page, limit: PAGE_SIZE }), [loadLocations, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleTogglePopular = (location) => attempt(() => togglePopular(location.id));

  const handleRankSave = async (location, rank) => {
    const res = await attempt(() => setPopularRank(location.id, rank));
    return res.ok;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Popular locations</h1>
        <p className="mt-1 text-sm text-text-muted">
          A city needs at least {minActiveListingsForPopular} active listings to qualify, so it isn&apos;t flagged
          Popular with a near-empty results page behind it.
        </p>
      </div>

      {locationsError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load locations: {locationsError}</span>
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Active listings</th>
              <th className="px-4 py-3 font-medium">Popular</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Facilities</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => {
              const eligible = location.activeListingCount >= minActiveListingsForPopular;
              return (
                <tr key={location.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{location.city}</p>
                    {location.locality ? <p className="text-xs text-text-muted">{location.locality}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {location.activeListingCount.toLocaleString("en-IN")}
                    {!eligible ? <span className="ml-2 text-xs text-danger">Below minimum</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={location.popular}
                      onChange={() => handleTogglePopular(location)}
                      label={`Toggle popular for ${location.city}`}
                      disabled={!eligible && !location.popular}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RankInput location={location} onSave={handleRankSave} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setFacilitiesFor(location)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              );
            })}
            {locationsLoading && locations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading locations…
                </td>
              </tr>
            ) : null}
            {!locationsLoading && !locationsError && locations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No locations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination
        meta={locationsMeta}
        label="locations"
        loading={locationsLoading}
        page={page}
        onPageChange={setPage}
      />

      {facilitiesFor ? (
        <Modal
          title={`Facilities: ${[facilitiesFor.locality, facilitiesFor.city].filter(Boolean).join(", ")}`}
          onClose={() => setFacilitiesFor(null)}
        >
          <FacilitiesManager location={facilitiesFor} />
        </Modal>
      ) : null}
    </div>
  );
}
