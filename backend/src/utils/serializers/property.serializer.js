function serializeImage(image) {
  const obj = typeof image.toObject === 'function' ? image.toObject() : { ...image };
  return {
    id: String(obj._id),
    url: obj.url,
    publicId: obj.publicId ?? null,
    alt: obj.alt,
    displayOrder: obj.displayOrder,
  };
}

// `contactNumber` has `select: false` in the schema, which only affects
// queries that don't explicitly re-select it. A document built or modified
// in-memory (create, update) still holds the field, so it must be stripped
// here before any property ever reaches a JSON response. Only the owner's own
// list (GET /properties/mine) passes includeContactNumber.
//
// `ownerId` and `status` are internal. Public routes never need them, so they
// are stripped unless the caller opts in with includeOwnerFields (owner and
// admin routes). `__v` is never useful to a client.
function serializeProperty(
  property,
  images = [],
  { includeContactNumber = false, includeOwnerFields = false } = {}
) {
  const obj = typeof property.toObject === 'function' ? property.toObject() : { ...property };
  if (includeContactNumber) {
    obj.contactNumber = obj.contactNumber ?? null;
  } else {
    delete obj.contactNumber;
  }
  delete obj.cityLower;
  delete obj.__v;
  if (!includeOwnerFields) {
    delete obj.ownerId;
    delete obj.status;
  }
  obj.images = images.map(serializeImage);
  return obj;
}

function serializeProperties(properties, imagesByPropertyId = new Map(), options = {}) {
  return properties.map((property) =>
    serializeProperty(property, imagesByPropertyId.get(String(property._id)) || [], options)
  );
}

module.exports = { serializeProperty, serializeProperties };