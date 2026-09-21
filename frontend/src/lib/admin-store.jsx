"use client";

import { createContext, useContext, useMemo } from "react";
import { MOCK_ARTICLES, MOCK_CATEGORIES, MOCK_LOCATIONS, MOCK_PROJECTS, MOCK_PROPERTIES } from "@/lib/mockData";
import { useLocalStorageState } from "@/lib/useLocalStorageState";

const MIN_ACTIVE_LISTINGS_FOR_POPULAR = 5;

const AdminStoreContext = createContext(null);

export function AdminStoreProvider({ children }) {
  const [properties, setProperties] = useLocalStorageState("homenest_admin_properties", MOCK_PROPERTIES);
  const [locations, setLocations] = useLocalStorageState("homenest_admin_locations", MOCK_LOCATIONS);
  const [projects, setProjects] = useLocalStorageState("homenest_admin_projects", MOCK_PROJECTS);
  const [articles, setArticles] = useLocalStorageState("homenest_admin_articles", MOCK_ARTICLES);

  const value = useMemo(
    () => ({
      properties,
      locations,
      projects,
      articles,
      categories: MOCK_CATEGORIES,
      minActiveListingsForPopular: MIN_ACTIVE_LISTINGS_FOR_POPULAR,
      toggleVerified: (id) =>
        setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, verified: !p.verified } : p))),
      toggleFeatured: (id) =>
        setProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, featured: !p.featured, featuredRank: !p.featured ? p.featuredRank : null } : p))
        ),
      setFeaturedRank: (id, rank) =>
        setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, featuredRank: rank } : p))),
      setPropertyStatus: (id, status) =>
        setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p))),
      togglePopular: (id) =>
        setLocations((prev) =>
          prev.map((l) => (l.id === id ? { ...l, popular: !l.popular, popularRank: !l.popular ? l.popularRank : null } : l))
        ),
      setPopularRank: (id, rank) =>
        setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, popularRank: rank } : l))),
      setProjectStatus: (id, status) =>
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p))),
      setArticleStatus: (id, status) =>
        setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a))),
      addProperty: (property) => setProperties((prev) => [property, ...prev]),
      addProject: (project) => setProjects((prev) => [project, ...prev]),
      addArticle: (article) => setArticles((prev) => [article, ...prev]),
      deleteProperty: (id) => setProperties((prev) => prev.filter((p) => p.id !== id)),
      deleteProject: (id) => setProjects((prev) => prev.filter((p) => p.id !== id)),
      deleteArticle: (id) => setArticles((prev) => prev.filter((a) => a.id !== id)),
      resetToMockData: () => {
        setProperties(MOCK_PROPERTIES);
        setLocations(MOCK_LOCATIONS);
        setProjects(MOCK_PROJECTS);
        setArticles(MOCK_ARTICLES);
      },
    }),
    [properties, locations, projects, articles, setProperties, setLocations, setProjects, setArticles]
  );

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error("useAdminStore must be used within AdminStoreProvider");
  return ctx;
}
