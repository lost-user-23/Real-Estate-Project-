export const PROPERTY_TYPE_LABELS = {
  apartment: "Apartment",
  villa: "Villa",
  "independent-house": "Independent House",
  plot: "Plot",
  "pg-hostel": "PG/Hostel",
  commercial: "Commercial",
};

// Options change with the active hero tab (PRD §5).
export const PROPERTY_TYPE_OPTIONS_BY_INTENT = {
  buy: ["apartment", "villa", "independent-house", "plot", "commercial"],
  rent: ["apartment", "villa", "independent-house", "pg-hostel", "commercial"],
};
