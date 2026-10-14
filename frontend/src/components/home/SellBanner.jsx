"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";
import { Container } from "@/components/ui/Container";
import { CheckBadgeIcon, ChevronRightIcon, KeyIcon, TrendingUpIcon } from "@/components/icons";

const PERKS = [
  { icon: CheckBadgeIcon, label: "Free to list" },
  { icon: TrendingUpIcon, label: "Reach genuine buyers" },
  { icon: KeyIcon, label: "Talk to owners directly" },
];

export function SellBanner() {
  return (
    <section id="sell" aria-labelledby="sell-heading" className="py-10 sm:py-14">
      <Container>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-linear-to-br from-primary-dark via-primary to-[#12a09e] px-6 py-10 shadow-xl shadow-primary/25 sm:px-12 sm:py-14">
          {/* Decorative background */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />
            <svg
              viewBox="0 0 200 200"
              className="absolute -right-6 -bottom-10 hidden h-72 w-72 text-white/10 md:block"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 100 100 30l80 70" />
              <path d="M40 90v85h120V90" />
              <path d="M85 175v-50h30v50" />
            </svg>
          </div>

          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase ring-1 ring-white/25 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                For owners &amp; agents
              </span>

              <h2
                id="sell-heading"
                className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
              >
                Have a property to sell?
                <span className="block text-accent">List it in minutes.</span>
              </h2>

              <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
                List your property &amp; connect with clients faster. Add details and photos, and start getting
                enquiries straight from interested buyers and tenants.
              </p>

              <ul className="mt-6 flex flex-wrap gap-2.5">
                {PERKS.map((perk) => (
                  <li
                    key={perk.label}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur"
                  >
                    <perk.icon className="h-4 w-4 text-accent" />
                    {perk.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-center">
              <Link
                href="/post-property"
                onClick={() => trackEvent("sell_banner_click", { source: "sell_banner" })}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-bold text-accent-ink shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
              >
                Sell your property
                <ChevronRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <p className="text-center text-xs text-white/75">Takes less than 5 minutes</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
