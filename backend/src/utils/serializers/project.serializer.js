function serializeProject(project) {
  const obj = typeof project.toObject === 'function' ? project.toObject() : { ...project };
  delete obj.cityLower;
  return obj;
}

function serializeProjects(projects) {
  return projects.map(serializeProject);
}

module.exports = { serializeProject, serializeProjects };
