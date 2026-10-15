// Admin view of an enquiry. ipAddress is deliberately never included.
function serializeLoanEnquiry(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  // propertyId is populated (object with _id) for the admin views, or a bare id.
  const prop = obj.propertyId;
  const property =
    prop && typeof prop === 'object' && prop._id
      ? { id: String(prop._id), title: prop.title ?? null, slug: prop.slug ?? null }
      : prop
        ? { id: String(prop), title: null, slug: null }
        : null;
  return {
    id: String(obj._id),
    name: obj.name,
    phone: obj.phone,
    email: obj.email ?? null,
    loanType: obj.loanType,
    amountInRupees: obj.amountInRupees,
    city: obj.city ?? null,
    preferredLenderId: obj.preferredLenderId ?? null,
    property,
    consent: {
      accepted: obj.consent?.accepted === true,
      textVersion: obj.consent?.textVersion ?? null,
      acceptedAt: obj.consent?.acceptedAt ?? null,
    },
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serializeLoanEnquiries(docs) {
  return docs.map(serializeLoanEnquiry);
}

module.exports = { serializeLoanEnquiry, serializeLoanEnquiries };
