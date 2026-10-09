"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { BUDGET_PRESETS } from "@/lib/budgetPresets";
import { addRecentSearch } from "@/lib/recentSearches";
import { trackEvent } from "@/lib/trackEvent";
import { useAuth } from "@/lib/auth-context";
import { SearchBar } from "@/components/home/SearchBar";
import { RecentSearches } from "@/components/home/RecentSearches";
import { HeroSlider } from "@/components/home/HeroSlider";
import { PostPropertyButton } from "@/components/PostPropertyButton";

const TABS = [
  { id: "buy", label: "Buy" },
  { id: "rent", label: "Rent" },
  { id: "sell", label: "Sell" },
];

function locationLabel(location) {
  if (!location) return "";
  return location.locality ? `${location.locality}, ${location.city}` : location.city;
}

export function Hero() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [tab, setTab] = useState("buy");
  const [searchValue, setSearchValue] = useState({
    location: null,
    propertyType: "all",
    budgetPresetId: null,
    bhk: "",
  });

  const handleTabChange = (next) => {
    setTab(next);
    if (next === "sell") return;
    const validTypes = PROPERTY_TYPE_OPTIONS_BY_INTENT[next];
    setSearchValue((prev) => ({
      ...prev,
      propertyType: validTypes.includes(prev.propertyType) ? prev.propertyType : "all",
      budgetPresetId: null,
    }));
  };

  const submitSearch = (value, intent, fromRecentSearch) => {
    if (!value.location) return;
    const preset = BUDGET_PRESETS[intent].find((p) => p.id === value.budgetPresetId);
    const params = new URLSearchParams();
    params.set("intent", intent);
    params.set("city", value.location.city);
    if (value.location.locality) params.set("locality", value.location.locality);
    if (value.propertyType !== "all") params.set("propertyType", value.propertyType);
    if (value.bhk) params.set("bhk", value.bhk);
    if (preset) {
      params.set("minPrice", String(preset.min));
      if (preset.max !== null) params.set("maxPrice", String(preset.max));
    }

    addRecentSearch({
      intent,
      city: value.location.city,
      locality: value.location.locality,
      label: locationLabel(value.location),
    });

    trackEvent("hero_search_submit", {
      intent,
      location: locationLabel(value.location),
      fromRecentSearch,
    });

    router.push(`/search?${params.toString()}`);
  };

  const handleRecentSearchSelect = (search) => {
    const value = {
      location: { city: search.city, locality: search.locality },
      propertyType: "all",
      budgetPresetId: null,
      bhk: "",
    };
    setTab(search.intent);
    setSearchValue(value);
    submitSearch(value, search.intent, true);
  };

  const sellPrefill = useMemo(
    () => ({
      city: searchValue.location?.city,
      propertyType: searchValue.propertyType !== "all" ? searchValue.propertyType : undefined,
    }),
    [searchValue]
  );

  return (
    <section className="relative -mt-16 flex min-h-120 items-center pt-28 pb-12 sm:min-h-150 sm:pt-32 sm:pb-20">
      <HeroSlider />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Find the right place, without the noise.
          </h1>
          <p className="mt-4 text-base text-white/90 sm:text-lg">
            Search reviewed listings for sale and rent, and contact owners and agents directly.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <div role="tablist" aria-label="Search intent" className="mb-4 flex justify-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => handleTabChange(t.id)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-primary text-white" : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sell" ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
              <p className="text-text-muted">List your property and reach interested buyers and tenants.</p>
              <div className="mt-4 flex justify-center">
                <PostPropertyButton source="sell_tab" prefill={sellPrefill} />
              </div>
              {!isLoggedIn ? (
                <p className="mt-3 text-xs text-text-muted">
                  You&apos;ll need to log in or create a free account to post a property.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <SearchBar
                intent={tab}
                value={searchValue}
                onChange={setSearchValue}
                onSubmit={(value) => submitSearch(value, tab, false)}
              />
              <RecentSearches onSelect={handleRecentSearchSelect} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
