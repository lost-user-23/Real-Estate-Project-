function serializeImage(image) {
  const obj = typeof image.toObject === 'function' ? image.toObject() : { ...image };
  return {
    id: String(obj._id),
    url: obj.url,
    alt: obj.alt,
    displayOrder: obj.displayOrder,
  };
}

// `contactNumber` has `select: false` in the schema, which only affects
// queries that don't explicitly re-select it. A document built or modified
// in-memory (create, update) still holds the field, so it must be stripped
// here before any property ever reaches a JSON response.
function serializeProperty(property, images = []) {
  const obj = typeof property.toObject === 'function' ? property.toObject() : { ...property };
  delete obj.contactNumber;
  obj.images = images.map(serializeImage);
  return obj;
}

function serializeProperties(properties, imagesByPropertyId = new Map()) {
  return properties.map((property) =>
    serializeProperty(property, imagesByPropertyId.get(String(property._id)) || [])
  );
}

module.exports = { serializeProperty, serializeProperties };
