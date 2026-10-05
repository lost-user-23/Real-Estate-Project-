"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/admin/Pagination";

const PAGE_SIZE = 20;
const STATUSES = ["new", "read", "archived"];
const label = (s) => s[0].toUpperCase() + s.slice(1);

const BADGE_STYLES = {
  new: "border-primary text-primary",
  read: "border-border text-text-muted",
  archived: "border-border text-text-muted",
};

const ACTIONS = {
  new: [
    { status: "read", text: "Mark as read" },
    { status: "archived", text: "Archive" },
  ],
  read: [
    { status: "new", text: "Mark as new" },
    { status: "archived", text: "Archive" },
  ],
  archived: [
    { status: "new", text: "Mark as new" },
    { status: "read", text: "Mark as read" },
  ],
};

// Message content comes from the public, so every field is rendered as plain
// text. Never as HTML and never as a link.
export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const data = await api.get(`/api/v1/admin/contact-messages?${params}`);
      setMessages(data.messages);
      setMeta(data.meta);
    } catch (e) {
      setMessages([]);
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (message, status) => {
    setSavingId(message.id);
    setRowErrors((prev) => ({ ...prev, [message.id]: "" }));
    try {
      const { contactMessage } = await api.patch(`/api/v1/admin/contact-messages/${message.id}`, { status });
      // With a status filter the row no longer matches, so reload. If it was
      // the only row on a later page, step back a page (which reloads).
      if (statusFilter) {
        if (messages.length === 1 && page > 1) setPage(page - 1);
        else load();
      } else {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? contactMessage : m)));
      }
    } catch (e) {
      setRowErrors((prev) => ({
        ...prev,
        [message.id]: e?.message || "Something went wrong. Please try again.",
      }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 text-sm text-text-muted">Messages sent through the contact form, newest first.</p>
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

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger"
        >
          <span>Could not load messages: {error}</span>
          <button type="button" onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-180 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium break-words">{message.name}</p>
                  <p className="text-xs text-text-muted break-all">{message.email}</p>
                  {message.phone ? <p className="text-xs text-text-muted">{message.phone}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <p className="whitespace-pre-wrap break-words">{message.message}</p>
                </td>
                <td className="px-4 py-3 text-text-muted">{formatDate(message.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[message.status]}`}
                  >
                    {label(message.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS[message.status].map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={savingId === message.id}
                        onClick={() => handleStatusChange(message, action.status)}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {action.text}
                      </button>
                    ))}
                  </div>
                  {rowErrors[message.id] ? (
                    <p role="alert" className="mt-2 text-xs text-danger">
                      {rowErrors[message.id]}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
            {loading && messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading messages…
                </td>
              </tr>
            ) : null}
            {!loading && !error && messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No messages.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} label="messages" loading={loading} page={page} onPageChange={setPage} />
    </div>
  );
}
