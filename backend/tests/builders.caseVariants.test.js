// tests/builders.caseVariants.test.js
process.env.MONGODB_DB_NAME = 'homenest_test_builder_case_variants';

const mongoose = require('mongoose');
const Project = require('../src/models/Project');
const { listBuilders, getBuilderBySlug } = require('../src/services/builder.service');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');

function project(developer, overrides = {}) {
  return {
    name: `P-${Math.random().toString(36).slice(2, 8)}`,
    developer,
    city: 'Jaipur',
    startingPriceInRupees: 5000000,
    status: 'published',
    publishedAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  await connectToDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('builder case variants', () => {
  beforeEach(async () => {
    await Project.deleteMany({});
    await Project.syncIndexes();
    await Project.create([project('DLF'), project('dlf'), project(' DLF ')]);
  });

  it('merges DLF and dlf into one card with the combined count', async () => {
    const { builders, total } = await listBuilders({ page: 1, limit: 50 });
    expect(total).toBe(1);
    expect(builders).toHaveLength(1);
    expect(builders[0].publishedProjectCount).toBe(3);
    expect(builders[0].name).toBe('DLF'); // deterministic display name
  });

  it('returns every spelling\'s projects from the merged slug', async () => {
    const { builders } = await listBuilders({ page: 1, limit: 50 });
    const detail = await getBuilderBySlug(builders[0].slug);
    expect(detail.projects).toHaveLength(3);
    expect(detail.publishedProjectCount).toBe(3);
  });

  it('returns null for a forged slug', async () => {
    const { builders } = await listBuilders({ page: 1, limit: 50 });
    const forged = builders[0].slug.replace(/~.*$/, '~Zm9yZ2Vk'); // base64url of "forged"
    expect(await getBuilderBySlug(forged)).toBeNull();
    expect(await getBuilderBySlug('no-separator')).toBeNull();
  });

  it('still filters by city', async () => {
    await Project.create(project('DLF', { city: 'Delhi' }));
    const { builders } = await listBuilders({ city: 'Delhi', page: 1, limit: 50 });
    expect(builders[0].publishedProjectCount).toBe(1);
  });
});