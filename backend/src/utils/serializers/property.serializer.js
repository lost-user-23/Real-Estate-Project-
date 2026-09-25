// `contactNumber` has `select: false` in the schema, which only affects
// queries that don't explicitly re-select it. A document built or modified
// in-memory (create, update) still holds the field, so it must be stripped
// here before any property ever reaches a JSON response.
function serializeProperty(property) {
  const obj = typeof property.toObject === 'function' ? property.toObject() : { ...property };
  delete obj.contactNumber;
  return obj;
}

function serializeProperties(properties) {
  return properties.map(serializeProperty);
}

module.exports = { serializeProperty, serializeProperties };
