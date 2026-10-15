const Property = require('../models/Property');
const Location = require('../models/Location');
const Project = require('../models/Project');
const Article = require('../models/Article');
const Report = require('../models/Report');
const LoanEnquiry = require('../models/LoanEnquiry');
const asyncHandler = require('../utils/asyncHandler');

// A location only counts as popular for the dashboard once it has this many
// active listings; matches the rule the admin Locations page enforces.
const MIN_ACTIVE_LISTINGS_FOR_POPULAR = 5;

const getDashboard = asyncHandler(async (req, res) => {
  const [
    publishedListings,
    featuredListings,
    awaitingVerification,
    popularLocations,
    publishedProjects,
    publishedArticles,
    openReports,
    newLoanEnquiries,
  ] = await Promise.all([
    Property.countDocuments({ status: 'published' }),
    Property.countDocuments({ status: 'published', featured: true }),
    Property.countDocuments({ status: 'published', verified: false }),
    Location.countDocuments({ popular: true, activeListingCount: { $gte: MIN_ACTIVE_LISTINGS_FOR_POPULAR } }),
    Project.countDocuments({ status: 'published' }),
    Article.countDocuments({ status: 'published' }),
    Report.countDocuments({ status: 'open' }),
    LoanEnquiry.countDocuments({ status: 'new' }),
  ]);

  res.status(200).json({
    stats: {
      publishedListings,
      featuredListings,
      awaitingVerification,
      popularLocations,
      publishedProjects,
      publishedArticles,
      openReports,
      newLoanEnquiries,
    },
  });
});

module.exports = { getDashboard, MIN_ACTIVE_LISTINGS_FOR_POPULAR };
