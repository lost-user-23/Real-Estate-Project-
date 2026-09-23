"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";
import { Section } from "@/components/ui/Section";
import { KeyIcon } from "@/components/icons";

export function SellBanner() {
  return (
    <Section id="sell" title="Have a property to sell?">
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border bg-surface px-6 py-8 sm:flex-row sm:gap-8 sm:px-10 sm:py-10">
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-dark text-white">
          <KeyIcon className="h-9 w-9" />
        </span>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-lg font-semibold sm:text-xl">List your property &amp; connect with clients faster!</p>
        </div>

        <Link
          href="/post-property"
          onClick={() => trackEvent("sell_banner_click", { source: "sell_banner" })}
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-dark sm:w-auto"
        >
          Sell your property
        </Link>
      </div>
    </Section>
  );
}
