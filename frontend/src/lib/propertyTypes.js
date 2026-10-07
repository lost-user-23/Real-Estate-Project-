export const PROPERTY_TYPE_LABELS = {
  apartment: "Apartment",
  villa: "Villa",
  "independent-house": "Independent House",
  plot: "Plot",
  "pg-hostel": "PG/Hostel",
  commercial: "Commercial",
  studio: "Studio",
  penthouse: "Penthouse",
};

// Options change with the active hero tab (PRD §5).
export const PROPERTY_TYPE_OPTIONS_BY_INTENT = {
  buy: ["apartment", "villa", "independent-house", "studio", "penthouse", "plot", "commercial"],
  rent: ["apartment", "villa", "independent-house", "studio", "penthouse", "pg-hostel", "commercial"],
};
