const Project = require('../models/Project');

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
  findPublishedById,
  findById,
  updateProjectById,
  publishProjectById,
  deleteProjectById,
};
