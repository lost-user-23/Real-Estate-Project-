process.env.MONGODB_DB_NAME = 'homenest_test_hero';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');
const { ownUrl } = require('./helpers/imageUrls');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const HeroBanner = require('../src/models/HeroBanner');
const { resolvePublic } = require('../src/services/hero.service');

const app = createApp();
const ADMIN = '/api/v1/admin/hero';
const PUBLIC = '/api/v1/hero';

async function registerUser(role) {
  const email = `hero-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Hero Tester', email, password: 'password123' });
  if (role) await User.findByIdAndUpdate(response.body.user.id, { role });
  return tokenFromResponse(response);
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(connectToDatabase);
afterEach(() => Promise.all([User.deleteMany({}), HeroBanner.deleteMany({})]));
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('hero banner: access', () => {
  it('serves public defaults without writing to the database', async () => {
    const res = await request(app).get(PUBLIC);
    expect(res.status).toBe(200);
    expect(res.body.hero).toMatchObject({ slides: [], decoration: null, titleLead: '' });
    expect(await HeroBanner.countDocuments()).toBe(0);
  });

  it('blocks unauthenticated and non-admin users from the admin routes', async () => {
    expect((await request(app).get(ADMIN)).status).toBe(401);
    const token = await registerUser();
    expect((await request(app).get(ADMIN).set(auth(token))).status).toBe(403);
    expect((await request(app).put(ADMIN).set(auth(token)).send({ badge: 'x' })).status).toBe(403);
    expect((await request(app).post(`${ADMIN}/image`).set(auth(token))).status).toBe(403);
  });
});

describe('hero banner: admin updates', () => {
  it('saves text and slides, and the public endpoint reflects them', async () => {
    const token = await registerUser('admin');
    const res = await request(app)
      .put(ADMIN)
      .set(auth(token))
      .send({ titleLead: 'Find a home,', titleAccent: 'fast.', slides: [{ url: ownUrl, alt: 'Skyline' }] });
    expect(res.status).toBe(200);

    const pub = await request(app).get(PUBLIC);
    expect(pub.body.hero.titleLead).toBe('Find a home,');
    expect(pub.body.hero.slides).toEqual([{ url: ownUrl, alt: 'Skyline' }]);
  });

  it('rejects images that are not our own Cloudinary URLs, and bad events', async () => {
    const token = await registerUser('admin');
    const bad = await request(app)
      .put(ADMIN)
      .set(auth(token))
      .send({
        slides: [{ url: 'https://picsum.photos/1.jpg' }],
        manualDecoration: 'halloween',
        events: [{ name: 'X', decoration: 'diwali', startsAt: '2026-11-10', endsAt: '2026-11-01' }],
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.length).toBeGreaterThanOrEqual(3);
  });
});

describe('hero banner: event resolution', () => {
  const doc = (extra) => ({
    slides: [],
    badge: '',
    titleLead: 'Base',
    titleAccent: '',
    subtitle: '',
    manualDecoration: null,
    events: [],
    ...extra,
  });
  const event = (extra) => ({
    enabled: true,
    decoration: 'diwali',
    startsAt: new Date('2026-11-01'),
    endsAt: new Date('2026-11-10'),
    greeting: 'Happy Diwali',
    badge: '',
    titleLead: '',
    titleAccent: '',
    subtitle: '',
    ...extra,
  });

  it('applies an event only inside its window, with text overrides', () => {
    const d = doc({ events: [event({ titleLead: 'Festive' })] });
    expect(resolvePublic(d, new Date('2026-11-05'))).toMatchObject({ decoration: 'diwali', greeting: 'Happy Diwali', titleLead: 'Festive' });
    expect(resolvePublic(d, new Date('2026-11-11'))).toMatchObject({ decoration: null, greeting: '', titleLead: 'Base' });
  });

  it('ignores disabled events, and a manual decoration wins over the schedule', () => {
    expect(resolvePublic(doc({ events: [event({ enabled: false })] }), new Date('2026-11-05')).decoration).toBeNull();
    const manual = doc({ manualDecoration: 'holi', events: [event()] });
    expect(resolvePublic(manual, new Date('2026-11-05'))).toMatchObject({ decoration: 'holi', greeting: '' });
  });
});
