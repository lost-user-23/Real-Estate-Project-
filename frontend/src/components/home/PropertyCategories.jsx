"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchCategories } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { SectionError } from "@/components/ui/SectionError";

const ICONS = {
  building: BuildingGlyph,
  home: HomeGlyph,
  house: HouseGlyph,
  map: MapGlyph,
  bed: BedGlyph,
  briefcase: BriefcaseGlyph,
};

export function PropertyCategories() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "categories";
  const fetcher = useCallback(() => fetchCategories(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "success" && data && data.length === 0) return null;

  return (
    <Section id="categories" title="Property categories" subtitle="Jump straight to the type of place you're after.">
      {status === "loading" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      )}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {data.map((category) => {
            const Glyph = ICONS[category.icon] ?? BuildingGlyph;
            return (
              <Link
                key={category.id}
                href={`/search?propertyType=${category.slug}`}
                onClick={() => trackEvent("category_tile_click", { category: category.slug })}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-center transition-colors hover:border-primary hover:bg-primary-light"
              >
                <Glyph className="h-7 w-7 text-primary" aria-hidden />
                <p className="text-sm font-medium">{category.name}</p>
                <p className="text-xs text-text-muted">{category.listingCount.toLocaleString("en-IN")}</p>
              </Link>
            );
          })}
        </div>
      ) : null}
    </Section>
  );
}

function glyphBase(props) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  };
}

function BuildingGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
    </svg>
  );
}

function HomeGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
    </svg>
  );
}

function HouseGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

function MapGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function BedGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 21v-3M21 21v-3" />
      <path d="M3 13V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

function BriefcaseGlyph(props) {
  return (
    <svg {...glyphBase(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
