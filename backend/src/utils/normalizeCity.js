// Canonical form of a city (or locality) for matching: trimmed, inner
// whitespace collapsed, lowercased. Anything that is not a string normalizes
// to '' so callers can never throw on odd query input.
function normalizeCity(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

module.exports = { normalizeCity };
