const {
  SeedValidationError,
  transformProperty,
  transformLocation,
  transformCategory,
  transformProject,
  transformArticle,
} = require('../scripts/seedData/transform');
const { loadMockData, MOCK_DATA_PATH } = require('../scripts/seedData/loadMockData');

describe('seed data transforms (no MongoDB required)', () => {
  describe('transformProperty', () => {
    const validMock = {
      id: 'p1',
      slug: 'test-slug',
      title: 'Test property',
      intent: 'buy',
      propertyType: 'apartment',
      bhk: 3,
      priceInRupees: 18500000,
      areaSqft: 1650,
      city: 'Bengaluru',
      locality: 'Koramangala',
      amenities: ['Parking', 'Lift'],
      image: { src: 'https://picsum.photos/seed/p1/800/600', alt: 'Living room' },
      verified: true,
      featured: true,
      featuredRank: 1,
      publishedAt: '2026-09-10',
      status: 'published',
    };

    it('converts publishedAt to a Date', () => {
      const { doc } = transformProperty(validMock);
      expect(doc.publishedAt).toBeInstanceOf(Date);
      expect(doc.publishedAt.toISOString().startsWith('2026-09-10')).toBe(true);
    });

    it('preserves the slug and ranks', () => {
      const { doc } = transformProperty(validMock);
      expect(doc.slug).toBe('test-slug');
      expect(doc.featuredRank).toBe(1);
    });

    it('moves image.src/alt into a separate PropertyImage payload, not the property doc', () => {
      const { doc, image } = transformProperty(validMock);
      expect(doc.image).toBeUndefined();
      expect(image).toEqual({
        url: 'https://picsum.photos/seed/p1/800/600',
        alt: 'Living room',
        displayOrder: 0,
      });
    });

    it('adds the normalized cityLower for matching', () => {
      const { doc } = transformProperty({ ...validMock, city: '  New   Delhi ' });
      expect(doc.cityLower).toBe('new delhi');
    });

    it('never invents an ownerId or contactNumber', () => {
      const { doc } = transformProperty(validMock);
      expect(doc.ownerId).toBeNull();
      expect(doc.contactNumber).toBeUndefined();
    });

    it('defaults featuredRank to null when absent', () => {
      const { doc } = transformProperty({ ...validMock, featured: false, featuredRank: null });
      expect(doc.featuredRank).toBeNull();
    });

    it('rejects an invalid intent', () => {
      expect(() => transformProperty({ ...validMock, intent: 'lease' })).toThrow(SeedValidationError);
    });

    it('rejects an invalid propertyType', () => {
      expect(() => transformProperty({ ...validMock, propertyType: 'houseboat' })).toThrow(SeedValidationError);
    });

    it('rejects an invalid status', () => {
      expect(() => transformProperty({ ...validMock, status: 'live' })).toThrow(SeedValidationError);
    });

    it('rejects a missing slug', () => {
      expect(() => transformProperty({ ...validMock, slug: '' })).toThrow(SeedValidationError);
    });

    it('rejects a non-numeric price or area', () => {
      expect(() => transformProperty({ ...validMock, priceInRupees: '18500000' })).toThrow(SeedValidationError);
      expect(() => transformProperty({ ...validMock, areaSqft: null })).toThrow(SeedValidationError);
    });

    it('rejects a non-numeric featuredRank', () => {
      expect(() => transformProperty({ ...validMock, featuredRank: 'first' })).toThrow(SeedValidationError);
    });
  });

  describe('transformLocation', () => {
    it('maps image.src/alt to imageUrl/imageAlt and preserves popularRank', () => {
      const { doc } = transformLocation({
        id: 'l1',
        city: 'Bengaluru',
        image: { src: 'https://picsum.photos/seed/loc/800/600', alt: 'Skyline of Bengaluru' },
        activeListingCount: 1240,
        popular: true,
        popularRank: 1,
      });
      expect(doc).toEqual({
        city: 'Bengaluru',
        cityLower: 'bengaluru',
        locality: null,
        localityLower: null,
        activeListingCount: 1240,
        popular: true,
        popularRank: 1,
        imageUrl: 'https://picsum.photos/seed/loc/800/600',
        imageAlt: 'Skyline of Bengaluru',
      });
    });

    it('rejects a non-numeric activeListingCount', () => {
      expect(() =>
        transformLocation({ id: 'l1', city: 'Bengaluru', activeListingCount: 'lots', popular: true, popularRank: 1 })
      ).toThrow(SeedValidationError);
    });
  });

  describe('transformCategory', () => {
    it('preserves slug and listingCount', () => {
      const { doc } = transformCategory({ id: 'c1', name: 'Apartments', slug: 'apartment', listingCount: 4210, icon: 'building' });
      expect(doc).toEqual({ name: 'Apartments', slug: 'apartment', listingCount: 4210, icon: 'building' });
    });
  });

  describe('transformLocation normalized fields', () => {
    it('adds cityLower and localityLower, with null locality staying null', () => {
      const base = { id: 'l2', city: ' Mumbai ', activeListingCount: 1 };
      expect(transformLocation({ ...base, locality: 'Andheri  West' }).doc).toEqual(
        expect.objectContaining({ cityLower: 'mumbai', localityLower: 'andheri west' })
      );
      expect(transformLocation(base).doc).toEqual(
        expect.objectContaining({ cityLower: 'mumbai', localityLower: null })
      );
    });
  });

  describe('transformProject', () => {
    const validMock = {
      id: 'pr1',
      name: 'Emerald Heights',
      developer: 'Vantage Developers',
      city: 'Bengaluru',
      locality: 'Sarjapur Road',
      image: { src: 'https://picsum.photos/seed/proj-1/800/600', alt: 'Rendering' },
      startingPriceInRupees: 7500000,
      possessionLabel: 'Dec 2027',
      publishedAt: '2026-09-17',
      status: 'published',
    };

    it('transforms a valid project', () => {
      const { doc } = transformProject(validMock);
      expect(doc.name).toBe('Emerald Heights');
      expect(doc.publishedAt).toBeInstanceOf(Date);
      expect(doc.imageUrl).toBe('https://picsum.photos/seed/proj-1/800/600');
    });

    it('adds the normalized cityLower for matching', () => {
      expect(transformProject({ ...validMock, city: 'BENGALURU ' }).doc.cityLower).toBe('bengaluru');
    });

    it('rejects an invalid status', () => {
      expect(() => transformProject({ ...validMock, status: 'live' })).toThrow(SeedValidationError);
    });

    it('rejects a non-numeric startingPriceInRupees', () => {
      expect(() => transformProject({ ...validMock, startingPriceInRupees: 'a lot' })).toThrow(SeedValidationError);
    });
  });

  describe('transformArticle', () => {
    it('preserves the slug and converts publishedAt to a Date', () => {
      const { doc } = transformArticle({
        id: 'a1',
        title: "A first-time buyer's checklist",
        excerpt: 'The documents to verify.',
        image: { src: 'https://picsum.photos/seed/article-1/800/600', alt: 'Reviewing documents' },
        publishedAt: '2026-09-15',
        slug: 'first-time-buyers-checklist',
        status: 'published',
      });
      expect(doc.slug).toBe('first-time-buyers-checklist');
      expect(doc.publishedAt).toBeInstanceOf(Date);
    });

    it('rejects an invalid status', () => {
      expect(() =>
        transformArticle({ id: 'a1', title: 'X', slug: 'x', publishedAt: '2026-09-15', status: 'pinned' })
      ).toThrow(SeedValidationError);
    });

    it('rejects a missing slug', () => {
      expect(() =>
        transformArticle({ id: 'a1', title: 'X', slug: '', publishedAt: '2026-09-15', status: 'draft' })
      ).toThrow(SeedValidationError);
    });
  });
});

describe('loadMockData (reads the frontend file directly, no MongoDB required)', () => {
  it('points at frontend/src/lib/mockData.js', () => {
    expect(MOCK_DATA_PATH.replace(/\\/g, '/')).toMatch(/frontend\/src\/lib\/mockData\.js$/);
  });

  it('loads all expected exports from the real frontend mock data file', () => {
    const mockData = loadMockData();
    expect(Array.isArray(mockData.MOCK_PROPERTIES)).toBe(true);
    expect(mockData.MOCK_PROPERTIES.length).toBeGreaterThan(0);
    expect(Array.isArray(mockData.MOCK_LOCATIONS)).toBe(true);
    expect(Array.isArray(mockData.MOCK_CATEGORIES)).toBe(true);
    expect(Array.isArray(mockData.MOCK_PROJECTS)).toBe(true);
    expect(Array.isArray(mockData.MOCK_ARTICLES)).toBe(true);
  });

  it('produces mock properties that transformProperty can validate without throwing', () => {
    const mockData = loadMockData();
    for (const mock of mockData.MOCK_PROPERTIES) {
      expect(() => transformProperty(mock)).not.toThrow();
    }
  });
});
