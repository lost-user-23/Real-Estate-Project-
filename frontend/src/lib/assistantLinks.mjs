// Links from a recommended property into the existing EMI calculator and loan
// enquiry flow. The calculator and loan form read `type`, `amount` and
// `propertyId` from the query (see parseLoanQuery in loanMath.mjs).

const DOWN_PAYMENT_SHARE = 0.2;
const ROUND_TO = 10_000;
const OBJECT_ID = /^[a-f\d]{24}$/i;

// A starting point only: 80% of the price, rounded. The user changes it in the calculator.
export function suggestedLoanAmount(priceInRupees) {
  if (!Number.isFinite(priceInRupees) || priceInRupees <= 0) return null;
  return Math.max(ROUND_TO, Math.round((priceInRupees * (1 - DOWN_PAYMENT_SHARE)) / ROUND_TO) * ROUND_TO);
}

function loanQuery(property) {
  const amount = suggestedLoanAmount(property?.priceInRupees);
  if (amount == null || property?.intent !== "buy") return null;
  const params = new URLSearchParams({ type: "home", amount: String(amount) });
  const id = String(property.id ?? property._id ?? "");
  if (OBJECT_ID.test(id)) params.set("propertyId", id);
  return params.toString();
}

// Only properties for sale have a purchase loan to estimate; rentals get null.
export function emiHref(property) {
  const query = loanQuery(property);
  return query ? `/tools/emi-calculator?${query}` : null;
}

export function loanHref(property) {
  const query = loanQuery(property);
  return query ? `/tools/loans?${query}` : null;
}

// The message prefilled in the property enquiry form. The visitor can edit it.
export function enquiryMessage(property) {
  const where = [property?.locality, property?.city].filter(Boolean).join(", ");
  return `Hi, I found "${property?.title}"${where ? ` in ${where}` : ""} through the HomeNest property finder and would like more information about it.`;
}
