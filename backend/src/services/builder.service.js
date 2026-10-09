const Project = require('../models/Project');
const { normalizeCity } = require('../utils/normalizeCity');
const { Buffer } = require('node:buffer');

// Most project cards one builder detail response carries.
const MAX_BUILDER_PROJECTS = 100;

function slugifyBuilderName(name) {
  const readable = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'builder';
  const encodedName = Buffer.from(name, 'utf8').toString('base64url');
  return `${readable}~${encodedName}`;
}

function developerFromSlug(slug) {
  const separator = slug.lastIndexOf('~');
  if (separator < 1) return null;

  const encodedName = slug.slice(separator + 1);
  const name = Buffer.from(encodedName, 'base64url').toString('utf8');
  return slugifyBuilderName(name) === slug ? name : null;
}

function mostCommonCity(cities) {
  return cities.sort((a, b) => b.projectCount - a.projectCount || a.city.localeCompare(b.city))[0]?.city;
}

async function listBuilders({ city, page, limit }) {
  const match = { status: 'published' };
  if (city) match.cityLower = normalizeCity(city);

  const skip = (page - 1) * limit;
  const [result] = await Project.aggregate([
    { $match: match },
    {
      $group: {
        _id: { developer: '$developer', city: '$city' },
        cityProjectCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.developer',
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
      name: group._id,
      slug: slugifyBuilderName(group._id),
      city: mostCommonCity(group.cities),
      publishedProjectCount: group.publishedProjectCount,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getBuilderBySlug(slug, { city } = {}) {
  const developer = developerFromSlug(slug);
  if (!developer) return null;

  const filter = { developer, status: 'published' };
  if (city) filter.cityLower = normalizeCity(city);
  // The project cards are capped; the count and the main city come from the
  // database so they stay true for a builder with more projects than the cap.
  const [projects, publishedProjectCount, cityRows] = await Promise.all([
    Project.find(filter).sort({ publishedAt: -1, _id: -1 }).limit(MAX_BUILDER_PROJECTS),
    Project.countDocuments(filter),
    Project.aggregate([{ $match: filter }, { $group: { _id: '$city', projectCount: { $sum: 1 } } }]),
  ]);
  if (projects.length === 0) return null;

  const cities = cityRows.map((row) => ({ city: row._id, projectCount: row.projectCount }));

  return {
    name: developer,
    slug: slugifyBuilderName(developer),
    city: mostCommonCity(cities),
    publishedProjectCount,
    projects,
  };
}

module.exports = { listBuilders, getBuilderBySlug };
