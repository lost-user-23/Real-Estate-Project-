const LAKH = 100_000;
const CRORE = 10_000_000;

function trimTrailingZero(value) {
  return Number(value.toFixed(2)).toString();
}

export function formatPrice(rupees) {
  if (rupees < LAKH) {
    return `₹${rupees.toLocaleString("en-IN")}`;
  }
  if (rupees < CRORE) {
    return `₹${trimTrailingZero(rupees / LAKH)} L`;
  }
  return `₹${trimTrailingZero(rupees / CRORE)} Cr`;
}

export function formatArea(sqft) {
  return `${sqft.toLocaleString("en-IN")} sq.ft`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
