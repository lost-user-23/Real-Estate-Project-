const mongoose = require('mongoose');
const SavedProperty = require('../models/SavedProperty');
const Property = require('../models/Property');
const AppError = require('../utils/AppError');
const { getImagesForProperties } = require('./property.service');

const assertValidId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid property id', 400);
};

exports.save = async (userId, propertyId) => {
  assertValidId(propertyId);
  const exists = await Property.exists({ _id: propertyId, status: 'published' });
  if (!exists) throw new AppError('Property not found', 404);

  try {
    // single atomic upsert: no find-then-create race
    await SavedProperty.updateOne(
      { userId, propertyId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    // two simultaneous first-time saves can both try to insert; the loser is fine
    if (err.code !== 11000) throw err;
  }
};

exports.remove = async (userId, propertyId) => {
  assertValidId(propertyId);
  await SavedProperty.deleteOne({ userId, propertyId }); // 0 deleted is still success
};

// Saved rows joined to their published property, newest save first. Rows whose
// property is unpublished or gone are dropped by the join.
const publishedSavedPipeline = (userId) => [
  { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
  { $sort: { createdAt: -1, _id: -1 } },
  {
    $lookup: {
      from: Property.collection.name,
      localField: 'propertyId',
      foreignField: '_id',
      pipeline: [{ $match: { status: 'published' } }, { $project: { _id: 1 } }],
      as: 'property',
    },
  },
  { $match: { 'property.0': { $exists: true } } },
];

exports.listIds = async (userId) => {
  const rows = await SavedProperty.aggregate([
    ...publishedSavedPipeline(userId),
    { $project: { propertyId: 1 } },
  ]);
  return rows.map((r) => String(r.propertyId));
};

exports.list = async (userId, { page = 1, limit = 20 } = {}) => {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const [result] = await SavedProperty.aggregate([
    ...publishedSavedPipeline(userId),
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { propertyId: 1 } }],
        count: [{ $count: 'total' }],
      },
    },
  ]);
  const pageIds = result.items.map((r) => r.propertyId);
  const total = result.count[0]?.total || 0;

  const props = await Property.find({ _id: { $in: pageIds }, status: 'published' });
  const byId = new Map(props.map((p) => [p._id.toString(), p]));
  const ordered = pageIds.map((id) => byId.get(id.toString())).filter(Boolean);
  const imagesByPropertyId = await getImagesForProperties(pageIds);

  return {
    properties: ordered,
    imagesByPropertyId,
    meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

// Called when properties are deleted so no orphaned saved rows remain.
exports.removeAllForProperties = async (propertyIds) => {
  await SavedProperty.deleteMany({ propertyId: { $in: propertyIds } });
};
