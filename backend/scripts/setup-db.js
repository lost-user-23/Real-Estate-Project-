const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const models = require('../src/models');

// Model.syncIndexes() builds indexes that are missing and drops indexes that
// are no longer defined on the schema. It only ever touches index metadata —
// it never drops a collection or deletes a document. Each model is synced
// independently and its own failure is caught and reported without stopping
// the rest, so one bad index definition can't leave the script in an unclear
// half-applied state.
async function syncModelIndexes(modelName, Model) {
  console.log(`[db:setup] syncing indexes for ${modelName} (${Model.collection.collectionName})...`);
  await Model.syncIndexes();
  const indexes = await Model.listIndexes();
  return { modelName, collection: Model.collection.collectionName, indexes };
}

function formatIndex(index) {
  const keyStr = Object.entries(index.key)
    .map(([field, direction]) => `${field}:${direction}`)
    .join(', ');
  const flags = [];
  if (index.unique) flags.push('unique');
  if (index.sparse) flags.push('sparse');
  const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
  return `    - ${index.name} { ${keyStr} }${flagStr}`;
}

function printSummary(results) {
  console.log('\n[db:setup] indexes confirmed:');
  for (const { modelName, collection, indexes } of results) {
    console.log(`  ${modelName} (${collection}):`);
    for (const index of indexes) {
      console.log(formatIndex(index));
    }
  }
}

async function main() {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error(`[db:setup] could not connect to MongoDB: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const results = [];
  const failures = [];

  try {
    for (const [modelName, Model] of Object.entries(models)) {
      try {
        results.push(await syncModelIndexes(modelName, Model));
      } catch (error) {
        failures.push({ modelName, error });
        console.error(`[db:setup] failed to sync indexes for ${modelName}: ${error.message}`);
      }
    }
  } finally {
    await disconnectFromDatabase();
  }

  if (results.length > 0) {
    printSummary(results);
  }

  if (failures.length > 0) {
    console.error(`\n[db:setup] failed for ${failures.length} of ${Object.keys(models).length} model(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('\n[db:setup] done.');
}

main().catch((error) => {
  console.error('[db:setup] unexpected error:', error);
  process.exitCode = 1;
});
