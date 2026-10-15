"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCity } from "@/lib/city-context";
import { SUPPORTED_CITIES } from "@/lib/city";
import { fetchPopularAreas } from "@/lib/dataSource";
import { trackEvent } from "@/lib/trackEvent";
import { ChevronDownIcon } from "@/components/icons";

const BUY_TYPES = [
  { label: "Flats", propertyType: "apartment" },
  { label: "Houses", propertyType: "independent-house" },
  { label: "Villas", propertyType: "villa" },
  { label: "Plots", propertyType: "plot" },
  { label: "Commercial properties", propertyType: "commercial" },
];

const RENT_TYPES = [
  { label: "Flats", propertyType: "apartment" },
  { label: "Houses", propertyType: "independent-house" },
  { label: "Villas", propertyType: "villa" },
  { label: "PG / Hostels", propertyType: "pg-hostel" },
  { label: "Commercial properties", propertyType: "commercial" },
];

const BHK_OPTIONS = ["1", "2", "3", "4"];

// Same city -> same areas, so reopening a menu (or switching tabs) is instant.
const areasCache = new Map();

function useAreas(city) {
  const [state, setState] = useState({ city: null, areas: [] });

  useEffect(() => {
    if (!city || areasCache.has(city)) return undefined;
    const controller = new AbortController();
    fetchPopularAreas(city, controller.signal)
      .then((areas) => {
        areasCache.set(city, areas);
        setState({ city, areas });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ city, areas: [] });
      });
    return () => controller.abort();
  }, [city]);

  // Stale areas from a previously selected city must never show under a new one.
  if (!city) return [];
  return areasCache.get(city) ?? (state.city === city ? state.areas : []);
}

function search(params) {
  return `/search?${new URLSearchParams(params).toString()}`;
}

function Heading({ children }) {
  return <p className="mb-3 text-sm text-text-muted">{children}</p>;
}

function MenuLink({ href, children, onNavigate, source }) {
  return (
    <Link
      href={href}
      onClick={() => {
        trackEvent("nav_menu_click", { source });
        onNavigate();
      }}
      className="block rounded-md py-1.5 text-[15px] text-text transition-colors hover:text-primary"
    >
      {children}
    </Link>
  );
}

// Buy / Rent: property types, then everything that depends on the chosen city.
function ListingsPanel({ intent, city, onNavigate }) {
  const areas = useAreas(city);
  const isRent = intent === "rent";
  const types = isRent ? RENT_TYPES : BUY_TYPES;
  const where = city ?? "India";
  const verb = isRent ? "for Rent" : "for Sale";
  const base = { intent, ...(city ? { city } : {}) };

  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_auto_1.6fr_1.4fr_1.6fr]">
      <div>
        <Heading>Property type</Heading>
        {types.map((type) => (
          <MenuLink key={type.label} href={search({ ...base, propertyType: type.propertyType })} onNavigate={onNavigate} source={`${intent}_type`}>
            {type.label}
          </MenuLink>
        ))}
      </div>

      <div aria-hidden className="hidden w-px bg-border md:block" />

      <div>
        <Heading>{city ? "Popular areas" : "Top cities"}</Heading>
        {city
          ? areas.length > 0
            ? areas.map((area) => (
                <MenuLink key={area.locality} href={search({ ...base, locality: area.locality })} onNavigate={onNavigate} source={`${intent}_area`}>
                  {area.locality}
                </MenuLink>
              ))
            : <p className="py-1.5 text-sm text-text-muted">No areas yet in {city}</p>
          : SUPPORTED_CITIES.slice(0, 6).map((name) => (
              <MenuLink key={name} href={search({ intent, city: name })} onNavigate={onNavigate} source={`${intent}_city`}>
                {isRent ? "Rentals" : "Properties"} in {name}
              </MenuLink>
            ))}
      </div>

      <div>
        <Heading>Search by BHK</Heading>
        {BHK_OPTIONS.map((bhk) => (
          <MenuLink key={bhk} href={search({ ...base, bhk })} onNavigate={onNavigate} source={`${intent}_bhk`}>
            {bhk} BHK {verb} in {where}
          </MenuLink>
        ))}
      </div>

      <div>
        <Heading>Popular searches</Heading>
        <MenuLink href={search({ ...base, propertyType: "villa" })} onNavigate={onNavigate} source={`${intent}_popular`}>
          Villas {verb.toLowerCase()}
        </MenuLink>
        <MenuLink href={search({ ...base, propertyType: "independent-house" })} onNavigate={onNavigate} source={`${intent}_popular`}>
          Independent houses
        </MenuLink>
        <MenuLink href={search({ ...base, propertyType: "studio" })} onNavigate={onNavigate} source={`${intent}_popular`}>
          Studio apartments
        </MenuLink>
        <MenuLink href={search({ ...base, propertyType: "penthouse" })} onNavigate={onNavigate} source={`${intent}_popular`}>
          Penthouses
        </MenuLink>
        <MenuLink href="/#new-projects" onNavigate={onNavigate} source={`${intent}_popular`}>
          New residential projects
        </MenuLink>
      </div>
    </div>
  );
}

function SellersPanel({ city, onNavigate }) {
  const prefill = city ? { city } : {};
  const post = (extra) => `/post-property?${new URLSearchParams({ ...prefill, ...extra }).toString()}`;

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div>
        <Heading>Post your property</Heading>
        <MenuLink href={post({ intent: "buy" })} onNavigate={onNavigate} source="sell_post_sale">
          Sell a property
        </MenuLink>
        <MenuLink href={post({ intent: "rent" })} onNavigate={onNavigate} source="sell_post_rent">
          Rent out a property
        </MenuLink>
        <MenuLink href={post({ intent: "buy", propertyType: "plot" })} onNavigate={onNavigate} source="sell_post_plot">
          Sell a plot
        </MenuLink>
        <MenuLink href={post({ intent: "buy", propertyType: "commercial" })} onNavigate={onNavigate} source="sell_post_commercial">
          List a commercial property
        </MenuLink>
      </div>
      <div>
        <Heading>Manage</Heading>
        <MenuLink href="/profile" onNavigate={onNavigate} source="sell_listings">
          My listings
        </MenuLink>
        <MenuLink href="/saved" onNavigate={onNavigate} source="sell_saved">
          Saved properties
        </MenuLink>
      </div>
      <div>
        <Heading>Tools &amp; guides</Heading>
        <MenuLink href="/tools" onNavigate={onNavigate} source="sell_tools">
          Property tools
        </MenuLink>
        <MenuLink href="/#insights" onNavigate={onNavigate} source="sell_insights">
          Selling tips &amp; insights
        </MenuLink>
      </div>
    </div>
  );
}

const MENUS = [
  { id: "buyers", label: "For Buyers", panel: (props) => <ListingsPanel intent="buy" {...props} /> },
  { id: "tenants", label: "For Tenants", panel: (props) => <ListingsPanel intent="rent" {...props} /> },
  { id: "sellers", label: "For Sellers", panel: (props) => <SellersPanel {...props} /> },
];

export function NavMegaMenus({ transparent = false }) {
  const { city } = useCity();
  const [openId, setOpenId] = useState(null);
  const rootRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!openId) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpenId(null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const open = (id) => {
    clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  // Small delay so the pointer can cross the gap between trigger and panel.
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 120);
  };

  return (
    <nav ref={rootRef} aria-label="Primary" className="hidden items-center gap-5 whitespace-nowrap xl:flex">
      {MENUS.map((menu) => {
        const isOpen = openId === menu.id;
        return (
          <div key={menu.id} className="flex h-16 items-center" onMouseEnter={() => open(menu.id)} onMouseLeave={scheduleClose}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => (isOpen ? setOpenId(null) : open(menu.id))}
              className={`relative flex items-center gap-1 py-1 text-sm font-semibold transition-colors ${
                transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
              }`}
            >
              {menu.label}
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen ? (
              <div className="fixed left-1/2 top-16 w-[min(70rem,calc(100vw-2rem))] -translate-x-1/2">
                {/* caret pointing at the trigger is omitted: the panel spans the header, not the button */}
                <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl bg-surface p-8 text-text shadow-2xl shadow-black/20 ring-1 ring-border">
                  {menu.panel({ city, onNavigate: () => setOpenId(null) })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
