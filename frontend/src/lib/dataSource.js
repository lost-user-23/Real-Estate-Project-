import { api } from "@/lib/api";

const MIN_ACTIVE_LISTINGS_FOR_POPULAR = 5;

function placeholderImage(seed) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
}

export function normalizeArticle(article) {
  return {
    ...article,
    id: String(article.id ?? article._id),
    image: {
      src: article.imageUrl || placeholderImage(article.slug),
      alt: article.imageAlt || article.title,
    },
  };
}

function normalizeProject(project) {
  return {
    ...project,
    id: String(project._id),
    image: {
      src: project.imageUrl || placeholderImage(project._id),
      alt: project.imageAlt || project.name,
    },
  };
}

export function normalizeProperty(property) {
  const first = property.images?.[0];
  return {
    ...property,
    id: String(property.id ?? property._id),
    image: {
      src: first?.url || placeholderImage(property.id),
      alt: first?.alt || property.title,
    },
  };
}

// Admin-flagged listings. Ordering, the city filter and the nationwide
// fallback all happen on the server; `scope` says which list came back.
export async function fetchFeaturedProperties(city, limit, simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const params = new URLSearchParams({ limit: String(limit) });
  if (city) params.set("city", city);
  const data = (await api.get(`/api/v1/properties/featured?${params}`, { auth: false })) ?? {};
  return {
    properties: (data.properties ?? []).map(normalizeProperty),
    scope: data.scope ?? "national",
  };
}

export async function fetchPopularLocations(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { locations } = (await api.get("/api/v1/locations/popular", { auth: false })) ?? {};
  return locations
    .filter((location) => location.activeListingCount >= MIN_ACTIVE_LISTINGS_FOR_POPULAR)
    .sort((a, b) => (a.popularRank ?? Infinity) - (b.popularRank ?? Infinity))
    .map((location) => ({
      ...location,
      image: {
        src: location.imageUrl || placeholderImage(location.city),
        alt: location.imageAlt || location.city,
      },
    }));
}

export async function fetchCategories(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { categories } = (await api.get("/api/v1/categories", { auth: false })) ?? {};
  return categories;
}

export async function fetchNewProjects(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { projects } = (await api.get("/api/v1/projects/new", { auth: false })) ?? {};
  return projects.map(normalizeProject);
}

export async function fetchInsights(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { articles } = (await api.get("/api/v1/articles?limit=3", { auth: false })) ?? {};
  return articles.map(normalizeArticle);
}

async function requestBuilders(city) {
  const query = city ? `?${new URLSearchParams({ city })}` : "";
  const { builders } = (await api.get(`/api/v1/projects/builders${query}`, { auth: false })) ?? {};
  return (builders ?? []).map((builder) => ({
    ...builder,
    projects: (builder.projects ?? []).map(normalizeProject),
  }));
}

// Grouping, counting and ordering happen on the server. A city with no
// builders falls back to the nationwide list so the section is never blank;
// `scope` says which list came back.
export async function fetchBuilders(city, simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const inCity = city ? await requestBuilders(city) : [];
  if (inCity.length > 0) return { builders: inCity, scope: "city" };
  return { builders: await requestBuilders(), scope: "national" };
}
