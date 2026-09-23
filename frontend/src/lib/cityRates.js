// Indicative average sale rate (rupees per sq.ft) per city, for the property
// value estimator only. Broadly consistent with MOCK_PROPERTIES so the
// estimator's numbers don't contradict the listings shown elsewhere on the
// site. Not a real valuation model - swap for a priced-data API later.
export const CITY_RATE_PER_SQFT = {
  Mumbai: 18000,
  "Delhi NCR": 9500,
  Bengaluru: 11000,
  Pune: 8500,
  Hyderabad: 7500,
  Chennai: 7000,
  Kolkata: 6000,
  Ahmedabad: 5500,
  Kochi: 5000,
  Coimbatore: 4500,
  Nagpur: 4000,
};

export const DEFAULT_RATE_PER_SQFT = 7000;

// Rough type and age multipliers layered on the base city rate - plots carry
// no built-up premium, commercial trades higher, and older properties
// discount slightly. All indicative only.
export const PROPERTY_TYPE_MULTIPLIER = {
  apartment: 1,
  villa: 1.1,
  "independent-house": 1.05,
  plot: 0.65,
  commercial: 1.35,
};

export function ageMultiplier(ageInYears) {
  if (ageInYears <= 1) return 1.05;
  if (ageInYears <= 5) return 1;
  if (ageInYears <= 10) return 0.92;
  if (ageInYears <= 20) return 0.82;
  return 0.7;
}
