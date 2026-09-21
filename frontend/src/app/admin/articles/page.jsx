"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/admin/StatusPill";
import { Modal } from "@/components/admin/Modal";
import { AddArticleForm } from "@/components/admin/forms/AddArticleForm";

export default function AdminArticlesPage() {
  const { articles, setArticleStatus, deleteArticle } = useAdminStore();
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = (article) => {
    if (window.confirm(`Delete "${article.title}"? This can't be undone.`)) {
      deleteArticle(article.id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-text-muted">
            The home page shows up to 3 published articles, most recently published first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Add article
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{article.title}</p>
                  <p className="text-xs text-text-muted">{article.excerpt}</p>
                </td>
                <td className="px-4 py-3 text-text-muted">{formatDate(article.publishedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill status={article.status} />
                    <select
                      value={article.status}
                      onChange={(e) => setArticleStatus(article.id, e.target.value)}
                      aria-label={`Status for ${article.title}`}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(article)}
                    className="text-xs font-medium text-danger hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {articles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No articles yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <Modal title="Add article" onClose={() => setShowAdd(false)}>
          <AddArticleForm onDone={() => setShowAdd(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
