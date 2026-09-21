// Deterministic placeholder number so the same listing always shows the same
// contact number in this mock build. The real flow fetches this from an
// authenticated API after login (PRD §6) rather than deriving it client-side.
export function getMockContactNumber(propertyId) {
  let hash = 0;
  for (const char of propertyId) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  const digits = String(7000000000 + hash).slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
