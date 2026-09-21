export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function randomSlugSuffix() {
  return Math.random().toString(36).slice(2, 6);
}
