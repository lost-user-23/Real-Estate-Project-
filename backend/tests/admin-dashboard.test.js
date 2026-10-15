process.env.MONGODB_DB_NAME = 'homenest_test_admin_dashboard';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const Location = require('../src/models/Location');
const Project = require('../src/models/Project');
const Article = require('../src/models/Article');
const Report = require('../src/models/Report');

const app = createApp();

async function registerUser() {
  const email = `dashboard-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Dashboard Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function createAdminToken() {
  const { token, user } = await registerUser();
  await User.findByIdAndUpdate(user.id, { role: 'admin' });
  return token;
}

function makeProperty(overrides = {}) {
  return Property.create({
    slug: `property-${new mongoose.Types.ObjectId()}`,
    title: 'Dashboard Property',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 1000,
    priceInRupees: 1000000,
    city: 'Bengaluru',
    status: 'published',
    verified: false,
    featured: false,
    featuredRank: null,
    ...overrides,
  });
}

function makeProject(overrides = {}) {
  return Project.create({
    name: 'Dashboard Project',
    developer: 'Dev',
    city: 'Pune',
    startingPriceInRupees: 100,
    status: 'published',
    ...overrides,
  });
}

function makeArticle(overrides = {}) {
  return Article.create({
    title: 'Dashboard Article',
    slug: `article-${new mongoose.Types.ObjectId()}`,
    status: 'published',
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Property.deleteMany({}),
    Location.deleteMany({}),
    Project.deleteMany({}),
    Article.deleteMany({}),
    Report.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('GET /api/v1/admin/dashboard', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/admin/dashboard');
    expect(response.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { token } = await registerUser();
    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('returns zeros when there is no content', async () => {
    const token = await createAdminToken();
    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.stats).toEqual({
      publishedListings: 0,
      featuredListings: 0,
      awaitingVerification: 0,
      popularLocations: 0,
      publishedProjects: 0,
      publishedArticles: 0,
      openReports: 0,
      newLoanEnquiries: 0,
    });
  });

  it('counts only published content and applies the popular-location rule', async () => {
    const token = await createAdminToken();

    await Promise.all([
      // published: 4 total, 2 featured, 3 unverified
      makeProperty({ featured: true, verified: true }),
      makeProperty({ featured: true }),
      makeProperty(),
      makeProperty(),
      // non-published listings must not count anywhere, even when featured or unverified
      makeProperty({ status: 'draft', featured: true }),
      makeProperty({ status: 'archived', featured: true }),

      // popular counts only with popular=true and >= 5 active listings
      Location.create({ city: 'Popular Big', popular: true, activeListingCount: 5 }),
      Location.create({ city: 'Popular Small', popular: true, activeListingCount: 4 }),
      Location.create({ city: 'Unflagged Big', popular: false, activeListingCount: 50 }),

      makeProject(),
      makeProject(),
      makeProject({ status: 'draft' }),
      makeProject({ status: 'archived' }),

      makeArticle(),
      makeArticle({ status: 'draft' }),

      // only open reports count; reviewed ones are done
      Report.create({ listingUrlOrId: 'a', reason: 'r' }),
      Report.create({ listingUrlOrId: 'b', reason: 'r' }),
      Report.create({ listingUrlOrId: 'c', reason: 'r', status: 'resolved' }),
      Report.create({ listingUrlOrId: 'd', reason: 'r', status: 'reviewing' }),
    ]);

    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.stats).toEqual({
      publishedListings: 4,
      featuredListings: 2,
      awaitingVerification: 3,
      popularLocations: 1,
      publishedProjects: 2,
      publishedArticles: 1,
      openReports: 2,
      newLoanEnquiries: 0,
    });
  });
});
