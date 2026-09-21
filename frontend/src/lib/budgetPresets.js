// Single source for budget brackets (PRD §5). The hero search bar and any
// future search/filter UI must read from here rather than restating values.
export const BUDGET_PRESETS = {
  buy: [
    { id: "buy-under-50l", label: "Under ₹50 L", min: 0, max: 5_000_000 },
    { id: "buy-50l-1cr", label: "₹50 L - ₹1 Cr", min: 5_000_000, max: 10_000_000 },
    { id: "buy-1cr-2cr", label: "₹1 Cr - ₹2 Cr", min: 10_000_000, max: 20_000_000 },
    { id: "buy-2cr-plus", label: "Above ₹2 Cr", min: 20_000_000, max: null },
  ],
  rent: [
    { id: "rent-under-15k", label: "Under ₹15,000", min: 0, max: 15_000 },
    { id: "rent-15k-30k", label: "₹15,000 - ₹30,000", min: 15_000, max: 30_000 },
    { id: "rent-30k-50k", label: "₹30,000 - ₹50,000", min: 30_000, max: 50_000 },
    { id: "rent-50k-plus", label: "Above ₹50,000", min: 50_000, max: null },
  ],
};

export function getBudgetPresets(intent) {
  return BUDGET_PRESETS[intent];
}
