const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/savedProperty.service");
const { serializeProperties } = require("../utils/serializers/property.serializer");

exports.listIds = asyncHandler(async (req, res) => {
    const propertyIds = await service.listIds(req.user._id);
    res.json({ propertyIds });
});

exports.list = asyncHandler(async (req, res) => {
    const { properties, imagesByPropertyId, meta } = await service.list(req.user._id, req.query);
    res.json({ properties: serializeProperties(properties, imagesByPropertyId), meta });
});

exports.save = asyncHandler(async (req, res) => {
    await service.save(req.user._id, req.params.propertyId);
    res.json({ message: "Property saved"});
});

exports.remove = asyncHandler(async (req, res) => {
    await service.remove(req.user._id, req.params.propertyId);
    res.json({ message: "Property removed"});
});