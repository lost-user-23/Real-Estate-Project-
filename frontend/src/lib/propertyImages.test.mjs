import test from "node:test";
import assert from "node:assert/strict";
import { placeholderImage } from "./safeImageSrc.mjs";
import { primaryImage, safeImages } from "./propertyImages.mjs";

const good = "https://res.cloudinary.com/demo/image/upload/v1/property-images/a.jpg";
const good2 = "https://res.cloudinary.com/demo/image/upload/v1/property-images/b.jpg";

test("primaryImage keeps a valid first image and its alt", () => {
  const image = primaryImage({ title: "Flat", images: [{ url: good, alt: "Hall" }] }, "p1");
  assert.deepEqual(image, { src: good, alt: "Hall" });
});

test("primaryImage replaces a bad first image with the placeholder", () => {
  for (const url of ["http://res.cloudinary.com/demo/a.jpg", "https://example.com/a.jpg", "not a url", "", null]) {
    const image = primaryImage({ title: "Flat", images: [{ url }] }, "p1");
    assert.equal(image.src, placeholderImage("p1"), String(url));
    assert.equal(image.alt, "Flat");
  }
});

test("primaryImage works with empty or missing images", () => {
  assert.deepEqual(primaryImage({ title: "Flat", images: [] }, "p1"), { src: placeholderImage("p1"), alt: "Flat" });
  assert.deepEqual(primaryImage({ title: "Flat" }, "p1"), { src: placeholderImage("p1"), alt: "Flat" });
});

test("safeImages replaces only the bad items and keeps other fields", () => {
  const result = safeImages(
    [
      { url: good, alt: "one", displayOrder: 0 },
      { url: "https://example.com/x.jpg", alt: "two", displayOrder: 1 },
      { url: good2, alt: "three", displayOrder: 2 },
    ],
    "p1"
  );
  assert.deepEqual(result.map((image) => image.url), [good, placeholderImage("p1-2"), good2]);
  assert.deepEqual(result.map((image) => image.alt), ["one", "two", "three"]);
  assert.equal(result[1].displayOrder, 1);
});

test("safeImages never throws on odd input", () => {
  assert.deepEqual(safeImages(undefined, "p1"), []);
  assert.deepEqual(safeImages(null, "p1"), []);
  assert.deepEqual(safeImages([], "p1"), []);
  assert.deepEqual(safeImages([null, undefined], "p1").map((image) => image.url), [
    placeholderImage("p1-1"),
    placeholderImage("p1-2"),
  ]);
});
