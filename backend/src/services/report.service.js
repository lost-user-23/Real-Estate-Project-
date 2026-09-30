const Report = require('../models/Report');

async function createReport({ listingUrlOrId, reason, details, propertyId, reporterId }) {
  return Report.create({
    listingUrlOrId,
    reason,
    details: details ?? '',
    propertyId: propertyId ?? null,
    reporterId: reporterId ?? null,
    status: 'open',
  });
}

async function listReports({ page, limit, status }) {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter),
  ]);

  return { reports, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function findById(id) {
  return Report.findById(id);
}

async function updateStatusById(id, status) {
  const report = await Report.findById(id);
  if (!report) return null;

  report.status = status;
  return report.save();
}

module.exports = {
  createReport,
  listReports,
  findById,
  updateStatusById,
};