process.env.MONGODB_DB_NAME = 'homenest_test_assistant';

const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const config = require('../src/config');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');
const { clearCatalogCache } = require('../src/services/assistant/catalog');
const { handleTurn } = require('../src/services/assistant/conversation');
const { extractRules } = require('../src/services/assistant/ruleExtractor');

const app = createApp();
const URL = '/api/v1/assistant/chat';

let counter = 0;
async function listing(overrides = {}) {
  counter += 1;
  const doc = await Property.create({
    slug: `assistant-${counter}-${new mongoose.Types.ObjectId()}`,
    title: `Listing ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    bhk: 3,
    areaSqft: 1400,
    priceInRupees: 6_500_000,
    city: 'Jaipur',
    locality: 'Vaishali Nagar',
    status: 'published',
    publishedAt: new Date(),
    amenities: ['Parking', 'Lift'],
    contactNumber: '9999900000',
    ...overrides,
  });
  return doc;
}

async function seed() {
  await listing({ title: 'Flat A', bhk: 3, priceInRupees: 6_500_000, verified: true });
  await listing({ title: 'Flat B', bhk: 3, priceInRupees: 6_900_000, locality: 'Mansarovar', yearOfConstruction: 2020 });
  await listing({ title: 'Flat C', bhk: 2, priceInRupees: 4_500_000 });
  await listing({ title: 'Flat D too pricey', bhk: 3, priceInRupees: 9_500_000 });
  await listing({ title: 'Flat E draft', bhk: 3, priceInRupees: 5_000_000, status: 'draft' });
  await listing({ title: 'Flat F archived', bhk: 3, priceInRupees: 5_200_000, status: 'archived' });
  await listing({ title: 'Pune Flat', bhk: 3, priceInRupees: 6_000_000, city: 'Pune', locality: 'Baner' });
  await listing({ title: 'Plot 1', propertyType: 'plot', bhk: null, areaSqft: 1800, priceInRupees: 3_500_000, locality: 'Mansarovar', amenities: [] });
  await listing({ title: 'Plot 2', propertyType: 'plot', bhk: null, areaSqft: 2500, priceInRupees: 4_800_000, locality: 'Vaishali Nagar', amenities: [] });
  await listing({ title: 'Plot pricey', propertyType: 'plot', bhk: null, areaSqft: 2500, priceInRupees: 30_000_000, amenities: [] });
  await listing({ title: 'Rent House 1', intent: 'rent', propertyType: 'independent-house', bhk: 3, priceInRupees: 30_000, city: 'Pune', locality: 'Baner', furnished: 'semi-furnished' });
  await listing({ title: 'Rent House 2', intent: 'rent', propertyType: 'independent-house', bhk: 2, priceInRupees: 22_000, city: 'Pune', locality: 'Kothrud' });
  await listing({ title: 'Rent House 3 pricey', intent: 'rent', propertyType: 'independent-house', bhk: 4, priceInRupees: 80_000, city: 'Pune', locality: 'Baner' });
}

const turn = (body) => request(app).post(URL).send(body);
const titles = (list) => list.map((p) => p.title);

// Plays a message, then keeps the returned state for the next turn.
function conversation() {
  let state;
  return {
    async say(message) {
      const res = await turn({ message, state });
      expect(res.status).toBe(200);
      state = res.body.state;
      return res.body;
    },
    async act(action) {
      const res = await turn({ action, state });
      expect(res.status).toBe(200);
      state = res.body.state;
      return res.body;
    },
    get state() {
      return state;
    },
  };
}

const chipFor = (body, label) => body.quickReplies.find((c) => c.label === label);

beforeAll(async () => {
  await connectToDatabase();
});

beforeEach(async () => {
  clearCatalogCache();
  await seed();
});

afterEach(async () => {
  jest.restoreAllMocks();
  config.assistant.anthropicApiKey = '';
  await Promise.all([Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('starting a conversation', () => {
  it('greets and asks whether to buy or rent', async () => {
    const res = await turn({});
    expect(res.status).toBe(200);
    expect(res.body.results).toBeNull();
    expect(res.body.state.expecting).toBe('intent');
    expect(res.body.quickReplies.map((c) => c.label)).toEqual(['Buy', 'Rent']);
  });

  it('rejects malformed requests', async () => {
    expect((await turn({ message: 42 })).status).toBe(400);
    expect((await turn({ message: 'x'.repeat(501) })).status).toBe(400);
    expect((await turn({ action: 'search' })).status).toBe(400);
    expect((await turn({ state: [] })).status).toBe(400);
  });
});

describe('buying a plot', () => {
  it('guides from intent to real, in-budget, published plots', async () => {
    const chat = conversation();

    let body = await chat.say('I want to buy a plot');
    expect(body.state.prefs).toEqual({ intent: 'buy', propertyType: 'plot' });
    expect(body.state.expecting).toBe('budget');
    expect(body.results).toBeNull();

    body = await chat.act(chipFor(body, 'Under ₹50 L').action);
    expect(body.state.prefs).toMatchObject({ maxPrice: 5_000_000 });
    expect(body.state.expecting).toBe('city');

    body = await chat.say('Jaipur');
    expect(body.state.prefs.city).toBe('Jaipur');
    expect(body.state.expecting).toBe('locality');
    expect(body.quickReplies.map((c) => c.label)).toEqual(expect.arrayContaining(['Mansarovar', 'Vaishali Nagar']));

    body = await chat.act({ type: 'skip', field: 'locality' });
    expect(body.state.expecting).toBe('details');
    expect(body.quickReplies.map((c) => c.label)).toContain('1,000 - 2,000 sq ft');

    body = await chat.say('around 2000 sq ft');
    expect(body.state.prefs.minAreaSqft).toBe(1700);
    expect(body.state.prefs.maxAreaSqft).toBe(2300);

    expect(body.results).not.toBeNull();
    expect(titles(body.results.exact)).toEqual(['Plot 1']);
    const plot = body.results.exact[0];
    expect(plot.propertyType).toBe('plot');
    expect(plot.slug).toBeTruthy();
    expect(plot.priceInRupees).toBe(3_500_000);
    expect(plot.match.tier).toBe('exact');
    expect(plot.match.reasons.length).toBeGreaterThan(0);
    // The 25L pricier plot and the out-of-size one are never in the exact list.
    expect(titles(body.results.exact)).not.toContain('Plot pricey');
  });

  it('refuses to rent a plot and offers the supported alternatives', async () => {
    const body = (await turn({ message: 'I want to rent a plot in Jaipur' })).body;
    expect(body.results).toBeNull();
    expect(body.messages.join(' ')).toMatch(/sale only/i);
    expect(body.state.prefs.propertyType).toBeUndefined();
    expect(body.quickReplies.map((c) => c.label)).toEqual(['Buy a plot', 'Rent something else']);
  });
});

describe('buying a flat with a stated budget', () => {
  it('populates everything from one message and returns only matching published flats', async () => {
    const body = (await turn({ message: 'I want to buy a 3 BHK flat in Jaipur under ₹70 lakh' })).body;

    expect(body.state.prefs).toMatchObject({
      intent: 'buy',
      propertyType: 'apartment',
      bhk: 3,
      city: 'Jaipur',
      maxPrice: 7_000_000,
    });
    expect(body.state.searched).toBe(true);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
    for (const p of [...body.results.exact, ...body.results.approximate]) {
      expect(p.priceInRupees).toBeLessThanOrEqual(7_000_000);
      expect(p.city).toBe('Jaipur');
    }
    // Draft, archived, too-expensive and other-city listings never appear.
    const all = JSON.stringify(body.results);
    for (const hidden of ['Flat D', 'Flat E', 'Flat F', 'Pune Flat']) expect(all).not.toContain(hidden);
    // Verified listing ranks first.
    expect(body.results.exact[0].title).toBe('Flat A');
  });

  it('asks only for what is missing when the intent is not stated', async () => {
    const chat = conversation();
    let body = await chat.say('3 BHK flat in Jaipur under 70 lakh');
    expect(body.state.prefs).toMatchObject({ propertyType: 'apartment', bhk: 3, city: 'Jaipur', maxPrice: 7_000_000 });
    expect(body.state.prefs.intent).toBeUndefined();
    expect(body.state.expecting).toBe('intent');
    expect(body.results).toBeNull();

    body = await chat.act(chipFor(body, 'Buy').action);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
  });

  it('never exposes private or internal fields', async () => {
    const body = (await turn({ message: 'buy a 3 BHK flat in Jaipur under 70 lakh' })).body;
    const json = JSON.stringify(body);
    expect(json).not.toContain('contactNumber');
    expect(json).not.toContain('9999900000');
    expect(json).not.toContain('ownerId');
    expect(json).not.toContain('cityLower');
    expect(body.results.exact[0]).not.toHaveProperty('status');
  });

  it('passes through real images and the working detail slug', async () => {
    const flat = await Property.findOne({ title: 'Flat A' });
    await PropertyImage.create({ propertyId: flat._id, url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', displayOrder: 0 });
    const body = (await turn({ message: 'buy a 3 BHK flat in Jaipur under 70 lakh' })).body;
    const card = body.results.exact.find((p) => p.title === 'Flat A');
    expect(card.images[0].url).toBe('https://res.cloudinary.com/demo/image/upload/a.jpg');
    expect(card.slug).toBe(flat.slug);
  });

  it('labels listings that miss a soft preference as approximate, with the reason', async () => {
    const body = (await turn({ message: 'buy a 3 BHK flat in Jaipur between 40 lakh and 70 lakh with Gym' })).body;
    expect(body.results.exact).toHaveLength(0);
    expect(body.results.approximate.length).toBeGreaterThan(0);
    for (const p of body.results.approximate) {
      expect(p.match.tier).toBe('approximate');
      expect(p.match.gaps.join(' ')).toMatch(/Gym/);
    }
    expect(body.messages.join(' ')).toMatch(/closest/i);
  });
});

describe('renting a house', () => {
  it('walks through the questions and returns rentals within the monthly budget', async () => {
    const chat = conversation();
    let body = await chat.say('I want to rent a house');
    expect(body.state.prefs).toEqual({ intent: 'rent', propertyType: 'independent-house' });
    expect(body.state.expecting).toBe('budget');
    expect(body.quickReplies.map((c) => c.label)).toContain('₹15,000 - ₹30,000');

    body = await chat.say('under 35k');
    expect(body.state.prefs.maxPrice).toBe(35_000);
    expect(body.state.expecting).toBe('city');

    body = await chat.say('Pune');
    expect(body.state.expecting).toBe('locality');

    body = await chat.act({ type: 'skip', field: 'locality' });
    expect(body.state.expecting).toBe('details');
    body = await chat.act(chipFor(body, '3 BHK').action);

    expect(titles(body.results.exact)).toEqual(['Rent House 1']);
    expect(body.results.exact[0].intent).toBe('rent');
    expect(body.results.exact[0].match.reasons.join(' ')).toMatch(/\/month/);
  });
});

describe('missing or ambiguous information', () => {
  it('asks for a unit when the budget has none', async () => {
    const body = (await turn({ message: 'buy a flat in Jaipur under 70' })).body;
    expect(body.results).toBeNull();
    expect(body.state.prefs.maxPrice).toBeUndefined();
    expect(body.messages.join(' ')).toMatch(/did you mean ₹70 lakh or ₹70 crore/i);
    const lakh = chipFor(body, '₹70 lakh');
    const next = (await turn({ action: lakh.action, state: body.state })).body;
    expect(next.state.prefs).toMatchObject({ maxPrice: 7_000_000, city: 'Jaipur' });
    // Everything core is known; locality is the one optional question left.
    expect(next.state.expecting).toBe('locality');
    const noLocality = (await turn({ action: { type: 'skip', field: 'locality' }, state: next.state })).body;
    expect(noLocality.state.expecting).toBe('details');
    const done = (await turn({ action: { type: 'skip', field: 'details' }, state: noLocality.state })).body;
    expect(done.results.exact.length + done.results.approximate.length).toBeGreaterThan(0);
  });

  it('asks for the city when it is missing, and does not search nationwide on its own', async () => {
    const body = (await turn({ message: 'I want to buy a flat under 70 lakh' })).body;
    expect(body.results).toBeNull();
    expect(body.state.expecting).toBe('city');
  });

  it('does not guess a city it has no listings in', async () => {
    const body = (await turn({ message: 'I want to buy a flat in Atlantis under 70 lakh' })).body;
    expect(body.results).toBeNull();
    expect(body.state.prefs.city).toBeUndefined();
    expect(body.messages.join(' ')).toMatch(/Atlantis/);
    expect(body.quickReplies.map((c) => c.label)).toContain('Jaipur');
  });

  it('asks which city when a locality exists in more than one', async () => {
    await listing({ title: 'Pune Mansarovar', city: 'Pune', locality: 'Mansarovar' });
    clearCatalogCache();
    const body = (await turn({ message: 'buy a flat in Mansarovar' })).body;
    expect(body.results).toBeNull();
    expect(body.messages.join(' ')).toMatch(/more than one city/i);
  });

  it('asks when the message names both buying and renting', async () => {
    const body = (await turn({ message: 'should I buy or rent a flat in Jaipur' })).body;
    expect(body.results).toBeNull();
    expect(body.state.expecting).toBe('intent');
  });

  it('lets the user skip optional questions and still searches', async () => {
    const chat = conversation();
    await chat.say('buy a flat in Jaipur');
    const body = await chat.say('just show me what you have');
    expect(body.results).not.toBeNull();
    expect(body.results.exact.length + body.results.approximate.length).toBeGreaterThan(0);
  });

  it('says it is not a general assistant for off-topic questions', async () => {
    const body = (await turn({ message: 'Is the stamp duty in Rajasthan tax free?' })).body;
    expect(body.results).toBeNull();
    expect(body.messages.join(' ')).toMatch(/can't answer legal/i);
  });
});

describe('no matching listings', () => {
  it('says so honestly and only offers broadening that would produce listings', async () => {
    const body = (await turn({ message: 'buy a villa in Pune under 10 lakh' })).body;
    expect(body.results.exact).toHaveLength(0);
    expect(body.results.approximate).toHaveLength(0);
    expect(body.messages.join(' ')).toMatch(/couldn't find any published listings/i);
    // No villas exist at any price, so a budget raise must not be offered.
    expect(body.quickReplies.map((c) => c.label).join('|')).not.toMatch(/Raise budget/);
  });

  it('offers to raise the budget with a real count when that helps', async () => {
    const chat = conversation();
    const first = await chat.say('buy a 3 BHK flat in Jaipur under 60 lakh');
    expect(titles(first.results.exact)).toEqual([]);
    const raise = first.quickReplies.find((c) => c.label.startsWith('Raise budget'));
    expect(raise).toBeTruthy();
    expect(raise.label).toMatch(/\(\d+ listings\)/);

    const body = await chat.act(raise.action);
    expect(body.state.prefs.maxPrice).toBe(7_500_000);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
  });

  it('counts a budget-raise offer only by listings that match every preference', async () => {
    await listing({ title: 'Two BHK pricey', bhk: 2, priceInRupees: 7_100_000 });
    await listing({ title: 'Four BHK pricey', bhk: 4, priceInRupees: 7_200_000 });
    const chat = conversation();
    const first = await chat.say('buy a 3 BHK flat in Jaipur under 60 lakh');
    expect(titles(first.results.exact)).toEqual([]);
    const raise = first.quickReplies.find((c) => c.label.startsWith('Raise budget'));
    // Only Flat A and Flat B are 3 BHK within 75 lakh; the 2 and 4 BHK listings must not be counted.
    expect(raise.label).toMatch(/to ₹75 L \(2 listings\)/);
    const body = await chat.act(raise.action);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
  });

  it('keeps the budget when the user asks to search the whole city', async () => {
    const chat = conversation();
    const first = await chat.say('buy a 3 BHK flat in Mansarovar, Jaipur under 66 lakh');
    expect(titles(first.results.exact)).toEqual([]);
    const all = first.quickReplies.find((c) => c.label.startsWith('Search all of Jaipur'));
    expect(all).toBeTruthy();
    const body = await chat.act(all.action);
    expect(body.state.prefs.maxPrice).toBe(6_600_000);
    expect(body.state.prefs.locality).toBeUndefined();
    expect(titles(body.results.exact)).toEqual(['Flat A']);
  });

  it('shows another-locality listings as approximate when the locality has none', async () => {
    const body = (await turn({ message: 'buy a 3 BHK flat in Kothrud, Pune under 70 lakh' })).body;
    expect(body.state.prefs.city).toBe('Pune');
    expect(body.results.exact).toHaveLength(0);
    const flat = body.results.approximate.find((p) => p.title === 'Pune Flat');
    expect(flat.match.gaps.join(' ')).toMatch(/Baner rather than Kothrud/);
  });
});

describe('changing preferences after recommendations', () => {
  async function flatsInJaipur() {
    const chat = conversation();
    const body = await chat.say('buy a 3 BHK flat in Jaipur under 70 lakh');
    expect(body.results).not.toBeNull();
    return chat;
  }

  it('re-searches when the city is changed, and drops the old locality', async () => {
    const chat = await flatsInJaipur();
    await chat.say('only in Vaishali Nagar');
    expect(chat.state.prefs.locality).toBe('Vaishali Nagar');
    const body = await chat.say('change the city to Pune');
    expect(body.state.prefs.city).toBe('Pune');
    expect(body.state.prefs.locality).toBeUndefined();
    expect(titles(body.results.exact)).toEqual(['Pune Flat']);
  });

  it('handles "show cheaper options" relative to the budget', async () => {
    const chat = await flatsInJaipur();
    const body = await chat.say('show cheaper options');
    expect(body.state.prefs.maxPrice).toBe(5_600_000);
    expect(body.results.exact).toHaveLength(0);
    for (const p of body.results.approximate) expect(p.priceInRupees).toBeLessThanOrEqual(5_600_000);
  });

  it('handles "only ready-to-move flats" using the listed construction year', async () => {
    const chat = await flatsInJaipur();
    const body = await chat.say('only ready-to-move flats');
    expect(body.state.prefs.possession).toBe('ready');
    expect(titles(body.results.exact)).toEqual(['Flat B']);
    const flatA = body.results.approximate.find((p) => p.title === 'Flat A');
    expect(flatA.match.gaps.join(' ')).toMatch(/Possession status not listed/);
  });

  it('handles "try another locality"', async () => {
    const chat = await flatsInJaipur();
    await chat.say('in Vaishali Nagar');
    const body = await chat.say('try another locality');
    expect(body.state.prefs.locality).toBeUndefined();
    expect(body.state.prefs.excludeLocalities).toEqual(['Vaishali Nagar']);
    expect(titles(body.results.exact)).toEqual(['Flat B']);
  });

  it('handles "show larger plots" by raising the minimum area', async () => {
    const chat = conversation();
    await chat.say('buy a plot in Jaipur under 1 crore');
    const body = await chat.say('show larger plots');
    expect(body.state.prefs.minAreaSqft).toBeGreaterThan(2000);
    expect(titles(body.results.exact)).toEqual(['Plot 2']);
  });

  it('lets the user edit a previous answer from the summary without restarting', async () => {
    const chat = await flatsInJaipur();
    let body = await chat.act({ type: 'ask', field: 'budget' });
    expect(body.state.expecting).toBe('budget');
    expect(body.results).toBeNull();
    body = await chat.say('under 1 crore');
    expect(body.state.prefs.maxPrice).toBe(10_000_000);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B', 'Flat D too pricey']);
    expect(body.state.prefs.city).toBe('Jaipur');
  });

  it('clears the budget when switching from buying to renting', async () => {
    const chat = await flatsInJaipur();
    const body = await chat.say('actually I want to rent');
    expect(body.state.prefs.intent).toBe('rent');
    expect(body.state.prefs.maxPrice).toBeUndefined();
    expect(body.state.expecting).toBe('budget');
    expect(body.results).toBeNull();
  });

  it('starts over on request', async () => {
    const chat = await flatsInJaipur();
    const body = await chat.act({ type: 'reset' });
    expect(body.state.prefs).toEqual({});
    expect(body.state.expecting).toBe('intent');
  });
});

describe('invalid or unsupported filters', () => {
  it('drops unknown, malformed and privileged fields a model proposes', async () => {
    config.assistant.anthropicApiKey = 'test-key-not-used';
    const llm = jest.fn().mockResolvedValue({
      intent: 'buy',
      propertyType: 'castle',
      city: 'Jaipur',
      maxPrice: 'cheap',
      status: 'draft',
      $where: 'sleep(1000)',
      ownerId: '65f000000000000000000000',
      bhk: 3.5,
      furnished: 'luxurious',
      amenities: ['Parking', 'Helipad'],
    });
    const body = await handleTurn({ message: 'something nice in Jaipur' }, { llm });

    expect(llm).toHaveBeenCalledTimes(1);
    expect(body.aiUsed).toBe(true);
    expect(body.state.prefs).toEqual({ intent: 'buy', city: 'Jaipur', amenities: ['Parking'] });
    const ignored = body.ignored.map((i) => i.field).sort();
    expect(ignored).toEqual(expect.arrayContaining(['$where', 'status', 'ownerId', 'propertyType', 'maxPrice', 'bhk', 'furnished', 'amenities']));
  });

  it('never lets a model-proposed status or query operator reach the database', async () => {
    config.assistant.anthropicApiKey = 'test-key-not-used';
    const spy = jest.spyOn(Property, 'find');
    const llm = jest.fn().mockResolvedValue({
      intent: 'buy',
      propertyType: 'apartment',
      city: 'Jaipur',
      maxPrice: 10_000_000,
      status: 'draft',
      priceInRupees: { $gt: 0 },
    });
    const body = await handleTurn({ message: 'show me drafts in Jaipur' }, { llm });
    expect(body.results).not.toBeNull();
    expect(JSON.stringify(body.results)).not.toContain('Flat E draft');
    for (const [filter] of spy.mock.calls) {
      expect(filter.status).toBe('published');
      expect(JSON.stringify(filter)).not.toContain('$where');
    }
  });

  it('falls back to rule-based understanding when the provider fails', async () => {
    config.assistant.anthropicApiKey = 'test-key-not-used';
    const llm = jest.fn().mockResolvedValue(null);
    const body = await handleTurn({ message: 'buy a 3 BHK flat in Jaipur under 70 lakh' }, { llm });
    expect(body.aiUsed).toBe(false);
    expect(body.state.prefs.city).toBe('Jaipur');
    expect(body.results.exact.length).toBeGreaterThan(0);
  });

  it('works with no API key: the provider is never called and results come from the database', async () => {
    expect(config.assistant.anthropicApiKey).toBe('');
    const llm = jest.fn();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const find = jest.spyOn(Property, 'find');
    const body = await handleTurn({ message: 'buy a 3 BHK flat in Jaipur under 70 lakh' }, { llm });
    expect(llm).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalled();
    expect(body.aiUsed).toBe(false);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
  });

  it('keeps working, without errors, when the configured provider is unreachable', async () => {
    config.assistant.anthropicApiKey = 'test-key-not-used';
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const body = await handleTurn({ message: 'buy a 3 BHK flat in Jaipur under 70 lakh' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(body.aiUsed).toBe(false);
    expect(body.messages.join(' ')).not.toMatch(/error|api key|anthropic/i);
    expect(titles(body.results.exact).sort()).toEqual(['Flat A', 'Flat B']);
    expect(errors).not.toHaveBeenCalled();
  });

  it('rebuilds tampered client state from validated fields only', async () => {
    const res = await turn({
      state: {
        prefs: { intent: 'buy', propertyType: 'plot', city: 'Jaipur', status: 'draft', $where: '1', minPrice: -5, maxPrice: 'x' },
        skipped: ['budget', 'everything'],
        expecting: 'drop table',
        searched: 'yes',
        lastStats: { maxPrice: 'big' },
      },
      action: { type: 'search' },
    });
    expect(res.status).toBe(200);
    expect(res.body.state.prefs).toEqual({ intent: 'buy', propertyType: 'plot', city: 'Jaipur' });
    expect(res.body.state.skipped).not.toContain('everything');
    expect(titles(res.body.results.exact).sort()).toEqual(['Plot 1', 'Plot 2', 'Plot pricey']);
  });

  it('ignores unsupported actions and patches', async () => {
    const res = await turn({
      action: { type: 'patch', prefs: { intent: 'sell', status: 'draft', city: 'Jaipur', maxPrice: 1e30 } },
    });
    expect(res.status).toBe(200);
    expect(res.body.state.prefs).toEqual({ city: 'Jaipur' });
    expect(res.body.ignored.length).toBeGreaterThanOrEqual(3);

    const bad = await turn({ action: { type: 'drop-database' } });
    expect(bad.status).toBe(200);
    expect(bad.body.ignored).toContainEqual({ field: 'action', reason: 'unsupported action' });
  });
});

describe('rule-based understanding', () => {
  const catalog = {
    cities: [{ city: 'Jaipur', cityLower: 'jaipur', count: 1 }, { city: 'Bengaluru', cityLower: 'bengaluru', count: 1 }],
    localities: [{ city: 'Jaipur', cityLower: 'jaipur', locality: 'Malviya Nagar', localityLower: 'malviya nagar', count: 1 }],
  };
  const read = (text, extra = {}) => extractRules(text, { catalog, ...extra }).patch;

  it('reads Indian budget units', () => {
    expect(read('under 1.5 cr')).toMatchObject({ maxPrice: 15_000_000 });
    expect(read('budget 70 lakh')).toMatchObject({ maxPrice: 7_000_000 });
    expect(read('between 50 and 80 lakh')).toMatchObject({ minPrice: 5_000_000, maxPrice: 8_000_000 });
    expect(read('rent below 25k per month')).toMatchObject({ maxPrice: 25_000 });
    expect(read('above ₹2 crore')).toMatchObject({ minPrice: 20_000_000 });
    expect(read('under ₹70,00,000')).toMatchObject({ maxPrice: 7_000_000 });
  });

  it('does not mistake BHK or area numbers for a budget', () => {
    const patch = read('3 BHK flat of 1200 sqft in Jaipur');
    expect(patch).toMatchObject({ bhk: 3, minAreaSqft: 1020, maxAreaSqft: 1380, city: 'Jaipur' });
    expect(patch.maxPrice).toBeUndefined();
  });

  it('converts area units to square feet', () => {
    expect(read('200 sq yd plot')).toMatchObject({ propertyType: 'plot', areaUnit: 'sqyd', intent: 'buy' });
    expect(read('at least 1 acre')).toMatchObject({ minAreaSqft: 43560, areaUnit: 'acre' });
  });

  it('understands city aliases and localities', () => {
    expect(read('flat in bangalore')).toMatchObject({ city: 'Bengaluru' });
    expect(read('flat in Malviya Nagar')).toMatchObject({ locality: 'Malviya Nagar' });
  });

  it('flags a bare number as ambiguous rather than guessing', () => {
    const result = extractRules('under 70', { catalog });
    expect(result.patch.maxPrice).toBeUndefined();
    expect(result.ambiguous).toContainEqual(expect.objectContaining({ field: 'budget', reason: 'missing-unit' }));
  });
});
