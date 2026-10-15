"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { normalizeProperty } from "@/lib/dataSource";
import { FinderCard } from "@/components/assistant/FinderCard";
import { CompareTable } from "@/components/assistant/CompareTable";
import { EnquiryForm } from "@/components/assistant/EnquiryForm";

const STORAGE_KEY = "homenest-finder-v1";
const MAX_COMPARE = 3;
const MAX_INPUT = 500;

const chipClass =
  "rounded-full border border-primary/40 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50";

let nextId = 1;
const newId = () => `m${Date.now()}-${nextId++}`;

function readSaved() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && Array.isArray(saved.messages) && saved.state ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(value) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; the chat still works without it.
  }
}

function clearSaved() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Turns an API reply into chat messages: one bubble per sentence block, with
// the result cards attached to the last one.
function assistantMessages(reply) {
  const texts = reply.messages ?? [];
  const results = reply.results
    ? {
        exact: reply.results.exact.map(normalizeProperty),
        approximate: reply.results.approximate.map(normalizeProperty),
      }
    : null;
  return texts.map((text, index) => {
    const last = index === texts.length - 1;
    return {
      id: newId(),
      role: "assistant",
      text,
      results: last ? results : null,
      // The follow-up actions belong to the message they answer, so they
      // scroll with it instead of sitting in a separate bar.
      actions: last ? (reply.quickReplies ?? []) : [],
    };
  });
}

export function PropertyFinderChat({ variant = "widget", onClose }) {
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState({ state: null, summary: [] });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [enquiry, setEnquiry] = useState(null);
  const logRef = useRef(null);
  const followRef = useRef(true);
  const lastTopRef = useRef(0);
  // One request at a time. A ref, because two clicks in the same tick both see the old `loading`.
  const busyRef = useRef(false);
  const startedRef = useRef(false);

  const apply = useCallback((reply, userText) => {
    setMessages((prev) => [
      ...prev,
      ...(userText ? [{ id: newId(), role: "user", text: userText }] : []),
      ...assistantMessages(reply),
    ]);
    setChat({ state: reply.state, summary: reply.summary ?? [] });
  }, []);

  const send = useCallback(
    async (body, userText) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoading(true);
      try {
        const reply = await api.post("/api/v1/assistant/chat", body, { auth: false });
        apply(reply, userText);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          ...(userText ? [{ id: newId(), role: "user", text: userText }] : []),
          { id: newId(), role: "assistant", text: error.message || "Something went wrong. Please try again.", error: true },
        ]);
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    },
    [apply]
  );

  // Restore the conversation after a page change, otherwise start a new one.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const saved = readSaved();
    if (saved) {
      // One-time hydration from sessionStorage, which is not available during SSR.
      // Conversations saved before actions moved into messages kept them separately.
      const restored = [...saved.messages];
      const lastIndex = restored.findLastIndex((m) => m.role === "assistant");
      if (lastIndex >= 0 && !restored[lastIndex].actions && saved.quickReplies) {
        restored[lastIndex] = { ...restored[lastIndex], actions: saved.quickReplies };
      }
      setMessages(restored);
      setChat({ state: saved.state, summary: saved.summary ?? [] });
      setLoading(false);
    } else {
      send({});
    }
  }, [send]);

  useEffect(() => {
    if (loading || !chat.state) return;
    writeSaved({ messages, state: chat.state, summary: chat.summary });
  }, [messages, chat, loading]);

  useEffect(() => {
    const log = logRef.current;
    if (log && followRef.current) log.scrollTop = log.scrollHeight;
  }, [messages, loading, enquiry, showCompare]);

  const onLogScroll = (event) => {
    const log = event.currentTarget;
    const gap = log.scrollHeight - log.scrollTop - log.clientHeight;
    // New content only ever grows the list, so only an upward scroll means the
    // reader left the bottom; reaching the bottom again resumes following.
    if (gap < 80) followRef.current = true;
    else if (log.scrollTop < lastTopRef.current) followRef.current = false;
    lastTopRef.current = log.scrollTop;
  };

  const submitText = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    followRef.current = true;
    send({ message: text, state: chat.state }, text);
  };

  const runAction = (label, action) => {
    if (loading) return;
    followRef.current = true;
    send({ action, state: chat.state }, label);
  };

  const reset = () => {
    if (busyRef.current) return;
    clearSaved();
    setMessages([]);
    setCompare([]);
    setShowCompare(false);
    setEnquiry(null);
    setLoading(true);
    send({});
  };

  const toggleCompare = (property) =>
    setCompare((prev) => (prev.some((p) => p.id === property.id) ? prev.filter((p) => p.id !== property.id) : prev.length < MAX_COMPARE ? [...prev, property] : prev));

  const enquirySent = (property) => {
    setEnquiry(null);
    setMessages((prev) => [
      ...prev,
      {
        // Keep the follow-up actions available after the confirmation.
        actions: [...prev].reverse().find((m) => m.actions?.length)?.actions ?? [],
        id: newId(),
        role: "assistant",
        text: `Thanks, your request about “${property.title}” has been sent to HomeNest. They will contact you using the details you gave. I have not shared those details with anyone else.`,
      },
    ]);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const containerClass =
    variant === "page"
      ? "flex h-[calc(100dvh-12rem)] min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-border bg-bg shadow-sm"
      : "flex h-full flex-col overflow-hidden bg-bg";

  return (
    <div className={containerClass}>
      <header className="flex items-center justify-between gap-2 bg-ink px-4 py-3 text-white">
        <div>
          <h2 className="text-sm font-bold">HomeNest Property Finder</h2>
          <p className="text-[11px] text-white/70">Results come from our live listings</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={reset} className="rounded-full px-3 py-1 text-xs font-semibold text-white/85 hover:bg-white/10">
            Start over
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close property finder" className="rounded-full px-2.5 py-1 text-lg leading-none text-white/85 hover:bg-white/10">
              &times;
            </button>
          ) : null}
        </div>
      </header>

      {chat.summary.length > 0 ? (
        <section aria-label="Your preferences" className="border-b border-border bg-surface px-3 py-1.5">
          <ul className="flex flex-wrap gap-1">
            {chat.summary.map((row) => (
              <li key={row.key} className="flex items-center overflow-hidden rounded-full bg-primary-light text-[11px] text-primary-dark">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(`Change ${row.label.toLowerCase()}`, { type: "ask", field: row.ask })}
                  aria-label={`Change ${row.label}: ${row.value}`}
                  className="px-2 py-0.5 hover:bg-primary/15 disabled:opacity-60"
                >
                  <span className="font-medium">{row.label}:</span> {row.value}
                </button>
                {row.clear ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => runAction(`Remove ${row.label.toLowerCase()}`, { type: "patch", prefs: Object.fromEntries(row.clear.map((k) => [k, null])) })}
                    aria-label={`Remove ${row.label}`}
                    className="px-1.5 py-0.5 hover:bg-primary/15 disabled:opacity-60"
                  >
                    &times;
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div ref={logRef} onScroll={onLogScroll} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
            <p
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-white"
                  : `max-w-[92%] rounded-2xl rounded-bl-md border px-3 py-2 text-sm ${m.error ? "border-danger/40 bg-surface text-danger" : "border-border bg-surface text-text"}`
              }
            >
              {m.text}
            </p>
            {m.results ? (
              <div className="space-y-2">
                {m.results.exact.map((p) => (
                  <FinderCard key={p.id} property={p} selected={compare.some((c) => c.id === p.id)} canSelect={compare.length < MAX_COMPARE} onToggleCompare={toggleCompare} onEnquire={setEnquiry} />
                ))}
                {m.results.approximate.length ? (
                  <>
                    <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Close matches</p>
                    {m.results.approximate.map((p) => (
                      <FinderCard key={p.id} property={p} selected={compare.some((c) => c.id === p.id)} canSelect={compare.length < MAX_COMPARE} onToggleCompare={toggleCompare} onEnquire={setEnquiry} />
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
            {m.id === lastAssistantId && !loading && compare.length > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <button type="button" disabled={compare.length < 2} onClick={() => setShowCompare(true)} className={chipClass}>
                  Compare selected ({compare.length})
                </button>
                {compare.length < 2 ? <span className="text-text-muted">Pick at least two to compare.</span> : null}
              </div>
            ) : null}
            {m.id === lastAssistantId && !loading && m.actions?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {m.actions.map((chip) =>
                  chip.href ? (
                    <Link key={chip.label} href={chip.href} className={chipClass}>
                      {chip.label}
                    </Link>
                  ) : (
                    <button key={chip.label} type="button" onClick={() => runAction(chip.label, chip.action)} className={chipClass}>
                      {chip.label}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        ))}

        {showCompare && compare.length >= 2 ? <CompareTable properties={compare} onClose={() => setShowCompare(false)} /> : null}
        {enquiry ? <EnquiryForm property={enquiry} onDone={enquirySent} onCancel={() => setEnquiry(null)} /> : null}
        {loading ? <p className="text-xs text-text-muted" role="status">Thinking...</p> : null}
      </div>

      <form onSubmit={submitText} className="flex gap-2 border-t border-border bg-surface p-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT))}
          aria-label="Type your message"
          placeholder="e.g. 3 BHK flat in Jaipur under ₹70 lakh"
          className="min-w-0 flex-1 rounded-full border border-border bg-bg px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          Send
        </button>
      </form>
      <p className="bg-surface px-3 pb-2 text-[11px] text-text-muted">
        Details come from HomeNest listings; EMIs are estimates, not lender offers. Please don&apos;t share personal details here.
      </p>
    </div>
  );
}
