// Optional ?city= on public list endpoints: must be a single non-blank string
// (a repeated param arrives as an array and is rejected). Returns the trimmed
// value, or undefined when absent; problems are pushed onto `errors`.
function parseOptionalCity(query, errors) {
  if (query.city == null) return undefined;
  if (typeof query.city !== 'string' || query.city.trim().length === 0) {
    errors.push('city must be a non-empty string');
    return undefined;
  }
  return query.city.trim();
}

module.exports = { parseOptionalCity };
