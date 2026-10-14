const { validateImportItem, normalizeSourceUrl } = require('../src/utils/importProperty');

const IMAGES = [1, 2, 3, 4, 5].map((n) => `https://cdn.example.com/photo-${n}.jpg`);

// No database needed: validateImportItem is a pure function.
function validItem(overrides = {}) {
  return {
    source: '99acres',
    sourceUrl: 'https://www.99acres.com/example-1',
    title: '2 BHK Apartment for Rent in Koregaon Park',
    intent: 'rent',
    propertyType: 'apartment',
    areaSqft: 1100,
    priceInRupees: 42000,
    city: 'Pune',
    contactNumber: '9876543210',
    imageUrls: IMAGES,
    ...overrides,
  };
}

describe('validateImportItem: valid items', () => {
  it('accepts a minimal item and fills only optional defaults', () => {
    const { value, errors, warnings } = validateImportItem(validItem());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(value).toEqual({
      source: '99acres',
      sourceUrl: 'https://www.99acres.com/example-1',
      title: '2 BHK Apartment for Rent in Koregaon Park',
      intent: 'rent',
      propertyType: 'apartment',
      areaSqft: 1100,
      priceInRupees: 42000,
      city: 'Pune',
      cityLower: 'pune',
      locality: null,
      description: '',
      bhk: null,
      bathrooms: null,
      balconies: null,
      floor: null,
      furnished: null,
      facing: null,
      yearOfConstruction: null,
      ownership: null,
      isLuxury: false,
      amenities: [],
      contactNumber: '9876543210',
      importImageUrls: IMAGES,
      imageImportStatus: 'pending',
    });
  });

  it('accepts a full item', () => {
    const { value, errors } = validateImportItem(
      validItem({
        locality: 'Koregaon Park',
        description: 'Spacious, well-lit flat close to the metro.',
        bhk: 2, bathrooms: 2, balconies: 1, floor: 0,
        furnished: 'semi-furnished', facing: 'north-east',
        yearOfConstruction: 2018, ownership: 'Freehold', isLuxury: true,
        amenities: ['Parking', 'Lift'], contactNumber: '+91 98765-43210',
      })
    );
    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      locality: 'Koregaon Park', bhk: 2, floor: 0, furnished: 'semi-furnished', facing: 'north-east',
      ownership: 'Freehold', isLuxury: true, amenities: ['Parking', 'Lift'], contactNumber: '9876543210',
    });
  });

  it('treats null optional fields as not provided', () => {
    const { value, errors } = validateImportItem(
      validItem({ description: null, locality: null, bhk: null, amenities: null, furnished: null })
    );
    expect(errors).toEqual([]);
    expect(value).toMatchObject({ description: '', locality: null, bhk: null, amenities: [], furnished: null });
  });

  it('accepts an empty description', () => {
    expect(validateImportItem(validItem({ description: '' })).errors).toEqual([]);
  });

  it('trims text and builds the lowercase city field', () => {
    const { value } = validateImportItem(
      validItem({
        source: '  99acres ', title: '  Nice flat in Pune  ', city: '  New   Delhi ', locality: ' Dwarka ',
        amenities: [' Gym ', '', '  '], ownership: '  Leasehold ',
      })
    );
    expect(value).toMatchObject({
      source: '99acres', title: 'Nice flat in Pune', city: 'New   Delhi', cityLower: 'new delhi',
      locality: 'Dwarka', amenities: ['Gym'], ownership: 'Leasehold',
    });
  });

  it('does not change the object it was given', () => {
    const item = validItem({ title: '  Padded title  ', sourceUrl: 'HTTPS://Example.com/a/?utm_source=x#top' });
    const copy = JSON.parse(JSON.stringify(item));
    validateImportItem(item);
    expect(item).toEqual(copy);
  });
});

describe('validateImportItem: errors', () => {
  it('reports every missing required field at once', () => {
    const { value, errors } = validateImportItem({});
    expect(value).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([
        'source is required',
        'sourceUrl is required',
        'title is required',
        expect.stringContaining('intent must be one of'),
        expect.stringContaining('propertyType must be one of'),
        'areaSqft must be a non-negative number',
        'priceInRupees must be a non-negative number',
        'city is required',
        'contactNumber is required',
        'imageUrls is required',
      ])
    );
    expect(errors).toHaveLength(10);
  });

  it('collects several different problems, not just the first', () => {
    const { errors } = validateImportItem(
      validItem({ title: 'abc', intent: 'lease', areaSqft: '1100', bhk: -1, furnished: 'half', description: 'too short' })
    );
    expect(errors).toEqual([
      'title must be at least 5 characters',
      'intent must be one of: buy, rent',
      'areaSqft must be a non-negative number',
      'bhk must be a non-negative number',
      'description must be at least 20 characters',
      'furnished must be one of: furnished, semi-furnished, unfurnished',
    ]);
  });

  it.each([
    ['intent', 'sale'],
    ['propertyType', 'flat'],
  ])('rejects an unknown %s', (field, bad) => {
    expect(validateImportItem(validItem({ [field]: bad })).errors).toEqual([
      expect.stringContaining(`${field} must be one of`),
    ]);
  });

  it.each([
    ['areaSqft', '1100'],
    ['priceInRupees', '25,000'],
    ['areaSqft', -5],
    ['priceInRupees', Infinity],
    ['priceInRupees', NaN],
  ])('rejects %s = %p', (field, bad) => {
    expect(validateImportItem(validItem({ [field]: bad })).errors).toHaveLength(1);
  });

  it('rejects zero area and zero price with a clear message', () => {
    const { errors } = validateImportItem(validItem({ areaSqft: 0, priceInRupees: 0 }));
    expect(errors).toEqual(['areaSqft must be greater than 0', 'priceInRupees must be greater than 0']);
  });

  it('rejects a whitespace-only city, title and source', () => {
    const { errors } = validateImportItem(validItem({ city: '   ', title: '     ', source: '  ' }));
    expect(errors).toEqual(expect.arrayContaining(['city is required', 'source is required']));
    expect(errors.some((e) => e.startsWith('title'))).toBe(true);
  });

  it('rejects a source longer than 100 characters', () => {
    expect(validateImportItem(validItem({ source: 'x'.repeat(101) })).errors).toEqual([
      'source must be at most 100 characters',
    ]);
  });

  it.each([
    ['ftp://example.com/a'],
    ['not a url'],
    ['/relative/path'],
    ['javascript:alert(1)'],
    [12345],
  ])('rejects sourceUrl %p', (bad) => {
    expect(validateImportItem(validItem({ sourceUrl: bad })).errors).toHaveLength(1);
  });

  it('rejects a sourceUrl longer than 2048 characters', () => {
    const { errors } = validateImportItem(validItem({ sourceUrl: `https://example.com/${'a'.repeat(2050)}` }));
    expect(errors).toEqual(['sourceUrl must be at most 2048 characters']);
  });

  it('rejects a bad phone, year, amenities and description length', () => {
    const { errors } = validateImportItem(
      validItem({ contactNumber: '12345', yearOfConstruction: 1700, amenities: ['ok', 5], description: 'x'.repeat(2001) })
    );
    expect(errors).toEqual([
      'description must be at most 2000 characters',
      'contactNumber must be a valid 10-digit Indian mobile number',
      'amenities must be an array of strings',
      'yearOfConstruction must be a valid year',
    ]);
  });

  it.each([[null], [undefined], ['text'], [42], [[1, 2]]])('rejects a non-object item %p', (bad) => {
    expect(validateImportItem(bad)).toEqual({ value: null, errors: ['item must be an object'], warnings: [] });
  });
});

describe('validateImportItem: ignored fields', () => {
  it('lists unknown and server-controlled fields as warnings and drops them', () => {
    const { value, errors, warnings } = validateImportItem(
      validItem({ agentName: 'Ravi', status: 'published', ownerId: 'abc', verified: true, slug: 'x', images: ['a.jpg'], proprtyType: 'villa' })
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual(['agentName', 'status', 'ownerId', 'verified', 'slug', 'images', 'proprtyType']);
    for (const field of ['agentName', 'status', 'ownerId', 'verified', 'slug', 'images', 'proprtyType']) {
      expect(value).not.toHaveProperty(field);
    }
  });

  it('still reports warnings when the item has errors', () => {
    const { value, errors, warnings } = validateImportItem({ titel: 'typo' });
    expect(value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(warnings).toEqual(['titel']);
  });
});

describe('normalizeSourceUrl', () => {
  it.each([
    ['https://WWW.Example.com/Listing/42', 'https://www.example.com/Listing/42'],
    ['https://example.com/a/', 'https://example.com/a'],
    ['https://example.com/a///', 'https://example.com/a'],
    ['https://example.com/', 'https://example.com'],
    ['https://example.com/a#photos', 'https://example.com/a'],
    ['https://example.com/a?utm_source=x&utm_medium=y', 'https://example.com/a'],
    ['https://example.com/a?id=7&utm_campaign=z&fbclid=1', 'https://example.com/a?id=7'],
    ['https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2'],
    ['https://example.com/a?UTM_Source=x', 'https://example.com/a'],
    ['http://example.com:80/a', 'http://example.com/a'],
    ['https://user:pass@example.com/a', 'https://example.com/a'],
    ['  https://example.com/a  ', 'https://example.com/a'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSourceUrl(input)).toBe(expected);
  });

  it('gives the same key for URLs that differ only by tracking and slash', () => {
    const a = normalizeSourceUrl('https://Example.com/p/9/?utm_source=a#x');
    const b = normalizeSourceUrl('https://example.com/p/9');
    expect(a).toBe(b);
  });

  it('keeps path case, because paths are case-sensitive', () => {
    expect(normalizeSourceUrl('https://example.com/A')).not.toBe(normalizeSourceUrl('https://example.com/a'));
  });

  it.each([['ftp://x.com'], ['nope'], [''], [null], [undefined], [5]])('returns null for %p', (bad) => {
    expect(normalizeSourceUrl(bad)).toBeNull();
  });

  it('is applied to the saved value', () => {
    const { value } = validateImportItem(validItem({ sourceUrl: 'HTTPS://Example.COM/a/?utm_source=x#top' }));
    expect(value.sourceUrl).toBe('https://example.com/a');
  });
});
