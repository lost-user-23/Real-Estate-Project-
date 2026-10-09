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
  const params = new URLSearchParams({ limit: "50" });
  if (city) params.set("city", city);
  const data = (await api.get(`/api/v1/builders?${params}`, { auth: false })) ?? {};
  if (!Array.isArray(data.builders)) throw new Error("Builder list was not returned");
  return { builders: data.builders, meta: data.meta };
}

export async function fetchBuilderDetails(slug, city, simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const query = city ? `?${new URLSearchParams({ city })}` : "";
  const data = await api.get(`/api/v1/builders/${encodeURIComponent(slug)}${query}`, { auth: false });
  if (!data?.builder || !Array.isArray(data.builder.projects)) {
    throw new Error("Builder details were not returned");
  }
  const { builder } = data;
  return {
    ...builder,
    projects: builder.projects.map(normalizeProject),
  };
}

// The directory loads project cards only when a builder is selected. A city
// with no builders falls back to the nationwide list; `scope` identifies it.
export async function fetchBuilders(city, simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  if (!city) return { ...(await requestBuilders()), scope: "national" };

  const inCity = await requestBuilders(city);
  if (inCity.builders.length > 0) return { ...inCity, scope: "city" };
  return { ...(await requestBuilders()), scope: "national" };
}
