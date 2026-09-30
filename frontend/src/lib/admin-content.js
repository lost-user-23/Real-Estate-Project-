// Maps admin API documents (Mongo-style _id) to the shapes the admin pages use.

export function toAdminArticle(a) {
  return {
    ...a,
    id: a.id ?? a._id,
    publishedAt: a.publishedAt ?? null,
  };
}

export function toAdminProject(p) {
  return {
    ...p,
    id: p.id ?? p._id,
    locality: p.locality ?? "",
    publishedAt: p.publishedAt ?? null,
  };
}

export function toAdminLocation(l) {
  return {
    ...l,
    id: l.id ?? l._id,
    popularRank: l.popularRank ?? null,
  };
}
