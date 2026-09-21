"use client";

import { useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

export default function AdminProfilePage() {
  const { profile, updateProfile } = useAdminAuth();
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    updateProfile(form);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Stored locally in this browser — there&apos;s no account backend yet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <AdminField label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Title">
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Save changes
          </button>
          {saved ? <p className="text-sm text-success">Saved.</p> : null}
        </div>
      </form>
    </div>
  );
}
