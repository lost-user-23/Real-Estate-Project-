"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

const INITIAL = {
  name: "",
  developer: "",
  city: "",
  locality: "",
  startingPrice: "",
  possessionLabel: "",
  status: "draft",
};

export function AddProjectForm({ onDone, item = null }) {
  const { addProject, updateProject } = useAdminStore();
  const [form, setForm] = useState(
    item
      ? {
          name: item.name,
          developer: item.developer,
          city: item.city,
          locality: item.locality ?? "",
          startingPrice: String(item.startingPriceInRupees ?? ""),
          possessionLabel: item.possessionLabel ?? "",
          status: item.status,
        }
      : INITIAL
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const fields = {
        name: form.name,
        developer: form.developer,
        city: form.city,
        locality: form.locality.trim() || null,
        startingPriceInRupees: Number(form.startingPrice),
        possessionLabel: form.possessionLabel,
      };
      if (item) {
        // Status changes go through the table's status select so publishing stamps publishedAt.
        await updateProject(item.id, fields);
      } else {
        await addProject({ ...fields, status: form.status });
      }
      onDone();
    } catch (e) {
      setError(e?.message || "Could not create the project. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <AdminField label="Project name" required>
        <input
          required
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>
      <div className="grid grid-cols-2 gap-4">
        <AdminField label="Developer" required>
          <input
            required
            value={form.developer}
            onChange={(e) => update({ developer: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Starting price (₹)" required>
          <input
            type="number"
            min={1}
            required
            value={form.startingPrice}
            onChange={(e) => update({ startingPrice: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="City" required>
          <input
            required
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Locality">
          <input
            value={form.locality}
            onChange={(e) => update({ locality: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Possession" required>
          <input
            required
            placeholder="e.g. Dec 2027"
            value={form.possessionLabel}
            onChange={(e) => update({ possessionLabel: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        {item ? null : (
          <AdminField label="Status">
            <select value={form.status} onChange={(e) => update({ status: e.target.value })} className={adminFieldInputClass}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </AdminField>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Saving…" : item ? "Save changes" : "Add project"}
      </button>
    </form>
  );
}
