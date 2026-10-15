"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchInsights } from "@/lib/dataSource";
import { ARTICLE_TYPES, ARTICLE_TYPE_PLURALS } from "@/lib/articleTypes";
import { useSectionData } from "@/lib/useSectionData";
import { formatDate } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionError } from "@/components/ui/SectionError";

export function Insights() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "insights";
  const [type, setType] = useState("");
  const fetcher = useCallback(() => fetchInsights(type, simulateError), [type, simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  return (
    <Section id="insights" title="Insights" subtitle="Useful reading before your next move.">
      <div role="tablist" aria-label="Insights type" className="mb-4 flex gap-2">
        {["", ...ARTICLE_TYPES].map((t) => (
          <button
            key={t || "all"}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              type === t ? "bg-primary text-white" : "border border-border bg-surface text-text-muted hover:text-text"
            }`}
          >
            {t ? ARTICLE_TYPE_PLURALS[t] : "All"}
          </button>
        ))}
      </div>
      {status === "success" && data && data.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nothing {type ? `in ${ARTICLE_TYPE_PLURALS[type].toLowerCase()} ` : ""}published yet.
        </p>
      ) : null}
      {status === "loading" && <SkeletonGrid count={3} className="sm:grid-cols-3 lg:grid-cols-3" />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data && data.length > 0 ? (
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
