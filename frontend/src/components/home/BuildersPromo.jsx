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
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[2rem] bg-linear-to-br from-ink to-ink-soft px-6 py-8 text-white shadow-xl shadow-ink/20 sm:flex-row sm:gap-8 sm:px-10 sm:py-10">
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-10 h-60 w-60 rounded-full bg-primary/40 blur-3xl" />
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-dark text-accent-ink shadow-lg shadow-accent/30">
          <BuildingIcon className="h-9 w-9" />
        </span>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-xl font-bold sm:text-2xl">Explore builders &amp; developers</p>
          <p className="mt-1 text-sm text-white/75">
            {city
              ? `See the most active builders in ${city}, and browse every listed project by builder and brand.`
              : "See the most active builders near you, and browse every listed project by builder and brand."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/builders#popular"
            onClick={() => trackEvent("builders_promo_popular_click", { city })}
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-ink"
          >
            {city ? `Popular builders in ${city}` : "Popular builders"}
          </Link>
          <Link
            href="/builders#all"
            onClick={() => trackEvent("builders_promo_all_click", { city })}
            className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-all hover:-translate-y-0.5 hover:bg-white"
          >
            View all by builder
          </Link>
        </div>
      </div>
    </Section>
  );
}
