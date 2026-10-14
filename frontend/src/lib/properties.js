import {api} from "@/lib/api";
import { primaryImage } from "@/lib/propertyImages.mjs";

export function toAdminProperty(p) {
  const id = p.id ?? p._id;
  return {
    ...p,
    id,
    image: p.images?.[0] ? primaryImage(p, id) : null,
    featuredRank: p.featuredRank ?? null,
  };
}

export async function fetchAdminProperties(params = {}){
    const qs = new URLSearchParams(params).toString();
    const data = await api.get(`/api/v1/admin/properties${qs ? `?${qs}` : ""}`);
    return {properties: data.properties.map(toAdminProperty), meta: data.meta};
}
// Any status, with contactNumber; used to pre-fill the admin edit form.
export async function fetchAdminProperty(id){
    const data = await api.get(`/api/v1/admin/properties/${id}`);
    return toAdminProperty(data.property);
}
