const { serializeProjects } = require('./project.serializer');

function serializeBuilder(builder) {
  return {
    name: builder.name,
    slug: builder.slug,
    city: builder.city,
    publishedProjectCount: builder.publishedProjectCount,
    ...(builder.projects ? { projects: serializeProjects(builder.projects) } : {}),
  };
}

module.exports = { serializeBuilder };
