const { parseCsv } = require('../scripts/seedData/parseCsv');
const { parsePrice, parseArea, parseFloor, parseFacing, transformRow, deriveLocations } = require('../scripts/seedData/transformDataset');

describe('dataset transform', () => {
  it('parses prices in rupees, lac and crore', () => {
    expect(parsePrice('70,000')).toBe(70000);
    expect(parsePrice('1.4 Lac')).toBe(140000);
    expect(parsePrice('1.2 Cr')).toBe(12000000);
    expect(parsePrice('Call for Price')).toBeNull();
  });

  it('takes the first number of the area column', () => {
    expect(parseArea('750 12800')).toBe(750);
    expect(parseArea('')).toBeNull();
  });

  it('normalises floor and facing', () => {
    expect(parseFloor('Ground')).toBe(0);
    expect(parseFloor('Lower Basement')).toBe(-1);
    expect(parseFloor('7')).toBe(7);
    expect(parseFacing('South -West')).toBe('south-west');
    expect(parseFacing('North - East')).toBe('north-east');
    expect(parseFacing('')).toBeNull();
  });

  it('parses quoted CSV fields', () => {
    const [row] = parseCsv('A,B\n"x, y","say ""hi"""\n');
    expect(row).toEqual({ A: 'x, y', B: 'say "hi"' });
  });

  it('maps a row to a property document', () => {
    const { doc } = transformRow(
      {
        Title: '3BHK Multistorey Apartment for Rent in Lodha Park at Worli',
        Price: '1.9 Lac',
        Area: '1592 12800',
        BHK: '3',
        Bathrooms: '3',
        Furnished: 'Semi-Furnished',
        Balconies: '',
        Floor: '20',
        Ownership: 'Freehold',
        Facing: 'North - East',
        Amenities: 'Garden/Park, Pool',
        'Transaction Type': 'Rent',
        'Property Type': 'Studio Apartment',
        Location: 'Mumbai',
        'Year of Construction': '2010',
        'Is Luxury': 'T',
        Description: '3 BHK is available for Rent in Worli, Mumbai for 1.85 Lac(s)',
        'Property Image': 'a.jpg',
      },
      5
    );
    expect(doc).toMatchObject({
      intent: 'rent',
      propertyType: 'studio',
      priceInRupees: 190000,
      areaSqft: 1592,
      locality: 'Worli',
      furnished: 'semi-furnished',
      facing: 'north-east',
      balconies: null,
      floor: 20,
      isLuxury: true,
      amenities: ['Garden/Park', 'Pool'],
      cityLower: 'mumbai',
    });
    expect(doc.slug.endsWith('-5')).toBe(true);
  });

  it('skips rows without a usable price', () => {
    expect(transformRow({ Title: 'x', Price: 'Call for Price', Area: '100' }, 1).skipped).toBeTruthy();
  });

  it('counts listings per city and locality', () => {
    const locations = deriveLocations([
      { city: 'Mumbai', locality: 'Worli' },
      { city: 'Mumbai', locality: 'Worli' },
      { city: 'Mumbai', locality: null },
    ]);
    expect(locations.find((l) => l.locality === 'Worli').activeListingCount).toBe(2);
    expect(locations.find((l) => l.locality === null).activeListingCount).toBe(3);
  });
});
