"use client";

import { useAdminStore } from "@/lib/admin-store";
import { Toggle } from "@/components/admin/Toggle";

export default function AdminLocationsPage() {
  const { locations, togglePopular, setPopularRank, minActiveListingsForPopular } = useAdminStore();

  const sorted = [...locations].sort((a, b) => b.activeListingCount - a.activeListingCount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Popular locations</h1>
        <p className="mt-1 text-sm text-text-muted">
          A city needs at least {minActiveListingsForPopular} active listings to qualify, so it isn&apos;t flagged
          Popular with a near-empty results page behind it.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Active listings</th>
              <th className="px-4 py-3 font-medium">Popular</th>
              <th className="px-4 py-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((location) => {
              const eligible = location.activeListingCount >= minActiveListingsForPopular;
              return (
                <tr key={location.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{location.city}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {location.activeListingCount.toLocaleString("en-IN")}
                    {!eligible ? <span className="ml-2 text-xs text-danger">Below minimum</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={location.popular}
                      onChange={() => togglePopular(location.id)}
                      label={`Toggle popular for ${location.city}`}
                      disabled={!eligible}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      disabled={!location.popular}
                      value={location.popularRank ?? ""}
                      onChange={(e) =>
                        setPopularRank(location.id, e.target.value === "" ? null : Number(e.target.value))
                      }
                      aria-label={`Order for ${location.city}`}
                      placeholder="Auto"
                      className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
