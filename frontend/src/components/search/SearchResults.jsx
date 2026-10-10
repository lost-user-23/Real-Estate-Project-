"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { formatPrice } from "@/lib/format";
import { primaryImage } from "@/lib/propertyImages.mjs";
import { PropertyCard } from "@/components/home/PropertyCard";
import { Container } from "@/components/ui/Container";
import { SearchFilters, normalizeKeyword, parseBhkParam } from "@/components/search/SearchFilters";
import { lastPageRedirect } from "@/lib/pagination.mjs";

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "featured", label: "Featured first" },
  { value: "verified", label: "Verified first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSort = searchParams.get("sort");
  const sort = SORT_OPTIONS.some((o) => o.value === requestedSort) ? requestedSort : "newest";
  const intent = searchParams.get("intent");
  const city = searchParams.get("city");
  const locality = searchParams.get("locality");
  const propertyType = searchParams.get("propertyType");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const keyword = normalizeKeyword(searchParams.get("q"));
  const bhkParam = parseBhkParam(searchParams.get("bhk")).join(",");
  const requestedPage = Number(searchParams.get("page")) || 1;
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ intent, city, locality, propertyType, minPrice, maxPrice })) {
      if (value) params.set(key, value);
    }
    if (keyword) params.set("q", keyword);
    if (bhkParam) params.set("bhk", bhkParam);
    if (sort !== "newest") params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    return params.toString();
  }, [intent, city, locality, propertyType, minPrice, maxPrice, keyword, bhkParam, sort, page]);
  const [state, setState] = useState({ status: "loading", properties: [], meta: null, error: "" });
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${queryString}:${retryCount}`;
  const visibleState = state.requestKey === requestKey
    ? state
    : { status: "loading", properties: [], meta: null, error: "" };

  useEffect(() => {
    const controller = new AbortController();

    api.get(`/api/v1/properties?${queryString}`, { auth: false, signal: controller.signal })
      .then((result) => {
        const properties = (result?.properties ?? []).map((property) => ({
          ...property,
          id: String(property._id),
          image: primaryImage(property, property.slug),
        }));
        setState({ status: "success", properties, meta: result?.meta ?? null, error: "", requestKey });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ status: "error", properties: [], meta: null, error: error.message, requestKey });
      });

    return () => controller.abort();
  }, [queryString, retryCount, requestKey]);

  // A page past the end (old link, or filters that shrank the results) moves to the
  // last page instead of showing an empty state while results exist.
  const redirectPage = lastPageRedirect(page, visibleState.status === "success" ? visibleState.meta : null);
  useEffect(() => {
    if (!redirectPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(redirectPage));
    router.replace(`/search?${params.toString()}`);
  }, [redirectPage, router, searchParams]);

  const pageHref = (nextPage) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/search?${params.toString()}`;
  };

  const applyFilters = ({ keyword: nextKeyword, bhk }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextKeyword) params.set("q", nextKeyword);
    else params.delete("q");
    if (bhk.length > 0) params.set("bhk", bhk.join(","));
    else params.delete("bhk");
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  };

  const changeSort = (value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") params.delete("sort");
    else params.set("sort", value);
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  };

  const locationLabel = locality || city;
  const heading = [
    intent === "rent" ? "Rentals" : intent === "buy" ? "Properties for sale" : "Properties",
    propertyType ? PROPERTY_TYPE_LABELS[propertyType] : null,
    locationLabel ? `in ${locationLabel}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const activeFilters = [
    intent ? { label: intent === "rent" ? "For rent" : "For sale", param: "intent" } : null,
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
    keyword ? { label: `“${keyword}”`, param: "q" } : null,
    bhkParam ? { label: `${bhkParam.split(",").join(", ")} BHK`, param: "bhk" } : null,
  ].filter(Boolean);

  return (
    <div className="py-8 sm:py-12">
      <Container>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading || "All properties"}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-text-muted">
            {visibleState.status === "success"
              ? `${visibleState.meta?.total ?? visibleState.properties.length} result${visibleState.meta?.total === 1 ? "" : "s"}`
              : "Search results"}
          </p>
          {activeFilters.map((filter) => (
            <span
              key={filter.param}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted"
            >
              {filter.label}
            </span>
          ))}
          {activeFilters.length > 0 ? (
            <Link href="/search" className="text-xs font-medium text-primary hover:underline">
              Clear filters
            </Link>
          ) : null}
          <label className="ml-auto flex items-center gap-2 text-sm text-text-muted">
            Sort by
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SearchFilters
          key={`${keyword}|${bhkParam}`}
          initialKeyword={keyword}
          initialBhk={bhkParam ? bhkParam.split(",") : []}
          onApply={applyFilters}
        />

        {visibleState.status === "loading" ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading properties">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : visibleState.status === "error" ? (
          <div role="alert" className="mt-10 rounded-2xl border border-danger/30 bg-surface p-10 text-center">
            <p className="font-medium">We couldn&apos;t load properties.</p>
            <p className="mt-1 text-sm text-text-muted">{visibleState.error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Try again
            </button>
          </div>
        ) : visibleState.properties.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-medium">No properties match these filters.</p>
            <p className="mt-1 text-sm text-text-muted">
              {keyword || bhkParam
                ? "Try a shorter keyword, a different BHK, or clear the filters."
                : "Try a different location, or clear a filter above."}
            </p>
            <Link
              href={activeFilters.length > 0 ? "/search" : "/"}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              {activeFilters.length > 0 ? "Clear all filters" : "Back to home"}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleState.properties.map((property) => (
                <PropertyCard key={property.id} property={property} fluid />
              ))}
            </div>
            {visibleState.meta?.totalPages > 1 ? (
              <nav aria-label="Search result pages" className="mt-8 flex items-center justify-center gap-4">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
                    Previous
                  </Link>
                ) : null}
                <span className="text-sm text-text-muted">
                  Page {page} of {visibleState.meta.totalPages}
                </span>
                {page < visibleState.meta.totalPages ? (
                  <Link href={pageHref(page + 1)} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </Container>
    </div>
  );
}
