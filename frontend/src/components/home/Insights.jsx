"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchInsights } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { formatDate } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionError } from "@/components/ui/SectionError";

export function Insights() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "insights";
  const fetcher = useCallback(() => fetchInsights(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "success" && data && data.length === 0) return null;

  return (
    <Section id="insights" title="Insights" subtitle="Useful reading before your next move.">
      {status === "loading" && <SkeletonGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.map((article) => (
            <Link
              key={article.id}
              href={`/insights/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/15"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-bg">
                <SafeImage
                  src={article.image.src}
                  alt={article.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 30vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs text-text-muted">{formatDate(article.publishedAt)}</p>
                <p className="text-lg font-bold leading-snug transition-colors group-hover:text-primary">{article.title}</p>
                <p className="text-sm text-text-muted">{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
