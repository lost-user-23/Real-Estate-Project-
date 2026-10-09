import test from "node:test";
import assert from "node:assert/strict";
import { lastPageRedirect } from "./pagination.mjs";

test("redirects to the last page when the page is past the end", () => {
  assert.equal(lastPageRedirect(999, { total: 5, totalPages: 1 }), 1);
  assert.equal(lastPageRedirect(4, { total: 30, totalPages: 3 }), 3);
});

test("no redirect inside the range", () => {
  assert.equal(lastPageRedirect(1, { total: 5, totalPages: 1 }), null);
  assert.equal(lastPageRedirect(3, { total: 30, totalPages: 3 }), null);
});

test("no redirect when there are no results or no meta (avoids a loop)", () => {
  assert.equal(lastPageRedirect(2, { total: 0, totalPages: 1 }), null);
  assert.equal(lastPageRedirect(2, null), null);
  assert.equal(lastPageRedirect(2, {}), null);
});
