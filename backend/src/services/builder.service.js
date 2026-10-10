const Project = require('../models/Project');
const { normalizeCity } = require('../utils/normalizeCity');
const { Buffer } = require('node:buffer');

// Most project cards one builder detail response carries.
const MAX_BUILDER_PROJECTS = 100;

// "DLF", "dlf" and " DLF " are the same builder. This key is used for
// grouping, slugs and lookups so they can never disagree.
const BUILDER_COLLATION = { locale: 'en', strength: 2 };

function normalizeBuilderKey(name) {
  return name.trim().toLowerCase();
}

function slugifyBuilderName(name) {
  const key = normalizeBuilderKey(name);
  const readable = key
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'builder';
  return `${readable}~${Buffer.from(key, 'utf8').toString('base64url')}`;
}

// Returns the normalized builder key, or null for a forged or malformed slug.
function developerFromSlug(slug) {
  const separator = slug.lastIndexOf('~');
  if (separator < 1) return null;

  const encodedName = slug.slice(separator + 1);
  const key = Buffer.from(encodedName, 'base64url').toString('utf8');
  return key && slugifyBuilderName(key) === slug ? key : null;
}

function mostCommonCity(cities) {
  return cities.sort((a, b) => b.projectCount - a.projectCount || a.city.localeCompare(b.city))[0]?.city;
}

// Deterministic display name: the lowest spelling in binary order
// ("DLF" wins over "dlf"), matching what $min does in the pipeline.
function pickDisplayName(names) {
  return names.reduce((best, name) => (name < best ? name : best));
}

async function listBuilders({ city, page, limit }) {
  const match = { status: 'published' };
  if (city) match.cityLower = normalizeCity(city);

  const skip = (page - 1) * limit;
  const [result] = await Project.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          developer: { $toLower: { $trim: { input: '$developer' } } },
          city: '$city',
        },
        displayName: { $min: { $trim: { input: '$developer' } } },
        cityProjectCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.developer',
        displayName: { $min: '$displayName' },
        publishedProjectCount: { $sum: '$cityProjectCount' },
        cities: { $push: { city: '$_id.city', projectCount: '$cityProjectCount' } },
      },
    },
    {
      $facet: {
        builders: [
          { $sort: { publishedProjectCount: -1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
        ],
        totals: [{ $count: 'total' }],
      },
    },
  ]);

  const groups = result?.builders ?? [];
  const total = result?.totals[0]?.total ?? 0;
  return {
    builders: groups.map((group) => ({
      name: group.displayName,
      slug: slugifyBuilderName(group._id),
      city: mostCommonCity(group.cities),
      publishedProjectCount: group.publishedProjectCount,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getBuilderBySlug(slug, { city } = {}) {
  const developerKey = developerFromSlug(slug);
  if (!developerKey) return null;

  // Case-insensitive match (collation) so every spelling of the builder is found.
  const filter = { developer: developerKey, status: 'published' };
  if (city) filter.cityLower = normalizeCity(city);

  // The project cards are capped; the count and the main city come from the
  // database so they stay true for a builder with more projects than the cap.
  const [projects, publishedProjectCount, cityRows] = await Promise.all([
    Project.find(filter)
      .collation(BUILDER_COLLATION)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(MAX_BUILDER_PROJECTS),
    Project.countDocuments(filter).collation(BUILDER_COLLATION),
    Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$city',
          displayName: { $min: { $trim: { input: '$developer' } } },
          projectCount: { $sum: 1 },
        },
      },
    ]).collation(BUILDER_COLLATION),
  ]);
  if (projects.length === 0) return null;

  const cities = cityRows.map((row) => ({ city: row._id, projectCount: row.projectCount }));
  const name = pickDisplayName(cityRows.map((row) => row.displayName));

  return {
    name,
    slug: slugifyBuilderName(developerKey),
    city: mostCommonCity(cities),
    publishedProjectCount,
    projects,
  };
}

module.exports = { listBuilders, getBuilderBySlug };