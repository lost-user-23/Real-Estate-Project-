"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { attempt } from "@/lib/attempt";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/admin/Pagination";

const PAGE_SIZE = 20;
const STATUSES = ["open", "reviewing", "resolved", "rejected"];
const label = (s) => s[0].toUpperCase() + s.slice(1);

export default function AdminReportsPage() {
  const { reports, reportsMeta, reportsLoading, reportsError, loadReports, setReportStatus } = useAdminStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const reload = useCallback(
    () => loadReports({ page, limit: PAGE_SIZE, ...(statusFilter ? { status: statusFilter } : {}) }),
    [loadReports, page, statusFilter]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const handleStatusChange = async (report, status) => {
    const res = await attempt(() => setReportStatus(report.id, status));
    if (res.ok && statusFilter) reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-text-muted">Listings flagged by visitors, newest first.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </div>

      {reportsError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load reports: {reportsError}</span>
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-180 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Reported</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-b border-border align-top last:border-0">
                <td className="break-all px-4 py-3">{report.listingUrlOrId}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{report.reason}</p>
                  {report.details ? <p className="mt-1 text-xs text-text-muted">{report.details}</p> : null}
                </td>
                <td className="px-4 py-3 text-text-muted">{formatDate(report.createdAt)}</td>
                <td className="px-4 py-3">
                  <select
                    value={report.status}
                    onChange={(e) => handleStatusChange(report, e.target.value)}
                    aria-label={`Status for report on ${report.listingUrlOrId}`}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {reportsLoading && reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Loading reports…
                </td>
              </tr>
            ) : null}
            {!reportsLoading && !reportsError && reports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No reports.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={reportsMeta} label="reports" loading={reportsLoading} page={page} onPageChange={setPage} />
    </div>
  );
}
