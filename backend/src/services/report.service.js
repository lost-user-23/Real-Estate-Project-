const { URL } = require('node:url');
const Report = require('../models/Report');
const Property = require('../models/Property');
const AppError = require('../utils/AppError');

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const SLUG = /^[a-z0-9-]+$/;
const PROPERTY_PATH = /^\/property\/([^/]+)\/?$/;

// Pulls a property slug out of "/property/<slug>" or a full http(s) URL whose
// pathname is "/property/<slug>". Parsing only; nothing is ever fetched.
function extractSlug(text) {
  let pathname;
  try {
    if (text.startsWith('/')) {
      pathname = new URL(text, 'http://placeholder.invalid').pathname;
    } else {
      const url = new URL(text);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      pathname = url.pathname;
    }
  } catch {
    return null;
  }

  const match = PROPERTY_PATH.exec(pathname);
  if (!match) return null;

  let slug;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return SLUG.test(slug) ? slug : null;
}

async function resolvePropertyId(listingUrlOrId) {
  const text = String(listingUrlOrId).trim();

  if (OBJECT_ID.test(text)) {
    const property = await Property.findById(text).select('_id').lean();
    return property ? property._id : null;
  }

  const slug = extractSlug(text);
  if (!slug) return null;
  const property = await Property.findOne({ slug }).select('_id').lean();
  return property ? property._id : null;
}

async function createReport({ listingUrlOrId, reason, details, propertyId, reporterId }) {
  let resolvedId;
  if (propertyId) {
    // A sent id is kept only if it points at a real property; never a failure.
    const property = await Property.findById(propertyId).select('_id').lean();
    resolvedId = property ? property._id : null;
  } else {
    resolvedId = await resolvePropertyId(listingUrlOrId);
  }

  // Logged-in reporters get one live report per listing; anonymous reports are not deduped.
  if (reporterId) {
    const sameListing = [{ listingUrlOrId }];
    if (resolvedId) sameListing.push({ propertyId: resolvedId });
    const existing = await Report.exists({
      reporterId,
      status: { $in: ['open', 'reviewing'] },
      $or: sameListing,
    });
    if (existing) {
      throw AppError.conflict('You have already reported this listing. We are still looking into it.');
    }
  }

  return Report.create({
    listingUrlOrId,
    reason,
    details: details ?? '',
    propertyId: resolvedId,
    reporterId: reporterId ?? null,
    status: 'open',
  });
}

// Maps propertyId (string) to a small summary of the existing properties the
// given reports point at. Deleted properties are simply absent from the map.
async function loadPropertySummaries(reports) {
  const ids = [...new Set(reports.filter((r) => r.propertyId).map((r) => String(r.propertyId)))];
  if (ids.length === 0) return new Map();

  const properties = await Property.find({ _id: { $in: ids } })
    .select('slug title city locality status')
    .lean();
  return new Map(properties.map((p) => [String(p._id), p]));
}

async function listReportsByReporter(reporterId, { page, limit }) {
  const filter = { reporterId };
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Report.countDocuments(filter),
  ]);
  const properties = await loadPropertySummaries(reports);

  return { reports, properties, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function listReports({ page, limit, status }) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter),
  ]);
  const properties = await loadPropertySummaries(reports);

  return { reports, properties, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function findById(id) {
  const report = await Report.findById(id);
  if (!report) return null;
  return { report, properties: await loadPropertySummaries([report]) };
}

async function updateStatusById(id, status) {
  const report = await Report.findById(id);
  if (!report) return null;

  report.status = status;
  await report.save();
  return { report, properties: await loadPropertySummaries([report]) };
}

module.exports = {
  createReport,
  listReportsByReporter,
  listReports,
  findById,
  updateStatusById,
};
