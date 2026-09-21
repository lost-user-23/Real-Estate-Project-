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

export function AddProjectForm({ onDone }) {
  const { addProject } = useAdminStore();
  const [form, setForm] = useState(INITIAL);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const id = crypto.randomUUID();
    addProject({
      id,
      name: form.name,
      developer: form.developer,
      city: form.city,
      locality: form.locality,
      image: { src: `https://picsum.photos/seed/${id}/800/600`, alt: form.name },
      startingPriceInRupees: Number(form.startingPrice),
      possessionLabel: form.possessionLabel,
      publishedAt: new Date().toISOString().slice(0, 10),
      status: form.status,
    });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <AdminField label="Status">
          <select value={form.status} onChange={(e) => update({ status: e.target.value })} className={adminFieldInputClass}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </AdminField>
      </div>

      <button
        type="submit"
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Add project
      </button>
    </form>
  );
}
