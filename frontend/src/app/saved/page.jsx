"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { normalizeProperty } from "@/lib/dataSource";
import { PageShell } from "@/components/layout/PageShell";
import { PropertyCard } from "@/components/home/PropertyCard";
import { Container } from "@/components/ui/Container";

const PAGE_SIZE = 20;
const LOADING_STATE = { status: "loading", properties: [], error: "", page: 0, meta: null };

export default function SavedPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const [state, setState] = useState(LOADING_STATE);
  const [retryCount, setRetryCount] = useState(0);
  const [more, setMore] = useState({ loading: false, error: "" });

  useEffect(() => {
    if (authLoading || !isLoggedIn) return undefined;
    let cancelled = false;

    // Deferred a tick so the state updates don't run synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setState(LOADING_STATE);
        setMore({ loading: false, error: "" });
        return api.get(`/api/v1/saved-properties?page=1&limit=${PAGE_SIZE}`);
      })
      .then((result) => {
        if (!result || cancelled) return;
        setState({
          status: "success",
          properties: (result.properties ?? []).map(normalizeProperty),
          error: "",
          page: 1,
          meta: result.meta ?? null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ ...LOADING_STATE, status: "error", error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn, retryCount]);

  async function loadMore() {
    if (more.loading) return;
    const nextPage = state.page + 1;
    setMore({ loading: true, error: "" });
    try {
      const result = await api.get(`/api/v1/saved-properties?page=${nextPage}&limit=${PAGE_SIZE}`);
      const added = (result.properties ?? []).map(normalizeProperty);
      setState((prev) => {
        const seen = new Set(prev.properties.map((property) => property.id));
        return {
          ...prev,
          properties: [...prev.properties, ...added.filter((property) => !seen.has(property.id))],
          page: nextPage,
          meta: result.meta ?? prev.meta,
        };
      });
      setMore({ loading: false, error: "" });
    } catch (error) {
      setMore({ loading: false, error: error.message });
    }
  }

  const hasMore = Boolean(state.meta) && state.page < state.meta.totalPages;

  let body;
  if (authLoading || (isLoggedIn && state.status === "loading")) {
    body = (
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading saved properties">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    );
  } else if (!isLoggedIn) {
    body = (
      <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
        <p className="font-medium">Log in to see your saved properties.</p>
        <button
          type="button"
          onClick={() => requestLogin()}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Log in
        </button>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div role="alert" className="mt-10 rounded-2xl border border-danger/30 bg-surface p-10 text-center">
        <p className="font-medium">We couldn&apos;t load your saved properties.</p>
        <p className="mt-1 text-sm text-text-muted">{state.error}</p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Try again
        </button>
      </div>
    );
  } else if (state.properties.length === 0) {
    body = (
      <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
        <p className="font-medium">You haven&apos;t saved any properties yet.</p>
        <p className="mt-1 text-sm text-text-muted">Tap the heart on a listing to keep it here.</p>
        <Link
          href="/search"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Browse properties
        </Link>
      </div>
    );
  } else {
    // Un-hearting a card does not drop it from this list; it is gone on the next load.
    body = (
      <>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.properties.map((property) => (
            <PropertyCard key={property.id} property={property} fluid />
          ))}
        </div>
        {hasMore && (
          <div className="mt-8 text-center">
            {more.error && (
              <p role="alert" className="mb-3 text-sm text-danger">
                We couldn&apos;t load more properties. {more.error}
              </p>
            )}
            <button
              type="button"
              onClick={loadMore}
              disabled={more.loading}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {more.loading ? "Loading…" : more.error ? "Try again" : "Load more"}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <PageShell>
      <div className="py-8 sm:py-12">
        <Container>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Saved properties</h1>
          {body}
        </Container>
      </div>
    </PageShell>
  );
}
