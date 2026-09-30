"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { attempt } from "@/lib/attempt";
import { slugify } from "@/lib/slugify";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

const EMPTY = { name: "", slug: "", icon: "" };

export default function AdminCategoriesPage() {
  const { categories, categoriesLoading, categoriesError, loadCategories, addCategory, updateCategory, deleteCategory } =
    useAdminStore();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const payload = { name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), icon: form.icon };
    const res = await attempt(() => (editingId ? updateCategory(editingId, payload) : addCategory(payload)));
    setSubmitting(false);
    if (res.ok) {
      setForm(EMPTY);
      setEditingId(null);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setForm({ name: category.name, slug: category.slug, icon: category.icon ?? "" });
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    await attempt(() => deleteCategory(category.id));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-text-muted">Property categories shown on the home page.</p>
      </div>

      {categoriesError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load categories: {categoriesError}</span>
          <button type="button" onClick={loadCategories} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4 sm:items-end"
      >
        <AdminField label="Name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Slug">
          <input
            value={form.slug}
            placeholder="auto from name"
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Icon">
          <input
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className={adminFieldInputClass}
          />
        </AdminField>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {editingId ? "Save" : "Add category"}
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-140 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Listings</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{category.name}</td>
                <td className="px-4 py-3 text-text-muted">{category.slug}</td>
                <td className="px-4 py-3 text-text-muted">{category.listingCount}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categoriesLoading && categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Loading categories…
                </td>
              </tr>
            ) : null}
            {!categoriesLoading && !categoriesError && categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No categories yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
