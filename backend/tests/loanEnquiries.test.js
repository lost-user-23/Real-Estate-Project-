process.env.MONGODB_DB_NAME = 'homenest_test_loan_enquiries';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const LoanEnquiry = require('../src/models/LoanEnquiry');
const { CONSENT_TEXT_VERSIONS } = require('../src/utils/loanEnquiryValidation');
const loanEnquiryService = require('../src/services/loanEnquiry.service');
const mailer = require('../src/services/mailer.service');
const config = require('../src/config');

const app = createApp();

const PUBLIC_URL = '/api/v1/loan-enquiries';
const ADMIN_URL = '/api/v1/admin/loan-enquiries';

const validBody = (overrides = {}) => ({
  name: 'Asha Verma',
  phone: '+91 98765-43210',
  loanType: 'home',
  amountInRupees: 7500000,
  consent: { accepted: true, textVersion: CONSENT_TEXT_VERSIONS[0] },
  ...overrides,
});

async function registerUser() {
  const email = `loan-${new mongoose.Types.ObjectId()}@example.com`;
  const response = await registerVerified(app, { name: 'Loan Tester', email, password: 'password123' });
  return { token: tokenFromResponse(response), user: response.body.user };
}

async function createAdmin() {
  const credentials = await registerUser();
  await User.findByIdAndUpdate(credentials.user.id, { role: 'admin' });
  return credentials.token;
}

async function createProperty(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return Property.create({
    _id: id,
    slug: `loan-flat-${id}`,
    title: 'Loan Test Flat',
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 7500000,
    city: 'Pune',
    locality: 'Baner',
    status: 'published',
    publishedAt: new Date(),
    ...overrides,
  });
}

let counter = 0;
async function createEnquiry(overrides = {}) {
  counter += 1;
  return LoanEnquiry.create({
    name: 'Seed Person',
    phone: `98000${String(counter).padStart(5, '0')}`,
    loanType: 'home',
    amountInRupees: 1000000,
    consent: { accepted: true, textVersion: CONSENT_TEXT_VERSIONS[0] },
    ipAddress: '10.0.0.1',
    ...overrides,
  });
}

beforeAll(async () => {
  await connectToDatabase();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([User.deleteMany({}), LoanEnquiry.deleteMany({}), Property.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('public loan enquiries', () => {
  it('lets an anonymous visitor create an enquiry and returns only a safe confirmation', async () => {
    const response = await request(app).post(PUBLIC_URL).send(validBody());

    expect(response.status).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual(['message', 'referenceId', 'success']);
    expect(response.body.success).toBe(true);
    expect(response.body.referenceId).toMatch(/^[a-f\d]{24}$/);

    const doc = await LoanEnquiry.findOne({}).select('+ipAddress');
    expect(String(doc._id)).toBe(response.body.referenceId);
    expect(doc).toMatchObject({ name: 'Asha Verma', phone: '+919876543210', loanType: 'home', status: 'new' });
    expect(doc.consent.accepted).toBe(true);
    expect(doc.consent.textVersion).toBe(CONSENT_TEXT_VERSIONS[0]);
    expect(doc.consent.acceptedAt).toBeInstanceOf(Date);
    expect(doc.ipAddress).toMatch(/127\.0\.0\.1|::1/);
    expect(JSON.stringify(response.body)).not.toContain(doc.ipAddress);
    expect(JSON.stringify(response.body)).not.toContain('9876543210');
  });

  it('accepts optional email, city, lender and a published property', async () => {
    const property = await createProperty();
    const response = await request(app)
      .post(PUBLIC_URL)
      .send(
        validBody({
          email: 'Asha@Example.COM',
          city: 'Pune',
          preferredLenderId: 'sbi-home-loan',
          propertyId: String(property._id),
        })
      );

    expect(response.status).toBe(201);
    const doc = await LoanEnquiry.findOne({});
    expect(doc.email).toBe('asha@example.com');
    expect(doc.city).toBe('Pune');
    expect(doc.preferredLenderId).toBe('sbi-home-loan');
    expect(String(doc.propertyId)).toBe(String(property._id));
  });

  it('ignores client supplied status, ipAddress and consent timestamp', async () => {
    const response = await request(app)
      .post(PUBLIC_URL)
      .send(
        validBody({
          status: 'closed',
          ipAddress: '1.2.3.4',
          consent: { accepted: true, textVersion: CONSENT_TEXT_VERSIONS[0], acceptedAt: '2000-01-01' },
        })
      );

    expect(response.status).toBe(201);
    const doc = await LoanEnquiry.findOne({}).select('+ipAddress');
    expect(doc.status).toBe('new');
    expect(doc.ipAddress).not.toBe('1.2.3.4');
    expect(doc.consent.acceptedAt.getFullYear()).toBeGreaterThan(2000);
  });

  it.each([
    ['missing consent', { consent: undefined }],
    ['consent false', { consent: { accepted: false, textVersion: CONSENT_TEXT_VERSIONS[0] } }],
    ['consent as the string "true"', { consent: { accepted: 'true', textVersion: CONSENT_TEXT_VERSIONS[0] } }],
    ['an unknown consent version', { consent: { accepted: true, textVersion: 'made-up' } }],
    ['a missing consent version', { consent: { accepted: true } }],
    ['a short name', { name: 'A' }],
    ['an object name', { name: { first: 'Asha' } }],
    ['a missing phone', { phone: undefined }],
    ['an invalid phone', { phone: 'call-me' }],
    ['a numeric phone', { phone: 9876543210 }],
    ['an invalid email', { email: 'nope' }],
    ['an array email', { email: ['a@b.co'] }],
    ['an unknown loan type', { loanType: 'gold' }],
    ['a missing loan type', { loanType: undefined }],
    ['a string amount', { amountInRupees: '7500000' }],
    ['a zero amount', { amountInRupees: 0 }],
    ['a negative amount', { amountInRupees: -5 }],
    ['an amount above the maximum', { amountInRupees: 500000001 }],
    ['a null-ish NaN amount', { amountInRupees: null }],
    ['an oversized city', { city: 'x'.repeat(81) }],
    ['a non-string city', { city: { a: 1 } }],
    ['an unknown lender', { preferredLenderId: 'fake-bank-home-loan' }],
    ['a lender that does not match the loan type', { preferredLenderId: 'sbi-personal-loan' }],
    ['a prototype-key lender', { preferredLenderId: 'constructor' }],
    ['a malformed property id', { propertyId: 'not-an-id' }],
    ['a non-string property id', { propertyId: { $ne: null } }],
  ])('rejects %s with 400 and creates nothing', async (_label, overrides) => {
    const response = await request(app).post(PUBLIC_URL).send(validBody(overrides));

    expect(response.status).toBe(400);
    expect(response.body.error.message).toEqual(expect.any(String));
    expect(await LoanEnquiry.countDocuments()).toBe(0);
  });

  it('rejects an empty body and a non-object body', async () => {
    expect((await request(app).post(PUBLIC_URL).send({})).status).toBe(400);
    expect((await request(app).post(PUBLIC_URL).send([1, 2])).status).toBe(400);
    expect(await LoanEnquiry.countDocuments()).toBe(0);
  });

  it('rejects a well-formed property id that does not exist, and an unpublished property', async () => {
    const missing = await request(app).post(PUBLIC_URL).send(validBody({ propertyId: String(new mongoose.Types.ObjectId()) }));
    const draft = await createProperty({ status: 'draft' });
    const unpublished = await request(app).post(PUBLIC_URL).send(validBody({ propertyId: String(draft._id) }));

    expect(missing.status).toBe(400);
    expect(unpublished.status).toBe(400);
    expect(await LoanEnquiry.countDocuments()).toBe(0);
  });

  it('rejects an oversized request body', async () => {
    const response = await request(app)
      .post(PUBLIC_URL)
      .send(validBody({ city: 'x'.repeat(200 * 1024) }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await LoanEnquiry.countDocuments()).toBe(0);
  });

  it('does not write a second document for an identical immediate resubmission', async () => {
    const first = await request(app).post(PUBLIC_URL).send(validBody());
    const second = await request(app).post(PUBLIC_URL).send(validBody());

    expect(second.status).toBe(201);
    expect(second.body.referenceId).toBe(first.body.referenceId);
    expect(await LoanEnquiry.countDocuments()).toBe(1);
  });

  it('answers a honeypot submission like a real one (same shape) without saving it', async () => {
    const real = await request(app).post(PUBLIC_URL).send(validBody());
    const countAfterReal = await LoanEnquiry.countDocuments();

    const spam = await request(app).post(PUBLIC_URL).send(validBody({ phone: '9111111111', website: 'spam' }));

    expect(spam.status).toBe(real.status);
    expect(Object.keys(spam.body).sort()).toEqual(Object.keys(real.body).sort());
    expect(spam.body.message).toBe(real.body.message);
    expect(spam.body.referenceId).toMatch(/^[a-f\d]{24}$/);
    expect(await LoanEnquiry.countDocuments()).toBe(countAfterReal);
  });

  it('uses the standard error handler when the database fails', async () => {
    jest.spyOn(loanEnquiryService, 'createLoanEnquiry').mockRejectedValueOnce(new Error('db exploded: secret detail'));

    const response = await request(app).post(PUBLIC_URL).send(validBody());

    expect(response.status).toBe(500);
    expect(response.body.error).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('secret detail');
  });
});

describe('loan enquiry email notification', () => {
  const originalRecipient = config.loanEnquiryNotifyEmail;
  afterEach(() => {
    config.loanEnquiryNotifyEmail = originalRecipient;
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it.each([[undefined], [''], ['   ']])('config treats LOAN_ENQUIRY_NOTIFY_EMAIL=%p as "no recipient" without throwing', (value) => {
    const saved = process.env.LOAN_ENQUIRY_NOTIFY_EMAIL;
    if (value === undefined) delete process.env.LOAN_ENQUIRY_NOTIFY_EMAIL;
    else process.env.LOAN_ENQUIRY_NOTIFY_EMAIL = value;
    try {
      jest.isolateModules(() => {
        expect(require('../src/config').loanEnquiryNotifyEmail).toBe('');
      });
    } finally {
      if (saved === undefined) delete process.env.LOAN_ENQUIRY_NOTIFY_EMAIL;
      else process.env.LOAN_ENQUIRY_NOTIFY_EMAIL = saved;
    }
  });

  it('sends nothing when no recipient is configured', async () => {
    config.loanEnquiryNotifyEmail = '';
    const deliver = jest.spyOn(mailer, 'deliver').mockResolvedValue();

    const response = await request(app).post(PUBLIC_URL).send(validBody());
    await flush();

    expect(response.status).toBe(201);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('sends one minimal notification (no applicant details) and not again for a duplicate', async () => {
    config.loanEnquiryNotifyEmail = 'ops@example.com';
    const deliver = jest.spyOn(mailer, 'deliver').mockResolvedValue();

    const first = await request(app).post(PUBLIC_URL).send(validBody());
    await request(app).post(PUBLIC_URL).send(validBody());
    await flush();

    expect(deliver).toHaveBeenCalledTimes(1);
    const mail = deliver.mock.calls[0][0];
    expect(mail.to).toBe('ops@example.com');
    expect(mail.text).toContain(first.body.referenceId);
    expect(JSON.stringify(mail)).not.toMatch(/Asha|9876543210|7500000/);
  });

  it('still returns 201 and keeps the enquiry when email delivery fails', async () => {
    config.loanEnquiryNotifyEmail = 'ops@example.com';
    jest.spyOn(mailer, 'deliver').mockRejectedValue(new Error('smtp down: user@secret'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).post(PUBLIC_URL).send(validBody());
    await flush();

    expect(response.status).toBe(201);
    expect(await LoanEnquiry.countDocuments()).toBe(1);
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain('user@secret');
  });

  it('still returns 201 when the mailer throws synchronously', async () => {
    config.loanEnquiryNotifyEmail = 'ops@example.com';
    jest.spyOn(mailer, 'deliver').mockImplementation(() => {
      throw new Error('boom');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).post(PUBLIC_URL).send(validBody());

    expect(response.status).toBe(201);
    expect(await LoanEnquiry.countDocuments()).toBe(1);
  });
});

describe('loan enquiry rate limit (real route, limiter active)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('ignores rejected submissions, then returns 429 after 5 accepted ones', async () => {
    for (let i = 0; i < 6; i += 1) {
      const bad = await request(app).post(PUBLIC_URL).send(validBody({ name: 'A' }));
      expect(bad.status).toBe(400);
    }
    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app).post(PUBLIC_URL).send(validBody({ phone: `987650000${i}0` }));
      expect(ok.status).toBe(201);
    }
    const limited = await request(app).post(PUBLIC_URL).send(validBody({ phone: '9999999999' }));
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many requests. Please try again later.' } });
    expect(limited.headers['ratelimit-limit']).toBe('5');
  });

  it('does not share its quota with the contact form limiter', async () => {
    const { contactRateLimiter } = require('../src/middleware/contactRateLimiter');
    const { loanEnquiryRateLimiter } = require('../src/middleware/loanEnquiryRateLimiter');
    expect(loanEnquiryRateLimiter).not.toBe(contactRateLimiter);
  });
});

describe('admin loan enquiries access control', () => {
  it('rejects anonymous requests with 401', async () => {
    const id = new mongoose.Types.ObjectId();
    expect((await request(app).get(ADMIN_URL)).status).toBe(401);
    expect((await request(app).patch(`${ADMIN_URL}/${id}`).send({ status: 'closed' })).status).toBe(401);
  });

  it('rejects a normal user with 403 and changes nothing', async () => {
    const { token } = await registerUser();
    const enquiry = await createEnquiry();
    const headers = { Authorization: `Bearer ${token}` };

    expect((await request(app).get(ADMIN_URL).set(headers)).status).toBe(403);
    const update = await request(app).patch(`${ADMIN_URL}/${enquiry._id}`).set(headers).send({ status: 'closed' });
    expect(update.status).toBe(403);
    expect((await LoanEnquiry.findById(enquiry._id)).status).toBe('new');
  });
});

describe('admin loan enquiries list', () => {
  const get = async (query = '') => {
    const token = await createAdmin();
    return request(app).get(`${ADMIN_URL}${query}`).set('Authorization', `Bearer ${token}`);
  };

  it('returns enquiries newest first with meta, property details and no ipAddress', async () => {
    const property = await createProperty();
    const oldest = await createEnquiry({ name: 'Oldest', createdAt: new Date('2026-01-01') });
    const newest = await createEnquiry({ name: 'Newest', createdAt: new Date('2026-03-01'), propertyId: property._id });

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body.enquiries.map((e) => e.id)).toEqual([String(newest._id), String(oldest._id)]);
    expect(response.body.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    expect(response.body.enquiries[0].property).toEqual({
      id: String(property._id),
      title: 'Loan Test Flat',
      slug: property.slug,
    });
    expect(response.body.enquiries[1].property).toBeNull();
    response.body.enquiries.forEach((e) => expect(e).not.toHaveProperty('ipAddress'));
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.1');
  });

  it('filters by status and loan type', async () => {
    await createEnquiry({ status: 'new', loanType: 'home' });
    await createEnquiry({ status: 'contacted', loanType: 'personal' });
    await createEnquiry({ status: 'contacted', loanType: 'home' });

    const byStatus = await get('?status=contacted');
    const byType = await get('?loanType=personal');
    const both = await get('?status=contacted&loanType=home');

    expect(byStatus.body.meta.total).toBe(2);
    expect(byType.body.enquiries.every((e) => e.loanType === 'personal')).toBe(true);
    expect(both.body.meta.total).toBe(1);
  });

  it.each([
    ['an unknown status', '?status=banana'],
    ['an unknown loan type', '?loanType=gold'],
    ['page=0', '?page=0'],
    ['a non numeric limit', '?limit=abc'],
  ])('rejects %s with 400', async (_label, query) => {
    expect((await get(query)).status).toBe(400);
  });

  it('caps limit at 50 and paginates', async () => {
    await createEnquiry({ createdAt: new Date('2026-01-01') });
    await createEnquiry({ createdAt: new Date('2026-02-01') });
    await createEnquiry({ createdAt: new Date('2026-03-01') });

    expect((await get('?limit=500')).body.meta.limit).toBe(50);
    const page2 = await get('?limit=2&page=2');
    expect(page2.body.enquiries).toHaveLength(1);
    expect(page2.body.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
  });
});

describe('admin loan enquiries update', () => {
  const patch = async (id, body) => {
    const token = await createAdmin();
    return request(app).patch(`${ADMIN_URL}/${id}`).set('Authorization', `Bearer ${token}`).send(body);
  };

  it.each(['contacted', 'closed', 'new'])('updates the status to %s', async (status) => {
    const enquiry = await createEnquiry({ status: status === 'new' ? 'closed' : 'new' });

    const response = await patch(enquiry._id, { status });

    expect(response.status).toBe(200);
    expect(response.body.loanEnquiry).toMatchObject({ id: String(enquiry._id), status });
    expect(response.body.loanEnquiry).not.toHaveProperty('ipAddress');
    expect((await LoanEnquiry.findById(enquiry._id)).status).toBe(status);
  });

  it('rejects an invalid status, a malformed id and extra fields', async () => {
    const enquiry = await createEnquiry();

    expect((await patch(enquiry._id, { status: 'banana' })).status).toBe(400);
    expect((await patch('not-an-id', { status: 'closed' })).status).toBe(400);
    const extra = await patch(enquiry._id, { status: 'closed', name: 'Hacked' });
    expect(extra.status).toBe(400);

    const doc = await LoanEnquiry.findById(enquiry._id);
    expect(doc.status).toBe('new');
    expect(doc.name).toBe('Seed Person');
  });

  it('returns 404 for a valid id that does not exist', async () => {
    expect((await patch(new mongoose.Types.ObjectId(), { status: 'closed' })).status).toBe(404);
  });
});
