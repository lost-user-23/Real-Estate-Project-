"use client";

import Link from "next/link";
import { formatArea, formatPrice } from "@/lib/format";
import { topAmenities } from "@/lib/amenities";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { useSavedProperties } from "@/lib/saved-properties-context";
import { SafeImage } from "@/components/ui/SafeImage";
import { HeartFilledIcon, HeartIcon, CheckBadgeIcon, MapPinIcon, StarIcon } from "@/components/icons";

export function PropertyCard({ property, priority = false, onView, fluid = false }) {
  const { isSaved, toggleSave } = useSavedProperties();
  const saved = isSaved(property.id);
  const amenities = topAmenities(property.amenities, 3);
  const typeLabel = property.bhk
    ? `${property.bhk} BHK ${PROPERTY_TYPE_LABELS[property.propertyType]}`
    : PROPERTY_TYPE_LABELS[property.propertyType];

  return (
    <article
      data-carousel-item={fluid ? undefined : true}
      className={`group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/15 ${
        fluid ? "w-full" : "w-[85vw] shrink-0 snap-start sm:w-auto sm:shrink"
      }`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-bg">
        <SafeImage
          src={property.image.src}
          alt={property.image.alt}
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 22vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          loading={priority ? "eager" : "lazy"}
          priority={priority}
        />

        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/60 to-transparent" />
        <p className="absolute bottom-3 left-4 text-xl font-bold text-white drop-shadow">
          {formatPrice(property.priceInRupees)}
          {property.intent === "rent" ? <span className="text-sm font-medium text-white/85">/mo</span> : null}
        </p>

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          {property.featured ? (
            <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">
              <StarIcon className="h-3.5 w-3.5" />
              Featured
              {property.verified ? <CheckBadgeIcon className="ml-0.5 h-3.5 w-3.5" aria-label="Verified" /> : null}
            </span>
          ) : property.verified ? (
            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
              <CheckBadgeIcon className="h-3.5 w-3.5" />
              Verified
            </span>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={saved ? "Remove from saved properties" : "Save property"}
          aria-pressed={saved}
          onClick={() => toggleSave(property.id)}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-text shadow-md backdrop-blur transition-all hover:scale-110 hover:bg-white"
        >
          {saved ? <HeartFilledIcon className="h-5 w-5 text-danger" /> : <HeartIcon className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-semibold text-text">
          {typeLabel} &middot; {formatArea(property.areaSqft)}
        </p>
        <p className="flex items-center gap-1 text-sm text-text-muted">
          <MapPinIcon className="h-4 w-4 shrink-0" />
          {property.locality}, {property.city}
        </p>

        {amenities.length ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {amenities.map((amenity) => (
              <li key={amenity} className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark">
                {amenity}
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href={`/property/${property.slug}`}
          onClick={() => onView?.(property)}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
