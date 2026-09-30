"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { attempt } from "@/lib/attempt";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

// Matches Facility.TYPES on the backend.
const FACILITY_TYPES = ["school", "hospital", "mall", "transit", "park", "restaurant"];
const EMPTY = { name: "", type: "school", address: "", distanceKm: "" };

export function FacilitiesManager({ location }) {
  const { listFacilities, createFacility, updateFacility, deleteFacility } = useAdminStore();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    listFacilities(location.id)
      .then((rows) => {
        if (cancelled) return;
        setFacilities(rows);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listFacilities, location.id, version]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const fields = {
      name: form.name,
      type: form.type,
      address: form.address,
      distanceKm: Number(form.distanceKm),
    };
    const res = await attempt(() =>
      editingId ? updateFacility(editingId, fields) : createFacility({ ...fields, locationId: location.id })
    );
    setSubmitting(false);
    if (res.ok) {
      setForm(EMPTY);
      setEditingId(null);
      load();
    }
  };

  const startEdit = (facility) => {
    setEditingId(facility.id);
    setForm({
      name: facility.name,
      type: facility.type,
      address: facility.address,
      distanceKm: String(facility.distanceKm),
    });
  };

  const handleDelete = async (facility) => {
    if (!window.confirm(`Delete "${facility.name}"?`)) return;
    const res = await attempt(() => deleteFacility(facility.id));
    if (res.ok) load();
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load facilities: {error}</span>
          <button type="button" onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border text-sm">
        {facilities.map((facility) => (
          <li key={facility.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <div>
              <p className="font-medium">{facility.name}</p>
              <p className="text-xs text-text-muted">
                {facility.type} · {facility.distanceKm} km · {facility.address}
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" onClick={() => startEdit(facility)} className="text-xs font-medium text-primary hover:underline">
                Edit
              </button>
              <button type="button" onClick={() => handleDelete(facility)} className="text-xs font-medium text-danger hover:underline">
                Delete
              </button>
            </div>
          </li>
        ))}
        {loading ? <li className="px-3 py-4 text-center text-text-muted">Loading…</li> : null}
        {!loading && !error && facilities.length === 0 ? (
          <li className="px-3 py-4 text-center text-text-muted">No facilities yet.</li>
        ) : null}
      </ul>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <AdminField label="Name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Type">
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={adminFieldInputClass}
          >
            {FACILITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Address" required>
          <input
            required
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Distance (km)" required>
          <input
            type="number"
            min={0}
            step="0.1"
            required
            value={form.distanceKm}
            onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {editingId ? "Save facility" : "Add facility"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
