// Public origin used for canonical URLs, Open Graph tags, robots.txt and the
// sitemap. Set NEXT_PUBLIC_SITE_URL for every deployed build; the localhost
// fallback only suits local development.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "HomeNest";
export const DEFAULT_OG_IMAGE = { url: "/next.svg", width: 1200, height: 630 };
