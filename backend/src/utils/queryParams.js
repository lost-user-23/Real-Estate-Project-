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

const MAX_KEYWORD_LENGTH = 100;

// Optional ?q= keyword search: a single non-empty string of at most
// MAX_KEYWORD_LENGTH characters. Returns the trimmed value, or undefined when
// absent; problems are pushed onto `errors`.
function parseKeyword(query, errors) {
  if (query.q == null) return undefined;
  const q = typeof query.q === 'string' ? query.q.trim() : null;
  if (q === null) {
    errors.push('q must be a string');
  } else if (q.length === 0) {
    errors.push('q must not be empty');
  } else if (q.length > MAX_KEYWORD_LENGTH) {
    errors.push(`q must be at most ${MAX_KEYWORD_LENGTH} characters`);
  } else {
    return q;
  }
  return undefined;
}

module.exports = { parseOptionalCity, parseOptionalText, parseKeyword };
