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

// Optional free-text filter (?locality=): must be a single string. A repeated
// param arrives as an array and is rejected with a 400 rather than reaching a
// regex or a lookup. The value is returned as sent; callers normalise it.
function parseOptionalText(query, key, errors) {
  if (query[key] == null) return undefined;
  if (typeof query[key] !== 'string') {
    errors.push(`${key} must be a single value`);
    return undefined;
  }
  return query[key];
}

module.exports = { parseOptionalCity, parseOptionalText };
