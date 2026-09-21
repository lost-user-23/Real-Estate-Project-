"use client";

import Image from "next/image";
import Link from "next/link";
import { formatArea, formatPrice } from "@/lib/format";
import { topAmenities } from "@/lib/amenities";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { useSavedProperties } from "@/lib/saved-properties-context";
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
      className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md ${
        fluid ? "w-full" : "w-[85vw] shrink-0 snap-start sm:w-auto sm:shrink"
      }`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-bg">
        <Image
          src={property.image.src}
          alt={property.image.alt}
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 22vw"
          className="object-cover"
          loading={priority ? "eager" : "lazy"}
          priority={priority}
        />

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
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-text shadow-sm transition-colors hover:bg-white"
        >
          {saved ? <HeartFilledIcon className="h-5 w-5 text-danger" /> : <HeartIcon className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-lg font-semibold">
          {formatPrice(property.priceInRupees)}
          {property.intent === "rent" ? <span className="text-sm font-normal text-text-muted">/mo</span> : null}
        </p>
        <p className="text-sm text-text">
          {typeLabel} &middot; {formatArea(property.areaSqft)}
        </p>
        <p className="flex items-center gap-1 text-sm text-text-muted">
          <MapPinIcon className="h-4 w-4 shrink-0" />
          {property.locality}, {property.city}
        </p>

        {amenities.length ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {amenities.map((amenity) => (
              <li key={amenity} className="rounded-full bg-bg px-2.5 py-1 text-xs text-text-muted">
                {amenity}
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          href={`/property/${property.slug}`}
          onClick={() => onView?.(property)}
          className="mt-3 inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
