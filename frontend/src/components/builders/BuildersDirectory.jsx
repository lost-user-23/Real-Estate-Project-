"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchBuilderDetails, fetchBuilders } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { useCity } from "@/lib/city-context";
import { formatPrice } from "@/lib/format";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SectionError } from "@/components/ui/SectionError";
import { BuildingIcon } from "@/components/icons";

const POPULAR_COUNT = 6;

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function BuilderProjects({ builder, city, simulateError }) {
  const fetcher = useCallback(
    () => fetchBuilderDetails(builder.slug, city, simulateError),
    [builder.slug, city, simulateError]
  );
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "loading") return <SkeletonGrid count={4} />;
  if (status === "error") return <SectionError onRetry={retry} />;
  if (!data.projects.length) return <p className="text-sm text-text-muted">No projects to show yet.</p>;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.projects.map((project) => (
        <Link
          key={project.id}
          href={`/project/${project.id}`}
          onClick={() => trackEvent("builder_project_click", { builder: builder.name, projectId: project.id })}
          className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-bg transition-shadow hover:shadow-md"
        >
          <div className="relative aspect-4/3 w-full overflow-hidden bg-surface">
            <Image
              src={project.image.src}
              alt={project.image.alt}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <p className="truncate font-medium">{project.name}</p>
            <p className="text-sm text-text-muted">
              {project.locality}, {project.city}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              From {formatPrice(project.startingPriceInRupees)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function BuildersDirectory() {
  const searchParams = useSearchParams();
  const { city } = useCity();
  const simulateError = searchParams.get("debugError") === "builders";
  const [selectedSlug, setSelectedSlug] = useState(null);
  const fetcher = useCallback(() => fetchBuilders(city, simulateError), [city, simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  const all = data?.builders ?? [];
  const popular = all.slice(0, POPULAR_COUNT);
  const scopedToAll = Boolean(city) && data?.scope === "national";

  return (
    <>
      <Section
        id="popular"
        title={city ? `Popular builders in ${city}` : "Popular builders"}
        subtitle={
          scopedToAll
            ? `No builders active in ${city} yet. Showing top builders nationwide.`
            : "The developers with the most active projects, ranked by project count."
        }
      >
        {status === "loading" && <SkeletonGrid count={POPULAR_COUNT} />}
        {status === "error" && <SectionError onRetry={retry} />}
        {status === "success" && popular.length === 0 ? (
          <p className="text-sm text-text-muted">No builders to show yet.</p>
        ) : null}
        {status === "success" && popular.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((builder) => (
              <a
                key={builder.name}
                href={`#builder-${builder.slug}`}
                onClick={() => {
                  setSelectedSlug(builder.slug);
                  trackEvent("popular_builder_click", { builder: builder.name, city });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
                  {initials(builder.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{builder.name}</span>
                  <span className="block text-sm text-text-muted">
                    {builder.publishedProjectCount} project{builder.publishedProjectCount === 1 ? "" : "s"}
                    {city ? "" : ` · ${builder.city}`}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </Section>

      <Section
        id="all"
        title="All properties by builder"
        subtitle={
          city
            ? `Every listed project in ${city}, grouped by builder and brand.`
            : "Every listed project nationwide, grouped by builder and brand."
        }
        tone="surface"
      >
        {status === "loading" && <SkeletonGrid count={4} />}
        {status === "error" && <SectionError onRetry={retry} />}
        {status === "success" && all.length === 0 ? (
          <p className="text-sm text-text-muted">No projects to show yet.</p>
        ) : null}
        {status === "success" && all.length > 0 ? (
          <div className="flex flex-col gap-8">
            {all.map((builder) => (
              <div key={builder.slug} id={`builder-${builder.slug}`} className="scroll-mt-24">
                <div className="mb-3 flex items-center gap-2">
                  <BuildingIcon className="h-5 w-5 shrink-0 text-primary" />
                  <h3 className="text-lg font-semibold">{builder.name}</h3>
                  <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-text-muted">
                    {builder.publishedProjectCount} project{builder.publishedProjectCount === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    aria-expanded={selectedSlug === builder.slug}
                    onClick={() => setSelectedSlug(selectedSlug === builder.slug ? null : builder.slug)}
                    className="ml-auto rounded-full border border-border px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-surface"
                  >
                    {selectedSlug === builder.slug ? "Hide projects" : "Show projects"}
                  </button>
                </div>
                {selectedSlug === builder.slug ? (
                  <BuilderProjects
                    builder={builder}
                    city={data.scope === "city" ? city : undefined}
                    simulateError={simulateError}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Section>
    </>
  );
}
