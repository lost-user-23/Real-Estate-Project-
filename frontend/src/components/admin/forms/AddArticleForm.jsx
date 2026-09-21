"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { slugify } from "@/lib/slugify";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

const INITIAL = { title: "", excerpt: "", status: "draft" };

export function AddArticleForm({ onDone }) {
  const { addArticle } = useAdminStore();
  const [form, setForm] = useState(INITIAL);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const id = crypto.randomUUID();
    addArticle({
      id,
      title: form.title,
      excerpt: form.excerpt,
      image: { src: `https://picsum.photos/seed/${id}/800/450`, alt: form.title },
      publishedAt: new Date().toISOString().slice(0, 10),
      slug: slugify(form.title),
      status: form.status,
    });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AdminField label="Title" required>
        <input
          required
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>
      <AdminField label="Excerpt" required>
        <textarea
          rows={3}
          required
          value={form.excerpt}
          onChange={(e) => update({ excerpt: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>
      <AdminField label="Status">
        <select value={form.status} onChange={(e) => update({ status: e.target.value })} className={adminFieldInputClass}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </AdminField>

      <button
        type="submit"
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Add article
      </button>
    </form>
  );
}
