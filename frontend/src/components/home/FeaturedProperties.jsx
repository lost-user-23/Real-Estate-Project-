"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFeaturedProperties } from "@/lib/dataSource";
import { useSectionData } from "@/lib/useSectionData";
import { useCity } from "@/lib/city-context";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { SectionError } from "@/components/ui/SectionError";
import { FeaturedShowcase } from "@/components/home/FeaturedShowcase";

const MAX_SHOWN = 5;

export function FeaturedProperties() {
  const searchParams = useSearchParams();
  const { city } = useCity();
  const simulateError = searchParams.get("debugError") === "featured";
  const fetcher = useCallback(
    () => fetchFeaturedProperties(city, MAX_SHOWN, simulateError),
    [city, simulateError]
  );
  const { status, data, retry } = useSectionData(fetcher);

  const shown = data?.properties ?? [];
  const scopedToAll = Boolean(city) && data?.scope === "national";

  if (status === "success" && shown.length === 0) return null;

  return (
    <Section
      id="featured"
      title="Featured properties"
      subtitle={
        scopedToAll
          ? `No featured picks in ${city} yet. Showing nationwide picks.`
          : city
            ? `Reviewed listings in ${city}, picked by our team.`
            : "Reviewed listings, picked by our team."
      }
    >
      {status === "loading" && (
        <div className="h-96 animate-pulse rounded-3xl border border-border bg-surface" />
      )}
      {status === "error" && <SectionError onRetry={retry} />}
      {status === "success" && shown.length ? (
        <FeaturedShowcase
          properties={shown}
          onView={(property, position) => trackEvent("featured_card_click", { propertyId: property.id, position })}
        />
      ) : null}
    </Section>
  );
}
