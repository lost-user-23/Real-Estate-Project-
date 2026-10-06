const request = require('supertest');
const config = require('../src/config');
const createApp = require('../src/app');

describe('CORS with a list of allowed origins', () => {
  const original = config.corsOrigins;
  let app;

  beforeAll(() => {
    config.corsOrigins = ['https://www.example.com', 'https://example.com'];
    app = createApp();
  });
  afterAll(() => {
    config.corsOrigins = original;
  });

  it.each(['https://www.example.com', 'https://example.com'])('echoes allowed origin %s with credentials', async (origin) => {
    const res = await request(app).get('/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends no allow header to an unlisted origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a state-changing request from an unlisted origin and accepts a listed one', async () => {
    // Logout needs no database, so only the origin check decides the status.
    const bad = await request(app).post('/api/auth/logout').set('Origin', 'http://evil.example');
    const good = await request(app).post('/api/auth/logout').set('Origin', 'https://example.com/');
    expect(bad.status).toBe(403);
    expect(good.status).toBe(200);
  });
});
