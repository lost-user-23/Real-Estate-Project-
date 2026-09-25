function serializeFacility(facility) {
    return {
        id: facility._id.toString(),
        locationId: facility.locationId.toString(),
        name: facility.name,
        type: facility.type,
        address: facility.address,
        distanceKm: facility.distanceKm,
    };
}

module.exports = {serializeFacility};