import test from "node:test";
import assert from "node:assert/strict";
import { BUILDER_LIST_LIMIT, builderListNote } from "./builderList.mjs";

test("says how many are shown when the API has more", () => {
  assert.equal(builderListNote(50, 73), "Showing 50 of 73 builders.");
});

test("no note when everything is shown or the numbers are unknown", () => {
  assert.equal(builderListNote(4, 4), null);
  assert.equal(builderListNote(0, 0), null);
  assert.equal(builderListNote(10, undefined), null);
});

test("the page-load limit is the API maximum", () => {
  assert.equal(BUILDER_LIST_LIMIT, 50);
});
