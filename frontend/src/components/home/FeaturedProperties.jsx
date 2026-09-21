"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFeaturedProperties } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { SkeletonGrid } from "@/components/ui/SkeletonGrid";
import { SectionError } from "@/components/ui/SectionError";
import { Carousel } from "@/components/ui/Carousel";
import { PropertyCard } from "@/components/home/PropertyCard";

export function FeaturedProperties() {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get("debugError") === "featured";
  const fetcher = useCallback(() => fetchFeaturedProperties(simulateError), [simulateError]);
  const { status, data, retry } = useSectionData(fetcher);

  if (status === "success" && data && data.length === 0) return null;

  return (
    <Section id="featured" title="Featured properties" subtitle="Reviewed listings, picked by our team.">
      {status === "loading" && <SkeletonGrid count={8} />}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && data ? (
        <Carousel label="Featured properties">
          {data.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              onView={() => trackEvent("featured_card_click", { propertyId: property.id, position: index })}
            />
          ))}
        </Carousel>
      ) : null}
    </Section>
  );
}
