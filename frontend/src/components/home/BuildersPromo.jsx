"use client";

import Link from "next/link";
import { useCity } from "@/lib/city-context";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { BuildingIcon } from "@/components/icons";

export function BuildersPromo() {
  const { city } = useCity();

  return (
    <Section id="builders-promo" title="Looking for a trusted builder?">
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border bg-surface px-6 py-8 sm:flex-row sm:gap-8 sm:px-10 sm:py-10">
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-dark text-white">
          <BuildingIcon className="h-9 w-9" />
        </span>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-lg font-semibold sm:text-xl">Explore builders &amp; developers</p>
          <p className="mt-1 text-sm text-text-muted">
            {city
              ? `See the most active builders in ${city}, and browse every listed project by builder and brand.`
              : "See the most active builders near you, and browse every listed project by builder and brand."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/builders#popular"
            onClick={() => trackEvent("builders_promo_popular_click", { city })}
            className="inline-flex items-center justify-center rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            {city ? `Popular builders in ${city}` : "Popular builders"}
          </Link>
          <Link
            href="/builders#all"
            onClick={() => trackEvent("builders_promo_all_click", { city })}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            View all by builder
          </Link>
        </div>
      </div>
    </Section>
  );
}
