import { unstable_rethrow } from "next/navigation";
import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

// Rebuilt at most hourly, so a build that ran while the API was down picks the
// listings up on a later request instead of serving static routes forever.
export const revalidate = 3600;

const PAGE_SIZE = 50; // the API's maximum page size
const MAX_PAGES = 200;
const REQUEST_TIMEOUT_MS = 10000;
const STATIC_ROUTES = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/search", priority: 0.8, changeFrequency: "daily" },
  { path: "/post-property", priority: 0.6, changeFrequency: "monthly" },
  { path: "/builders", priority: 0.5, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.5, changeFrequency: "monthly" },
  { path: "/tools/emi-calculator", priority: 0.6, changeFrequency: "monthly" },
  { path: "/tools/property-value-calculator", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/careers", priority: 0.2, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/help", priority: 0.4, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.4, changeFrequency: "monthly" },
  { path: "/report", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/verified-policy", priority: 0.3, changeFrequency: "yearly" },
];

// Reads every page of a public, published-only list endpoint.
async function fetchAll(path, key) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = (await api.get(`${path}?page=${page}&limit=${PAGE_SIZE}`, {
      auth: false,
      next: { revalidate },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })) ?? {};
    items.push(...(data[key] ?? []));
    if (page >= (data.meta?.totalPages ?? 1)) break;
  }
  return items;
}

function lastModifiedOf(item) {
  const value = item.updatedAt || item.publishedAt;
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// A failed request only drops that resource's entries; it never fails the build.
async function entriesFrom(path, key, toEntry) {
  try {
    const items = await fetchAll(path, key);
    return items.map((item) => ({ ...toEntry(item), lastModified: lastModifiedOf(item) }));
  } catch (error) {
    // Let Next.js's own control-flow errors through; only API failures fall back.
    unstable_rethrow(error);
    console.warn(`[sitemap] ${path} unavailable, leaving it out: ${error.message}`);
    return [];
  }
}

export default async function sitemap() {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const [propertyEntries, projectEntries, articleEntries] = await Promise.all([
    entriesFrom("/api/v1/properties", "properties", (property) => ({
      url: `${SITE_URL}/property/${encodeURIComponent(property.slug)}`,
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    entriesFrom("/api/v1/projects", "projects", (project) => ({
      url: `${SITE_URL}/project/${encodeURIComponent(project._id ?? project.id)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
    entriesFrom("/api/v1/articles", "articles", (article) => ({
      url: `${SITE_URL}/insights/${encodeURIComponent(article.slug)}`,
      changeFrequency: "monthly",
      priority: 0.5,
    })),
  ]);

  return [...staticEntries, ...propertyEntries, ...projectEntries, ...articleEntries];
}
