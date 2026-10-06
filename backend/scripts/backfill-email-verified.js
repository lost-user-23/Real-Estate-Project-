// Marks accounts that predate email verification as verified. Idempotent: only
// documents with no emailVerified field at all are touched, so a second run
// changes nothing and never flips an account that is genuinely unverified.
// Prints counts only. Run via `npm run backfill:email-verified`.
async function backfillEmailVerified(User) {
  // The raw collection bypasses Mongoose, so updatedAt is left untouched.
  const result = await User.collection.updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: true } }
  );
  return { updated: result.modifiedCount };
}

async function main() {
  const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
  const User = require('../src/models/User');

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[backfill-email-verified] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const { updated } = await backfillEmailVerified(User);
    console.log(`[backfill-email-verified] User: updated ${updated}`);
    console.log('[backfill-email-verified] done.');
  } catch (error) {
    console.error(`[backfill-email-verified] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { backfillEmailVerified };
