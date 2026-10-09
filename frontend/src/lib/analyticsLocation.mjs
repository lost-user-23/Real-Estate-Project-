// What Google Analytics may see of the current page. The query string is left
// out on purpose: /search?q=... would otherwise hand the keyword to GA through
// page_location, which no event-level filtering can catch.
export function pageLocation(loc) {
  return `${loc.origin}${loc.pathname}`;
}

// Names of the GA cookies (_ga, _ga_XXXX, _gid, _gat...) in a document.cookie string.
export function gaCookieNames(cookieString) {
  return String(cookieString || "")
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter((name) => /^_ga(_|$)|^_gid$|^_gat/.test(name));
}
