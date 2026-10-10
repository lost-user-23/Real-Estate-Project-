import imageHosts from "./imageHosts.cjs";

const ALLOWED_HOSTNAMES = new Set(imageHosts.IMAGE_HOSTNAMES);

export function placeholderImage(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
}

// next/image throws in dev (and 400s in production) for a host that is not
// configured, a malformed src or a non-https URL. Anything that would do that
// gets the placeholder instead. Never throws.
export function safeImageSrc(url, seed) {
  try {
    if (typeof url === "string") {
      const parsed = new URL(url);
      if (
        parsed.protocol === "https:" &&
        ALLOWED_HOSTNAMES.has(parsed.hostname) &&
        !parsed.username &&
        !parsed.password &&
        !parsed.port
      ) {
        return url;
      }
    }
  } catch {
    // malformed URL: fall through to the placeholder
  }
  return placeholderImage(seed || "image");
}
