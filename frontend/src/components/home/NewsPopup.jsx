"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchInsights } from "@/lib/dataSource";

const SEEN_KEY = "homenest_seen_news";

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(id) {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {}
}

// Pops the latest published news item up once per visitor, until newer news is published.
export function NewsPopup() {
  const [news, setNews] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchInsights("news", false, 1)
      .then(([latest]) => {
        if (!cancelled && latest && readSeen() !== latest.id) setNews(latest);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!news) return null;

  const dismiss = () => {
    writeSeen(news.id);
    setNews(null);
  };

  return (
    <aside
      role="status"
      aria-label="Latest news"
      className="fixed bottom-4 right-4 z-60 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss news notification"
        className="absolute right-3 top-2 text-lg leading-none text-text-muted hover:text-text"
      >
        ×
      </button>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Latest news</p>
      <p className="mt-1 pr-5 font-bold leading-snug">{news.title}</p>
      {news.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-text-muted">{news.excerpt}</p> : null}
      <Link
        href={`/insights/${news.slug}`}
        onClick={dismiss}
        className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
      >
        Read more
      </Link>
    </aside>
  );
}
