import test from "node:test";
import assert from "node:assert/strict";
import { clearSessionHint, hasSessionHint, setSessionHint } from "./sessionHint.mjs";

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test("no hint by default, so an anonymous visitor does not call refresh", () => {
  assert.equal(hasSessionHint(fakeStorage()), false);
});

test("set then clear", () => {
  const s = fakeStorage();
  setSessionHint(s);
  assert.equal(hasSessionHint(s), true);
  clearSessionHint(s);
  assert.equal(hasSessionHint(s), false);
});

test("the stored value is a bare flag, never a token", () => {
  const s = fakeStorage();
  setSessionHint(s);
  assert.deepEqual(Object.values(s.data), ["1"]);
});

test("a throwing storage reads as no hint and never throws", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(hasSessionHint(broken), false);
  assert.doesNotThrow(() => setSessionHint(broken));
  assert.doesNotThrow(() => clearSessionHint(broken));
});
