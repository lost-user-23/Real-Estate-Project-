// Fills cityLower (Property, Project, Location) and localityLower (Location)
// from the stored city/locality. Idempotent: only documents whose stored value
// differs from the computed one are written, so a second run changes nothing.
// Prints counts only, never document contents. Run via `npm run backfill:city-lower`.
const { normalizeCity } = require('../src/utils/normalizeCity');

const BATCH_SIZE = 500;

const TARGETS = [
  { name: 'Property', withLocality: false },
  { name: 'Project', withLocality: false },
  { name: 'Location', withLocality: true },
];

// Pure: the $set a document needs, or null when it is already correct.
function planUpdate(doc, { withLocality }) {
  const set = {};

  const cityLower = normalizeCity(doc.city);
  if (doc.cityLower !== cityLower) set.cityLower = cityLower;

  if (withLocality) {
    const localityLower = doc.locality ? normalizeCity(doc.locality) : null;
    if ((doc.localityLower ?? null) !== localityLower) set.localityLower = localityLower;
  }

  return Object.keys(set).length > 0 ? set : null;
}

async function backfillModel(Model, { withLocality }) {
  const counts = { scanned: 0, updated: 0 };
  let ops = [];

  const flush = async () => {
    if (ops.length === 0) return;
    // timestamps: false keeps updatedAt untouched; this is a derived field, not an edit.
    await Model.bulkWrite(ops, { timestamps: false });
    counts.updated += ops.length;
    ops = [];
  };

  const projection = withLocality ? 'city cityLower locality localityLower' : 'city cityLower';
  for await (const doc of Model.find({}).select(projection).lean().cursor()) {
    counts.scanned += 1;
    const set = planUpdate(doc, { withLocality });
    if (set) ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    if (ops.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return counts;
}

async function main() {
  const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
  const models = require('../src/models');

  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[backfill-city-lower] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    for (const { name, withLocality } of TARGETS) {
      const { scanned, updated } = await backfillModel(models[name], { withLocality });
      console.log(`[backfill-city-lower] ${name}: scanned ${scanned}, updated ${updated}`);
    }
    console.log('[backfill-city-lower] done.');
  } catch (error) {
    console.error(`[backfill-city-lower] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { planUpdate, backfillModel, TARGETS };
