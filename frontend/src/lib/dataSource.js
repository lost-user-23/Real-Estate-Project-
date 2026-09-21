import {
  MOCK_ARTICLES,
  MOCK_CATEGORIES,
  MOCK_LOCATIONS,
  MOCK_PROJECTS,
  MOCK_PROPERTIES,
} from "@/lib/mockData";

const MIN_ACTIVE_LISTINGS_FOR_POPULAR = 5;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stands in for the real API described in PRD §10. Each function applies
// the same selection/ordering logic (§4) the backend will eventually own,
// so swapping this module out later is a data-source change, not a
// component change. `simulateError` lets the loading/error UI (§11) be
// exercised without a real backend, e.g. /?debugError=featured.
async function withSimulatedNetwork(data, simulateError) {
  await delay(500 + Math.random() * 400);
  if (simulateError) {
    throw new Error("Simulated network error");
  }
  return data;
}

export async function fetchFeaturedProperties(simulateError = false) {
  const published = MOCK_PROPERTIES.filter((p) => p.status === "published");
  const ranked = published
    .filter((p) => p.featured && p.featuredRank !== null)
    .sort((a, b) => a.featuredRank - b.featuredRank);
  const unranked = published
    .filter((p) => p.featured && p.featuredRank === null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return withSimulatedNetwork([...ranked, ...unranked].slice(0, 8), simulateError);
}

export async function fetchPopularLocations(simulateError = false) {
  const qualifying = MOCK_LOCATIONS.filter(
    (l) => l.popular && l.activeListingCount >= MIN_ACTIVE_LISTINGS_FOR_POPULAR
  ).sort((a, b) => (a.popularRank ?? Infinity) - (b.popularRank ?? Infinity));
  return withSimulatedNetwork(qualifying.slice(0, 12), simulateError);
}

export async function fetchCategories(simulateError = false) {
  return withSimulatedNetwork(MOCK_CATEGORIES, simulateError);
}

export async function fetchNewProjects(simulateError = false) {
  const published = MOCK_PROJECTS.filter((p) => p.status === "published")
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 4);
  return withSimulatedNetwork(published, simulateError);
}

export async function fetchInsights(simulateError = false) {
  const published = MOCK_ARTICLES.filter((a) => a.status === "published")
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 3);
  return withSimulatedNetwork(published, simulateError);
}
