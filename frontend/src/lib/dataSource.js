import { apiRequest } from "@/lib/api-client";

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

function normalizeProperty(property) {
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

// Admin-flagged listings: explicit ranks first, then unranked by most recently published.
export async function fetchFeaturedProperties(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { properties } = await apiRequest("/api/v1/properties?featured=true&limit=50");
  const byRank = (a, b) => (a.featuredRank ?? Infinity) - (b.featuredRank ?? Infinity);
  const byRecent = (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1);
  const ranked = properties.filter((p) => p.featuredRank != null).sort(byRank);
  const unranked = properties.filter((p) => p.featuredRank == null).sort(byRecent);
  return [...ranked, ...unranked].slice(0, 8).map(normalizeProperty);
}

export async function fetchPopularLocations(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { locations } = await apiRequest("/api/v1/locations/popular");
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

  const { categories } = await apiRequest("/api/v1/categories");
  return categories;
}

export async function fetchNewProjects(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { projects } = await apiRequest("/api/v1/projects/new");
  return projects.map(normalizeProject);
}

export async function fetchInsights(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { articles } = await apiRequest("/api/v1/articles?limit=3");
  return articles.map(normalizeArticle);
}

// Builders/developers aren't their own record type yet, so derive them from
// the public project API.
export async function fetchBuilders(simulateError = false) {
  if (simulateError) throw new Error("Simulated network error");

  const { projects } = await apiRequest("/api/v1/projects?limit=50");
  const published = projects.map(normalizeProject);
  const byDeveloper = new Map();
  for (const project of published) {
    if (!byDeveloper.has(project.developer)) {
      byDeveloper.set(project.developer, { name: project.developer, projects: [] });
    }
    byDeveloper.get(project.developer).projects.push(project);
  }
  const builders = [...byDeveloper.values()].map((builder) => ({
    ...builder,
    cities: [...new Set(builder.projects.map((p) => p.city))],
    projectCount: builder.projects.length,
  }));
  return builders;
}
