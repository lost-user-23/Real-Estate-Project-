"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatArea, formatPrice } from "@/lib/format";
import { topAmenities } from "@/lib/amenities";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { useSavedProperties } from "@/lib/saved-properties-context";
import { SafeImage } from "@/components/ui/SafeImage";
import {
  CheckBadgeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartFilledIcon,
  HeartIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  StarIcon,
} from "@/components/icons";

const AUTO_ADVANCE_MS = 5500;

// A single large "top pick" panel with a thumbnail rail, rather than a grid
// of cards - up to 5 featured properties (PRD §4 caps at 8, this view is
// intentionally narrower since only one is shown at a time).
export function FeaturedShowcase({ properties, onView }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotionRef = useRef(false);
  const { isSaved, toggleSave } = useSavedProperties();

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotionRef.current) setPaused(true);
  }, []);

  useEffect(() => {
    if (paused || properties.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % properties.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [paused, properties.length]);

  const goTo = useCallback(
    (next) => setIndex((next + properties.length) % properties.length),
    [properties.length]
  );

  // Derived rather than clamped via an effect: if the list shrinks (e.g. a
  // city filter change) this still resolves to a valid item on the very
  // next render, with no extra render pass.
  const safeIndex = properties.length > 0 ? index % properties.length : 0;
  const property = properties[safeIndex];
  if (!property) return null;

  const saved = isSaved(property.id);
  const amenities = topAmenities(property.amenities, 3);
  const typeLabel = property.bhk
    ? `${property.bhk} BHK ${PROPERTY_TYPE_LABELS[property.propertyType]}`
    : PROPERTY_TYPE_LABELS[property.propertyType];

  return (
    <div>
      {properties.length > 1 ? (
        <div className="mb-4 flex items-center gap-3 overflow-x-auto pb-1">
          {properties.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === safeIndex}
              aria-label={`Show ${p.title}`}
              className={`group flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors ${
                i === safeIndex ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/50"
              }`}
            >
              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg">
                <SafeImage src={p.image.src} alt="" fallbackSeed={p.id} fill sizes="32px" className="object-cover" />
              </span>
              <span className={`max-w-32 truncate font-medium ${i === safeIndex ? "text-primary" : "text-text"}`}>
                {p.city}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid overflow-hidden rounded-3xl border border-border bg-surface lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col justify-between gap-6 bg-linear-to-br from-primary to-primary-dark p-6 text-white sm:p-8">
          <div>
            <div className="flex items-center gap-1.5">
              {property.featured ? (
                <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">
                  <StarIcon className="h-3.5 w-3.5" />
                  Featured
                </span>
              ) : null}
              {property.verified ? (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                  <CheckBadgeIcon className="h-3.5 w-3.5" />
                  Verified
                </span>
              ) : null}
            </div>

            <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">{property.title}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
              <MapPinIcon className="h-4 w-4 shrink-0" />
              {property.locality}, {property.city}
            </p>

            <p className="mt-5 text-2xl font-bold sm:text-3xl">
              {formatPrice(property.priceInRupees)}
              {property.intent === "rent" ? <span className="text-base font-normal text-white/80">/mo</span> : null}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {typeLabel} &middot; {formatArea(property.areaSqft)}
            </p>

            {amenities.length ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {amenities.map((amenity) => (
                  <li key={amenity} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">
                    {amenity}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/property/${property.slug}`}
              onClick={() => onView?.(property, safeIndex)}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-dark"
            >
              View details
            </Link>
            <button
              type="button"
              aria-label={saved ? "Remove from saved properties" : "Save property"}
              aria-pressed={saved}
              onClick={() => toggleSave(property.id)}
              className="rounded-full bg-white/15 p-2.5 transition-colors hover:bg-white/25"
            >
              {saved ? <HeartFilledIcon className="h-5 w-5 text-accent" /> : <HeartIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="relative aspect-4/3 w-full overflow-hidden bg-bg lg:aspect-auto">
          <SafeImage
            key={property.id}
            src={property.image.src}
            alt={property.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
            loading="lazy"
          />

          {properties.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous featured property"
                onClick={() => goTo(safeIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/45"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next featured property"
                onClick={() => goTo(safeIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/45"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label={paused ? "Resume auto-advancing" : "Pause auto-advancing"}
                aria-pressed={paused}
                onClick={() => setPaused((v) => !v)}
                className="absolute right-3 top-3 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/45"
              >
                {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
