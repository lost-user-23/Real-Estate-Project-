// Shared publish-state enum for content types that follow the same
// draft/published/archived lifecycle as Property (Project, Article).
// Not explicitly enumerated for these types in the architecture doc; reusing
// Property's documented values keeps "Only published X are public" consistent
// across collections.
const CONTENT_STATUSES = ['draft', 'published', 'archived'];

module.exports = { CONTENT_STATUSES };
