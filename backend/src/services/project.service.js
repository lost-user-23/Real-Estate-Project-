const Project = require('../models/Project');
const { normalizeCity } = require('../utils/normalizeCity');

const EDITABLE_FIELDS = [
  'name',
  'developer',
  'city',
  'locality',
  'imageUrl',
  'imageAlt',
  'startingPriceInRupees',
  'possessionLabel',
  'status',
];

const NEW_PROJECTS_LIMIT = 4;

async function createProject(input) {
  const status = input.status || 'draft';
  return Project.create({
    name: input.name,
    developer: input.developer,
    city: input.city,
    locality: input.locality ?? null,
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    startingPriceInRupees: input.startingPriceInRupees,
    possessionLabel: input.possessionLabel ?? '',
    status,
    publishedAt: status === 'published' ? new Date() : null,
  });
}

async function listProjects({ page, limit, publishedOnly }) {
  const filter = publishedOnly ? { status: 'published' } : {};
  const skip = (page - 1) * limit;
  // _id breaks createdAt/publishedAt ties so pagination order is deterministic.
  const sort = publishedOnly ? { publishedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const [projects, total] = await Promise.all([
    Project.find(filter).sort(sort).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  return { projects, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function listNewProjects() {
  return Project.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(NEW_PROJECTS_LIMIT);
}

const MAX_BUILDERS = 50;

// Published projects grouped by the developer string exactly as stored (no
// merging of spelling variants). Busiest builders first, capped at
// MAX_BUILDERS; projects inside a builder are newest published first.
async function listBuilders({ city } = {}) {
  const match = { status: 'published' };
  if (city) match.cityLower = normalizeCity(city);

  const groups = await Project.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$developer',
        projectIds: { $push: '$_id' },
        cities: { $addToSet: '$city' },
        projectCount: { $sum: 1 },
      },
    },
    { $sort: { projectCount: -1, _id: 1 } },
    { $limit: MAX_BUILDERS },
  ]);

  const allIds = groups.flatMap((group) => group.projectIds);
  const projects = await Project.find({ _id: { $in: allIds } });
  const byId = new Map(projects.map((project) => [project._id.toString(), project]));
  const publishedTime = (project) => (project.publishedAt ? project.publishedAt.getTime() : 0);

  return groups.map((group) => ({
    name: group._id,
    projectCount: group.projectCount,
    cities: [...group.cities].sort((a, b) => a.localeCompare(b)),
    projects: group.projectIds
      .map((id) => byId.get(id.toString()))
      .filter(Boolean)
      .sort((a, b) => publishedTime(b) - publishedTime(a) || (a._id.toString() < b._id.toString() ? -1 : 1)),
  }));
}

async function findPublishedById(id) {
  return Project.findOne({ _id: id, status: 'published' });
}

async function findById(id) {
  return Project.findById(id);
}

async function updateProjectById(id, body) {
  const project = await Project.findById(id);
  if (!project) return null;

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      project[field] = body[field];
    }
  }

  if (project.isModified('status') && project.status === 'published' && !project.publishedAt) {
    project.publishedAt = new Date();
  }

  return project.save();
}

async function publishProjectById(id) {
  const project = await Project.findById(id);
  if (!project) return null;

  project.status = 'published';
  if (!project.publishedAt) project.publishedAt = new Date();
  return project.save();
}

async function deleteProjectById(id) {
  return Project.findByIdAndDelete(id);
}

module.exports = {
  EDITABLE_FIELDS,
  createProject,
  listProjects,
  listNewProjects,
  listBuilders,
  findPublishedById,
  findById,
  updateProjectById,
  publishProjectById,
  deleteProjectById,
};
