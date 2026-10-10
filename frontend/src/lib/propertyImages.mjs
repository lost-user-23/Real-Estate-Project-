import { safeImageSrc } from "./safeImageSrc.mjs";

// The image shown on a card: the first stored photo if its URL is safe, the
// placeholder otherwise. `seed` picks the placeholder, so it stays stable.
export function primaryImage(property, seed) {
  const first = property?.images?.[0];
  return {
    src: safeImageSrc(first?.url, seed),
    alt: first?.alt || property?.title,
  };
}

// Every photo with its url made safe; other fields are kept. Only the bad
// items are replaced, each with its own placeholder.
export function safeImages(images, seed) {
  if (!Array.isArray(images)) return [];
  return images.map((image, index) => ({ ...image, url: safeImageSrc(image?.url, `${seed}-${index + 1}`) }));
}
