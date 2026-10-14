"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchNewProjects } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { useCity } from "@/lib/city-context";
import { isSameCity } from "@/lib/city";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionError } from "@/components/ui/SectionError";

export function NewProjects() {
  const searchParams = useSearchParams();
  const { city } = useCity();
  const simulateError = searchParams.get("debugError") === "projects";
  const fetcher = useCallback(() => fetchNewProjects(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  const { shown, scopedToAll } = useMemo(() => {
    if (!data) return { shown: [], scopedToAll: false };
    if (!city) return { shown: data, scopedToAll: false };
    const inCity = data.filter((p) => isSameCity(p.city, city));
    if (inCity.length > 0) return { shown: inCity, scopedToAll: false };
    return { shown: data, scopedToAll: true };
  }, [data, city]);

  if (status === "success" && shown.length === 0) return null;

  return (
    <Section
      id="new-projects"
      title="New projects"
      subtitle={
        scopedToAll
          ? `No new launches in ${city} yet. Showing recent launches nationwide.`
          : "Recently launched developments worth a look."
      }
      tone="surface"
    >
      {status === "loading" && <SkeletonGrid count={4} />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && shown.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-bg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/15"
            >
              <div className="relative aspect-4/3 w-full overflow-hidden bg-bg">
                <SafeImage
                  src={project.image.src}
                  alt={project.image.alt}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="font-semibold">{project.name}</p>
                <p className="text-sm text-text-muted">{project.developer}</p>
                <p className="text-sm text-text-muted">
                  {project.locality}, {project.city}
                </p>
                <p className="mt-2 text-sm font-bold text-primary">
                  From {formatPrice(project.startingPriceInRupees)}
                </p>
                <p className="text-xs text-text-muted">Possession: {project.possessionLabel}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
