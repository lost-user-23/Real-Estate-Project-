import {api} from "@/lib/api";

export function toAdminProperty(p) {
  const first = p.images?.[0];
  return {
    ...p,
    id: p.id ?? p._id,
    image: first ? { src: first.url, alt: first.alt || p.title } : null,
    featuredRank: p.featuredRank ?? null,
  };
}

export async function fetchAdminProperties(params = {}){
    const qs = new URLSearchParams(params).toString();
    const data = await api.get(`/api/v1/admin/properties${qs ? `?${qs}` : ""}`);
    return {properties: data.properties.map(toAdminProperty), meta: data.meta};
}