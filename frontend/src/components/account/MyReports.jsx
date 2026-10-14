"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Section } from "@/components/account/AccountSections";

const PAGE_SIZE = 10;

const STATUS_LABELS = {
  open: "Received",
  reviewing: "Under review",
  resolved: "Action taken",
  rejected: "Closed, no action needed",
};

const STATUS_STYLES = {
  open: "bg-text-muted/10 text-text-muted",
  reviewing: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  rejected: "bg-text-muted/10 text-text-muted",
};

export function MyReports() {
  const [reports, setReports] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/v1/reports/mine?page=${page}&limit=${PAGE_SIZE}`);
      setReports((current) => (append ? [...current, ...data.reports] : data.reports));
      setMeta(data.meta);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so the loading state update isn't synchronous in the effect body.
    Promise.resolve().then(() => load(1));
  }, [load]);

  const hasMore = meta && meta.page < meta.totalPages;

  return (
    <Section title="My reports" description="Listings you have reported and where each report stands.">
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          <span>Could not load your reports: {error}</span>
          <button type="button" onClick={() => load(1)} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      {loading && reports.length === 0 && !error ? (
        <p className="text-sm text-text-muted">Loading your reports…</p>
      ) : null}

      {!loading && !error && reports.length === 0 ? (
        <p className="text-sm text-text-muted">You have not reported any listings.</p>
      ) : null}

      {reports.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {report.listing.slug ? (
                  <Link href={`/property/${report.listing.slug}`} className="block truncate font-medium text-primary hover:underline">
                    {report.listing.title}
                  </Link>
                ) : (
                  <p className="truncate font-medium">{report.listing.reference}</p>
                )}
                <p className="mt-1 text-sm text-text-muted">
                  {report.reason} · {formatDate(report.createdAt)}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[report.status]}`}>
                {STATUS_LABELS[report.status] ?? report.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(meta.page + 1, true)}
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-bg disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </Section>
  );
}
