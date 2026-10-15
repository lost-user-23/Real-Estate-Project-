const Property = require('../../models/Property');
const { normalizeCity } = require('../../utils/normalizeCity');

// What the published inventory actually contains: the cities and localities a
// conversation is allowed to name. One aggregation, cached briefly so a chat
// does not hit the database for it on every message.
const CACHE_MS = 60 * 1000;
let cache = null;

async function loadCatalog() {
  const rows = await Property.aggregate([
    { $match: { status: 'published' } },
    {
      $group: {
        _id: { cityLower: '$cityLower', locality: '$locality' },
        city: { $first: '$city' },
        count: { $sum: 1 },
      },
    },
  ]);

  const cities = new Map();
  const localities = [];
  for (const row of rows) {
    const cityLower = row._id.cityLower;
    if (!cityLower) continue;
    const entry = cities.get(cityLower) || { city: row.city, cityLower, count: 0 };
    entry.count += row.count;
    cities.set(cityLower, entry);
    const locality = row._id.locality;
    if (typeof locality === 'string' && locality.trim()) {
      localities.push({
        city: row.city,
        cityLower,
        locality: locality.trim(),
        localityLower: normalizeCity(locality),
        count: row.count,
      });
    }
  }
  return {
    cities: [...cities.values()].sort((a, b) => b.count - a.count),
    localities: localities.sort((a, b) => b.count - a.count),
  };
}

async function getCatalog() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = await loadCatalog();
  cache = { at: Date.now(), value };
  return value;
}

function clearCatalogCache() {
  cache = null;
}

module.exports = { getCatalog, clearCatalogCache };
