function serializeCategory(category) {
    return {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        listingCount: category.listingCount,
        icon: category.icon,
    };
}

module.exports = { serializeCategory };