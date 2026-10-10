import test from "node:test";
import assert from "node:assert/strict";
import { placeholderImage, safeImageSrc } from "./safeImageSrc.mjs";

const cloudinary = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";

test("keeps URLs on allowed https hosts", () => {
  for (const url of [cloudinary, "https://picsum.photos/seed/x/800/600", "https://images.unsplash.com/photo-1?w=1200"]) {
    assert.equal(safeImageSrc(url, "seed"), url);
  }
});

test("falls back to the placeholder for anything next/image would reject", () => {
  const cases = [
    "http://res.cloudinary.com/demo/image/upload/a.jpg",
    "https://example.com/a.jpg",
    "https://res.cloudinary.com:8443/demo/image/upload/a.jpg",
    "https://user:pw@res.cloudinary.com/demo/image/upload/a.jpg",
    "javascript:alert(1)",
    "//res.cloudinary.com/demo/a.jpg",
    "/relative/path.jpg",
    "not a url",
    " ",
    "",
    null,
    undefined,
    123,
    {},
  ];
  for (const url of cases) {
    assert.equal(safeImageSrc(url, "city name"), placeholderImage("city name"), String(url));
  }
});

test("uses a default seed when none is given", () => {
  assert.equal(safeImageSrc(null), placeholderImage("image"));
  assert.equal(safeImageSrc(null, ""), placeholderImage("image"));
});
