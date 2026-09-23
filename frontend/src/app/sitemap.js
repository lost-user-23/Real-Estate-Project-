import { MOCK_ARTICLES, MOCK_PROJECTS, MOCK_PROPERTIES } from "@/lib/mockData";

const SITE_URL = "https://www.homenest.example";
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

export default function sitemap() {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const propertyEntries = MOCK_PROPERTIES.filter((p) => p.status === "published").map((property) => ({
    url: `${SITE_URL}/property/${property.slug}`,
    lastModified: new Date(property.publishedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const projectEntries = MOCK_PROJECTS.filter((p) => p.status === "published").map((project) => ({
    url: `${SITE_URL}/project/${project.id}`,
    lastModified: new Date(project.publishedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const articleEntries = MOCK_ARTICLES.filter((a) => a.status === "published").map((article) => ({
    url: `${SITE_URL}/insights/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...propertyEntries, ...projectEntries, ...articleEntries];
}
