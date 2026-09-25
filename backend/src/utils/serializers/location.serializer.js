function serializeLocation(location) {
    return {
        id: location._id.toString(),
        city: location.city,
        locality: location.locality,
        activeListingCount: location.activeListingCount,
        popular: location.popular,
        popularRank: location.popularRank,
        imageUrl: location.imageUrl,
        imageAlt: location.imageAlt,
    };
}

module.exports = { serializeLocation };