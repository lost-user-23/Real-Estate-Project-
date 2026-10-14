"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchPopularLocations } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionError } from "@/components/ui/SectionError";

export function PopularLocations() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "locations";
  const fetcher = useCallback(() => fetchPopularLocations(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "success" && data && data.length === 0) return null;

  return (
    <Section id="locations" title="Popular locations" subtitle="Browse listings by the areas people search most." tone="surface">
      {status === "loading" && <SkeletonGrid count={10} />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((location) => (
            <Link
              key={location.id}
              href={`/search?city=${encodeURIComponent(location.city)}`}
              onClick={() => trackEvent("location_tile_click", { city: location.city })}
              className="group relative aspect-4/3 overflow-hidden rounded-3xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20"
            >
              <SafeImage
                src={location.image.src}
                alt={location.image.alt}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                loading="lazy"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-lg font-bold">{location.city}</p>
                <p className="mt-0.5 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium backdrop-blur">{location.activeListingCount.toLocaleString("en-IN")} listings</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
