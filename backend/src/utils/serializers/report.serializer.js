function toPlain(report) {
  return typeof report.toObject === 'function' ? report.toObject() : { ...report };
}

function serializeProperty(property) {
  if (!property) return null;
  return {
    id: String(property._id),
    slug: property.slug,
    title: property.title,
    city: property.city,
    locality: property.locality ?? null,
    status: property.status,
  };
}

// The public POST response uses this alone, so it never carries the property
// object. Admin responses use serializeAdminReport with the service's map.
function serializeReport(report) {
  return toPlain(report);
}

function serializeAdminReport(report, properties) {
  const plain = toPlain(report);
  const property = plain.propertyId ? properties.get(String(plain.propertyId)) : null;
  return { ...plain, property: serializeProperty(property) };
}

module.exports = { serializeReport, serializeAdminReport };
