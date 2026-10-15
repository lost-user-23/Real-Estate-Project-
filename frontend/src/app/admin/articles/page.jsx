"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { useAttempt } from "@/lib/attempt";
import { useToast } from "@/lib/toast-context";
import { ARTICLE_TYPES, ARTICLE_TYPE_LABELS, ARTICLE_TYPE_PLURALS } from "@/lib/articleTypes";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/admin/Pagination";
import { StatusPill } from "@/components/admin/StatusPill";
import { Modal } from "@/components/admin/Modal";
import { AddArticleForm } from "@/components/admin/forms/AddArticleForm";

const PAGE_SIZE = 20;

export default function AdminArticlesPage() {
  const { articles, articlesMeta, articlesLoading, articlesError, loadArticles, setArticleStatus, deleteArticle } =
    useAdminStore();
  const attempt = useAttempt();
  const confirm = useConfirm();
  const { show } = useToast();
  const [typeFilter, setTypeFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);

  const reload = useCallback(
    () => loadArticles({ page, limit: PAGE_SIZE, ...(typeFilter ? { type: typeFilter } : {}) }),
    [loadArticles, page, typeFilter]
  );

  const changeFilter = (next) => {
    setTypeFilter(next);
    setPage(1);
  };

  useEffect(() => {
    reload();
  }, [reload]);

  const handleStatusChange = async (article, status) => {
    const res = await attempt(() => setArticleStatus(article.id, status));
    if (res.ok) {
      show(`${ARTICLE_TYPE_LABELS[article.type ?? "blog"]} ${status === "published" ? "published" : `moved to ${status}`}.`);
      reload();
    }
  };

  const handleDelete = async (article) => {
    const ok = await confirm({
      title: "Delete article?",
      message: `Delete "${article.title}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await attempt(() => deleteArticle(article.id));
    if (!res.ok) return;
    show(`${ARTICLE_TYPE_LABELS[article.type ?? "blog"]} deleted.`);
    if (articles.length <= 1 && page > 1) setPage((p) => p - 1);
    else reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights: blogs &amp; news</h1>
          <p className="mt-1 text-sm text-text-muted">
            The home page shows up to 3 published blogs and 3 published news items, most recently published first. Publishing news also pops a notification up for visitors.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Add {typeFilter ? ARTICLE_TYPE_LABELS[typeFilter].toLowerCase() : "article"}
        </button>
      </div>

      <div role="tablist" aria-label="Filter by type" className="flex gap-2">
        {["", ...ARTICLE_TYPES].map((t) => (
          <button
            key={t || "all"}
            type="button"
            role="tab"
            aria-selected={typeFilter === t}
            onClick={() => changeFilter(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              typeFilter === t ? "bg-primary text-white" : "border border-border bg-surface text-text-muted hover:text-text"
            }`}
          >
            {t ? ARTICLE_TYPE_PLURALS[t] : "All"}
          </button>
        ))}
      </div>

      {articlesError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load articles: {articlesError}</span>
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Type</th>
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
                <td className="px-4 py-3 text-text-muted">{ARTICLE_TYPE_LABELS[article.type ?? "blog"]}</td>
                <td className="px-4 py-3 text-text-muted">{article.publishedAt ? formatDate(article.publishedAt) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill status={article.status} />
                    <select
                      value={article.status}
                      onChange={(e) => handleStatusChange(article, e.target.value)}
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
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(article)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(article)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {articlesLoading && articles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading articles…
                </td>
              </tr>
            ) : null}
            {!articlesLoading && !articlesError && articles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No {typeFilter ? ARTICLE_TYPE_PLURALS[typeFilter].toLowerCase() : "articles"} yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={articlesMeta} label="articles" loading={articlesLoading} page={page} onPageChange={setPage} />

      {showAdd ? (
        <Modal title={`Add ${typeFilter ? ARTICLE_TYPE_LABELS[typeFilter].toLowerCase() : "article"}`} onClose={() => setShowAdd(false)}>
          <AddArticleForm
            defaultType={typeFilter || "blog"}
            onDone={() => {
              setShowAdd(false);
              show("Saved.");
              if (page === 1) reload();
              else setPage(1);
            }}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit article" onClose={() => setEditing(null)}>
          <AddArticleForm
            item={editing}
            onDone={() => {
              setEditing(null);
              show("Changes saved.");
              reload();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
