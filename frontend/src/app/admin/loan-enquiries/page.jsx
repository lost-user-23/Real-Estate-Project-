"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { LENDERS } from "@/lib/lenders.mjs";
import { Pagination } from "@/components/admin/Pagination";

const PAGE_SIZE = 20;
const STATUSES = ["new", "contacted", "closed"];
const LOAN_TYPES = ["home", "personal"];
const label = (s) => s[0].toUpperCase() + s.slice(1);
const LENDER_NAMES = Object.fromEntries(
  LENDERS.map((l) => [l.id, `${l.name} (${l.loanType === "home" ? "home" : "personal"})`])
);

const BADGE_STYLES = {
  new: "border-primary text-primary",
  contacted: "border-border text-text",
  closed: "border-border text-text-muted",
};

const selectClass = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";

// Everything here comes from the public, so each field is rendered as plain
// text: never as HTML, and phone/email are deliberately not turned into links.
export default function AdminLoanEnquiriesPage() {
  const { show } = useToast();
  const [enquiries, setEnquiries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("loanType", typeFilter);
    try {
      const data = await api.get(`/api/v1/admin/loan-enquiries?${params}`);
      setEnquiries(data.enquiries);
      setMeta(data.meta);
    } catch (e) {
      setEnquiries([]);
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (enquiry, status) => {
    if (status === enquiry.status) return;
    setSavingId(enquiry.id);
    setRowErrors((prev) => ({ ...prev, [enquiry.id]: "" }));
    try {
      const { loanEnquiry } = await api.patch(`/api/v1/admin/loan-enquiries/${enquiry.id}`, { status });
      show(`Marked as ${status}`);
      if (statusFilter) {
        if (enquiries.length === 1 && page > 1) setPage(page - 1);
        else load();
      } else {
        setEnquiries((prev) => prev.map((e) => (e.id === enquiry.id ? loanEnquiry : e)));
      }
    } catch (e) {
      setRowErrors((prev) => ({
        ...prev,
        [enquiry.id]: e?.message || "Something went wrong. Please try again.",
      }));
    } finally {
      setSavingId(null);
    }
  };

  const onFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loan enquiries</h1>
          <p className="mt-1 text-sm text-text-muted">
            Callback requests from the loans page, newest first. These are not bank applications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={typeFilter} onChange={onFilter(setTypeFilter)} aria-label="Filter by loan type" className={selectClass}>
            <option value="">All loan types</option>
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>{label(t)}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={onFilter(setStatusFilter)} aria-label="Filter by status" className={selectClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load loan enquiries: {error}</span>
          <button type="button" onClick={load} className="font-medium underline">Retry</button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-220 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Request</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => (
              <tr key={enquiry.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium break-words">{enquiry.name}</p>
                  <p className="text-xs text-text-muted">{enquiry.phone}</p>
                  {enquiry.email ? <p className="text-xs text-text-muted break-all">{enquiry.email}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {label(enquiry.loanType)} loan, {formatPrice(enquiry.amountInRupees)}
                  </p>
                  {enquiry.city ? <p className="text-xs text-text-muted break-words">{enquiry.city}</p> : null}
                  <p className="text-xs text-text-muted">
                    Lender: {enquiry.preferredLenderId ? LENDER_NAMES[enquiry.preferredLenderId] || "Unknown" : "No preference"}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {enquiry.property ? (
                    <span className="break-words">{enquiry.property.title || enquiry.property.id}</span>
                  ) : (
                    <span className="text-text-muted">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted">{formatDate(enquiry.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[enquiry.status]}`}>
                    {label(enquiry.status)}
                  </span>
                  <select
                    value={enquiry.status}
                    disabled={savingId === enquiry.id}
                    onChange={(e) => handleStatusChange(enquiry, e.target.value)}
                    aria-label={`Status for ${enquiry.name}`}
                    className={`${selectClass} block w-full py-1 text-xs disabled:opacity-50`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </select>
                  {rowErrors[enquiry.id] ? (
                    <p role="alert" className="mt-2 text-xs text-danger">{rowErrors[enquiry.id]}</p>
                  ) : null}
                </td>
              </tr>
            ))}
            {loading && enquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">Loading loan enquiries…</td>
              </tr>
            ) : null}
            {!loading && !error && enquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">No loan enquiries.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} label="enquiries" loading={loading} page={page} onPageChange={setPage} />
    </div>
  );
}
