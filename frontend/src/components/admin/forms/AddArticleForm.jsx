"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";
import { ARTICLE_TYPES, ARTICLE_TYPE_LABELS } from "@/lib/articleTypes";

export function AddArticleForm({ onDone, item = null, defaultType = "blog" }) {
  const { addArticle, updateArticle } = useAdminStore();
  const [form, setForm] = useState(
    item
      ? { type: item.type ?? "blog", title: item.title, excerpt: item.excerpt ?? "", content: item.content ?? "", status: item.status }
      : { type: defaultType, title: "", excerpt: "", content: "", status: "draft" }
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // The backend generates the slug and stamps publishedAt when created as published.
      if (item) {
        // Status changes go through the table's status select so publishing stamps publishedAt.
        await updateArticle(item.id, { type: form.type, title: form.title, excerpt: form.excerpt, content: form.content });
      } else {
        await addArticle({ type: form.type, title: form.title, excerpt: form.excerpt, content: form.content, status: form.status });
      }
      onDone();
    } catch (e) {
      setError(e?.message || "Could not create the article. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <AdminField label="Type">
        <select value={form.type} onChange={(e) => update({ type: e.target.value })} className={adminFieldInputClass}>
          {ARTICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ARTICLE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </AdminField>
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
      <AdminField label="Content">
        <textarea
          rows={8}
          value={form.content}
          onChange={(e) => update({ content: e.target.value })}
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

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Saving…" : item ? "Save changes" : `Add ${ARTICLE_TYPE_LABELS[form.type].toLowerCase()}`}
      </button>
    </form>
  );
}
