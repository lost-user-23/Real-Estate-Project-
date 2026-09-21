"use client";

import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchNewProjects } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SectionError } from "@/components/ui/SectionError";

export function NewProjects() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "projects";
  const fetcher = useCallback(() => fetchNewProjects(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "success" && data && data.length === 0) return null;

  return (
    <Section id="new-projects" title="New projects" subtitle="Recently launched developments worth a look." tone="surface">
      {status === "loading" && <SkeletonGrid count={4} />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-4/3 w-full overflow-hidden bg-bg">
                <Image
                  src={project.image.src}
                  alt={project.image.alt}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="font-semibold">{project.name}</p>
                <p className="text-sm text-text-muted">{project.developer}</p>
                <p className="text-sm text-text-muted">
                  {project.locality}, {project.city}
                </p>
                <p className="mt-2 text-sm font-medium text-primary">
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
