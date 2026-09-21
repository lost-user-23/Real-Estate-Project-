"use client";

import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

// Manual, keyboard-operable horizontal scroller. Never auto-advances, so it
// already respects prefers-reduced-motion (PRD §11) without extra branching.
export function Carousel({ children, label }) {
  const trackRef = useRef(null);

  const scrollByCard = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("[data-carousel-item]");
    const amount = (card?.offsetWidth ?? 280) + 16;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: amount * direction, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="relative" role="group" aria-label={label}>
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4"
      >
        {children}
      </div>
      <div className="mt-4 flex justify-end gap-2 sm:hidden">
        <button
          type="button"
          aria-label={`Scroll ${label} left`}
          onClick={() => scrollByCard(-1)}
          className="rounded-full border border-border bg-surface p-2 text-text hover:bg-primary-light"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={`Scroll ${label} right`}
          onClick={() => scrollByCard(1)}
          className="rounded-full border border-border bg-surface p-2 text-text hover:bg-primary-light"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
