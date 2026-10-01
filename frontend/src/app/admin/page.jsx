"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { StatCard } from "@/components/admin/StatCard";

export default function AdminDashboardPage() {
  const { user } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/v1/admin/dashboard")
      .then((data) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  };

  const firstName = user?.name?.split(" ")[0] ?? "admin";

  // Show a dash instead of a misleading 0 while loading or after a failed load.
  const stat = (key) => (stats ? stats[key] : loading ? "…" : "-");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Live counts for the site and what needs your attention.
        </p>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
          <span>Could not load dashboard stats: {error}</span>
          <button type="button" onClick={retry} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published listings" value={stat("publishedListings")} />
        <StatCard label="Featured on home page" value={stat("featuredListings")} hint="Up to 8 shown" />
        <StatCard label="Awaiting verification" value={stat("awaitingVerification")} />
        <StatCard label="Popular locations" value={stat("popularLocations")} hint="Needs 5+ active listings" />
        <StatCard label="Published projects" value={stat("publishedProjects")} hint="Up to 4 shown, most recent first" />
        <StatCard label="Published insights" value={stat("publishedArticles")} hint="Up to 3 shown, most recent first" />
        <StatCard label="Open reports" value={stat("openReports")} hint="Flagged listings to review" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/admin/listings" label="Manage listings" description="Verify, feature, and reorder" />
        <QuickLink href="/admin/locations" label="Manage locations" description="Flag popular cities" />
        <QuickLink href="/admin/projects" label="Manage projects" description="Publish or unpublish" />
        <QuickLink href="/admin/articles" label="Manage insights" description="Publish or unpublish" />
        <QuickLink href="/admin/reports" label="Review reports" description="Flagged listings" />
      </div>
    </div>
  );
}

function QuickLink({ href, label, description }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-primary-light"
    >
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </Link>
  );
}