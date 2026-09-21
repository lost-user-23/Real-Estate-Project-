"use client";

import { useState } from "react";

const INITIAL = { name: "", email: "", message: "" };

export function ContactForm() {
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-semibold">Thanks, {form.name || "there"}.</p>
        <p className="mt-1 text-sm text-text-muted">
          There&apos;s no backend connected yet, so this message wasn&apos;t actually sent — in the live product
          it would reach our support inbox.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(INITIAL);
            setSubmitted(false);
          }}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Name</span>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-xs font-medium text-text-muted">Message</span>
        <textarea
          rows={5}
          required
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        Send message
      </button>
    </form>
  );
}
