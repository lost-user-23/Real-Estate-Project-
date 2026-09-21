"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MOCK_PROPERTIES } from "@/lib/mockData";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { formatPrice } from "@/lib/format";
import { PropertyCard } from "@/components/home/PropertyCard";
import { Container } from "@/components/ui/Container";

export function SearchResults() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const city = searchParams.get("city");
  const locality = searchParams.get("locality");
  const propertyType = searchParams.get("propertyType");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const results = useMemo(() => {
    return MOCK_PROPERTIES.filter((p) => {
      if (p.status !== "published") return false;
      if (intent && p.intent !== intent) return false;
      if (city && p.city.toLowerCase() !== city.toLowerCase()) return false;
      if (locality && p.locality.toLowerCase() !== locality.toLowerCase()) return false;
      if (propertyType && p.propertyType !== propertyType) return false;
      if (minPrice && p.priceInRupees < Number(minPrice)) return false;
      if (maxPrice && p.priceInRupees > Number(maxPrice)) return false;
      return true;
    });
  }, [intent, city, locality, propertyType, minPrice, maxPrice]);

  const locationLabel = locality || city;
  const heading = [
    intent === "rent" ? "Rentals" : intent === "buy" ? "Properties for sale" : "Properties",
    propertyType ? PROPERTY_TYPE_LABELS[propertyType] : null,
    locationLabel ? `in ${locationLabel}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const activeFilters = [
    city ? { label: locality ? `${locality}, ${city}` : city, param: "city" } : null,
    propertyType ? { label: PROPERTY_TYPE_LABELS[propertyType] ?? propertyType, param: "propertyType" } : null,
    minPrice || maxPrice
      ? {
          label: `${minPrice ? formatPrice(Number(minPrice)) : "Any"} – ${
            maxPrice ? formatPrice(Number(maxPrice)) : "Any"
          }`,
          param: "price",
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="py-8 sm:py-12">
      <Container>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading || "All properties"}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-text-muted">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          {activeFilters.map((filter) => (
            <span
              key={filter.param}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted"
            >
              {filter.label}
            </span>
          ))}
          {activeFilters.length > 0 || intent ? (
            <Link href="/search" className="text-xs font-medium text-primary hover:underline">
              Clear filters
            </Link>
          ) : null}
        </div>

        {results.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-medium">No properties match these filters.</p>
            <p className="mt-1 text-sm text-text-muted">Try a different location, or clear a filter above.</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((property) => (
              <PropertyCard key={property.id} property={property} fluid />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
