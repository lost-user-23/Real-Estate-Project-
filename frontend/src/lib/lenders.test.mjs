import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LENDERS, isSafeLenderUrl, lendersForType } from "./lenders.mjs";

const REQUIRED = ["id", "name", "loanType", "description", "applyUrl", "sourceUrl", "verifiedAt"];

test("lender ids are unique", () => {
  const ids = LENDERS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every lender has all required fields and a supported loan type", () => {
  for (const lender of LENDERS) {
    for (const key of REQUIRED) {
      assert.equal(typeof lender[key], "string", `${lender.id}.${key}`);
      assert.ok(lender[key].trim().length > 0, `${lender.id}.${key} is empty`);
    }
    assert.ok(["home", "personal"].includes(lender.loanType), lender.id);
  }
});

test("application and source URLs are https and parse", () => {
  for (const lender of LENDERS) {
    for (const url of [lender.applyUrl, lender.sourceUrl]) {
      assert.ok(url.startsWith("https://"), `${lender.id}: ${url}`);
      assert.ok(isSafeLenderUrl(url), `${lender.id}: ${url}`);
    }
  }
});

test("verification dates are real ISO dates, not in the future", () => {
  for (const lender of LENDERS) {
    assert.match(lender.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    const date = new Date(`${lender.verifiedAt}T00:00:00Z`);
    assert.ok(!Number.isNaN(date.getTime()), lender.id);
    assert.ok(date.getTime() <= Date.now() + 24 * 3600 * 1000, `${lender.id} verifiedAt is in the future`);
  }
});

test("no unverified rates, fees or offers are stored on lender entries", () => {
  for (const lender of LENDERS) {
    assert.deepEqual(Object.keys(lender).sort(), [...REQUIRED].sort());
  }
});

test("isSafeLenderUrl rejects non-https, credentials and garbage", () => {
  assert.equal(isSafeLenderUrl("http://example.com"), false);
  assert.equal(isSafeLenderUrl("javascript:alert(1)"), false);
  assert.equal(isSafeLenderUrl("https://user:pw@example.com"), false);
  assert.equal(isSafeLenderUrl("not a url"), false);
  assert.equal(isSafeLenderUrl(undefined), false);
  assert.equal(isSafeLenderUrl("https://example.com/x"), true);
});

test("both loan types have at least one lender", () => {
  assert.ok(lendersForType("home").length > 0);
  assert.ok(lendersForType("personal").length > 0);
});

test("ids and loan types match the backend allowlist", () => {
  const source = readFileSync(new URL("../../../backend/src/utils/loanEnquiryValidation.js", import.meta.url), "utf8");
  const block = source.match(/KNOWN_LENDERS = \{([\s\S]*?)\};/)[1];
  const backend = Object.fromEntries([...block.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const frontend = Object.fromEntries(LENDERS.map((l) => [l.id, l.loanType]));
  assert.deepEqual(frontend, backend);
});
