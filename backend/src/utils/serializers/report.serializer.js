function serializeReport(report) {
  return typeof report.toObject === 'function' ? report.toObject() : { ...report };
}

function serializeReports(reports) {
  return reports.map(serializeReport);
}

module.exports = { serializeReport, serializeReports };