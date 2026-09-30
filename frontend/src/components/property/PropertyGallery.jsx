"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
      <path
        d={direction === "prev" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PropertyGallery({ title, images, badges }) {
  const [selected, setSelected] = useState(0);
  const count = images.length;

  const go = useCallback(
    (step) => setSelected((current) => (current + step + count) % count),
    [count]
  );

  const handleKeyDown = (event) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };

  const altFor = (index) => `${title}, photo ${index + 1}`;
  const current = images[selected];

  return (
    <div
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={handleKeyDown}
      role={count > 1 ? "group" : undefined}
      aria-label={count > 1 ? "Photo gallery, use the left and right arrow keys to change photo" : undefined}
      className="outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-bg sm:aspect-16/9">
        {current ? (
          <Image
            key={current.url}
            src={current.url}
            alt={altFor(selected)}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority={selected === 0}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            No property photo available
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-1.5">{badges}</div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-text shadow hover:bg-surface"
            >
              <ArrowIcon direction="prev" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-text shadow hover:bg-surface"
            >
              <ArrowIcon direction="next" />
            </button>
            <p className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {selected + 1} / {count}
            </p>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={`${index}-${image.url}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === selected}
                className={`relative block h-16 w-24 overflow-hidden rounded-lg border-2 ${
                  index === selected ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
                }`}
              >
                <Image src={image.url} alt={altFor(index)} fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
