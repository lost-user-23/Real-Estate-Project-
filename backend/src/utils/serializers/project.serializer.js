function serializeProject(project) {
  return typeof project.toObject === 'function' ? project.toObject() : { ...project };
}

function serializeProjects(projects) {
  return projects.map(serializeProject);
}

module.exports = { serializeProject, serializeProjects };
