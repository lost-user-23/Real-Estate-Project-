"use client";

import Link from "next/link";
import { useAdminStore } from "@/lib/admin-store";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { StatCard } from "@/components/admin/StatCard";

export default function AdminDashboardPage() {
  const { properties, locations, projects, articles } = useAdminStore();
  const { profile } = useAdminAuth();

  const publishedProperties = properties.filter((p) => p.status === "published");
  const featuredCount = publishedProperties.filter((p) => p.featured).length;
  const unverifiedCount = publishedProperties.filter((p) => !p.verified).length;
  const popularLocationsCount = locations.filter((l) => l.popular && l.activeListingCount >= 5).length;
  const publishedProjects = projects.filter((p) => p.status === "published").length;
  const publishedArticles = articles.filter((a) => a.status === "published").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {profile.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-text-muted">
          What&apos;s currently driving the home page sections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published listings" value={publishedProperties.length} />
        <StatCard label="Featured on home page" value={featuredCount} hint="Up to 8 shown" />
        <StatCard label="Awaiting verification" value={unverifiedCount} />
        <StatCard label="Popular locations" value={popularLocationsCount} hint="Needs 5+ active listings" />
        <StatCard label="Published projects" value={publishedProjects} hint="Up to 4 shown, most recent first" />
        <StatCard label="Published insights" value={publishedArticles} hint="Up to 3 shown, most recent first" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/admin/listings" label="Manage listings" description="Verify, feature, and reorder" />
        <QuickLink href="/admin/locations" label="Manage locations" description="Flag popular cities" />
        <QuickLink href="/admin/projects" label="Manage projects" description="Publish or unpublish" />
        <QuickLink href="/admin/articles" label="Manage insights" description="Publish or unpublish" />
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
