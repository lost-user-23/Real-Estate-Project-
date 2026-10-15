import test from "node:test";
import assert from "node:assert/strict";
import { emiHref, enquiryMessage, loanHref, suggestedLoanAmount } from "./assistantLinks.mjs";

const flat = { id: "65f0a1b2c3d4e5f6a7b8c9d0", intent: "buy", priceInRupees: 6_500_000, title: "Sunny 3 BHK", locality: "Baner", city: "Pune" };

test("suggests 80% of the price, rounded to ten thousand", () => {
  assert.equal(suggestedLoanAmount(6_500_000), 5_200_000);
  assert.equal(suggestedLoanAmount(1_234_567), 990_000);
  assert.equal(suggestedLoanAmount(0), null);
  assert.equal(suggestedLoanAmount(Number.NaN), null);
});

test("links purchase properties to the calculator and loan form with the property id", () => {
  assert.equal(emiHref(flat), "/tools/emi-calculator?type=home&amount=5200000&propertyId=65f0a1b2c3d4e5f6a7b8c9d0");
  assert.equal(loanHref(flat), "/tools/loans?type=home&amount=5200000&propertyId=65f0a1b2c3d4e5f6a7b8c9d0");
});

test("offers no loan links for rentals", () => {
  assert.equal(emiHref({ ...flat, intent: "rent" }), null);
  assert.equal(loanHref({ ...flat, intent: "rent" }), null);
});

test("drops a property id that is not a valid id", () => {
  assert.equal(emiHref({ ...flat, id: "not-an-id" }), "/tools/emi-calculator?type=home&amount=5200000");
});

test("prefills an enquiry message that names the listing", () => {
  assert.match(enquiryMessage(flat), /Sunny 3 BHK" in Baner, Pune/);
});
