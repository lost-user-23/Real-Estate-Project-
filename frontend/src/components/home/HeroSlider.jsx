"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

// Full-bleed background carousel for the hero section (housing.com /
// MagicBricks style) - the headline and search bar float on top of this.
// Purely decorative imagery, so the photos are aria-hidden; only the dot
// and arrow controls are exposed to assistive tech. Auto-advances like the
// sites it's modelled on, but freezes on the first frame for
// prefers-reduced-motion (PRD §11).
const SLIDES = [
  { id: "s1", image: { src: "https://picsum.photos/seed/hero-banner-1/1920/1080" } },
  { id: "s2", image: { src: "https://picsum.photos/seed/hero-banner-2/1920/1080" } },
  { id: "s3", image: { src: "https://picsum.photos/seed/hero-banner-3/1920/1080" } },
  { id: "s4", image: { src: "https://picsum.photos/seed/hero-banner-4/1920/1080" } },
];

const AUTO_ADVANCE_MS = 6000;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (reducedMotionRef.current) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const goTo = useCallback((next) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div aria-hidden="true">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.image.src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/50 to-black/70" />
      </div>

      <button
        type="button"
        aria-label="Previous background image"
        onClick={() => goTo(index - 1)}
        className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition-colors hover:bg-white/30 sm:block"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next background image"
        onClick={() => goTo(index + 1)}
        className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white backdrop-blur transition-colors hover:bg-white/30 sm:block"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>

      <div
        role="group"
        aria-label="Background image navigation"
        className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5"
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Show background image ${i + 1}`}
            aria-current={i === index}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
