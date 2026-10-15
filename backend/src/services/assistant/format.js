const { SQFT_PER_UNIT, AREA_UNIT_LABELS } = require('./preferences');

const LAKH = 100_000;
const CRORE = 10_000_000;

const trim = (n) => Number(n.toFixed(2)).toString();

// Same display convention as frontend/src/lib/format.js.
function formatPrice(rupees) {
  if (rupees < LAKH) return `₹${rupees.toLocaleString('en-IN')}`;
  if (rupees < CRORE) return `₹${trim(rupees / LAKH)} L`;
  return `₹${trim(rupees / CRORE)} Cr`;
}

// `sqft` is always the stored unit; `unit` is only how the user likes to read it.
function formatArea(sqft, unit = 'sqft') {
  const factor = SQFT_PER_UNIT[unit] || 1;
  const value = sqft / factor;
  const text = unit === 'acre' ? value.toFixed(2) : Math.round(value).toLocaleString('en-IN');
  return `${text} ${AREA_UNIT_LABELS[unit] || 'sq ft'}`;
}

// Rounds a derived amount (a raised or lowered budget) to a figure people would say.
function niceAmount(value) {
  const step = value >= 10_000_000 ? 500_000 : value >= 1_000_000 ? 100_000 : value >= 100_000 ? 10_000 : 1_000;
  return Math.max(step, Math.round(value / step) * step);
}

module.exports = { formatPrice, formatArea, niceAmount };
