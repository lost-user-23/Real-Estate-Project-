import test from "node:test";
import assert from "node:assert/strict";
import { gaCookieNames, pageLocation } from "./analyticsLocation.mjs";

test("pageLocation drops the query string and hash", () => {
  const loc = new URL("https://www.example.com/search?q=secretkeyword&bhk=2#top");
  assert.equal(pageLocation(loc), "https://www.example.com/search");
  assert.ok(!pageLocation(loc).includes("secretkeyword"));
});

test("gaCookieNames picks only GA cookies", () => {
  assert.deepEqual(gaCookieNames("a=1; _ga=GA1; _ga_ABC=x; _gid=2; other=3"), ["_ga", "_ga_ABC", "_gid"]);
  assert.deepEqual(gaCookieNames(""), []);
});
