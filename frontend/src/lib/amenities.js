// Priority order confirmed with ops/content (PRD §6). Amenities not in this
// list are treated as lowest priority and sort after known ones.
export const AMENITY_PRIORITY = [
  "Parking",
  "Lift",
  "Power Backup",
  "Security",
  "Gym",
  "Clubhouse",
  "Garden",
  "Swimming Pool",
  "Kids Play Area",
  "Pet Friendly",
];

export function topAmenities(amenities, count = 3) {
  return [...amenities]
    .sort((a, b) => {
      const rankA = AMENITY_PRIORITY.indexOf(a);
      const rankB = AMENITY_PRIORITY.indexOf(b);
      return (rankA === -1 ? Infinity : rankA) - (rankB === -1 ? Infinity : rankB);
    })
    .slice(0, count);
}
