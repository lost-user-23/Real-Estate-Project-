"use client";

import { useState } from "react";
import Image from "next/image";
import { placeholderImage, safeImageSrc } from "@/lib/safeImageSrc.mjs";

// next/image that never gets a bad src and swaps to the placeholder if the
// image fails to load. Takes the usual next/image props.
export function SafeImage({ src, alt, fallbackSeed, onError, ...props }) {
  const seed = fallbackSeed || alt || "image";
  const checkedSrc = safeImageSrc(src, seed);
  const [failedSrc, setFailedSrc] = useState(null);
  const finalSrc = failedSrc === checkedSrc ? placeholderImage(seed) : checkedSrc;

  return (
    <Image
      {...props}
      src={finalSrc}
      alt={alt}
      onError={(event) => {
        setFailedSrc(checkedSrc);
        onError?.(event);
      }}
    />
  );
}
