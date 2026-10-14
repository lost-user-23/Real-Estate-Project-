// Retries the background photo import for scraped drafts whose photos are still
// "pending" (the server stopped before the queue finished) or "partial" (some
// images failed). Safe to run again: photos already saved are skipped, nothing
// is ever deleted, and a listing that finishes is marked "done".
//
// Usage: npm run import:retry-images

async function main() {
  const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
  const { Property } = require('../src/models');
  const { enqueueImageImports, whenImageQueueIdle } = require('../src/services/importImages.service');

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[import-retry-images] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const rows = await Property.find({ status: 'draft', imageImportStatus: { $in: ['pending', 'partial'] } })
      .select('_id')
      .lean();
    console.log(`[import-retry-images] ${rows.length} listing(s) to retry`);

    enqueueImageImports(rows.map((row) => row._id));
    await whenImageQueueIdle();

    const left = await Property.countDocuments({ status: 'draft', imageImportStatus: { $in: ['pending', 'partial'] } });
    console.log(`[import-retry-images] done; ${left} listing(s) still pending or partial`);
  } catch (error) {
    console.error(`[import-retry-images] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
