"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fetchAdminProperties, toAdminProperty } from "@/lib/properties";
import { toAdminArticle, toAdminLocation, toAdminProject } from "@/lib/admin-content";

const MIN_ACTIVE_LISTINGS_FOR_POPULAR = 5;
const MAX_FEATURED_LISTINGS = 8;

const identity = (item) => ({ ...item, id: item.id ?? item._id });

const AdminStoreContext = createContext(null);

// Demo data this store used to seed into the browser, before the admin area went live.
const LEGACY_STORAGE_KEYS = ["homenest_admin_locations", "homenest_admin_projects", "homenest_admin_articles"];

// A paginated admin list. Only the latest load may write state, so a slow
// earlier response can't overwrite a newer one.
function useRemoteList(path, key, mapper) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const latestLoad = useRef(0);

  const load = useCallback(
    async (params = {}) => {
      const loadId = ++latestLoad.current;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams(params).toString();
        const data = await api.get(`${path}${qs ? `?${qs}` : ""}`);
        if (loadId !== latestLoad.current) return;
        setItems(data[key].map(mapper));
        setMeta(data.meta ?? null);
      } catch (e) {
        if (loadId !== latestLoad.current) return;
        setError(e.message);
      } finally {
        if (loadId === latestLoad.current) setLoading(false);
      }
    },
    [path, key, mapper]
  );

  return { items, setItems, meta, loading, error, load };
}

export function AdminStoreProvider({ children }) {
  // Clear leftovers from the old localStorage-backed demo data.
  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {}
  }, []);

  // Properties come from the real API.
  const [properties, setProperties] = useState([]);
  const [propertiesMeta, setPropertiesMeta] = useState(null);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState(null);

  const articleList = useRemoteList("/api/v1/admin/articles", "articles", toAdminArticle);
  const setArticles = articleList.setItems;

  const projectList = useRemoteList("/api/v1/admin/projects", "projects", toAdminProject);
  const setProjects = projectList.setItems;

  const locationList = useRemoteList("/api/v1/admin/locations", "locations", toAdminLocation);
  const setLocations = locationList.setItems;

  const reportList = useRemoteList("/api/v1/admin/reports", "reports", identity);
  const setReports = reportList.setItems;

  // Categories: the public list endpoint is unpaginated, writes are admin-only.
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await api.get("/api/v1/categories", { auth: false });
      setCategories(data.categories);
    } catch (e) {
      setCategoriesError(e.message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Only the latest load may write state, so a slow earlier response
  // (e.g. from a previous filter) can't overwrite a newer one.
  const latestLoad = useRef(0);

  const loadProperties = useCallback(async (params) => {
    const loadId = ++latestLoad.current;
    setPropertiesLoading(true);
    setPropertiesError(null);
    try {
      const { properties: rows, meta } = await fetchAdminProperties(params);
      if (loadId !== latestLoad.current) return;
      setProperties(rows);
      setPropertiesMeta(meta);
    } catch (e) {
      if (loadId !== latestLoad.current) return;
      setPropertiesError(e.message);
    } finally {
      if (loadId === latestLoad.current) setPropertiesLoading(false);
    }
  }, []);

  // Single-location PATCH. The server response is the source of truth.
  const patchLocation = useCallback(
    async (id, updates) => {
      const { location } = await api.patch(`/api/v1/admin/locations/${id}`, updates);
      const mapped = toAdminLocation(location);
      setLocations((prev) => prev.map((l) => (l.id === id ? mapped : l)));
    },
    [setLocations]
  );

  // Merge a partial update into local rows (used after bulk calls succeed).
  const applyLocal = useCallback((ids, updates) => {
    setProperties((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, ...updates } : p)));
  }, []);

  // Single-property PATCH. The server response is the source of truth.
  const patchProperty = useCallback(async (id, updates) => {
    const { property } = await api.patch(`/api/v1/properties/${id}`, updates);
    const mapped = toAdminProperty(property);
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...mapped, image: mapped.image ?? p.image } : p))
    );
  }, []);

  const value = useMemo(
    () => ({
      properties,
      propertiesMeta,
      propertiesLoading,
      propertiesError,
      loadProperties,
      locations: locationList.items,
      locationsMeta: locationList.meta,
      locationsLoading: locationList.loading,
      locationsError: locationList.error,
      loadLocations: locationList.load,
      projects: projectList.items,
      projectsMeta: projectList.meta,
      projectsLoading: projectList.loading,
      projectsError: projectList.error,
      loadProjects: projectList.load,
      articles: articleList.items,
      articlesMeta: articleList.meta,
      articlesLoading: articleList.loading,
      articlesError: articleList.error,
      loadArticles: articleList.load,
      minActiveListingsForPopular: MIN_ACTIVE_LISTINGS_FOR_POPULAR,
      maxFeaturedListings: MAX_FEATURED_LISTINGS,

      // ---- Properties (real API). All of these are async and can throw ApiError. ----
      toggleVerified: async (id) => {
        const target = properties.find((p) => p.id === id);
        if (target) await patchProperty(id, { verified: !target.verified });
      },
      toggleFeatured: async (id) => {
        const target = properties.find((p) => p.id === id);
        if (!target) return { ok: false, reason: "not_found" };

        // The public site only shows published listings, so featuring a draft would do nothing.
        if (!target.featured && target.status !== "published") return { ok: false, reason: "not_published" };

        // The featured limit is enforced by the backend (409); its message reaches the caller as a thrown ApiError.
        await patchProperty(
          id,
          target.featured ? { featured: false, featuredRank: null } : { featured: true }
        );
        return { ok: true };
      },
      setFeaturedRank: (id, rank) => patchProperty(id, { featuredRank: rank }),
      setPropertyStatus: (id, status) => patchProperty(id, { status }),
      deleteProperty: async (id) => {
        await api.delete(`/api/v1/properties/${id}`);
        setProperties((prev) => prev.filter((p) => p.id !== id));
      },
      bulkSetVerified: async (ids, verified) => {
        await api.patch("/api/v1/admin/properties/bulk", { ids, updates: { verified } });
        applyLocal(ids, { verified });
      },
      bulkSetFeatured: async (ids, featured) => {
        if (!featured) {
          await api.patch("/api/v1/admin/properties/bulk", {
            ids,
            updates: { featured: false, featuredRank: null },
          });
          applyLocal(ids, { featured: false, featuredRank: null });
          return { ok: true };
        }

        const unpublished = properties.filter((p) => ids.includes(p.id) && p.status !== "published");
        if (unpublished.length > 0) return { ok: false, reason: "not_published", count: unpublished.length };

        // The featured limit is enforced by the backend (409); local state is only updated after it accepts.
        await api.patch("/api/v1/admin/properties/bulk", { ids, updates: { featured: true } });
        applyLocal(ids, { featured: true });
        return { ok: true };
      },
      bulkSetStatus: async (ids, status) => {
        await api.patch("/api/v1/admin/properties/bulk", { ids, updates: { status } });
        applyLocal(ids, { status });
      },
      bulkDeleteProperties: async (ids) => {
        await api.delete("/api/v1/admin/properties/bulk", { body: { ids } });
        setProperties((prev) => prev.filter((p) => !ids.includes(p.id)));
      },
      // Uploads the photos through the backend (size/type checked, then sent to Cloudinary), then creates the
      // property. POST /properties always creates a draft, so publishing is a follow-up PATCH.
      addProperty: async ({ files, status, ...input }) => {
        const images = await Promise.all(
          files.map(async (file, index) => {
            const body = new FormData();
            body.append("image", file);
            const result = await api.post("/api/v1/uploads/image", body);
            return { url: result.url, publicId: result.publicId, alt: file.name, displayOrder: index };
          })
        );
        const { property } = await api.post("/api/v1/properties", { ...input, images });
        // The listing exists as a draft by now. Don't throw if only the publish step fails, or the
        // caller would treat it as a failed create and a retry would duplicate the listing.
        let publishError = null;
        if (status && status !== "draft") {
          try {
            await api.patch(`/api/v1/properties/${property.id}`, { status });
          } catch (e) {
            publishError = e?.message || "unknown error";
          }
        }
        return { property: toAdminProperty(property), publishError };
      },

      // ---- Locations (real API). Async, can throw ApiError. ----
      togglePopular: async (id) => {
        const target = locationList.items.find((l) => l.id === id);
        if (target) {
          await patchLocation(id, target.popular ? { popular: false, popularRank: null } : { popular: true });
        }
      },
      setPopularRank: (id, rank) => patchLocation(id, { popularRank: rank }),
      // ---- Facilities (per location) ----
      listFacilities: async (locationId) =>
        (await api.get(`/api/v1/locations/${locationId}/facilities`, { auth: false })).facilities,
      createFacility: async (input) => (await api.post("/api/v1/admin/facilities", input)).facility,
      updateFacility: async (id, updates) => (await api.patch(`/api/v1/admin/facilities/${id}`, updates)).facility,
      deleteFacility: (id) => api.delete(`/api/v1/admin/facilities/${id}`),

      // ---- Categories ----
      categories,
      categoriesLoading,
      categoriesError,
      loadCategories,
      addCategory: async (input) => {
        const { category } = await api.post("/api/v1/categories", input);
        setCategories((prev) => [...prev, category]);
      },
      updateCategory: async (id, updates) => {
        const { category } = await api.patch(`/api/v1/categories/${id}`, updates);
        setCategories((prev) => prev.map((c) => (c.id === id ? category : c)));
      },
      deleteCategory: async (id) => {
        await api.delete(`/api/v1/categories/${id}`);
        setCategories((prev) => prev.filter((c) => c.id !== id));
      },

      // ---- Reports ----
      reports: reportList.items,
      reportsMeta: reportList.meta,
      reportsLoading: reportList.loading,
      reportsError: reportList.error,
      loadReports: reportList.load,
      setReportStatus: async (id, status) => {
        const { report } = await api.patch(`/api/v1/admin/reports/${id}`, { status });
        setReports((prev) => prev.map((r) => (r.id === id ? identity(report) : r)));
      },

      // ---- Projects (real API). Async, can throw ApiError. ----
      updateProject: async (id, updates) => {
        const { project } = await api.patch(`/api/v1/admin/projects/${id}`, updates);
        setProjects((prev) => prev.map((p) => (p.id === id ? toAdminProject(project) : p)));
      },
      updateArticle: async (id, updates) => {
        const { article } = await api.patch(`/api/v1/admin/articles/${id}`, updates);
        setArticles((prev) => prev.map((a) => (a.id === id ? toAdminArticle(article) : a)));
      },
      setProjectStatus: async (id, status) => {
        const { project } =
          status === "published"
            ? await api.patch(`/api/v1/admin/projects/${id}/publish`)
            : await api.patch(`/api/v1/admin/projects/${id}`, { status });
        const mapped = toAdminProject(project);
        setProjects((prev) => prev.map((p) => (p.id === id ? mapped : p)));
      },
      addProject: async (input) => {
        const { project } = await api.post("/api/v1/admin/projects", input);
        return toAdminProject(project);
      },
      deleteProject: async (id) => {
        await api.delete(`/api/v1/admin/projects/${id}`);
        setProjects((prev) => prev.filter((p) => p.id !== id));
      },
      // ---- Articles (real API). Async, can throw ApiError. ----
      // Publishing goes through /publish, which stamps publishedAt once; other statuses use PATCH.
      setArticleStatus: async (id, status) => {
        const { article } =
          status === "published"
            ? await api.patch(`/api/v1/admin/articles/${id}/publish`)
            : await api.patch(`/api/v1/admin/articles/${id}`, { status });
        const mapped = toAdminArticle(article);
        setArticles((prev) => prev.map((a) => (a.id === id ? mapped : a)));
      },
      addArticle: async (input) => {
        const { article } = await api.post("/api/v1/admin/articles", input);
        return toAdminArticle(article);
      },
      deleteArticle: async (id) => {
        await api.delete(`/api/v1/admin/articles/${id}`);
        setArticles((prev) => prev.filter((a) => a.id !== id));
      },
    }),
    [
      properties,
      propertiesMeta,
      propertiesLoading,
      propertiesError,
      loadProperties,
      patchProperty,
      applyLocal,
      locationList.items,
      locationList.meta,
      locationList.loading,
      locationList.error,
      locationList.load,
      patchLocation,
      projectList.items,
      projectList.meta,
      projectList.loading,
      projectList.error,
      projectList.load,
      articleList.items,
      articleList.meta,
      articleList.loading,
      articleList.error,
      articleList.load,
      reportList.items,
      reportList.meta,
      reportList.loading,
      reportList.error,
      reportList.load,
      setReports,
      categories,
      categoriesLoading,
      categoriesError,
      loadCategories,
      setProjects,
      setArticles,
    ]
  );

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error("useAdminStore must be used within AdminStoreProvider");
  return ctx;
}