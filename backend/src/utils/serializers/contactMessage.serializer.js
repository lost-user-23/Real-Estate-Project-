// `ipAddress` has `select: false` in the schema, but a freshly created document
// still holds it in memory, so it is stripped here before reaching any response.
function serializeContactMessage(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id),
    name: obj.name,
    email: obj.email,
    phone: obj.phone ?? null,
    message: obj.message,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serializeContactMessages(docs) {
  return docs.map(serializeContactMessage);
}

module.exports = { serializeContactMessage, serializeContactMessages };
