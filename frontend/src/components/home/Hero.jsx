"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { BUDGET_PRESETS } from "@/lib/budgetPresets";
import { addRecentSearch } from "@/lib/recentSearches";
import { trackEvent } from "@/lib/trackEvent";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { HERO_DECORATIONS } from "@/lib/heroDecorations";
import { SearchBar } from "@/components/home/SearchBar";
import { RecentSearches } from "@/components/home/RecentSearches";
import { HeroSlider } from "@/components/home/HeroSlider";
import { HeroDecoration } from "@/components/home/HeroDecoration";
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

// Built-in copy, used for any field the admin has left blank (and if the settings can't be loaded).
const DEFAULT_COPY = {
  badge: "Reviewed listings · Direct owner contact",
  titleLead: "Find the right place,",
  titleAccent: "without the noise.",
  subtitle: "Search reviewed listings for sale and rent, and contact owners and agents directly.",
};

export function Hero() {
  const router = useRouter();
  // null until the admin-managed content arrives, so the headline never flashes the default copy first.
  const [content, setContent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/v1/hero", { auth: false })
      .then((data) => !cancelled && setContent(data.hero))
      .catch(() => !cancelled && setContent({}));
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = {
    badge: content?.badge || DEFAULT_COPY.badge,
    titleLead: content?.titleLead || DEFAULT_COPY.titleLead,
    titleAccent: content?.titleAccent || (content?.titleLead ? "" : DEFAULT_COPY.titleAccent),
    subtitle: content?.subtitle || DEFAULT_COPY.subtitle,
  };
  const decoration = content?.decoration && HERO_DECORATIONS[content.decoration] ? content.decoration : null;
  const greeting = decoration ? content.greeting || HERO_DECORATIONS[decoration].greeting : "";

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
    const preset = BUDGET_PRESETS[intent].find((p) => p.id === value.budgetPresetId);
    const params = new URLSearchParams();
    params.set("intent", intent);
    if (value.location) {
      params.set("city", value.location.city);
      if (value.location.locality) params.set("locality", value.location.locality);
    } else if (value.keyword) {
      params.set("q", value.keyword);
    }
    if (value.propertyType !== "all") params.set("propertyType", value.propertyType);
    if (value.bhk) params.set("bhk", value.bhk);
    if (preset) {
      params.set("minPrice", String(preset.min));
      if (preset.max !== null) params.set("maxPrice", String(preset.max));
    }

    // Recent searches are location-based; a keyword-only search has nothing to replay.
    if (value.location) {
      addRecentSearch({
        intent,
        city: value.location.city,
        locality: value.location.locality,
        label: locationLabel(value.location),
      });
    }

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
    <section className="relative -mt-16 flex bg-ink min-h-120 items-center pt-28 pb-12 sm:min-h-150 sm:pt-32 sm:pb-20">
      {content ? <HeroSlider images={content.slides} /> : null}
      {decoration ? <HeroDecoration id={decoration} /> : null}

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-3xl text-center ${content ? "animate-fade-up" : "opacity-0"}`}>
          {greeting ? (
            <p className="mb-3 text-lg font-semibold tracking-wide text-accent drop-shadow sm:text-xl">{greeting}</p>
          ) : null}
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white uppercase ring-1 ring-white/25 backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {copy.badge}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl lg:leading-[1.05]">
            {copy.titleLead}{" "}
            {copy.titleAccent ? <span className="text-gradient">{copy.titleAccent}</span> : null}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/90 drop-shadow sm:text-lg">
            {copy.subtitle}
          </p>
        </div>

        <div className="animate-fade-up delay-200 mx-auto mt-10 max-w-5xl">
          <div
            role="tablist"
            aria-label="Search intent"
            className="mx-auto mb-4 flex w-fit justify-center gap-1 rounded-full bg-white/15 p-1.5 ring-1 ring-white/30 backdrop-blur-md"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => handleTabChange(t.id)}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-primary text-white shadow-lg shadow-black/20"
                    : "text-white/90 hover:bg-white/15 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sell" ? (
            <div className="rounded-3xl bg-white/95 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur">
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
